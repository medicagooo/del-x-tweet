<div align="center">
  <h1>de-x</h1>
  <p><strong>无需付费 API 权限，删除你的推文、转推和回复历史。</strong></p>
  <p>
    <a href="README.md">English</a> ·
    <a href="README.zh-CN.md">简体中文</a>
  </p>
  <p>
    <a href="#python-脚本版"><strong>Python 脚本版</strong></a> ·
    <a href="#chrome-扩展版"><strong>Chrome 扩展版</strong></a> ·
    <a href="extension/README.zh-CN.md"><strong>扩展说明</strong></a>
  </p>
  <p>
    <img alt="Python 脚本版" src="https://img.shields.io/badge/Workflow-Python%20Script-1f6feb?style=flat-square">
    <img alt="Chrome 扩展版" src="https://img.shields.io/badge/Workflow-Chrome%20Extension-0f766e?style=flat-square">
    <img alt="仅本地运行" src="https://img.shields.io/badge/Execution-Local%20Only-475569?style=flat-square">
  </p>
</div>

这个仓库现在提供两种使用方式：

- Python 脚本版：在本地终端里执行删除
- Chrome 扩展原型：在浏览器控制面板里执行删除

扩展目录在 [`extension/`](extension/README.zh-CN.md)。

## 目录

