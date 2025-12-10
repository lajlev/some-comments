// Content script for Instagram Comment AI Extension

let lastFocusedInput = null;
let extensionValid = true;
let commentId = 0;
let butlerInterval;
let actionsCount = 0;
let commentsCount = 0;
let maxActions = 40;
let maxComments = 10;

function getCommentId() {
  return commentId++;
}

function setLastFocusedInput(element) {
  lastFocusedInput = element;
}

// Check if extension context is valid
function isExtensionValid() {
  try {
    // Try to access chrome.runtime
    if (chrome.runtime && chrome.runtime.id) {
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

// Expand caption by clicking "... more" button
function expandCaption() {
  if (!lastFocusedInput) {
    console.log("[IG Comment AI] No comment input focused, cannot find post");
    return;
  }

  // Find the post container
  let postContainer = lastFocusedInput.closest("article");

  if (!postContainer) {
    postContainer =
      lastFocusedInput.closest('[role="dialog"]') ||
      lastFocusedInput.closest('div[class*="Post"]');
  }

  if (!postContainer) {
    console.log(
      "[IG Comment AI] Could not find post container for caption expansion",
    );
    return;
  }

  // Look for "... more" or "more" buttons/links
  const moreButtons = postContainer.querySelectorAll(
    'button, div[role="button"], span[role="button"]',
  );

  for (const button of moreButtons) {
    const text = button.innerText?.toLowerCase();
    if (
      text &&
      (text.includes("more") || text.includes("…") || text === "more")
    ) {
      console.log(
        "[IG Comment AI] Found 'more' button, clicking to expand caption:",
        button.innerText,
      );

      // Simulate a real click event
      const clickEvent = new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      button.dispatchEvent(clickEvent);

      // Also try direct click in case event dispatch doesn't work
      try {
        button.click();
      } catch (e) {
        console.log("[IG Comment AI] Direct click failed:", e);
      }

      console.log("[IG Comment AI] Caption expansion triggered");
      return;
    }
  }

  console.log(
    "[IG Comment AI] No 'more' button found, caption may already be expanded",
  );
}

// Safe message sender with error handling
async function sendMessageSafely(message) {
  if (!isExtensionValid()) {
    showNotification(
      "Extension was updated. Please refresh the page.",
      "error",
    );
    extensionValid = false;
    return null;
  }

  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (error.message.includes("Extension context invalidated")) {
      showNotification(
        "Extension was updated. Please refresh the page.",
        "error",
      );
      extensionValid = false;
    } else {
      console.error("[IG Comment AI] Message error:", error);
      showNotification(
        "Communication error. Try refreshing the page.",
        "error",
      );
    }
    return null;
  }
}

// Track focused comment input
document.addEventListener(
  "click",
  (e) => {
    // Instagram comment inputs can be textarea or contenteditable divs
    if (
      e.target.matches(
        'textarea[placeholder*="comment" i], textarea[aria-label*="comment" i], div[contenteditable="true"][aria-label*="comment" i]',
      )
    ) {
      lastFocusedInput = e.target;
      console.log("[IG Comment AI] Comment input focused:", e.target);
    }
  },
  true,
);

// Custom keyboard shortcut listener: Cmd + Ctrl + G
document.addEventListener(
  "keydown",
  (e) => {
    // Check for the specific combination:
    // - Command key (Meta on Mac)
    // - Control key
    // - G key (no Shift or Alt)

    if (
      e.metaKey &&
      e.ctrlKey &&
      !e.shiftKey &&
      !e.altKey &&
      e.key.toLowerCase() === "g"
    ) {
      e.preventDefault();
      e.stopPropagation();

      console.log("[IG Comment AI] Keyboard shortcut detected: Cmd+Ctrl+G");

      // Check if extension is still valid
      if (!extensionValid || !isExtensionValid()) {
        showNotification(
          "Extension was updated. Please refresh the page.",
          "error",
        );
        return;
      }

      if (!lastFocusedInput) {
        showNotification(
          "Please click on a comment input field first.",
          "error",
        );
        return;
      }

      // Expand caption by clicking "... more" link if it exists
      expandCaption();

      // Show notification
      showNotification("Generating comment...", "info");

      // Wait for caption expansion, then trigger comment generation
      setTimeout(() => {
        const id = getCommentId();
        lastFocusedInput.dataset.commentId = id;
        sendMessageSafely({ action: "triggerGeneration", commentId: id });
      }, 400);
    }
  },
  true,
);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPostContext") {
    // Handle async function
    extractPostContext()
      .then((context) => {
        sendResponse(context);
      })
      .catch((error) => {
        console.error("[IG Comment AI] Error in getPostContext:", error);
        sendResponse({ error: error.message });
      });
    return true; // Keep channel open for async response
  }

  if (request.action === "insertComment") {
    insertGeneratedComment(request.comment, request.commentId);
    showNotification("Comment generated successfully!", "success");
    return true;
  }

  if (request.action === "showError") {
    showNotification(request.message || "Error generating comment", "error");
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "startButler") {
    startButler();
  } else if (request.action === "stopButler") {
    stopButler();
  }
});

