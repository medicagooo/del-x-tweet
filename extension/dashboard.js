const STORAGE_KEY = "dexState";
const MAX_LOGS = 250;
const DEFAULT_RATE_LIMIT_CHECK_SECONDS = 300;

const refs = {
  tabSummary: document.getElementById("tab-summary"),
  fileSummary: document.getElementById("file-summary"),
  progressSummary: document.getElementById("progress-summary"),
  statusPill: document.getElementById("status-pill"),
  processedValue: document.getElementById("processed-value"),
  nextCheckValue: document.getElementById("next-check-value"),
  lastTweetValue: document.getElementById("last-tweet-value"),
  lastResponseValue: document.getElementById("last-response-value"),
  progressFill: document.getElementById("progress-fill"),
  logList: document.getElementById("log-list"),
  authInput: document.getElementById("authorization-input"),
  helperInput: document.getElementById("helper-input"),
  fileInput: document.getElementById("tweets-file-input"),
  rateLimitInput: document.getElementById("rate-limit-input"),
  delayInput: document.getElementById("delay-input"),
  useCurrentTabBtn: document.getElementById("use-current-tab-btn"),
  openXBtn: document.getElementById("open-x-btn"),
  extractAuthBtn: document.getElementById("extract-auth-btn"),
  startBtn: document.getElementById("start-btn"),
  resumeBtn: document.getElementById("resume-btn"),
  stopBtn: document.getElementById("stop-btn"),
  resetBtn: document.getElementById("reset-btn"),
  clearLogBtn: document.getElementById("clear-log-btn")
};

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  const state = await getState();
  populateForm(state, true);
  render(state);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) {
      return;
    }

    const next = mergeState(changes[STORAGE_KEY].newValue);
    populateForm(next, false);
    render(next);
  });
});

function bindEvents() {
  refs.useCurrentTabBtn.addEventListener("click", handleUseCurrentTab);
  refs.openXBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://x.com/home" });
  });
  refs.extractAuthBtn.addEventListener("click", handleExtractAuthorization);
  refs.startBtn.addEventListener("click", handleStartFresh);
  refs.resumeBtn.addEventListener("click", handleResumeSavedJob);
  refs.stopBtn.addEventListener("click", handleStop);
  refs.resetBtn.addEventListener("click", handleResetProgress);
  refs.clearLogBtn.addEventListener("click", handleClearLogView);

  refs.authInput.addEventListener("change", saveFormSettings);
  refs.rateLimitInput.addEventListener("change", saveFormSettings);
  refs.delayInput.addEventListener("change", saveFormSettings);
}

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
    targetTabId: null,
    targetTabTitle: "",
    targetTabUrl: "",
    targetOrigin: "https://x.com",
    fileName: "",
    startedAt: null,
    updatedAt: null,
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

function withLog(state, level, text) {
  return {
    ...state,
    logs: [...state.logs, makeLog(level, text)].slice(-MAX_LOGS)
  };
}

function populateForm(state, force) {
  if (force || document.activeElement !== refs.authInput) {
    refs.authInput.value = state.authorization || "";
  }

  if (force || document.activeElement !== refs.rateLimitInput) {
    refs.rateLimitInput.value = String(
      Number.parseInt(state.rateLimitCheckSeconds, 10) ||
        DEFAULT_RATE_LIMIT_CHECK_SECONDS
    );
  }

  if (force || document.activeElement !== refs.delayInput) {
    refs.delayInput.value = String(Number.parseInt(state.requestDelayMs, 10) || 0);
  }
}

function render(state) {
  const processed = Math.min(state.nextIndex, state.total);
  const remaining = Math.max(state.total - processed, 0);
  const percent = state.total > 0 ? (processed / state.total) * 100 : 0;

  refs.tabSummary.textContent = state.targetTabId
    ? `${state.targetTabTitle || "X tab"} (${state.targetTabUrl || "x.com"})`
    : "No X tab selected yet.";
  refs.fileSummary.textContent = state.fileName
    ? `${state.fileName} loaded with ${state.total} tweet IDs.`
    : "No archive loaded yet.";
  refs.processedValue.textContent = `${processed} / ${state.total || 0}`;
  refs.nextCheckValue.textContent = state.nextCheckAt
    ? formatDateTime(state.nextCheckAt)
    : "None";
  refs.lastTweetValue.textContent = state.lastTweetId || "None";
  refs.lastResponseValue.textContent =
    state.lastResponseStatus === null ? "None" : String(state.lastResponseStatus);
  refs.progressFill.style.width = `${percent}%`;
  refs.progressSummary.textContent = getProgressSummary(state, remaining);

  refs.statusPill.textContent = humanizeStatus(state.status);
  refs.statusPill.className = `status-pill ${state.status}`;

  refs.resumeBtn.disabled = state.tweetIds.length === 0;
  refs.stopBtn.disabled = !["running", "rate_limited", "starting", "stopping"].includes(
    state.status
  );

  renderLogs(state.logs);
}

