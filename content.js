// Content script for Instagram Comment AI Extension

let lastFocusedInput = null;
let extensionValid = true;
let commentId = 0;
let butlerInterval;
let actionsCount = 0;
let commentsCount = 0;
let maxActions = 40;
let maxComments = 10;
let commentedPosts = new Set(); // Track posts we've already commented on
let activeCommentInsertions = new Set(); // Track in-progress comment insertions by commentId
let previousComments = []; // Track last 10 comments to ensure diversity

function getCommentId() {
  return commentId++;
}

function setLastFocusedInput(element) {
  lastFocusedInput = element;
}

// Get unique identifier for a post
function getPostId(element) {
  if (!element) return null;

  // Find the post container
  let postContainer = element.closest("article");
  if (!postContainer) {
    postContainer =
      element.closest('[role="dialog"]') ||
      element.closest('div[class*="Post"]');
  }

  if (!postContainer) return null;

  // Try to find a unique identifier for the post
  // Method 1: Look for post link with shortcode
  const postLink = postContainer.querySelector('a[href*="/p/"]');
  if (postLink) {
    const match = postLink.href.match(/\/p\/([^\/]+)/);
    if (match) return match[1]; // Return shortcode
  }

  // Method 2: Look for timestamp link
  const timeLink = postContainer.querySelector("time[datetime]");
  if (timeLink) {
    const datetime = timeLink.getAttribute("datetime");
    if (datetime) return `time-${datetime}`;
  }

  // Method 3: Use post image src as fallback
  const postImage = postContainer.querySelector('img[src*="instagram"]');
  if (postImage) {
    // Extract a unique part of the image URL
    const urlMatch = postImage.src.match(/\/([^\/]+)\?/);
    if (urlMatch) return `img-${urlMatch[1]}`;
  }

  // Method 4: Generate ID from post content hash (last resort)
  const contentText = postContainer.innerText?.substring(0, 100);
  if (contentText) {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < contentText.length; i++) {
      const char = contentText.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `hash-${hash}`;
  }

  return null;
}

// Check if we've already commented on this post
function hasCommentedOnPost(element) {
  const postId = getPostId(element);
  if (!postId) return false;

  const hasCommented = commentedPosts.has(postId);
  if (hasCommented) {
    console.log("[IG Comment AI] Already commented on post:", postId);
  }
  return hasCommented;
}

// Mark post as commented
function markPostAsCommented(element) {
  const postId = getPostId(element);
  if (postId) {
    commentedPosts.add(postId);
    console.log("[IG Comment AI] Marked post as commented:", postId);
    console.log("[IG Comment AI] Total commented posts:", commentedPosts.size);
  }
}

// Get current logged-in username
function getCurrentUsername() {
  // Method 1: From profile link in nav
  const profileLink = document.querySelector('a[href^="/"][href$="/"]');
  if (profileLink && profileLink.href) {
    const match = profileLink.href.match(/instagram\.com\/([^\/]+)\/?$/);
    if (match && match[1] && match[1] !== "explore" && match[1] !== "direct") {
      return match[1];
    }
  }

  // Method 2: From SVG home icon's parent link
  const homeIcon = document.querySelector('svg[aria-label*="Home"]');
  if (homeIcon) {
    const links = document.querySelectorAll('a[href^="/"]');
    for (const link of links) {
      const href = link.getAttribute("href");
      if (
        href &&
        href !== "/" &&
        !href.includes("/explore") &&
        !href.includes("/direct") &&
        !href.includes("/reels")
      ) {
        const match = href.match(/^\/([^\/]+)\/?$/);
        if (match) return match[1];
      }
    }
  }

  return null;
}

