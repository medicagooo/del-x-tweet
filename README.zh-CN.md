# de-x.py

[English](README.md) | [简体中文](README.zh-CN.md)

无需付费 API 权限，删除你的推文、转推和回复历史。

## 概览

很多旧的 Twitter 清理工具在 X/Twitter 收紧 API 访问后已经失效。这个脚本采用了另一种方式：

- 从你导出的 Twitter 数据归档中读取 tweet ID。
- 复用你当前浏览器会话中的请求头进行授权。
- 直接发送删除请求，不需要开发者账号。

## 目录

- [依赖要求](#依赖要求)
- [快速开始](#快速开始)
- [准备工作](#准备工作)
- [运行](#运行)
- [实现原理](#实现原理)
- [注意事项](#注意事项)

## 依赖要求

- Python 3
- `requests`
- 你的 X/Twitter 数据归档，其中包含 `tweets.js`
- 一个当前仍然登录中的浏览器会话

使用项目自带虚拟环境安装依赖：

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

如果你还没有创建虚拟环境，可以这样初始化：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 快速开始

1. 在 X/Twitter 申请并下载你的数据归档。
2. 从归档中解压出 `tweets.js`。
3. 将浏览器请求头复制到 `request-headers.txt`。
4. 使用 `tweets.js` 和 `request-headers.txt` 运行脚本。

## 准备工作

### 1. 申请你的数据归档

在 X/Twitter 上申请导出账号数据。归档通常需要等待几天后才能下载。归档准备好后，你会在 App 或邮箱中收到通知。

![在 X 上申请 Twitter 归档](doc/archive.png)

### 2. 解压 `tweets.js`

下载 ZIP 压缩包后，请先解压到本地。你需要其中名为 `tweets.js` 的文件，它包含你的每一条推文、回复和转推，以及对应的 tweet ID。

### 3. 从浏览器导出请求头

脚本还需要一个当前有效、已登录浏览器会话中的请求头。如果没有这些请求头，X/Twitter 会拒绝删除请求。

浏览器获取方式：

1. Edge/Chrome：登录 X/Twitter，按 `Ctrl-Shift-i` 打开开发者工具，切换到 `Network` 标签页，点击任意请求后复制请求头。
2. Firefox：流程基本类似。
3. Burp Suite：录制浏览器访问会话，然后复制客户端请求头。

将 `Accept` 之后的请求头复制到本地文件，例如 `request-headers.txt`。

关键请求头包括：

- `Cookie`
- `X-Csrf-Token`
- `Authorization`

一个最小可用示例：

```text
Authorization: Bearer AAAAAAAAAAAAAAAAAAAAANR[...]
X-Csrf-Token: b0a38[...]
Cookie: [...] _twitter_sess=BAhD[...]; auth_token=24fa[...]
```

请确认复制结果中没有多余换行。

![在 twitter.com 中复制请求头](doc/session.png)

## 运行

准备好归档和请求头文件后，执行：

```bash
source .venv/bin/activate
python de-x.py tweets.js request-headers.txt
```

如果你使用系统 Python 并已经安装了依赖，也可以直接运行：

```bash
python3 de-x.py tweets.js request-headers.txt
```

## 实现原理

只要知道某条推文的 tweet ID，就可以对这条推文发起删除请求。所以最关键的问题，其实是先拿到所有要删除内容的 tweet ID。

这个脚本不依赖受限的 Twitter API，而是直接从你自己的数据归档中读取这些 ID。归档是完整的、免费的、机器可读的。拿到 ID 后，脚本再带着你当前浏览器会话中的请求头，逐条发送认证后的删除请求。

## 注意事项

- 这不是一个真正意义上的“一键删除”工具，你仍然需要手动导出归档并复制请求头。
- 会话请求头会过期。如果删除请求开始失败，请重新从浏览器里复制一份新的请求头。
- 这个脚本依赖 X/Twitter 当前的内部请求方式，未来平台变更后可能失效。
- 按照过去的经验，这种方式可以在较短时间内删除数千条推文。

如果你想在不支付 API 费用的前提下清理旧内容，这个项目提供了一种轻量、透明的实现方式。
