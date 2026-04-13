const DASHBOARD_URL = chrome.runtime.getURL("dashboard.html");

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});
