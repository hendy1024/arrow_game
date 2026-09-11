# 箭间 · 微信箭头消除小游戏

第一版源码、微信构建、本地试玩入口及自动化测试。AppID 已配置为 `wx47e5456f2f4f5ade`。

## 导入微信开发者工具

1. 将本目录完整放到目标位置；用户指定位置为 `F:\User\wechat_game\codex`。
2. 打开微信开发者工具，导入包含本 README 和 `project.config.json` 的根目录。不要只导入 `src`。
3. 核对 AppID 和项目类型“小游戏”。配置已指定 `miniprogramRoot` 为 `dist/wechat/`。
4. 点击编译。已有微信构建可直接使用，无需先安装 npm 包。
5. 点击预览，用有该小游戏权限的微信账号扫码，在 iPhone 15 Pro 上检查。

仅 AppID 不代表当前登录微信账号已获得该小游戏的开发者或体验者权限。真实编译、扫码、iPhone 和 Android 验收结果需在 `reports/device-validation.json` 中据实记录；当前未记录为通过。

## 本地命令

在本目录打开 PowerShell。已验证环境为 Node.js 24.14.0、npm 11.9.0。没有运行时依赖，也不需要下载第三方包。

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

`dev` 启动后打开 `http://127.0.0.1:4173`。这是同一画布游戏的本地测试入口，不代替微信真机预览。

只运行某阶段测试：

```powershell
npm.cmd test -- p2
npm.cmd run validate:levels
npm.cmd run verify:devices
```

全量 `npm test` 包含真实 Edge 浏览器测试，默认浏览器位置为 `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`。其他安装位置可设置 `EDGE_PATH`；需要 Node.js 22 或以上的内置 WebSocket。浏览器启动失败会使测试失败，不会跳过。测试使用独立临时浏览器资料，不访问个人浏览器账户；本机受限进程环境采用软件绘制和进程内 GPU，不代表手机 GPU 性能。

`verify:devices` 是独立的真实设备验收门槛；没有真实记录会返回非零退出码。不能为让这个命令变绿而填入模拟器数据。

## 已实现

- 四方向、直线及多转弯箭头；完整出口检测。
- 身体沿原路径跟随，尾部离开后消除。
- 可并行的独立移动、当前身体占用和出口冲突保护。
- 前期自由尝试；试验配置中第 21 关起每关 3 次机会。
- 首页、第一关教学、暂停、设置、重开确认、通关、失败与继续闯关。
- 五档随机难度、独立可解验证、种子复现和同布局重试。
- 双份带校验的存档、动画中断后的稳定恢复、读取失败保护和保存失败重试。
- 自制音效与震动开关。

临时游戏名称为“箭间”。生命切换、关卡密度和速度仍是试玩参数，集中在 `src/config.js`；未冒充已完成手机调参。

## 文件结构

| 目录 | 内容 |
| --- | --- |
| `src/domain` | 棋盘规则、生命、会话状态 |
| `src/movement` | 折线路径推进、当前占用 |
| `src/generation` | 随机生成、独立解法验证、保底关卡 |
| `src/input` | 最近箭头命中、触摸取消 |
| `src/ui` | 页面和交互控制 |
| `src/platform` | 微信及浏览器适配、声音震动 |
| `src/persistence` | 存档与恢复 |
| `dist/wechat` | 微信小游戏可导入构建 |
| `dist/preview` | 本地画布试玩构建 |
| `tests` | 分阶段有效测试 |
| `reports` | 测试结果、生成报告、截图、真机待验收记录 |
| `docs` | 需求副本、开发计划副本、实现与验收说明 |

## 开发调试

本地地址添加 `?debug` 后可在开发者控制台使用 `__arrowDebug.level(21, 51)`、`__arrowDebug.fixture('bent')` 和 `__arrowDebug.grid()`。默认试玩不暴露调试对象；微信构建不包含浏览器调试入口。

修改源码后重新运行测试与 `npm run build`。不要直接修改 `dist`。关卡 1 为受控教学布局；第 2 关起随机生成。30 关是首轮连续试玩验证范围，通关后仍可按最高难度继续生成，不设置未确认的最终关数。

## 状态边界

源码和本地自动化验证与真机验收分别记录。用户安排稍后导入并使用 iPhone 15 Pro 试玩；Android 设备尚未指定。当前不宣称已完成微信真机测试或公开发布。
