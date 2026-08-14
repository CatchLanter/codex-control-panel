# Codex 控制面板

Codex 风格的本地桌面控制面板：在一个窗口里管理多个真实终端、浏览并继续 Codex
对话、按终端独立控制权限模式，并快速切换 API、模型与推理强度。

## 功能

- 多终端：真实 cmd / PowerShell / PowerShell 7 / WSL 进程，标签页与网格两种排布
- Codex 对话历史：读取 `~/.codex/sessions`，显示对话标题，点击直接
  `codex resume <id>` 续聊，支持重命名与永久删除
- 每终端独立权限模式：默认 / 计划（只读）/ 自动 / 完全自动 / 自定义；
  运行中的 Codex 终端通过 `/plan`、`/auto`、`/permissions` 即时切换
- API 与模型：在设置或右栏切换 API 服务（provider）、模型（如
  deepseek-v4-flash / deepseek-v4-pro）和推理强度（low/medium/high/max），
  支持添加自定义 API，写入 `~/.codex/config.toml`（自动备份 .bak）
- 终端会话历史：输出自动落盘，可搜索、回放、导出、恢复
- 无边框窗口：细标题栏 + 右上角原生风格最小化/最大化/关闭按钮
- 快捷键：命令面板、新建/关闭终端、切换标签等，全部可在设置中修改

## 架构

应用由三个进程组成：

```text
┌─────────────────────────────┐
│ Electron 主进程（main）       │  窗口、生命周期、历史与设置存储、IPC 路由
│  src/main/index.ts          │
│  src/main/ipc/*.ts          │  按领域拆分的 IPC 模块
└──────────────┬──────────────┘
               │ stdio JSON-RPC
┌──────────────▼──────────────┐
│ 终端守护进程（pty-daemon）     │  用系统 Node 运行，持有真实 PTY
│  node dist/main/pty-daemon  │  node-pty / ConPTY，不依赖 Electron ABI
└─────────────────────────────┘

渲染进程（React + xterm.js）
  状态逻辑拆分到 src/renderer/src/hooks/
  展示组件在 src/renderer/src/components/
```

关键点：

- 终端引擎跑在独立 Node 守护进程里，Electron 主进程通过管道 JSON-RPC 与其通信，
  避免原生模块与 Electron ABI 绑定，也便于单独测试
- 主进程按 `session / history / settings / codex / system` 五个模块注册 IPC，
  入口只负责装配依赖和生命周期
- 共享类型、权限模式映射、快捷键工具放在 `src/shared/`，主进程与渲染层复用

## 目录结构

```text
src/
  main/                  Electron 主进程
    ipc/                 IPC 注册（session/history/settings/codex/system）
    terminal-manager.ts  PTY 会话管理（纯 Node，可脱离 Electron 测试）
    pty-daemon.ts        终端守护进程入口
    pty-client.ts        主进程侧的守护进程 RPC 客户端
    codex.ts             Codex CLI 检测、config.toml 读写、对话删除
    codex-sessions.ts    对话会话扫描、标题提取、重命名
    history-store.ts     终端历史 NDJSON 存储
    settings.ts          应用设置 JSON 存储
    window.ts            无边框主窗口
  preload/               contextBridge 暴露的安全 API
  shared/                类型与纯工具（权限模式、快捷键）
  renderer/
    src/hooks/           状态逻辑（settings/sessions/conversations/history/codex）
    src/components/      UI 组件
scripts/                 构建辅助、冒烟与端到端测试
```

## 开发

```bash
npm install        # 安装依赖（postinstall 自动补齐 Windows PTY 预编译二进制）
npm run dev        # Vite + 主进程编译 + Electron，热更新
```

环境要求：Windows 10/11、Node.js 20+（终端守护进程用它运行）、本机安装 Codex CLI。

## 测试

```bash
npm run smoke      # 终端引擎冒烟测试：真实 cmd 收发 + 退出
npm run e2e        # 端到端：客户端→守护进程→cmd 往返 + 进程树清理
```

## 构建

```bash
npm run build      # 类型检查 + 打包渲染层与主进程
npm start          # 构建后直接运行
npm run pack       # 用 electron-builder 生成 Windows 安装包（release/）
```

打包前准备：

- 把与终端守护进程同 ABI 的 Node 运行时放到 `build/node/node.exe`
  （本机 Node 24.15.0 即 ABI 137，与 node-pty 预编译二进制匹配）
- 应用图标放到 `build/icon.ico`（Windows 安装包与桌面图标使用）

## 快捷键（默认，可在设置中修改）

| 动作 | 快捷键 |
| --- | --- |
| 命令面板 | Ctrl+Shift+P |
| 新建终端 | Ctrl+Shift+N |
| 关闭当前终端 | Ctrl+W |
| 下一个 / 上一个标签 | Ctrl+Tab / Ctrl+Shift+Tab |
| 开关历史侧栏 | Ctrl+B |
| 打开设置 | Ctrl+, |

## 数据位置

- 应用设置与终端历史：`%APPDATA%\codex-control-panel\data\`
- Codex 配置（API/模型切换实际写入这里）：`%USERPROFILE%\.codex\config.toml`

## 隐私说明

应用完全本地运行，不包含遥测或数据上报。读取 Codex 配置时只会把 API 密钥的
“是否存在”传给界面，密钥本身不会被上传或记录；API 密钥仍以 Codex 原生格式
保存在本机 `config.toml` 中。
