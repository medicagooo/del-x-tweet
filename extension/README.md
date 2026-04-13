# Chrome Extension Prototype

This folder contains a local Chrome extension version of the project.

## What it does

- Opens a dashboard page from the extension icon
- Lets you upload `tweets.js`
- Lets you paste the `Authorization` bearer token manually
- Uses a logged-in `x.com` tab for the current session cookies and CSRF token
- Deletes tweets with realtime logs, saved progress, and rate-limit polling

## Important constraints

- Keep one logged-in `x.com` tab open while the extension runs.
- The extension does not export your cookies. It uses the session already present in the open tab.
- You still need to paste a valid `Authorization` bearer token yourself.
- This is a prototype. If X changes its internal delete flow, the extension may stop working.

## Load it in Chrome

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the `extension/` folder from this repository

## Use it

1. Open `x.com` and log in.
2. Click the extension icon to open the dashboard.
3. Click `Use Current X Tab`.
4. Paste the `Authorization` token, or paste a copied cURL/request header block and click `Extract Authorization`.
5. Upload your `tweets.js`.
6. Click `Start Fresh` or `Resume Saved Job`.

## Resume behavior

- The extension stores the uploaded tweet IDs, progress, logs, and the next index in `chrome.storage.local`.
- If the dashboard closes, you can reopen it and click `Resume Saved Job`.
- If rate limiting happens, the content script waits and checks again based on the configured interval.