async function extractPostContext() {
  if (!lastFocusedInput) {
    return { error: "No comment input focused" };
  }

  // Find the closest article/post container
  let postContainer = lastFocusedInput.closest("article");

  if (!postContainer) {
    // Try alternative selectors for different Instagram layouts
    postContainer =
      lastFocusedInput.closest('[role="dialog"]') ||
      lastFocusedInput.closest('div[class*="Post"]');
  }

  if (!postContainer) {
    return { error: "Could not find post container" };
  }

  // Extract post caption/text
  // Instagram caption is typically the first comment under the image
  // Note: Caption should already be expanded by expandCaption() called from keyboard shortcut
  let captionText = "";

  // Try to find the caption by looking after the like/bookmark section
  // Method 1: Find the section with like/bookmark buttons, then get the next div
  const likeSection = postContainer.querySelector("section");
  if (likeSection) {
    // The caption is typically in a div that comes after the section
    let captionContainer = likeSection.nextElementSibling;

    // Sometimes there are multiple siblings, try a few
    for (let i = 0; i < 3 && captionContainer; i++) {
      if (captionContainer.tagName === "DIV") {
        // Get the entire text content of this div (includes username + caption)
        const fullText = captionContainer.innerText?.trim();

        if (
          fullText &&
          fullText.length > 10 &&
          !fullText.includes("Suggested for you")
        ) {
          // Try to extract just the caption part (after username)
          // Instagram format is usually: "username Caption text here"
          const lines = fullText.split("\n");

          // If there are multiple lines, the caption might be on subsequent lines
          if (lines.length > 1) {
            // Skip the first line if it's just a username (short, no spaces typically)
            const potentialCaption = lines.slice(1).join("\n").trim();
            if (potentialCaption.length > 5) {
              captionText = potentialCaption;
              console.log(
                "[IG Comment AI] Found caption (multiline) after like section, Length:",
                captionText.length,
              );
              break;
            }
          }

          // If single line or no caption found yet, try to split by space
          // Format: "username rest of caption text"
          if (!captionText) {
            const words = fullText.split(" ");
            if (words.length > 1) {
              // Skip first word (username) and get the rest
              captionText = words.slice(1).join(" ").trim();
              console.log(
                "[IG Comment AI] Found caption (single line) after like section, Length:",
                captionText.length,
              );
              break;
            }
          }
        }
        if (captionText) break;
      }
      captionContainer = captionContainer.nextElementSibling;
    }
  }

  // Method 2: Look for specific Instagram caption patterns
  if (!captionText) {
    const captionSelectors = [
      // First span in the comments section (usually the caption)
      "ul > div > li:first-child span",
      "ul > li:first-child span",
      // Spans with dir="auto" (common Instagram pattern)
      'span[dir="auto"]',
      // Direct h1 elements (stories or specific layouts)
      "h1",
    ];

    for (const selector of captionSelectors) {
      const elements = postContainer.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.innerText?.trim();
        // Skip unwanted texts
        if (
          text &&
          text.length > 10 &&
          text.length > captionText.length &&
          !text.includes("Suggested for you") &&
          !text.includes("View all") &&
          !text.includes("Log in") &&
          !text.includes("Sign up")
        ) {
          // Skip if it's just emoji or numbers
          if (!/^[ -]*$/.test(text)) {
            captionText = text;
            console.log(
              "[IG Comment AI] Found caption using selector:",
              selector,
              "Length:",
              text.length,
            );
            break;
          }
        }
      }
      if (captionText) break;
    }
  }

  // Method 3: Fallback - look for username + text pattern
  if (!captionText) {
    // Instagram captions often have username followed by text
    const possibleCaptions = postContainer.querySelectorAll("span");

    for (const span of possibleCaptions) {
      const text = span.innerText?.trim();

      // Skip UI elements
      if (
        !text ||
        text.includes("Like") ||
        text.includes("Comment") ||
        text.includes("Share") ||
        text.includes("Suggested for you") ||
        text.includes("View all") ||
        text.includes("ago") ||
        text.length < 15
      ) {
        continue;
      }

      // Look for substantial text that could be a caption
      if (text.length > 15 && text.length < 5000) {
        captionText = text;
        console.log(
          "[IG Comment AI] Found caption using fallback method, Length:",
          text.length,
        );
        break;
      }
    }
  }

  // Extract image information
  const images = postContainer.querySelectorAll('img[src*="instagram"]');
  const imageData = [];

  for (const img of images) {
    if (
      img.alt &&
      img.alt !== "Instagram" &&
      !img.alt.includes("avatar") &&
      !img.alt.includes("profile")
    ) {
      imageData.push({
        alt: img.alt,
        src: img.src,
      });
    }
  }

  // Get the first valid image (usually the main post image)
  const mainImage = images.length > 0 ? images[0].src : null;

  // Extract hashtags
  const hashtags = [];
  const hashtagElements = postContainer.querySelectorAll(
    'a[href*="/explore/tags/"]',
  );
  for (const tag of hashtagElements) {
    hashtags.push(tag.innerText);
  }

  // Convert image to base64 if available
  let imageBase64 = null;
  if (mainImage && images.length > 0) {
    try {
      imageBase64 = await imageToBase64(images[0]);
      console.log(
        "[IG Comment AI] Image converted to base64, length:",
        imageBase64?.length,
      );
    } catch (error) {
      console.error("[IG Comment AI] Error converting image to base64:", error);
    }
  }

  return {
    caption: captionText,
    imageBase64: imageBase64,
    imageAlt: imageData.length > 0 ? imageData[0].alt : "",
    hashtags: hashtags, // Return all hashtags
    hasImage: !!imageBase64,
  };
}

