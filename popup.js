// Popup script for Instagram Comment AI Extension

const apiKeyInput = document.getElementById("apiKey");
const modelSelect = document.getElementById("model");
const systemPromptInput = document.getElementById("systemPrompt");
const userPromptInput = document.getElementById("userPrompt");
const saveBtn = document.getElementById("saveBtn");
const statusDiv = document.getElementById("status");
const advancedToggle = document.getElementById("advancedToggle");
const advancedContent = document.getElementById("advancedContent");
const butlerModeBtn = document.getElementById("butlerModeBtn");
const butlerStats = document.getElementById("butlerStats");
const likesCount = document.getElementById("likesCount");
const followsCount = document.getElementById("followsCount");
const commentsCount = document.getElementById("commentsCount");
const butlerSettingsToggle = document.getElementById("butlerSettingsToggle");
const butlerSettingsContent = document.getElementById("butlerSettingsContent");
const maxActionsInput = document.getElementById("maxActions");
const maxCommentsInput = document.getElementById("maxComments");

// Default prompts
const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant that generates natural, authentic Instagram comments. Keep comments brief, friendly, and relevant to the post content and images.";

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

// Load saved settings on popup open
chrome.storage.local.get(
  [
    "openaiApiKey",
    "model",
    "systemPrompt",
    "userPrompt",
    "butlerMode",
    "butlerStats",
    "maxActions",
    "maxComments",
  ],
  (result) => {
    if (result.openaiApiKey) {
      apiKeyInput.value = result.openaiApiKey;
    }

    modelSelect.value = result.model || "gpt-4o-mini";
    systemPromptInput.value = result.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    userPromptInput.value = result.userPrompt || DEFAULT_USER_PROMPT;
    maxActionsInput.value = result.maxActions || 40;
    maxCommentsInput.value = result.maxComments || 10;

    updateButlerButton(result.butlerMode);
    updateButlerStats(result.butlerStats);
  },
);

function updateButlerButton(butlerMode) {
  if (butlerMode) {
    butlerModeBtn.textContent = "Disable Butler Mode";
    butlerModeBtn.style.backgroundColor = "#ed4956";
  } else {
    butlerModeBtn.textContent = "Enable Butler Mode";
    butlerModeBtn.style.backgroundColor = "#0095f6";
  }
}

function updateButlerStats(stats) {
  if (stats) {
    butlerStats.style.display = "block";
    likesCount.textContent = stats.likes;
    followsCount.textContent = stats.follows;
    commentsCount.textContent = stats.comments;
  } else {
    butlerStats.style.display = "none";
  }
}

butlerModeBtn.addEventListener("click", () => {
  chrome.storage.local.get(["butlerMode"], (result) => {
    const newButlerModeState = !result.butlerMode;
    chrome.storage.local.set({ butlerMode: newButlerModeState }, () => {
      updateButlerButton(newButlerModeState);
      if (!newButlerModeState) {
        chrome.storage.local.get(["butlerStats"], (res) => {
          updateButlerStats(res.butlerStats);
        });
      } else {
        chrome.storage.local.set(
          { butlerStats: { likes: 0, follows: 0, comments: 0 } },
          () => {
            updateButlerStats({ likes: 0, follows: 0, comments: 0 });
          },
        );
      }
    });
  });
});

// Collapsible advanced settings
advancedToggle.addEventListener("click", () => {
  advancedToggle.classList.toggle("active");
  advancedContent.classList.toggle("active");
});

butlerSettingsToggle.addEventListener("click", () => {
  butlerSettingsToggle.classList.toggle("active");
  butlerSettingsContent.classList.toggle("active");
});

// Save all settings
saveBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus("Please enter an API key", "error");
    return;
  }

  if (!apiKey.startsWith("sk-")) {
    showStatus('Invalid API key format. Should start with "sk-"', "error");
    return;
  }

  const settings = {
    openaiApiKey: apiKey,
    model: modelSelect.value,
    systemPrompt: systemPromptInput.value.trim() || DEFAULT_SYSTEM_PROMPT,
    userPrompt: userPromptInput.value.trim() || DEFAULT_USER_PROMPT,
    maxActions: parseInt(maxActionsInput.value),
    maxComments: parseInt(maxCommentsInput.value),
  };

  try {
    await chrome.storage.local.set(settings);
    showStatus("Settings saved successfully!", "success");
  } catch (error) {
    showStatus("Error saving settings: " + error.message, "error");
  }
});

// Enter key to save
apiKeyInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    saveBtn.click();
  }
});

function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;

  if (type === "success") {
    setTimeout(() => {
      statusDiv.className = "status";
    }, 3000);
  }
}
