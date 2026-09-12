# 竞速试玩与好友榜验收

工程直接使用当前 arrow-game，重新编译后主页会出现竞速入口。普通闯关到达第15关解锁；第20关仍解锁原有挑战。

本版不需要开通微信云开发。好友成绩使用微信小游戏自带的用户数据托管接口，好友信息只在开放数据域绘制。构建输出已包含 `open-data/index.js` 和 `game.json` 的开放数据域配置。

## 本地验证

运行 `node scripts/check.cjs`、`node scripts/test.cjs p7`、`node scripts/test.cjs`。完整日志在 reports/all-tests.log。竞速浏览器截图在 reports/screenshots/race-*.png。

## 微信真机步骤

1. 用已有 AppID 编译工程，用 iPhone 15 Pro 进入。到达15关后检查解锁提示和主页入口。
2. 选择每日或每周，开始10关竞速；确认没有倒计时与道具、三次点错结束整轮、重跑回到第一关。
3. 暂停或切后台10秒再回来，累计用时应增加；箭头不会因切后台提前消除。返回主页确认普通关卡保持不变。
4. 完成10关，在个人历史检查成绩；网络失败时用结果页或历史页重试同步。
5. 至少两个已互加好友、具备当前体验版本访问权限的微信账号，完成同一赛期10关；授权好友信息后，互相检查排行和用时升序。微信官方说明：新添加的好友在2小时内可能尚不可见。
6. 拒绝好友授权后，点击“下一页 / 授权重试”打开微信设置，授权后重新读取。网络失败返回再进，不应显示伪造成绩。
7. 检查日榜与周榜相互独立；同版本同赛期关卡一致。北京时间零点/周一零点切换后，旧赛期成绩不能出现在新榜。进行中的旧赛期完成后仅记本机。

个人历史只保存在本机，卸载或清理数据可能丢失。好友最佳上传以本机保存的本期最佳为准，换机或清除数据后没有跨设备最佳合并。本版未提供服务器防篡改校验，不用于有奖赛事。

接口依据：[微信官方 API 类型说明](https://github.com/wechat-miniprogram/minigame-api-typings/blob/master/types/wx/lib.wx.api.d.ts)，涉及 getFriendCloudStorage、scope.WxFriendInteraction、setUserCloudStorage；[微信官方开放数据域示例](https://github.com/wechat-miniprogram/minigame-canvas-engine/tree/master/demos/noengine)。

自动测试中的微信接口为模拟验证，不能替代实际微信账号和手机验收。
