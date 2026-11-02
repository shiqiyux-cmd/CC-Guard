# scripts/
> L2 | 父级: ../CLAUDE.md
test-ui.ts: bun run test:ui。Edge 无头 + vite + Tauri mockIPC 假后端（tests/app-fixture.tsx）：向导、secret 不回显、三色状态、unknown 不显示绿色、概览线路图、启动被拦、账号切换确认、漏网置顶与侧栏计数、网页版核验与关闭定位、检查规则、英文无中文、深色；截图等入场动画结束后写入系统临时目录，docs/images 从这里取。
test-identities-ui.ts / test-browser-profiles.ts: bun run test:identities。账号卡片与保留选项的界面模拟，以及两份持久浏览器资料的 Cookie/本地存储隔离。
test-windows.py: bun run test:windows。CLI 原生/npm/WinGet 隔离样本的卸载重装与失败保护，语言/区域写入后还原。
claude-cli.ps1: claude_cli.rs 内嵌的 Windows CLI 管理脚本；原生重装先下载并解析官方安装器再卸载旧程序。
windows-region.ps1: 当前用户首选语言与区域格式的写入核验。
check-egress.py: 手动只读对照日常和 Claude 专用入口，显示 Ping0、Cloudflare 和 ipify 报出的公网 IP、查询耗时、命中规则、节点及前置，并列出当前能识别的 Codex、ChatGPT 和 Claude 进程连接。
fetch-browser.py / package-browser.ps1: 按固定 SHA-256 下载并核验 Fingerprint Chromium 引擎；package-browser.ps1 是打包前置检查（tauri beforeBuildCommand）。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
