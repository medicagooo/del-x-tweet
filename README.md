# de-x.py

[English](README.md) | [简体中文](README.zh-CN.md)

Delete your tweet history, retweets, and replies without paid API access.

## Overview

Many older Twitter cleanup tools stopped working after X/Twitter restricted API access. This script takes a different route:

- It reads tweet IDs from your exported Twitter archive.
- It reuses your current browser session headers for authorization.
- It sends delete requests directly, without requiring a developer account.

## Table of Contents

- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Preparation](#preparation)
- [Run](#run)
- [How It Works](#how-it-works)
- [Notes](#notes)

## Requirements

- Python 3
- `requests`
- Your X/Twitter data archive, including `tweets.js`
- A valid, currently logged-in browser session

Install dependencies with the project virtual environment:

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

If you have not created the virtual environment yet:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Quick Start

1. Request and download your X/Twitter archive.
2. Extract `tweets.js` from the archive.
3. Copy your browser request headers into `request-headers.txt`.
4. Run the script with `tweets.js` and `request-headers.txt`.

## Preparation

### 1. Request your archive

Request an archive of your data at X/Twitter. It usually takes a few days before the archive becomes available. Once it is ready, you will receive a notification in the app or by email.

![Request Twitter archive at X](doc/archive.png)

### 2. Extract `tweets.js`

After downloading the ZIP archive, extract it locally. You will need the file named `tweets.js`, which contains every tweet, reply, and retweet together with its tweet ID.

### 3. Export request headers from your browser

The script also needs valid session headers from a currently logged-in browser session. Without them, X/Twitter will reject the delete requests.

Browser options:

1. Edge/Chrome: Log into X/Twitter, press `Ctrl-Shift-i`, open the `Network` tab, click any request, and copy the request headers.
2. Firefox: The process should be similar.
3. Burp Suite: Record a browser session and copy the client request headers.

Copy everything after `Accept` into a local file such as `request-headers.txt`.

Important headers include:

- `Cookie`
- `X-Csrf-Token`
- `Authorization`

Example minimal header file:

```text
Authorization: Bearer AAAAAAAAAAAAAAAAAAAAANR[...]
X-Csrf-Token: b0a38[...]
Cookie: [...] _twitter_sess=BAhD[...]; auth_token=24fa[...]
```

Make sure the copied headers do not contain accidental line breaks.

![Copy & Paste session headers at twitter.com](doc/session.png)

## Run

With the archive and request headers prepared, run:

```bash
source .venv/bin/activate
python de-x.py tweets.js request-headers.txt
```

You can also run it directly with system Python if the dependency is installed:

```bash
python3 de-x.py tweets.js request-headers.txt
```

## How It Works

If you know a tweet ID, you can send a delete request for that specific tweet. The main challenge is therefore collecting all relevant tweet IDs first.

Instead of relying on restricted Twitter APIs, this script reads the IDs from your personal archive. The archive is complete, free, and machine-readable. Once the tweet IDs are loaded, the script sends authenticated delete requests using your current session headers.

## Notes

- This is not a one-click tool. You still need to export your archive and copy valid request headers manually.
- Session headers can expire. If requests start failing, refresh the headers from a new logged-in browser session.
- The script depends on X/Twitter's current internal request flow, which may change over time.
- Historically, this approach was fast enough to delete thousands of tweets in a relatively short time.

If you want to remove old content from the platform without paying for API access, this project gives you a lightweight, transparent way to do it.
