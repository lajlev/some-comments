# Debugging Guide

## Viewing Console Logs

The extension has two types of scripts that log to different consoles:

### 1. Content Script Logs (content.js)
These logs appear in the **Instagram page console**:
- Open Instagram in Chrome
- Press `F12` or right-click → Inspect
- Go to the **Console** tab
- Filter by `[IG Comment AI]` to see only extension logs

**Content script logs include:**
- `[IG Comment AI] Extension loaded successfully`
- `[IG Comment AI] Comment input focused`
- `[IG Comment AI] Keyboard shortcut detected: Cmd+Ctrl+G`
- `[IG Comment AI] Image converted to base64, length: XXXXX`

### 2. Background Service Worker Logs (background.js)
These logs appear in the **Extension service worker console**:

**How to view:**
1. Go to `chrome://extensions/`
2. Make sure "Developer mode" is enabled (toggle in top-right)
3. Find "Instagram Comment AI" extension
4. Click the **"service worker"** link (appears as blue text)
5. A DevTools window opens showing the service worker console

**Background logs include:**
- `[IG Comment AI] Background service worker loaded`
- `[IG Comment AI] generateComment called for tab: X`
- `[IG Comment AI] Settings loaded, has API key: true`
- `[IG Comment AI] Requesting post context from content script...`
- `[IG Comment AI] Post context: {...}` ← **This is where your log appears!**
- `[IG Comment AI] Sending request with image, base64 length: XXXXX`
- `[IG Comment AI] Generated comment: ...`
- `[IG Comment AI] OpenAI API error: ...` (if errors occur)

## Common Issues

### "Post context" log not appearing

**Check these steps:**

1. **Open the correct console** - The "Post context" log is in the service worker console, NOT the Instagram page console
2. **Refresh the service worker** - If you reloaded the extension, you may need to close and reopen the service worker console
3. **Check for errors before** - Look for error messages that might prevent the code from reaching the log statement
4. **Verify API key is set** - Check if you see "Settings loaded, has API key: true"

### Service worker says "inactive"

If the service worker link shows "inactive":
1. Go to Instagram and trigger the extension with `Cmd+Ctrl+G`
2. The service worker will activate
3. Click the "service worker" link again

### Extension not triggering

Check the Instagram page console for:
- `[IG Comment AI] Extension loaded successfully` - If missing, refresh the page
- `[IG Comment AI] Keyboard shortcut detected: Cmd+Ctrl+G` - If missing, check if you focused a comment input first

## Testing Workflow

1. Open Instagram
2. Open DevTools on Instagram page (`F12`)
3. Go to `chrome://extensions/` in another tab
4. Click "service worker" link for the extension
5. Arrange windows side-by-side
6. Focus a comment input on Instagram
7. Press `Cmd+Ctrl+G`
8. Watch both consoles for logs

## Log Sequence (Normal Flow)

**Instagram Page Console (content.js):**
```
[IG Comment AI] Extension loaded successfully
[IG Comment AI] Comment input focused: <element>
[IG Comment AI] Keyboard shortcut detected: Cmd+Ctrl+G
[IG Comment AI] Image converted to base64, length: 45678
[IG Comment AI] Comment generated successfully!
```

**Service Worker Console (background.js):**
```
[IG Comment AI] Background service worker loaded
[IG Comment AI] generateComment called for tab: 1234567890
[IG Comment AI] Settings loaded, has API key: true
[IG Comment AI] Requesting post context from content script...
[IG Comment AI] Post context: {caption: "...", hasImage: true, ...}
[IG Comment AI] Sending request with image, base64 length: 45678
[IG Comment AI] Generated comment: Great photo! Love the colors.
```

## Error Debugging

If you get errors, check both consoles:

**Common errors in page console:**
- Extension context invalidated → Refresh the Instagram page
- No comment input focused → Click a comment input first

**Common errors in service worker console:**
- API key invalid → Check your OpenAI API key in settings
- 400 error → Check the detailed error object for the specific issue
- 401 error → Invalid API key
- 429 error → Rate limit or quota exceeded
