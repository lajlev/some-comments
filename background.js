// Listen for changes in storage
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && "butlerMode" in changes) {
    const newButlerModeState = changes.butlerMode.newValue;
    const oldButlerModeState = changes.butlerMode.oldValue;

    if (newButlerModeState !== oldButlerModeState) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          const action = newButlerModeState ? "startButler" : "stopButler";
          chrome.tabs.sendMessage(tabs[0].id, { action });
        }
      });
    }
  }
});

// Background service worker for Instagram Comment AI Extension

// Listen for messages from content script (keyboard shortcut)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "triggerGeneration") {
    generateComment(sender.tab.id, request.commentId, request.butlerMode);
  }
});

async function generateComment(tabId, commentId, butlerMode = false) {
  try {
    console.log("[IG Comment AI] generateComment called for tab:", tabId);
    console.log("[IG Comment AI] Butler Mode:", butlerMode);

    // Use provided tabId from content script
    const tab = { id: tabId };

    // Get settings from storage
    const settings = await chrome.storage.local.get([
      "openaiApiKey",
      "model",
      "systemPrompt",
      "userPrompt",
    ]);

    console.log(
      "[IG Comment AI] Settings loaded, has API key:",
      !!settings.openaiApiKey,
    );

    if (!settings.openaiApiKey) {
      // Open popup to configure API key
      chrome.action.openPopup();
      return;
    }

    console.log(
      "[IG Comment AI] Requesting post context from content script...",
    );

    // Get post context from content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "getPostContext",
    });

    if (response.error) {
      console.error(
        "[IG Comment AI] Error getting post context:",
        response.error,
      );
      await chrome.tabs.sendMessage(tab.id, {
        action: "showError",
        message: response.error,
      });
      return;
    }

    console.log("[IG Comment AI] Post context:", {
      caption: response.caption,
      hasImage: response.hasImage,
      imageBase64Length: response.imageBase64?.length,
      hashtags: response.hashtags,
      butlerMode: butlerMode,
    });

    // If Butler mode, check if post is board game related
    if (butlerMode) {
      const boardGameCheck = await checkIfBoardGameRelated(settings, response);
      if (!boardGameCheck.isBoardGame) {
        console.log("[IG Butler] Post is not board game related, skipping");
        // Send AI vision analysis to content script for logging
        await chrome.tabs.sendMessage(tab.id, {
          action: "logAIVision",
          analysis: boardGameCheck.analysis,
          isBoardGame: false,
        });
        await chrome.tabs.sendMessage(tab.id, {
          action: "showError",
          message: "Skipping - not board game related",
        });
        return;
      }
      console.log("[IG Butler] Post is board game related, proceeding");
      // Send AI vision analysis to content script for logging
      await chrome.tabs.sendMessage(tab.id, {
        action: "logAIVision",
        analysis: boardGameCheck.analysis,
        isBoardGame: true,
      });
    }

    // Generate comment using OpenAI API
    const comment = await callOpenAI(settings, response);

    if (comment) {
      // Insert the generated comment
      await chrome.tabs.sendMessage(tab.id, {
        action: "insertComment",
        comment: comment,
        commentId: commentId,
      });
    } else {
      // AI decided to skip - clean up without showing error
      console.log(
        "[IG Comment AI] Skipping post - AI could not generate relevant comment",
      );
      await chrome.tabs.sendMessage(tab.id, {
        action: "showError",
        message: "Could not generate relevant comment for this post.",
      });
    }
  } catch (error) {
    console.error("[IG Comment AI] Error generating comment:", error);
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: "showError",
        message: "Failed to generate comment. Check console for details.",
      });
    } catch (e) {
      console.error("[IG Comment AI] Could not show error notification:", e);
    }
  }
}

async function checkIfBoardGameRelated(settings, postContext) {
  try {
    const detectionPrompt = `Analyze this Instagram post and determine if it is related to board games, tabletop games, card games, or the board gaming hobby.

Caption: ${postContext.caption || "No caption"}
Hashtags: ${postContext.hashtags?.join(" ") || "No hashtags"}

Look for:
- Images of board games, game components, dice, cards, miniatures
- Discussions about board gaming
- Board game reviews, unboxings, or gameplay
- Board game community content
- Tabletop gaming events or meetups

First, describe what you see in the image in 1-2 sentences.
Then respond with "YES" if this post is board game related, or "NO" if it is not.

Format:
IMAGE: [what you see]
RESULT: [YES or NO]`;

    let userContent;
    if (postContext.imageBase64 && postContext.hasImage) {
      userContent = [
        {
          type: "text",
          text: detectionPrompt,
        },
        {
          type: "image_url",
          image_url: {
            url: postContext.imageBase64,
            detail: "low",
          },
        },
      ];
    } else {
      userContent = detectionPrompt;
    }

    const model = settings.model || "gpt-4o-mini";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content:
              "You are a board game content detector. First describe what you see in the image, then respond with YES or NO.",
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        max_tokens: 100,
        temperature: 0.3, // Low temperature for consistent detection
      }),
    });

    if (!response.ok) {
      console.error("[IG Butler] Board game detection API error");
      return { isBoardGame: false, analysis: "API error" }; // Skip if detection fails
    }

    const data = await response.json();
    const fullResponse = data.choices[0].message.content.trim();

    console.log("[IG Butler] AI Vision Analysis:");
    console.log(fullResponse);

    const resultUpper = fullResponse.toUpperCase();
    const isBoardGame =
      resultUpper.includes("RESULT: YES") ||
      (resultUpper.includes("YES") && !resultUpper.includes("RESULT: NO"));

    console.log(
      "[IG Butler] Board game detection:",
      isBoardGame ? "YES ✓" : "NO ✗",
    );

    return {
      isBoardGame: isBoardGame,
      analysis: fullResponse,
    };
  } catch (error) {
    console.error("[IG Butler] Error checking board game content:", error);
    return { isBoardGame: false, analysis: "Error occurred" }; // Skip if error occurs
  }
}

