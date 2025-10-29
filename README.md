# Instagram Comment AI - Chrome Extension

A Chrome extension that uses OpenAI API with vision capabilities to generate relevant, contextual comments for Instagram posts based on the post image, caption, and hashtags.

## Features

- Generate AI-powered Instagram comments with a keyboard shortcut
- Uses GPT-4o-mini vision model to analyze post images
- Analyzes post caption, hashtags, and visual content
- Real-time notifications for user feedback
- Works when comment input is focused
- Configurable OpenAI API key
- Natural, authentic-sounding comments

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
4. Click "Save Settings"

## Usage

1. Navigate to Instagram (instagram.com)
2. Find a post and click on the comment input field to focus it
3. Press the keyboard shortcut: `Command + Control + G` (Cmd + Ctrl + G)
4. The extension will:
   - Show a blue notification "Generating comment..."
   - Extract the post image, caption, and hashtags
   - Send image and text to OpenAI GPT-4o-mini vision API
   - Generate a relevant comment based on visual and textual context
   - Insert it into the comment field
   - Show a green success notification
5. Review the comment and press Enter to post (or edit as needed)

## Customization

### Model Selection

Choose from multiple OpenAI models in the extension settings:
- **GPT-4o Mini** (recommended) - Best balance of cost and quality with vision support
- **GPT-4o** - Highest quality, more expensive, with vision support
- **GPT-4 Turbo** - High quality with vision support
- **GPT-3.5 Turbo** - Cheapest option, but no vision support

### Custom Prompts

Click "Advanced Settings" in the extension popup to customize:

**System Prompt**: Defines the AI's personality and behavior
- Default: "You are a helpful assistant that generates natural, authentic Instagram comments..."
- Customize to change tone, style, or language

**User Prompt Template**: The instruction template for each comment
- Use `{caption}` placeholder for post caption
- Use `{hashtags}` placeholder for hashtags
- Customize to change comment format, length, or focus

### Keyboard Shortcut

The keyboard shortcut is set to `Command + Control + G`. To modify it:

1. Edit `content.js`
2. Find the keyboard event listener (around line 75)
3. Change the key combination by modifying the conditions in the `if` statement

### Notifications

The extension shows visual notifications in the top-right corner of Instagram:
- Blue notification when generating comment
- Green notification on success
- Red notification on error

### Vision Settings

For models with vision support, images are automatically included. To adjust image quality:
- Edit `background.js` (around line 130)
- Change `detail: "low"` to `detail: "high"` for better image analysis (higher cost)

## Files Structure

```
.
├── manifest.json       # Extension configuration
├── background.js       # Service worker handling OpenAI API calls
├── content.js          # Instagram page interaction
├── popup.html          # Settings UI
├── popup.js           # Settings logic
├── icon16.png         # Extension icons
├── icon48.png
└── icon128.png
```

## Privacy & Security

- Your API key is stored locally in Chrome's storage
- The extension only runs on instagram.com
- No data is collected or sent anywhere except OpenAI API
- Post context (caption, image info) is sent to OpenAI for comment generation

## Troubleshooting

### Comment not generating

- Make sure you've focused the comment input field first
- Check that your API key is saved correctly
- Open Developer Console (F12) to see error messages
- Verify you have credits in your OpenAI account

### Comment not inserting

- Instagram's interface may have changed
- Try clicking the comment input again before using the shortcut
- Check console for errors

### API errors

- Verify your API key is valid
- Check your OpenAI account has available credits
- Ensure you have access to the `gpt-4o-mini` model

## Cost Estimation

Costs vary by model (approximate per comment):

**GPT-4o Mini** (recommended):
- ~$0.003-0.005 per comment with vision
- Most cost-effective option with image analysis

**GPT-4o**:
- ~$0.015-0.025 per comment with vision
- Best quality but higher cost

**GPT-4 Turbo**:
- ~$0.010-0.020 per comment with vision
- Good balance of quality and cost

**GPT-3.5 Turbo**:
- ~$0.001-0.002 per comment (text only, no vision)
- Cheapest but can't analyze images

## License

MIT License - feel free to modify and distribute

## Disclaimer

This extension is for personal use. Be mindful of Instagram's terms of service and community guidelines when using automated tools. Always review generated comments before posting.
