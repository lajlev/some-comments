# Instagram Comment AI - Chrome Extension

A Chrome extension that uses OpenAI API with vision capabilities to generate relevant, contextual comments for Instagram posts based on the post image, caption, and hashtags.

## Features

### Core Features
- **AI-Powered Comments**: Generate contextual Instagram comments with a keyboard shortcut
- **Vision Analysis**: Uses GPT-4o-mini vision model to analyze post images
- **Smart Context Extraction**: Analyzes post caption, hashtags, and visual content
- **Real-time Notifications**: Visual feedback for user actions
- **Configurable API Settings**: Multiple model options and custom prompts

### Safety & Quality Features
- ✅ **Duplicate Prevention**: Never comments on the same post twice
- ✅ **Own Post Detection**: Automatically skips your own posts
- ✅ **Comment Diversity**: Prevents repetitive/similar comments (70% similarity check)
- ✅ **Existing Comments Check**: Only comments on posts that already have comments
- ✅ **Relevance Filtering**: AI ensures comments reference both image and caption
- ✅ **Post Tracking**: Maintains session history of commented posts

### Butler Mode
- **Automated Engagement**: Scroll, like, follow, and comment automatically
- **Board Game Filtering**: Butler mode only engages with board game related content
- **AI Vision Detection**: Uses vision model to identify board game posts
- **Configurable Limits**: Set maximum actions and maximum comments
- **Activity Statistics**: Track likes, follows, and comments made
- **Safety Protections**: All manual mode protections apply in Butler mode

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the extension directory

## Setup

1. Get your OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Click the extension icon in Chrome toolbar
3. Configure your settings:
   - Paste your API key
   - Select your preferred model (default: GPT-4o Mini)
   - (Optional) Customize system and user prompts in Advanced Settings
   - (Optional) Configure Butler Settings (Max Actions, Max Comments)
4. Click "Save Settings"

## Usage

### Manual Mode - Generating a Comment

1. Navigate to Instagram (instagram.com)
2. Find a post and click on the comment input field to focus it
3. Press the keyboard shortcut: `Command + Control + G` (Cmd + Ctrl + G)
4. The extension will:
   - Show a blue notification "Generating comment..."
   - Expand the caption if needed
   - Extract the post image, caption, and hashtags
   - Send image and text to OpenAI GPT-4o-mini vision API
   - Generate a relevant comment based on visual and textual context
   - Insert it into the comment field
   - Show a green success notification
5. Review the comment and press Enter to post (or edit as needed)

**Manual Mode Checks:**
- ✅ Not your own post
- ✅ Haven't already commented
- ✅ Post has existing comments
- ✅ Comment is relevant to image and caption

### Butler Mode

1. Click the extension icon to open the popup
2. Expand the "Butler Settings" section
3. Configure settings:
   - **Maximum Actions**: Total actions (likes + follows + comments) before stopping
   - **Maximum Comments**: Maximum number of comments to post
4. Click "Save Settings"
5. Click "Enable Butler Mode" button
6. The extension will automatically:
   - Scroll through the Instagram feed
   - Like posts (excluding your own)
   - Follow users
   - Analyze posts for board game content
   - Comment only on board game related posts
7. To disable, click "Disable Butler Mode" button

**Butler Mode Checks:**
- ✅ All Manual Mode checks, plus:
- ✅ **Board Game Detection**: AI Vision analyzes if post is board game related
- ✅ **Action Limits**: Stops at configured maximum actions
- ✅ **Comment Limits**: Stops commenting at configured maximum

**Board Game Detection:**
Butler mode uses AI Vision to identify:
- Board games, tabletop games, card games
- Game components (dice, cards, miniatures)
- Board game reviews, unboxings, gameplay
- Board gaming community content
- Tabletop gaming events or meetups

## Customization

### Model Selection

Choose from multiple OpenAI models in the extension settings:
- **GPT-4o Mini** (recommended) - Best balance of cost and quality with vision support
- **GPT-4o** - Highest quality, more expensive, with vision support
- **GPT-4 Turbo** - High quality with vision support
- **GPT-3.5 Turbo** - Cheapest option, but no vision support (not recommended)

### Custom Prompts

Click "Advanced Settings" in the extension popup to customize:

**System Prompt**: Defines the AI's personality and behavior
- Default: Focuses on natural, authentic comments with specific image/caption references
- Customize to change tone, style, or language
- Includes diversity requirements to prevent repetitive comments

**User Prompt Template**: The instruction template for each comment
- Use `{caption}` placeholder for post caption
- Use `{hashtags}` placeholder for hashtags
- Customize to change comment format, length, or focus
- Default includes requirements for relevance and specificity

### Butler Settings

Configure automated behavior:
- **Maximum Actions** (default: 40): Total actions before Butler stops
- **Maximum Comments** (default: 10): Maximum comments to post
- Adjust based on your engagement goals and Instagram's rate limits

### Keyboard Shortcut

The keyboard shortcut is set to `Command + Control + G`. To modify it:

1. Edit `content.js`
2. Find the keyboard event listener (around line 380)
3. Change the key combination by modifying the conditions in the `if` statement

### Notifications

The extension shows visual notifications in the top-right corner of Instagram:
- Blue notification when generating comment
- Green notification on success
- Red notification on error or when skipping posts

### Vision Settings