async function callOpenAI(settings, postContext) {
  try {
    // Default prompts (same as in popup.js)
    const DEFAULT_USER_PROMPT = `Generate a friendly, relevant, and engaging Instagram comment for this post.

{caption}

{hashtags}

CRITICAL REQUIREMENTS:
- MUST reference SPECIFIC details from BOTH the image AND the caption text
- If you cannot see the image or understand the caption, respond with "SKIP"
- Comment must be directly related to what you see and read
- NO generic comments like "Great post!" or "Love this!"

Generate a comment that:
- Is 1-2 sentences long
- Feels natural and authentic
- References specific visual elements from the image (colors, objects, people, setting, etc.)
- References specific text elements from the caption (topics, emotions, story, etc.)
- Is positive and encouraging
- Does not use excessive emojis (max 1-2)
- Sounds like a real person, not AI-generated
- Uses VARIED vocabulary and sentence structures
- Avoids repetitive phrases like "love the", "great shot", "amazing", etc.
- Takes a FRESH approach each time (ask questions, share observations, express emotions, etc.)

Comment:`;

    const DEFAULT_SYSTEM_PROMPT =
      "You are a helpful assistant that generates natural, authentic Instagram comments. Keep comments brief, friendly, and relevant to the post content and images. NEVER generate generic comments. Always reference specific details from both the image and caption. CRITICAL: Each comment must be UNIQUE and DIVERSE - never use the same phrases, structures, or patterns repeatedly. Vary your sentence structure, vocabulary, tone, and approach for every comment. If you cannot generate a relevant and unique comment, respond with exactly 'SKIP'.";

    // Get user prompt template or use default
    let userPromptTemplate = settings.userPrompt || DEFAULT_USER_PROMPT;

    // Replace placeholders in user prompt
    let captionText = "";
    if (postContext.caption) {
      captionText = `Post caption: ${postContext.caption}`;
    }

    let hashtagsText = "";
    if (postContext.hashtags && postContext.hashtags.length > 0) {
      hashtagsText = `Hashtags: ${postContext.hashtags.join(" ")}`;
    }

    let textPrompt = userPromptTemplate
      .replace("{caption}", captionText)
      .replace("{hashtags}", hashtagsText);

    // Build message content with image if available
    let userContent;
    if (postContext.imageBase64 && postContext.hasImage) {
      // Use vision model with image (base64 data URL)
      console.log(
        "[IG Comment AI] Sending request with image, base64 length:",
        postContext.imageBase64.length,
      );
      userContent = [
        {
          type: "text",
          text: textPrompt,
        },
        {
          type: "image_url",
          image_url: {
            url: postContext.imageBase64, // Base64 data URL
            detail: "low", // Use low detail for faster/cheaper processing
          },
        },
      ];
    } else {
      // Text only if no image
      console.log("[IG Comment AI] Sending request without image (text only)");
      userContent = textPrompt;
    }

    const model = settings.model || "gpt-4o-mini";
    const systemPrompt = settings.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        max_tokens: 100,
        temperature: 1.0, // Higher temperature for more diverse responses
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[IG Comment AI] OpenAI API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });

      // Extract meaningful error message
      const errorMessage =
        errorData?.error?.message || `API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const comment = data.choices[0].message.content.trim();

    console.log("[IG Comment AI] Generated comment:", comment);

    // Check if AI decided to skip this post
    if (comment === "SKIP" || comment.includes("SKIP")) {
      console.log(
        "[IG Comment AI] AI could not generate relevant comment, skipping post",
      );
      return null; // Don't post anything
    }

    return comment;
  } catch (error) {
    console.error("[IG Comment AI] Error calling OpenAI:", error);
    throw error;
  }
}

console.log("[IG Comment AI] Background service worker loaded");