function renderLogs(logs) {
  refs.logList.innerHTML = "";

  if (!logs.length) {
    const empty = document.createElement("div");
    empty.className = "log-empty";
    empty.textContent = "Logs will appear here once the extension starts working.";
    refs.logList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const entry of logs) {
    const item = document.createElement("article");
    item.className = `log-entry ${entry.level}`;

    const time = document.createElement("div");
    time.className = "log-time";
    time.textContent = formatTime(entry.ts);

    const text = document.createElement("div");
    text.className = "log-text";
    text.textContent = entry.text;

    item.append(time, text);
    fragment.appendChild(item);
  }

  refs.logList.appendChild(fragment);
  refs.logList.scrollTop = refs.logList.scrollHeight;
}

function humanizeStatus(status) {
  const labels = {
    idle: "Idle",
    starting: "Starting",
    running: "Running",
    rate_limited: "Rate Limited",
    stopping: "Stopping",
    stopped: "Stopped",
    completed: "Completed",
    error: "Error"
  };

  return labels[status] || status;
}

function getProgressSummary(state, remaining) {
  if (state.error) {
    return `Stopped with an error: ${state.error}`;
  }

  if (state.status === "rate_limited" && state.nextCheckAt) {
    return `Rate limited. ${remaining} tweet IDs remain. The next check is scheduled for ${formatDateTime(
      state.nextCheckAt
    )}.`;
  }

  if (state.status === "completed") {
    return "All tweet IDs in the loaded archive have been processed.";
  }

  if (state.status === "stopped") {
    return `${remaining} tweet IDs remain. Click “Resume Saved Job” to continue later.`;
  }

  if (!state.total) {
    return "Waiting for a job to start.";
  }

  return `${remaining} tweet IDs remain. Current status: ${humanizeStatus(state.status)}.`;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function isXUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "x.com";
  } catch {
    return false;
  }
}

async function findUsableTab() {
  const state = await getState();

  if (state.targetTabId) {
    try {
      const tab = await chrome.tabs.get(state.targetTabId);

      if (tab && isXUrl(tab.url)) {
        return tab;
      }
    } catch {
      // Ignore closed or inaccessible tabs.
    }
  }

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (activeTab && isXUrl(activeTab.url)) {
    return activeTab;
  }

  const tabs = await chrome.tabs.query({
    url: ["https://x.com/*"]
  });

  return tabs[0] || null;
}

async function ensureTargetTab() {
  const tab = await findUsableTab();

  if (!tab) {
    throw new Error("Open a logged-in x.com tab first, then try again.");
  }

  return tab;
}

async function rememberTargetTab(tab) {
  const state = await getState();
  const next = withLog(
    {
      ...state,
      targetTabId: tab.id,
      targetTabTitle: tab.title || "X",
      targetTabUrl: tab.url || "",
      targetOrigin: "https://x.com"
    },
    "info",
    `Using X tab: ${tab.title || tab.url}`
  );
  await setState(next);
  return next;
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
}

async function sendTabCommand(tabId, command) {
  await ensureContentScript(tabId);
  return chrome.tabs.sendMessage(tabId, command);
}

async function saveFormSettings() {
  await patchState({
    authorization: normalizeAuthorization(refs.authInput.value),
    rateLimitCheckSeconds: sanitizePositiveInt(
      refs.rateLimitInput.value,
      DEFAULT_RATE_LIMIT_CHECK_SECONDS
    ),
    requestDelayMs: sanitizePositiveInt(refs.delayInput.value, 0)
  });
}

function extractAuthorization(text) {
  const patterns = [
    /-H\s+['"]authorization:\s*([^'"]+)['"]/i,
    /^authorization:\s*(.+)$/im,
    /^Authorization:\s*(.+)$/im
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      return normalizeAuthorization(match[1]);
    }
  }

  return "";
}

function normalizeAuthorization(value) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
}

async function handleUseCurrentTab() {
  try {
    const tab = await ensureTargetTab();
    await rememberTargetTab(tab);
  } catch (error) {
    await reportDashboardError(error);
  }
}

async function handleExtractAuthorization() {
  const extracted = extractAuthorization(refs.helperInput.value);

  if (!extracted) {
    await reportDashboardError(
      new Error("No Authorization header was found in the pasted text.")
    );
    return;
  }

  refs.authInput.value = extracted;
  await saveFormSettings();
}

function parseTweetIds(text) {
  const start = text.indexOf("[");

  if (start === -1) {
    throw new Error("The selected file does not contain a JSON array.");
  }

  const parsed = JSON.parse(text.slice(start));
  const uniqueIds = [];
  const seen = new Set();

  for (const item of parsed) {
    const tweetId = item?.tweet?.id_str;

    if (tweetId && !seen.has(tweetId)) {
      seen.add(tweetId);
      uniqueIds.push(tweetId);
    }
  }

  if (!uniqueIds.length) {
    throw new Error("No tweet IDs were found in the selected archive file.");
  }

  return uniqueIds;
}