// Convert image to base64 data URL
async function imageToBase64(img) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Set canvas size to image size
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      // Draw image to canvas
      ctx.drawImage(img, 0, 0);

      // Convert to base64
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      resolve(dataUrl);
    } catch (error) {
      reject(error);
    }
  });
}

function insertGeneratedComment(comment, commentId) {
  const commentInput = document.querySelector(
    `[data-comment-id='${commentId}']`,
  );
  if (!commentInput) {
    console.error("[IG Comment AI] No comment input to insert into");
    return;
  }

  // Handle both textarea and contenteditable elements
  if (commentInput.tagName === "TEXTAREA") {
    commentInput.value = comment;
    commentInput.dispatchEvent(new Event("input", { bubbles: true }));
    commentInput.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (commentInput.isContentEditable) {
    commentInput.innerText = comment;
    commentInput.dispatchEvent(new Event("input", { bubbles: true }));
    commentInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Focus the input again
  commentInput.focus();

  // Move cursor to end
  if (commentInput.isContentEditable) {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(commentInput);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    commentInput.setSelectionRange(comment.length, comment.length);
  }

  // Click the post button
  setTimeout(() => {
    const postButton = Array.from(
      document.querySelectorAll('div[role="button"]'),
    ).find((btn) => btn.textContent === "Post");
    if (postButton) {
      postButton.click();
      console.log("[IG Butler] Commented on a post");
      commentsCount++;
      actionsCount++;
      chrome.storage.local.get(["butlerStats"], (res) => {
        const stats = res.butlerStats || { likes: 0, follows: 0, comments: 0 };
        stats.comments = commentsCount;
        chrome.storage.local.set({ butlerStats: stats });
      });
    }
  }, 500);
}

// Notification system
function showNotification(message, type = "info") {
  // Remove any existing notification
  const existingNotification = document.getElementById(
    "ig-comment-ai-notification",
  );
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement("div");
  notification.id = "ig-comment-ai-notification";
  notification.textContent = message;

  // Set styles based on type
  const baseStyles = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease-out;
    transition: opacity 0.3s ease-out;
  `;

  const typeStyles = {
    info: "background: #0095f6; color: white;",
    success: "background: #00c853; color: white;",
    error: "background: #ed4956; color: white;",
  };

  notification.style.cssText = baseStyles + typeStyles[type];

  // Add animation keyframes if not already added
  if (!document.getElementById("ig-comment-ai-styles")) {
    const styleSheet = document.createElement("style");
    styleSheet.id = "ig-comment-ai-styles";
    styleSheet.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(styleSheet);
  }

  document.body.appendChild(notification);

  // Auto-remove after 1 second
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 100);
  }, 1000);
}

// Butler mode content script
function startButler() {
  chrome.storage.local.get(["maxActions", "maxComments"], (result) => {
    maxActions = result.maxActions || 40;
    maxComments = result.maxComments || 10;
    actionsCount = 0;
    commentsCount = 0;
    console.log("[IG Butler] Starting butler mode");
    butlerInterval = setInterval(doButlerStuff, 5000); // Run every 5 seconds
  });
}

function stopButler() {
  console.log("[IG Butler] Stopping butler mode");
  clearInterval(butlerInterval);
  chrome.storage.local.set({ butlerMode: false });
}

function doButlerStuff() {
  if (actionsCount >= maxActions) {
    stopButler();
    return;
  }

  // Scroll the page
  window.scrollBy(0, window.innerHeight);

  // Find posts
  const articles = document.querySelectorAll("article");
  articles.forEach((article) => {
    if (actionsCount >= maxActions) {
      stopButler();
      return;
    }

    // 1. Like post
    const likeButton = article.querySelector('svg[aria-label="Like"]');
    if (likeButton) {
      likeButton.parentElement.click();
      console.log("[IG Butler] Liked a post");
      actionsCount++;
      chrome.storage.local.get(["butlerStats"], (res) => {
        const stats = res.butlerStats || { likes: 0, follows: 0, comments: 0 };
        stats.likes++;
        chrome.storage.local.set({ butlerStats: stats });
      });
    }

    // 2. Follow user
    const followButton = Array.from(
      article.querySelectorAll('div[role="button"]'),
    ).find((btn) => btn.textContent === "Follow");
    if (followButton) {
      followButton.click();
      console.log("[IG Butler] Followed a user");
      actionsCount++;
      chrome.storage.local.get(["butlerStats"], (res) => {
        const stats = res.butlerStats || { likes: 0, follows: 0, comments: 0 };
        stats.follows++;
        chrome.storage.local.set({ butlerStats: stats });
      });
    }

    // 3. Comment on post
    if (commentsCount < maxComments) {
      const commentInput = article.querySelector(
        'textarea[placeholder*="comment"]',
      );
      if (
        commentInput &&
        !commentInput.value &&
        !commentInput.dataset.commentId
      ) {
        const id = getCommentId();
        commentInput.dataset.commentId = id;
        setLastFocusedInput(commentInput);
        sendMessageSafely({ action: "triggerGeneration", commentId: id });
      }
    }
  });
}

// Check initial state of butler mode
chrome.storage.local.get(["butlerMode"], (result) => {
  if (result.butlerMode) {
    startButler();
  }
});

console.log("[IG Comment AI] Extension loaded successfully");