For models with vision support, images are automatically included. To adjust image quality:
- Edit `background.js` (around line 160)
- Change `detail: "low"` to `detail: "high"` for better image analysis (higher cost)

## Console Logging

The extension provides detailed console logging for debugging:

### Manual Mode Logs:
```
[IG Comment AI] Keyboard shortcut detected: Cmd+Ctrl+G (Manual Mode)
[IG Comment AI] Found caption (multiline) after like section, Length: XXX
[IG Comment AI] Image converted to base64, length: XXX
[IG Comment AI] Generated comment: [comment text]
[IG Comment AI] Marked post as commented: [post-id]
```

### Butler Mode Logs:
```
[IG Butler] Starting butler mode
[IG Butler] Max Actions: 40
[IG Butler] Max Comments: 10
[IG Butler] Attempting to comment on post
=== AI VISION ANALYSIS ===
IMAGE: [What AI sees in the image]
RESULT: YES/NO
Board Game: YES ✓ / NO ✗
==========================
[IG Butler] Post is board game related, proceeding
[IG Comment AI] Generated comment: [comment text]
[IG Comment AI] Tracking comment. Total tracked: X
```

## Files Structure

```
.
├── manifest.json       # Extension configuration with permissions
├── background.js       # Service worker handling OpenAI API calls
├── content.js          # Instagram page interaction and Butler mode
├── popup.html          # Settings UI with Butler controls
├── popup.js           # Settings logic
├── icons/
│   ├── icon16.png     # Extension icons
│   ├── icon48.png
│   └── icon128.png
└── README.md          # This file
```

## Privacy & Security

- Your API key is stored locally in Chrome's storage
- The extension only runs on instagram.com
- No data is collected or sent anywhere except OpenAI API
- Post context (caption, image info) is sent to OpenAI for:
  - Board game detection (Butler mode only)
  - Comment generation (both modes)
- All checks and filtering happen locally in your browser

## Troubleshooting

### Comment not generating

- Make sure you've focused the comment input field first
- Check that your API key is saved correctly
- Open Developer Console (F12) to see error messages
- Verify you have credits in your OpenAI account
- Check console for specific error messages

### Comment not inserting

- Instagram's interface may have changed
- Try clicking the comment input again before using the shortcut
- Check console for errors
- Verify the Post button is found (check console logs)

### Butler Mode not working

- Ensure you clicked "Save Settings" after configuring Butler Settings
- Check console for logs showing Max Actions and Max Comments
- Verify Butler Mode is enabled (button shows "Disable Butler Mode")
- Refresh Instagram page after enabling Butler Mode
- Check console for board game detection results

### Duplicate comments posted

- This should be prevented by the duplicate prevention system
- Check console for "Already commented on post" messages
- Report the issue with console logs if duplicates occur

### API errors

- Verify your API key is valid
- Check your OpenAI account has available credits
- Ensure you have access to the `gpt-4o-mini` model
- Check console for specific API error messages

### Board game detection not working

- Verify you're using a vision-capable model (GPT-4o Mini recommended)
- Check console for "AI VISION ANALYSIS" logs
- Ensure posts have clear images of board games
- Try manual mode to test if basic functionality works

## Cost Estimation

Costs vary by model (approximate per comment):

**Butler Mode** (includes board game detection):
- Board game detection: ~$0.001-0.002 per post analyzed
- Comment generation: ~$0.003-0.005 per comment
- Total: ~$0.004-0.007 per commented post

**GPT-4o Mini** (recommended):
- Manual mode: ~$0.003-0.005 per comment with vision
- Butler mode: ~$0.004-0.007 per comment (includes detection)
- Most cost-effective option with image analysis

**GPT-4o**:
- Manual mode: ~$0.015-0.025 per comment with vision
- Butler mode: ~$0.017-0.030 per comment
- Best quality but higher cost

**GPT-4 Turbo**:
- Manual mode: ~$0.010-0.020 per comment with vision
- Butler mode: ~$0.012-0.025 per comment
- Good balance of quality and cost

**GPT-3.5 Turbo**:
- ~$0.001-0.002 per comment (text only, no vision)
- Cheapest but can't analyze images or detect board games
- Not recommended for Butler mode

## Development Notes

### Key Features Implementation

1. **Duplicate Prevention**: Uses Set data structure to track commented posts by shortcode
2. **Comment Diversity**: Calculates similarity between comments (70% threshold)
3. **Board Game Detection**: Separate API call with low temperature (0.3) for consistency
4. **Comment Tracking**: Maintains array of last 10 comments for diversity check
5. **Click Loop Prevention**: Active insertions Set prevents duplicate submissions

### Technical Details

- Manifest V3 architecture
- Service worker for background processing
- Content script injection on Instagram
- Chrome storage for persistent settings
- Message passing between contexts
- Async/await for API calls
- Base64 image encoding for vision API

## License

MIT License - feel free to modify and distribute

## Disclaimer

This extension is for personal use. Be mindful of Instagram's terms of service and community guidelines when using automated tools. Always review generated comments before posting. Use Butler mode responsibly and within Instagram's rate limits to avoid account restrictions.

**Important**: 
- The extension will NOT post comments automatically in manual mode - you must review and submit
- Butler mode is designed for board game engagement only
- All safety features are enabled by default to protect your account
- The extension respects Instagram's interface and does not bypass security measures