async function handleStartFresh() {
  try {
    const tab = await ensureTargetTab();
    const file = refs.fileInput.files[0];

    if (!file) {
      throw new Error("Choose your tweets.js file before starting.");
    }

    const authorization =
      normalizeAuthorization(refs.authInput.value) ||
      extractAuthorization(refs.helperInput.value);

    if (!authorization) {
      throw new Error("Paste a valid Authorization bearer token first.");
    }

    const ids = parseTweetIds(await file.text());
    const state = mergeState({
      authorization,
      rateLimitCheckSeconds: sanitizePositiveInt(
        refs.rateLimitInput.value,
        DEFAULT_RATE_LIMIT_CHECK_SECONDS
      ),
      requestDelayMs: sanitizePositiveInt(refs.delayInput.value, 0),
      tweetIds: ids,
      total: ids.length,
      nextIndex: 0,
      status: "starting",
      stopRequested: false,
      nextCheckAt: null,
      error: "",
      fileName: file.name,
      lastTweetId: "",
      lastResponseStatus: null,
      startedAt: Date.now(),
      targetTabId: tab.id,
      targetTabTitle: tab.title || "X",
      targetTabUrl: tab.url || "",
      targetOrigin: "https://x.com",
      logs: [
        makeLog("info", `Loaded ${ids.length} tweet IDs from ${file.name}.`),
        makeLog("info", `Using X tab: ${tab.title || tab.url}`),
        makeLog("info", "Starting deletion loop in the page...")
      ]
    });

    await setState(state);
    await sendTabCommand(tab.id, { type: "DEX_START" });
  } catch (error) {
    await reportDashboardError(error);
  }
}

async function handleResumeSavedJob() {
  try {
    const currentState = await getState();

    if (!currentState.tweetIds.length) {
      throw new Error("There is no saved job to resume yet.");
    }

    const tab = await ensureTargetTab();
    const authorization =
      normalizeAuthorization(refs.authInput.value) ||
      currentState.authorization ||
      extractAuthorization(refs.helperInput.value);

    if (!authorization) {
      throw new Error("Paste a valid Authorization bearer token first.");
    }

    const nextState = withLog(
      {
        ...currentState,
        authorization,
        rateLimitCheckSeconds: sanitizePositiveInt(
          refs.rateLimitInput.value,
          DEFAULT_RATE_LIMIT_CHECK_SECONDS
        ),
        requestDelayMs: sanitizePositiveInt(refs.delayInput.value, 0),
        targetTabId: tab.id,
        targetTabTitle: tab.title || "X",
        targetTabUrl: tab.url || "",
        targetOrigin: "https://x.com",
        status: "starting",
        stopRequested: false,
        nextCheckAt: null,
        error: ""
      },
      "info",
      "Resuming the saved deletion job..."
    );

    await setState(nextState);
    await sendTabCommand(tab.id, { type: "DEX_RESUME" });
  } catch (error) {
    await reportDashboardError(error);
  }
}

async function handleStop() {
  const state = await getState();
  const nextState = withLog(
    {
      ...state,
      status: "stopping",
      stopRequested: true
    },
    "warn",
    "Stop requested from the dashboard."
  );

  await setState(nextState);

  if (state.targetTabId) {
    try {
      await sendTabCommand(state.targetTabId, { type: "DEX_STOP" });
    } catch {
      // The content script may already be gone; the stored stop flag still helps.
    }
  }
}

async function handleResetProgress() {
  const confirmed = window.confirm(
    "Reset the saved extension job and clear the loaded archive progress?"
  );

  if (!confirmed) {
    return;
  }

  const state = await getState();
  const nextState = mergeState({
    authorization: normalizeAuthorization(refs.authInput.value) || state.authorization,
    rateLimitCheckSeconds: sanitizePositiveInt(
      refs.rateLimitInput.value,
      DEFAULT_RATE_LIMIT_CHECK_SECONDS
    ),
    requestDelayMs: sanitizePositiveInt(refs.delayInput.value, 0),
    targetTabId: state.targetTabId,
    targetTabTitle: state.targetTabTitle,
    targetTabUrl: state.targetTabUrl,
    targetOrigin: state.targetOrigin,
    logs: [makeLog("info", "Saved job progress was reset from the dashboard.")]
  });

  refs.fileInput.value = "";
  refs.helperInput.value = "";
  await setState(nextState);
}

async function handleClearLogView() {
  const state = await getState();
  await setState({
    ...state,
    logs: [makeLog("info", "Log view cleared from the dashboard.")]
  });
}

async function reportDashboardError(error) {
  const state = await getState();
  const message = error instanceof Error ? error.message : String(error);
  await setState(
    withLog(
      {
        ...state,
        status: "error",
        error: message
      },
      "error",
      message
    )
  );
}