// Check if post has any comments (return true if NO comments)
function postHasNoComments(element) {
  if (!element) return true;

  const postContainer = element.closest("article");
  if (!postContainer) return true;

  // Look for comment section
  // Instagram shows "View all X comments" or comment counts
  const viewCommentsLink = postContainer.querySelector('[role="button"]');
  const commentText = postContainer.innerText;

  // Check for "No comments yet" or absence of comment indicators
  if (commentText.includes("No comments yet")) {
    return true;
  }

  // Look for existing comment elements
  const commentsList = postContainer.querySelector("ul");
  if (commentsList) {
    // Check if there are any comment items (excluding the caption)
    const commentItems = commentsList.querySelectorAll("li");
    // First li is usually the caption, so if there's only 1 or 0, no comments
    if (commentItems.length <= 1) {
      return true;
    }
  }

  return false;
}

// Check if post is by current user
function isOwnPost(element) {
  if (!element) return false;

  const currentUsername = getCurrentUsername();
  if (!currentUsername) return false;

  const postContainer = element.closest("article");
  if (!postContainer) return false;

  // Look for the author's username in the post header
  const authorLink = postContainer.querySelector('header a[href^="/"]');
  if (authorLink) {
    const href = authorLink.getAttribute("href");
    const match = href.match(/^\/([^\/]+)\/?$/);
    if (match && match[1] === currentUsername) {
      console.log("[IG Comment AI] This is your own post, skipping");
      return true;
    }
  }

  return false;
}

// Calculate similarity between two strings (0-1, where 1 is identical)
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Check if one contains the other (very similar)
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Count common words
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(
    (word) => words2.includes(word) && word.length > 3,
  ).length;

  const maxWords = Math.max(words1.length, words2.length);
  const wordSimilarity = commonWords / maxWords;

  return wordSimilarity;
}

// Check if comment is too similar to recent comments
function isCommentTooSimilar(newComment) {
  if (previousComments.length === 0) return false;

  for (const prevComment of previousComments) {
    const similarity = calculateSimilarity(newComment, prevComment);
    if (similarity > 0.7) {
      // 70% similar
      console.log(
        "[IG Comment AI] Comment too similar to previous:",
        prevComment,
      );
      return true;
    }
  }

  return false;
}

