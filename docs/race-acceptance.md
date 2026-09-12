# 竞速试玩与好友榜验收

工程直接使用当前 arrow-game，重新编译后主页会出现竞速入口。普通闯关通关第5关后解锁；第20关仍解锁原有挑战。

本版不需要开通微信云开发。好友成绩使用微信小游戏自带的用户数据托管接口，好友信息只在开放数据域绘制。构建输出已包含 `open-data/index.js` 和 `game.json` 的开放数据域配置。

## 本地验证

运行 `node scripts/check.cjs`、`node scripts/test.cjs p7`、`node scripts/test.cjs`。完整日志在 reports/all-tests.log。竞速浏览器截图在 reports/screenshots/race-*.png。

## 微信真机步骤

1. 用已有 AppID 编译工程，用 iPhone 15 Pro 进入。通关第5关后检查解锁提示和主页入口。
2. 选择每日或每周，开始10关竞速；确认没有倒计时与道具、点错只提示、不扣次数也不失败、重跑回到第一关。
3. 暂停或切后台10秒再回来，累计用时应增加；箭头不会因切后台提前消除。返回主页确认普通关卡保持不变。
4. 完成10关，在个人历史检查成绩；网络失败时用结果页或历史页重试同步。
5. 至少两个已互加好友、具备当前体验版本访问权限的微信账号，完成同一赛期10关；从主页右上角进入排行榜，切换好友榜/个人榜及每日/每周；授权好友信息后，互相检查排行和用时升序。微信官方说明：新添加的好友在2小时内可能尚不可见。
6. 拒绝好友授权后，点击“好友授权”重新请求；失败弹窗仅在权限明确未开启时提供“去设置”，主动确认后再打开设置，授权后重新读取。网络失败点击独立“刷新”按钮，不应显示伪造成绩。
7. 检查日榜与周榜相互独立；同版本同赛期关卡一致。北京时间零点/周一零点切换后，旧赛期成绩不能出现在新榜。进行中的旧赛期完成后仅记本机。

个人历史只保存在本机，卸载或清理数据可能丢失。好友最佳上传以本机保存的本期最佳为准，换机或清除数据后没有跨设备最佳合并。本版未提供服务器防篡改校验，不用于有奖赛事。

接口依据：[微信官方 API 类型说明](https://github.com/wechat-miniprogram/minigame-api-typings/blob/master/types/wx/lib.wx.api.d.ts)，涉及 getFriendCloudStorage、scope.WxFriendInteraction、setUserCloudStorage；[微信官方开放数据域示例](https://github.com/wechat-miniprogram/minigame-canvas-engine/tree/master/demos/noengine)。

自动测试中的微信接口为模拟验证，不能替代实际微信账号和手机验收。

2026-09-12 移动提速更新：竞速版本2使用24格/秒基础速度及距离加速；个人历史展示版本号，好友榜隔离版本1旧成绩。重新编译后生效。

本人显示验收：未授权好友信息时，底部“我”仍核对本人托管成绩；完成本期10关并同步后显示用时。未完赛显示说明，上传失败保留本机成绩并提示待同步，个人榜同步成功后刷新好友榜。

若只进入“个人信息与权限使用记录”：新代码不会直接跳设置，会先请求微信隐私授权和好友授权，失败时显示原始原因。检查公众平台后台《用户隐私保护指引》是否声明微信朋友关系；本地代码无法确认后台是否已提交生效。依据微信官方 requirePrivacyAuthorize 说明：https://github.com/wechat-miniprogram/minigame-api-typings/blob/master/types/wx/lib.wx.api.d.ts 。

### 隐私告知弹窗接入（2026-09-12，当前规则）
真机报错 `please go to mp open official popup or use wx.onNeedPrivacyAuthorization`，说明声明朋友关系之外，还需要启用隐私告知流程。现于平台初始化注册微信自定义隐私授权事件；展示用途说明，提供查看完整指引、明确同意、拒绝入口。查看指引不等于同意；返回后仍需点击同意。拒绝、取消或打开失败均不会自动授权。后台仍需保持朋友关系用途声明。当前没有地区榜，不需要声明或申请位置信息。
验证：重新编译并扫码打开最新预览，进入好友榜点击好友授权，查看指引并返回，点击同意后再完成微信朋友权限授权。取消后普通游戏与本机个人榜仍可使用。自动化验证覆盖同意、拒绝、并发请求、协议返回和打开失败；iPhone 真机结果待复验。
官方接口依据：https://github.com/wechat-miniprogram/minigame-api-typings/blob/master/types/wx/lib.wx.api.d.ts （onNeedPrivacyAuthorization / openPrivacyContract）
