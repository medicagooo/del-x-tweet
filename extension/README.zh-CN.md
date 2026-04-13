# Chrome 扩展原型

这个目录里放的是项目的本地 Chrome 扩展版本。

## 它能做什么

- 点击扩展图标打开一个控制面板
- 上传 `tweets.js`
- 手动填写 `Authorization` bearer token
- 复用当前已登录 `x.com` 标签页里的会话 Cookie 和 CSRF token
- 提供实时日志、保存进度和限流后轮询续跑

## 重要限制

- 删除过程中请保持一个已登录的 `x.com` 标签页处于打开状态。
- 扩展不会导出你的 Cookie，它只会在当前标签页里使用现成登录态。
- `Authorization` 仍然需要你手动提供。
- 这是一个原型版本，X 一旦调整内部删除流程，扩展也可能失效。

## 在 Chrome 中加载

1. 打开 `chrome://extensions`
2. 开启 `开发者模式`
3. 点击 `加载已解压的扩展程序`
4. 选择本仓库中的 `extension/` 目录

## 使用方式

1. 打开 `x.com` 并保持登录。
2. 点击扩展图标打开控制面板。
3. 点击 `Use Current X Tab`。
4. 粘贴 `Authorization` token，或者粘贴复制出来的 cURL / 请求头并点击 `Extract Authorization`。
5. 上传你的 `tweets.js`。
6. 点击 `Start Fresh` 或 `Resume Saved Job`。

## 续跑行为

- 扩展会把 tweet ID、当前进度、日志和下一个索引保存到 `chrome.storage.local`。
- 如果控制面板被关掉，你可以重新打开后点击 `Resume Saved Job`。
- 如果遇到限流，内容脚本会按照设置的间隔继续检查并恢复删除。
