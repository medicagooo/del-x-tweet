<div align="center">
  <h1>de-x</h1>
  <p><strong>Delete your tweet history, retweets, and replies without paid API access.</strong></p>
  <p>
    <a href="README.md">English</a> ·
    <a href="README.zh-CN.md">简体中文</a>
  </p>
  <p>
    <a href="#python-script-workflow"><strong>Python Script</strong></a> ·
    <a href="#chrome-extension-workflow"><strong>Chrome Extension</strong></a> ·
    <a href="extension/README.md"><strong>Extension Docs</strong></a>
  </p>
  <p>
    <img alt="Python Script Workflow" src="https://img.shields.io/badge/Workflow-Python%20Script-1f6feb?style=flat-square">
    <img alt="Chrome Extension Workflow" src="https://img.shields.io/badge/Workflow-Chrome%20Extension-0f766e?style=flat-square">
    <img alt="Execution Local Only" src="https://img.shields.io/badge/Execution-Local%20Only-475569?style=flat-square">
  </p>
</div>

This repository includes two ways to use the project:

- Python script: run deletes from your local terminal
- Chrome extension prototype: run deletes from a local browser dashboard

The extension lives under [`extension/`](extension/README.md).

## Table of Contents

- [Overview](#overview)
- [Choose a Workflow](#choose-a-workflow)
- [Shared Preparation](#shared-preparation)
- [Python Script Workflow](#python-script-workflow)
- [Chrome Extension Workflow](#chrome-extension-workflow)
- [How It Works](#how-it-works)
- [Notes](#notes)

## Overview

Many older Twitter cleanup tools stopped working after X/Twitter restricted API access. This project takes a different route:

- It reads tweet IDs from your exported Twitter archive.
- It reuses your current authenticated browser session.
- It sends delete requests directly, without requiring a paid developer API plan.

## Choose a Workflow

### Option 1: Python script

Choose this if you prefer running everything from the terminal.

You will need:

- Python 3
- `requests`
- Your X/Twitter archive, including `tweets.js`
- A valid logged-in browser session
- `Authorization`, `X-Csrf-Token`, and `Cookie`

### Option 2: Chrome extension prototype

Choose this if you prefer a browser UI with logs, progress, and resume controls.

You will need:

- Google Chrome or Microsoft Edge
- One open and logged-in `x.com` tab
- Your X/Twitter archive, including `tweets.js`
- A valid `Authorization` bearer token

The extension reuses the logged-in tab for cookies and the CSRF token, so you do not need to paste those into the dashboard.

## Shared Preparation

### 1. Request your archive

Request an archive of your data at X/Twitter. It usually takes a few days before the archive becomes available. Once it is ready, you will receive a notification in the app or by email.

![Request Twitter archive at X](doc/archive.png)

### 2. Extract `tweets.js`

After downloading the ZIP archive, extract it locally. You will need the file named `tweets.js`, which contains every tweet, reply, and retweet together with its tweet ID.

### 3. Export request headers from your browser

You need valid session data from a currently logged-in browser session.

Browser options:

1. Edge/Chrome: Log into X/Twitter, press `Ctrl-Shift-i`, open the `Network` tab, click any request, and copy the request headers.
2. Firefox: The process is similar.
3. Burp Suite: Record a browser session and copy the client request headers.

Important headers include:

- `Authorization`
- `X-Csrf-Token`
- `Cookie`

In Chrome or Edge, the clearest workflow is:

1. Open `x.com` while logged in.
2. Press `Ctrl-Shift-i` to open DevTools.
3. Go to `Network`.
4. Switch to `Fetch/XHR`.
5. Filter with `/i/api/` or `graphql`.
6. Click one authenticated request and look at the `Headers` tab.

At that point you should be able to see the key headers on the right:

![Request headers in DevTools](doc/network-request-headers.png)

Then:

1. Right-click the same request in the left request list.
2. Choose `Copy`.
3. Choose `Copy as cURL (bash)`.

![Copy request as cURL (bash)](doc/copy-as-curl-bash.png)

How to use that copied data:

- For the Python script, extract `Authorization`, `X-Csrf-Token`, and `Cookie` into `.env`.
- For the Chrome extension, paste the full copied cURL into the helper box and click `Extract Authorization`.

Make sure copied values stay on a single line without accidental line breaks.

## Python Script Workflow

### 1. Install dependencies

If `.venv` already exists, install dependencies with:

```bash
cd /home/medicago/projects/del-x-tweet
.venv/bin/pip install -r requirements.txt
```

If you do not have a virtual environment yet:

```bash
cd /home/medicago/projects/del-x-tweet
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 2. Create `.env`

Copy the template:

```bash
cd /home/medicago/projects/del-x-tweet
cp .env.example .env
```

Then edit `.env` and fill in your values:

```dotenv
TWEETS_FILE=twitter/data/tweets.js
PROGRESS_FILE=.delete-progress.json
RATE_LIMIT_CHECK_INTERVAL_SECONDS=300
AUTHORIZATION="Bearer AAAAAAAAAAAAAAAAAAAAANR[...]"
X_CSRF_TOKEN="b0a38[...]"
COOKIE="ct0=...; auth_token=..."
```

### 3. Run the script

Run with realtime output:

```bash
cd /home/medicago/projects/del-x-tweet
.venv/bin/python -u de-x.py 2>&1 | tee -a delete-live.log
```

### 4. Resume after interruption

The script stores progress in `.delete-progress.json`.

If the process stops, run the same command again:

```bash
cd /home/medicago/projects/del-x-tweet
.venv/bin/python -u de-x.py 2>&1 | tee -a delete-live.log
```

It will continue from the saved index instead of starting from the beginning.

### 5. Optional legacy mode

If you prefer a separate request header file, you can still use the old CLI form:

```bash
cd /home/medicago/projects/del-x-tweet
.venv/bin/python de-x.py tweets.js request-headers.txt
```

## Chrome Extension Workflow

The repository also includes a local Chrome extension prototype in [`extension/`](extension/README.md).

### 1. Load the extension

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the `extension/` folder from this repository

### 2. Prepare the browser

1. Open `x.com`
2. Log in
3. Keep that `x.com` tab open while deleting

### 3. Start a new job

1. Click the extension icon to open the dashboard
2. Click `Use Current X Tab`
3. Paste the `Authorization` bearer token
4. If you copied a full cURL or request-header block instead, paste it into the helper box and click `Extract Authorization`
5. Upload your `tweets.js`
6. Set the rate-limit check interval if needed
7. Click `Start Fresh`

### 4. Resume a saved job

If the dashboard closes or the run stops:

1. Reopen the extension dashboard
2. Make sure your `x.com` tab is still open and logged in
3. Click `Use Current X Tab`
4. Confirm the `Authorization` token is still present
5. Click `Resume Saved Job`

The extension stores progress, logs, and the next index in `chrome.storage.local`.

## How It Works

If you know a tweet ID, you can send a delete request for that specific tweet. The main challenge is collecting all relevant tweet IDs first.

Instead of relying on restricted Twitter APIs, this project reads the IDs from your personal archive. The archive is complete, free, and machine-readable. Once the tweet IDs are loaded, the script or extension sends authenticated delete requests using your current session.

## Notes

- This is not a one-click tool. You still need to export your archive and provide valid authentication data manually.
- Session data can expire. If requests start failing, refresh the headers or token from a new logged-in browser session.
- The project depends on X/Twitter's current internal request flow, which may change over time.
- Rate limiting is expected during large deletion runs. Both workflows support waiting and resuming.
- Historically, this approach was fast enough to delete thousands of tweets in a relatively short time.