- [概览](#概览)
- [选择使用方式](#选择使用方式)
- [通用准备工作](#通用准备工作)
- [Python 脚本版](#python-脚本版)
- [Chrome 扩展版](#chrome-扩展版)
- [实现原理](#实现原理)
- [注意事项](#注意事项)

## 概览

很多旧的 Twitter 清理工具在 X/Twitter 收紧 API 访问后已经失效。这个项目采用了另一种方式：

- 从你导出的 Twitter 数据归档中读取 tweet ID
- 复用你当前浏览器里的已登录会话
- 直接发送删除请求，不依赖付费开发者 API

## 选择使用方式

### 方案 1：Python 脚本版

适合喜欢在终端里运行任务的人。

你需要准备：

- Python 3
- `requests`
- 包含 `tweets.js` 的 X/Twitter 数据归档
- 一个当前仍然登录中的浏览器会话
- `Authorization`、`X-Csrf-Token` 和 `Cookie`

### 方案 2：Chrome 扩展原型

适合希望在浏览器里看到日志、进度和恢复按钮的人。

你需要准备：

- Google Chrome 或 Microsoft Edge
- 一个保持登录状态的 `x.com` 标签页
- 包含 `tweets.js` 的 X/Twitter 数据归档
- 一个有效的 `Authorization` bearer token

扩展会直接复用当前 `x.com` 标签页里的 Cookie 和 CSRF token，所以不需要在控制面板里再手动填写这两项。

## 通用准备工作

### 1. 申请你的数据归档

在 X/Twitter 上申请导出账号数据。归档通常需要等待几天后才能下载。归档准备好后，你会在 App 或邮箱中收到通知。

![在 X 上申请 Twitter 归档](doc/archive.png)

### 2. 解压 `tweets.js`

下载 ZIP 压缩包后，请先解压到本地。你需要其中名为 `tweets.js` 的文件，它包含你的每一条推文、回复和转推，以及对应的 tweet ID。

### 3. 从浏览器导出请求头

你需要从当前已登录的浏览器会话里拿到有效的认证信息。

浏览器获取方式：

1. Edge/Chrome：登录 X/Twitter，按 `Ctrl-Shift-i` 打开开发者工具，切换到 `Network` 标签页，点击任意请求后复制请求头。
2. Firefox：流程基本类似。
3. Burp Suite：录制浏览器访问会话，然后复制客户端请求头。

关键请求头包括：

- `Authorization`
- `X-Csrf-Token`
- `Cookie`

在 Chrome 或 Edge 里，最清晰的操作流程是：

1. 打开已经登录的 `x.com`
2. 按 `Ctrl-Shift-i` 打开开发者工具
3. 进入 `Network`
4. 切到 `Fetch/XHR`
5. 用 `/i/api/` 或 `graphql` 过滤请求
6. 点开任意一条已登录请求，查看右侧 `Headers`

这时你应该能在右侧看到关键请求头：

![在 DevTools 中查看请求头](doc/network-request-headers.png)

接着：

1. 在左侧请求列表里右键同一条请求
2. 选择 `Copy`
3. 选择 `Copy as cURL (bash)`

![将请求复制为 cURL (bash)](doc/copy-as-curl-bash.png)

复制出来的数据这样使用：

- 对 Python 脚本版来说，把 `Authorization`、`X-Csrf-Token` 和 `Cookie` 提取出来写进 `.env`
- 对 Chrome 扩展版来说，把整段 cURL 粘贴到辅助输入框里，再点击 `Extract Authorization`

请确认复制出来的值都保持在单独一行里，不要出现额外换行。

## Python 脚本版

### 1. 安装依赖

如果仓库里已经有 `.venv`，直接安装依赖：

```bash
cd /home/medicago/projects/del-x-tweet
.venv/bin/pip install -r requirements.txt
```

如果你还没有虚拟环境：

```bash
cd /home/medicago/projects/del-x-tweet
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 2. 创建 `.env`

先复制模板：

```bash
cd /home/medicago/projects/del-x-tweet
cp .env.example .env
```

然后编辑 `.env`，填入你的值：

```dotenv
TWEETS_FILE=twitter/data/tweets.js
PROGRESS_FILE=.delete-progress.json
RATE_LIMIT_CHECK_INTERVAL_SECONDS=300
AUTHORIZATION="Bearer AAAAAAAAAAAAAAAAAAAAANR[...]"
X_CSRF_TOKEN="b0a38[...]"
COOKIE="ct0=...; auth_token=..."
```

### 3. 运行脚本

用下面这条命令启动，并在终端里实时看到日志：

```bash
cd /home/medicago/projects/del-x-tweet
.venv/bin/python -u de-x.py 2>&1 | tee -a delete-live.log
```

### 4. 中断后继续运行

脚本会把进度保存到 `.delete-progress.json`。

如果进程中断了，重新执行同一条命令即可：

```bash
cd /home/medicago/projects/del-x-tweet
.venv/bin/python -u de-x.py 2>&1 | tee -a delete-live.log
```

它会从保存的索引继续，而不是重新从头开始。

### 5. 兼容旧用法

如果你还是想单独维护请求头文件，也可以继续使用旧命令：

```bash
cd /home/medicago/projects/del-x-tweet
.venv/bin/python de-x.py tweets.js request-headers.txt
```

## Chrome 扩展版

仓库里也带了一个本地 Chrome 扩展原型，目录在 [`extension/`](extension/README.zh-CN.md)。

### 1. 在 Chrome 中加载

1. 打开 `chrome://extensions`
2. 开启 `开发者模式`
3. 点击 `加载已解压的扩展程序`
4. 选择本仓库中的 `extension/` 目录

### 2. 准备浏览器

1. 打开 `x.com`
2. 登录你的账号
3. 在删除过程中保持这个 `x.com` 标签页处于打开状态

### 3. 启动一个新任务

1. 点击扩展图标打开控制面板
2. 点击 `Use Current X Tab`
3. 粘贴 `Authorization` bearer token
4. 如果你复制的是完整 cURL 或请求头文本，就粘贴到辅助输入框，然后点击 `Extract Authorization`
5. 上传你的 `tweets.js`
6. 如有需要，设置限流检查间隔
7. 点击 `Start Fresh`

### 4. 恢复之前的任务

如果控制面板被关掉，或者运行过程中停了：

1. 重新打开扩展控制面板
2. 确认 `x.com` 标签页仍然打开并保持登录
3. 点击 `Use Current X Tab`
4. 确认 `Authorization` token 仍然存在
5. 点击 `Resume Saved Job`

扩展会把进度、日志和下一个索引保存到 `chrome.storage.local` 中。

## 实现原理

只要知道某条推文的 tweet ID，就可以对这条推文发起删除请求。最关键的问题，是先拿到所有要删除内容的 tweet ID。

这个项目不依赖受限的 Twitter API，而是直接从你自己的数据归档中读取这些 ID。归档是完整的、免费的、机器可读的。拿到 ID 后，脚本或扩展再利用你当前的登录会话去逐条发送删除请求。

## 注意事项

- 这不是一个真正意义上的“一键删除”工具，你仍然需要手动导出归档并提供有效认证信息。
- 会话信息会过期。如果请求开始失败，请从新的已登录浏览器会话中重新获取。
- 这个项目依赖 X/Twitter 当前的内部请求方式，未来平台变更后可能失效。
- 大批量删除时出现限流是正常现象，脚本版和扩展版都支持等待后继续执行。
- 按照过去的经验，这种方式可以在较短时间内删除数千条推文。
