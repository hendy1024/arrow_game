'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Controller}=require('../src/ui/controller'),{Session}=require('../src/domain/session'),{View}=require('../src/ui/view');
const {fakePlatform}=require('./helpers.cjs'),{fixtures}=require('../src/fixtures');
function checkPopup(a,title,items){
 assert.equal(a.modal,'reward-items');assert.equal(a.rewardPopup.title,title);assert.deepEqual(a.rewardPopup.items,items);
 const v=new View(a.platform.ctx);v.render(a,{width:320,height:568,safeTop:24,safeBottom:24});
 assert.ok(a.platform.ctx.calls.some(c=>c[0]==='fillText'&&c[1]===title));
 for(const [k,name]of Object.entries({time:'加时',life:'容错',shuffle:'提示'}))assert.ok(a.platform.ctx.calls.some(c=>c[0]==='fillText'&&c[1]===name+' × '+items[k]));
 const b=v.buttons.find(b=>b.id==='reward-close');assert.equal(v.hitButton(b.x+b.width/2,b.y+b.height/2),'reward-close');
 assert.ok(v.dialogRect.y>=24&&v.dialogRect.y+v.dialogRect.height<=528);
}
test('P20 通关发奖先展示物品，收下后返回结算，重复事件不发奖',()=>{
 const a=new Controller(fakePlatform());a.unlocked=7;a.lifeIntroDone=true;a.screen='game';a.currentLevel=7;a.session=new Session({...fixtures.boundary,number:7});
 a.clickArrow('a');a.tick(1000);const items=require('../src/campaign/catalog').entry(7).rewards;
 checkPopup(a,'通关奖励',items);const inventory={...a.inventory};a.syncModal();a.events();checkPopup(a,'通关奖励',items);assert.deepEqual(a.inventory,inventory);
 a.action('reward-close');assert.equal(a.modal,'won');a.events();assert.equal(a.modal,'won');assert.deepEqual(a.inventory,inventory);
});
test('P20 通关奖励与解锁通知同时发生时先领奖再解锁再结算',()=>{
 const a=new Controller(fakePlatform());a.lifeIntroDone=true;a.screen='game';a.currentLevel=7;a.session=new Session({...fixtures.boundary,number:7});a.clickArrow('a');a.tick(1000);
 checkPopup(a,'通关奖励',require('../src/campaign/catalog').entry(7).rewards);a.action('reward-close');assert.equal(a.modal,'race-unlocked');a.action('race-notice-close');assert.equal(a.modal,'won');
});
test('P20 分享返回展示各5件奖励，重复分享不重复弹发奖窗口，每日领取独立展示',()=>{
 const a=new Controller(fakePlatform());a.platform.share=()=>{};const returned=require('../src/ui/sharing').returned;
 a.action('share');a.action('share-start');a.sharePending.departed=true;returned(a);
 checkPopup(a,'每日分享奖励',{time:5,life:5,shuffle:5});assert.deepEqual(a.inventory,{time:15,life:15,shuffle:15});returned(a);assert.equal(a.inventory.time,15);
 a.action('reward-close');assert.equal(a.modal,'share-reward');a.action('share-start');a.sharePending.departed=true;returned(a);assert.equal(a.modal,'share-reward');assert.equal(a.rewardPopup,null);assert.equal(a.inventory.time,15);
 a.action('share-close');a.action('daily-reward');checkPopup(a,'每日道具奖励',require('../src/ui/rewards').DAILY);
});

