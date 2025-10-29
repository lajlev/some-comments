// Background service worker for Instagram Comment AI Extension

// Listen for messages from content script (keyboard shortcut)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "triggerGeneration") {
    generateComment(sender.tab.id);
  }
});

async function generateComment(tabId) {
  try {
    console.log("[IG Comment AI] generateComment called for tab:", tabId);

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
    });

    // Generate comment using OpenAI API
    const comment = await callOpenAI(settings, response);

    if (comment) {
      // Insert the generated comment
      await chrome.tabs.sendMessage(tab.id, {
        action: "insertComment",
        comment: comment,
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

async function callOpenAI(settings, postContext) {
  try {
    // Default prompts (same as in popup.js)
    const DEFAULT_USER_PROMPT = `Generate a friendly, relevant, and engaging Instagram comment for this post.

{caption}

{hashtags}

Generate a comment that:
- Is 1-2 sentences long
- Feels natural and authentic
- References specific details from both the image and text
- Is positive and encouraging
- Does not use excessive emojis (max 1-2)
- Sounds like a real person, not AI-generated

Comment:`;

    const DEFAULT_SYSTEM_PROMPT =
      "You are a helpful assistant that generates natural, authentic Instagram comments. Keep comments brief, friendly, and relevant to the post content and images.";

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
        temperature: 0.8,
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
    return comment;
  } catch (error) {
    console.error("[IG Comment AI] Error calling OpenAI:", error);
    throw error;
  }
}

console.log("[IG Comment AI] Background service worker loaded");