// Track a new comment for diversity checking
function trackComment(comment) {
  previousComments.push(comment);
  // Keep only last 10 comments
  if (previousComments.length > 10) {
    previousComments.shift();
  }
  console.log(
    "[IG Comment AI] Tracking comment. Total tracked:",
    previousComments.length,
  );
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

      console.log(
        "[IG Comment AI] Keyboard shortcut detected: Cmd+Ctrl+G (Manual Mode)",
      );

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

      // Check if this is your own post
      if (isOwnPost(lastFocusedInput)) {
        showNotification("Cannot comment on your own post!", "error");
        return;
      }

      // Check if we've already commented on this post
      if (hasCommentedOnPost(lastFocusedInput)) {
        showNotification("You've already commented on this post!", "error");
        return;
      }

      // Check if post has no other comments
      if (postHasNoComments(lastFocusedInput)) {
        showNotification(
          "Post has no comments. Be the first manually!",
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
        sendMessageSafely({
          action: "triggerGeneration",
          commentId: id,
          butlerMode: false, // Manual mode doesn't filter by topic
        });
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

  if (request.action === "logAIVision") {
    console.log("=== AI VISION ANALYSIS ===");
    console.log(request.analysis);
    console.log("Board Game:", request.isBoardGame ? "YES ✓" : "NO ✗");
    console.log("==========================");
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

// Robust click function - tries ONLY native click to prevent duplicates
function robustClick(element) {
  if (!element) {
    console.error("[IG Comment AI] No element to click");
    return false;
  }

  console.log("[IG Comment AI] Attempting to click element:", element);

  // ONLY use native click - Instagram responds to it properly
  // Using multiple methods causes duplicate posts!
  try {
    element.click();
    console.log("[IG Comment AI] Native click executed");
    return true;
  } catch (e) {
    console.error("[IG Comment AI] Native click failed:", e);
    return false;
  }
}

function insertGeneratedComment(comment, commentId) {
  // Prevent duplicate insertions for the same commentId
  if (activeCommentInsertions.has(commentId)) {
    console.log(
      "[IG Comment AI] Comment insertion already in progress for ID:",
      commentId,
    );
    return;
  }

  // Check if comment is too similar to recent ones
  if (isCommentTooSimilar(comment)) {
    console.log(
      "[IG Comment AI] Rejecting comment - too similar to recent comments",
    );
    showNotification(
      "Comment too similar to recent ones. Try another post!",
      "error",
    );
    activeCommentInsertions.delete(commentId);
    return;
  }

  // Mark this commentId as being processed
  activeCommentInsertions.add(commentId);

  const commentInput = document.querySelector(
    `[data-comment-id='${commentId}']`,
  );
  if (!commentInput) {
    console.error("[IG Comment AI] No comment input to insert into");
    activeCommentInsertions.delete(commentId); // Clean up
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

  // Click the post button with robust method
  setTimeout(() => {
    // Find the Post button - try multiple selectors
    let postButton = null;

    // Method 1: Look for exact text "Post"
    postButton = Array.from(
      document.querySelectorAll('div[role="button"]'),
    ).find((btn) => btn.textContent.trim() === "Post");

    // Method 2: Try form submit buttons
    if (!postButton) {
      postButton = Array.from(document.querySelectorAll("button")).find(
        (btn) => btn.textContent.trim() === "Post" || btn.type === "submit",
      );
    }

    // Method 3: Look near the comment input
    if (!postButton && commentInput) {
      const form = commentInput.closest("form");
      if (form) {
        postButton =
          form.querySelector('div[role="button"]') ||
          form.querySelector('button[type="submit"]');
      }
    }

    if (postButton) {
      console.log("[IG Comment AI] Found Post button:", postButton);
      robustClick(postButton);
      console.log("[IG Comment AI] Post button clicked");

      // Track this comment for diversity checking
      trackComment(comment);

      // Mark this post as commented to prevent duplicates
      markPostAsCommented(commentInput);

      // Clean up the commentId from active insertions
      activeCommentInsertions.delete(commentId);

      // Remove the data-comment-id attribute to prevent reprocessing
      commentInput.removeAttribute("data-comment-id");

      commentsCount++;
      actionsCount++;
      chrome.storage.local.get(["butlerStats"], (res) => {
        const stats = res.butlerStats || { likes: 0, follows: 0, comments: 0 };
        stats.comments = commentsCount;
        chrome.storage.local.set({ butlerStats: stats });
      });
    } else {
      console.error("[IG Comment AI] Could not find Post button");
      activeCommentInsertions.delete(commentId); // Clean up even on failure
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
    console.log("[IG Butler] Max Actions:", maxActions);
    console.log("[IG Butler] Max Comments:", maxComments);
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

    // 1. Like post (but not own posts)
    const likeButton = article.querySelector('svg[aria-label="Like"]');
    if (likeButton && !isOwnPost(article)) {
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

    // 3. Comment on post (with all safety checks)
    if (commentsCount < maxComments) {
      const commentInput = article.querySelector(
        'textarea[placeholder*="comment"]',
      );
      if (
        commentInput &&
        !commentInput.value &&
        !commentInput.dataset.commentId &&
        !isOwnPost(commentInput) && // Don't comment on own posts
        !hasCommentedOnPost(commentInput) && // Check for duplicates
        !postHasNoComments(commentInput) // Only comment if post already has comments
      ) {
        console.log("[IG Butler] Attempting to comment on post");
        const id = getCommentId();
        commentInput.dataset.commentId = id;
        setLastFocusedInput(commentInput);
        sendMessageSafely({
          action: "triggerGeneration",
          commentId: id,
          butlerMode: true, // Butler mode filters for board games only
        });
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
