# SpyLeads Chrome Extension

## Setup

1. Go to `chrome://extensions` in your browser.
2. Enable Developer Mode.
3. Click "Load unpacked" and select the `extension/` folder.

## Environment

- Copy `.env.example` to `.env` and set `BACKEND_URL` as needed.

## Files

- popup.html, popup.js: Extension popup UI
- background.js: Service worker
- content.js: Injected into Instagram pages
- constants.js: Shared constants
- icons/: Extension icons
- scripts/: Additional scripts
