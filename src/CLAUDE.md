# src/
> L2 | 父级: ../CLAUDE.md
界面只管输入、显示和执行记录；权限、进程和网络都在原生层，每次启动都由原生端重新检查。命令契约见 contract.ts。
contract.ts: 前后端命令契约（命令名、参数、返回 JSON）的唯一来源，含沿用命令 KEPT 与已删除命令 REMOVED。
main.tsx: 主窗口：左侧栏（概览、账号、连接、网页版，底部设置；概览旁线路信号灯、连接旁漏网数），右侧内容纸张（非概览页顶部线路信号条），首次向导，Toast；连接监控在这一层，窗口隐藏时停止轮询。
overview.tsx: 默认首页：大号信号面板 + Claude 流量线路图（Claude → 专用端口 → 节点 → 出口，轨道只随判定上色）、三张启动卡片、当前账号与连接监控摘要。
status-bar.tsx: useLineCheck、freshCheck 与 StatusBar：各页信号条（判定、原因、出口地区 / IP / 分流模式、检查时间、「重新检查」）和概览大号面板；pass 绿、block 红、unknown 灰。
line-model.ts / line-model.test.ts: 显示用判定（错误、无结果、过期一律 unknown）、首次设置判断、分流模式文案、漏网合并排序。
wizard.tsx: 首次向导（controller 空或 port 为 0 时弹出）：连上 Clash → 选端口和节点 → 检查并记住出口。
settings.tsx: 设置页：线路（草稿探测、手填服务商新 IP 并验证后更换）、检查规则（出口查询服务、Claude 域名与进程名）、外观（语言、主题）、后台守护说明、关于（CLI 卸载/重装）。
launch-bar.tsx: useLaunch 与 LaunchPanel：概览的「Claude Code / 桌面版 / 网页版」启动卡片，Claude Code 卡片显示并可更改 CLI 工作目录；被拦或出错用 Toast 显示原因并回写检查结果。
connections.tsx: useConnections（主窗口层轮询，连接页 2 秒、其他页 10 秒，漏网记录跨页保留）与连接页：判定、Claude / 漏网读数、识别规则、漏网标红置顶；process_matching=false 时提示只按域名核对。
identities.tsx: 账号页：当前账号大卡片、已暂存账号（切换 / ⋯ 改名删除）、空账号，右栏保留选项、浏览器联动与切换四步；切换与删除确认。
identity-model.ts: 身份、保留策略、账号显示字段与浏览器绑定类型；不含凭据。
browser-panel.tsx: 网页版页：browser_read 快照（引擎、运行、资料联动、回传时间、环境核验、目标环境、本机状态），system_disable_location 只打开 Windows 设置，启动走 useLaunch('web')。
claude-cli-panel.tsx: Claude Code CLI 版本、安装方式与路径，确认后的卸载/重装（未安装时为安装）。
cleaner-activity.tsx / cleaner-model.ts / cleaner-model.test.ts: 身份与 CLI 事务的进度和日志，路径父子去重与规模格式化。
browser-start.tsx / browser-model.ts / browser-network.ts / browser-network.test.ts: 指纹浏览器起始页：真实 navigator/Intl 与出口观测上报，目标地区核验，服务限流时切换备用服务；browser-model 也是网页版页的快照类型。
theme.ts: 浅色/深色/跟随系统，只存 localStorage。
i18n.ts / i18n.test.ts: 文案翻译与原生消息模板匹配；测试要求中英键一致、界面文案全在 YAML 里（t() 的非字面量键不在检查范围，新增时要手工补齐并跑英文界面模拟）。
index.css: 「信号所」设计令牌：暖灰纸面、墨色主按钮、信号蓝焦点，pass 是唯一绿色；Windows 自带字体（Bahnschrift / Segoe UI Variable / Cascadia Mono），线路轨道、信号灯与入场动画。
app-version.d.ts: 构建时注入的 __APP_VERSION__ 声明。
components/ui/: Button、Card / CardTitle、Badge、Avatar、Dialog（警告默认聚焦取消）、Input / Textarea、Select、Switch、Checkbox、Tooltip、Toast、DropdownMenu、page（PageHeader、Stat、Section、Chip）与 cn；基于 radix-ui。
locales/: 中英文 YAML 文案；见其 CLAUDE.md。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
