(() => {
  if (globalThis.__DEX_CONTENT_SCRIPT_ACTIVE__) {
    return;
  }

  globalThis.__DEX_CONTENT_SCRIPT_ACTIVE__ = true;

  const STORAGE_KEY = "dexState";
  const DELETE_TWEET_QUERY_ID = "nxpZCY2K-I6QoFHAHeojFQ";
  const MAX_LOGS = 250;
  const DEFAULT_RATE_LIMIT_CHECK_SECONDS = 300;
  let loopInFlight = false;

  function mergeState(raw = {}) {
    return {
      status: "idle",
      logs: [],
      tweetIds: [],
      total: 0,
      nextIndex: 0,
      authorization: "",
      rateLimitCheckSeconds: DEFAULT_RATE_LIMIT_CHECK_SECONDS,
      requestDelayMs: 0,
      nextCheckAt: null,
      stopRequested: false,
      targetOrigin: "https://x.com",
      lastTweetId: "",
      lastResponseStatus: null,
      error: "",
      ...raw
    };
  }

  async function getState() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return mergeState(stored[STORAGE_KEY]);
  }

  async function setState(state) {
    const next = mergeState(state);
    next.updatedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  }

  async function patchState(patch) {
    const state = await getState();
    return setState({ ...state, ...patch });
  }

  function makeLog(level, text) {
    return {
      ts: Date.now(),
      level,
      text
    };
  }

  async function addLog(level, text) {
    const state = await getState();
    const logs = [...state.logs, makeLog(level, text)].slice(-MAX_LOGS);
    await setState({ ...state, logs });
  }

  function getCsrfTokenFromCookie() {
    const cookie = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith("ct0="));

    if (!cookie) {
      return "";
    }

    return decodeURIComponent(cookie.slice(4));
  }

  function getDeleteUrl() {
    return `https://x.com/i/api/graphql/${DELETE_TWEET_QUERY_ID}/DeleteTweet`;
  }

  function getLanguageHeader() {
    const language = (navigator.language || "en").split("-")[0];
    return language || "en";
  }

  function getServerResetSeconds(headers) {
    const raw = headers["x-rate-limit-reset"];

    if (!raw) {
      return null;
    }

    const reset = Number.parseInt(raw, 10);

    if (Number.isNaN(reset)) {
      return null;
    }

    return Math.max(reset - Math.floor(Date.now() / 1000) + 1, 1);
  }

  async function sleepWithStopCheck(milliseconds) {
    let remaining = milliseconds;

    while (remaining > 0) {
      const state = await getState();

      if (state.stopRequested) {
        return false;
      }

      const slice = Math.min(1000, remaining);
      await new Promise((resolve) => setTimeout(resolve, slice));
      remaining -= slice;
    }

    return true;
  }

  async function deleteTweet(tweetId, authorization) {
    const csrfToken = getCsrfTokenFromCookie();

    if (!csrfToken) {
      throw new Error(
        "Missing ct0 cookie in the current X tab. Stay logged in and reload x.com once."
      );
    }

    const response = await fetch(getDeleteUrl(), {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "*/*",
        authorization,
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        "x-twitter-active-user": "yes",
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-client-language": getLanguageHeader()
      },
      body: JSON.stringify({
        variables: {
          tweet_id: tweetId,
          dark_request: false
        },
        queryId: DELETE_TWEET_QUERY_ID
      })
    });

    const text = await response.text();
    const headers = {};

    for (const [key, value] of response.headers.entries()) {
      headers[key.toLowerCase()] = value;
    }

    return {
      status: response.status,
      text,
      headers
    };
  }

  async function stopLoop() {
    await addLog("warn", "Deletion stopped from the dashboard.");
    await patchState({
      status: "stopped",
      stopRequested: false,
      nextCheckAt: null
    });
  }

  function getBodyPreview(text) {
    return text.replace(/\s+/g, " ").trim().slice(0, 220);
  }

  async function runDeleteLoop() {
    if (loopInFlight) {
      await addLog("info", "Deletion loop is already running in this tab.");
      return;
    }

    loopInFlight = true;

    try {
      let state = await getState();

      if (!state.authorization) {
        await patchState({
          status: "error",
          error: "Missing Authorization token."
        });
        await addLog(
          "error",
          "Missing Authorization token. Paste it into the extension dashboard first."
        );
        return;
      }

      if (!Array.isArray(state.tweetIds) || state.tweetIds.length === 0) {
        await patchState({
          status: "error",
          error: "No tweet archive is loaded."
        });
        await addLog(
          "error",
          "No tweet IDs are loaded. Upload tweets.js in the extension dashboard first."
        );
        return;
      }

      if (state.nextIndex >= state.total) {
        await patchState({
          status: "completed",
          nextCheckAt: null,
          error: ""
        });
        await addLog("success", "All tweet IDs in the loaded archive have been processed.");
        return;
      }

      await patchState({
        status: "running",
        stopRequested: false,
        nextCheckAt: null,
        error: "",
        targetOrigin: window.location.origin
      });
      await addLog("info", `Deletion loop started on ${window.location.origin}.`);

      while (true) {
        state = await getState();

        if (state.stopRequested) {
          await stopLoop();
          return;
        }

        if (state.nextIndex >= state.total) {
          await patchState({
            status: "completed",
            nextCheckAt: null,
            error: ""
          });
          await addLog(
            "success",
            "All tweet IDs in the loaded archive have been processed."
          );
          return;
        }

        const tweetId = state.tweetIds[state.nextIndex];
        await addLog(
          "info",
          `Deleting ${tweetId} (${state.nextIndex + 1}/${state.total})...`
        );

        let result;

        try {
          result = await deleteTweet(tweetId, state.authorization);
        } catch (error) {
          const message = String(error);
          await patchState({
            status: "error",
            error: message,
            lastTweetId: tweetId,
            nextCheckAt: null
          });
          await addLog("error", `Request failed for ${tweetId}: ${message}`);
          return;
        }

        if (result.status === 200) {
          await patchState({
            status: "running",
            nextIndex: state.nextIndex + 1,
            lastTweetId: tweetId,
            lastResponseStatus: 200,
            nextCheckAt: null,
            error: ""
          });
          await addLog("success", `Deleted ${tweetId}.`);

          const delay = Math.max(Number.parseInt(state.requestDelayMs, 10) || 0, 0);

          if (delay > 0) {
            const keepGoing = await sleepWithStopCheck(delay);

            if (!keepGoing) {
              await stopLoop();
              return;
            }
          }

          continue;
        }

        if (result.status === 429) {
          const configuredWaitSeconds = Math.max(
            Number.parseInt(state.rateLimitCheckSeconds, 10) ||
              DEFAULT_RATE_LIMIT_CHECK_SECONDS,
            1
          );
          const serverHintSeconds = getServerResetSeconds(result.headers);
          const waitSeconds = Math.max(
            Math.min(serverHintSeconds ?? configuredWaitSeconds, configuredWaitSeconds),
            1
          );

          await patchState({
            status: "rate_limited",
            nextCheckAt: Date.now() + waitSeconds * 1000,
            lastTweetId: tweetId,
            lastResponseStatus: 429,
            error: ""
          });
          await addLog(
            "warn",
            `Rate limited on ${tweetId}. Next check in ${waitSeconds}s${
              serverHintSeconds ? ` (server hint ${serverHintSeconds}s)` : ""
            }.`
          );

          const keepGoing = await sleepWithStopCheck(waitSeconds * 1000);

          if (!keepGoing) {
            await stopLoop();
            return;
          }

          continue;
        }

        const preview = getBodyPreview(result.text);
        await patchState({
          status: "error",
          error: `${result.status} ${preview || "Request failed."}`,
          lastTweetId: tweetId,
          lastResponseStatus: result.status,
          nextCheckAt: null
        });
        await addLog(
          "error",
          `Delete failed for ${tweetId}: ${result.status}${
            preview ? ` ${preview}` : ""
          }`
        );
        return;
      }
    } finally {
      loopInFlight = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") {
      return;
    }

    if (message.type === "DEX_START" || message.type === "DEX_RESUME") {
      runDeleteLoop().catch(async (error) => {
        const messageText = String(error);
        await patchState({
          status: "error",
          error: messageText,
          nextCheckAt: null
        });
        await addLog("error", `Unexpected extension error: ${messageText}`);
      });
      sendResponse({ ok: true, accepted: true });
      return true;
    }

    if (message.type === "DEX_STOP") {
      patchState({ stopRequested: true }).then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message.type === "DEX_PING") {
      sendResponse({
        ok: true,
        title: document.title,
        url: window.location.href
      });
      return false;
    }
  });
})();
