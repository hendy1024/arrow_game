'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Controller}=require('../src/ui/controller'),{View}=require('../src/ui/view');
const {fakePlatform,fakeWx}=require('./helpers.cjs');
const {createWechatPlatform}=require('../src/platform/wechat');
const {bindPersistence}=require('../src/persistence/store');
const {launch,delay}=require('../scripts/cdp.cjs');
const fs=require('node:fs');

test('P13 浏览器点击体验版道具与主页新入口，补充库存重载保留',{timeout:30000},async()=>{
 require('../scripts/build.cjs').build();const b=await launch(),c=b.cdp,s=b.sessionId,e=x=>c.evaluate(x,s);
 async function click(id){const point=await e(`(()=>{const b=__arrowDebug.view.buttons.find(b=>b.id==='${id}'),r=document.querySelector('canvas').getBoundingClientRect();return [r.x+b.x+b.width/2,r.y+b.y+b.height/2];})()`);for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,x:point[0],y:point[1],button:'left',clickCount:1},s);await delay(50);}
 async function ready(){for(let i=0;i<150;i++){if(await e('!!window.__arrowDebug'))return;await delay(30);}throw Error('preview unavailable');}
 try{
  await c.send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true},s);await c.send('Page.navigate',{url:b.url+'/?debug'},s);await ready();
  await e('__arrowDebug.app.platform.isTrial=true;__arrowDebug.render()');
  for(const kind of ['time','life','shuffle'])await click('trial-item-'+kind);
  assert.deepEqual(await e('__arrowDebug.app.inventory'),{time:11,life:11,shuffle:11});
  const {data}=await c.send('Page.captureScreenshot',{format:'png'},s);fs.mkdirSync('reports/screenshots',{recursive:true});fs.writeFileSync('reports/screenshots/home-trial.png',Buffer.from(data,'base64'));
  await click('level-map');assert.equal(await e('__arrowDebug.app.screen'),'map');
  await click('map-home');await click('settings');assert.equal(await e('__arrowDebug.app.modal'),'settings');await click('settings-done');
  await click('reset-progress-ask');assert.equal(await e('__arrowDebug.app.modal'),'reset-progress');await click('reset-progress-cancel');
  await c.send('Page.reload',{},s);await ready();assert.deepEqual(await e('__arrowDebug.app.inventory'),{time:11,life:11,shuffle:11});assert.equal(await e('__arrowDebug.view.buttons.some(b=>b.id.startsWith("trial-item-"))'),false);
 for(const kind of ['time','life','shuffle']){
  await click('home-info-'+kind);assert.equal(await e('__arrowDebug.app.modal'),'item-info');
  assert.deepEqual(await e('__arrowDebug.app.inventory'),{time:11,life:11,shuffle:11});
  assert.ok(await e('__arrowDebug.view.dialogRect.y+__arrowDebug.view.dialogRect.height<=568'));
  await click('item-info-close');assert.equal(await e('__arrowDebug.app.screen'),'home');
 }
 }finally{await b.close();}
});

test('P13 首页入口位置、小按钮触摸范围及体验版库存卡不重叠',()=>{
 for(const isTrial of [false,true])for(const [width,height]of [[320,568],[393,852],[430,932]]){
  const p=fakePlatform();p.isTrial=isTrial;const a=new Controller(p),v=new View(p.ctx);
  v.render(a,{width,height,safeTop:24,menuBottom:54,safeBottom:24});
  const get=id=>v.buttons.find(b=>b.id===id),start=get('start'),map=get('level-map'),share=get('share'),settings=get('settings'),reset=get('reset-progress-ask');
  const title=p.ctx.calls.find(c=>c[0]==='fillText'&&c[1]==='箭间');assert.ok(title[3]-26>=share.y+share.height+8);
  assert.equal(start.x+start.width/2,width/2);assert.ok(map.x>=start.x+start.width);assert.ok(Math.abs(map.y-start.y)<=5);
  assert.equal(share.y,v.lastLayout.top);assert.ok(settings.x<start.x);if(isTrial)assert.ok(reset.x>map.x);else assert.equal(reset,undefined);assert.equal(settings.y+settings.height,v.lastLayout.bottom);
  assert.equal(share.x+share.width,width-16);assert.equal(share.width,44);assert.equal(get('rank').x,16);
  const daily=get('daily-reward');assert.equal(daily.x,share.x);assert.equal(daily.width,share.width);assert.equal(daily.height,share.height);assert.equal(daily.y,share.y+52);assert.ok(title[3]-22>=daily.y+daily.height+8);
  assert.ok(p.ctx.calls.some(c=>c[0]==='fillText'&&c[1]==='每日奖励'&&c[2]===daily.x-8&&c[3]===daily.y+22));
  assert.equal(p.ctx.calls.filter(c=>c[0]==='scale'&&c[1]===34/32&&c[2]===34/32).length,isTrial?5:4);
  assert.equal(p.ctx.calls.some(c=>c[0]==='fillText'&&['⚙','↺','▦'].includes(c[1])),false);
  assert.equal(v.buttons.filter(b=>b.id.startsWith('trial-item-')).length,isTrial?3:0);
  for(const b of v.buttons){assert.ok(b.width>=44&&b.height>=44);assert.ok(b.x>=0&&b.x+b.width<=width&&b.y>=v.lastLayout.top&&b.y+b.height<=v.lastLayout.bottom);assert.equal(v.hitButton(b.x+b.width/2,b.y+b.height/2),b.id);
   for(const other of v.buttons.filter(o=>o!==b))assert.ok(b.x+b.width<=other.x||other.x+other.width<=b.x||b.y+b.height<=other.y||other.y+other.height<=b.y,`${b.id}/${other.id}`);
  }
 }
});

test('P13 只有微信体验版启用补充道具，正式/开发/未知/接口失败均关闭',()=>{
 for(const envVersion of ['trial','release','develop',undefined]){
  const {wx}=fakeWx();wx.getAccountInfoSync=()=>({miniProgram:{envVersion}});
  assert.equal(createWechatPlatform(wx,{}).isTrial,envVersion==='trial');
 }
 const {wx}=fakeWx();assert.equal(createWechatPlatform(wx,{}).isTrial,false);
 wx.getAccountInfoSync=()=>{throw Error('unavailable');};assert.equal(createWechatPlatform(wx,{}).isTrial,false);
});

test('P13 体验版每次只增加指定道具1个并保存，弹窗/游戏/读取失败/正式版拒绝补充',()=>{
 const data=new Map(),storage={get:k=>data.get(k),set:(k,v)=>data.set(k,v)};
 const p=fakePlatform();p.isTrial=true;const a=new Controller(p);bindPersistence(a,storage);
 for(const kind of ['time','life','shuffle'])a.action('trial-item-'+kind);
 assert.deepEqual(a.inventory,{time:11,life:11,shuffle:11});
 const restored=new Controller(fakePlatform());bindPersistence(restored,storage);assert.deepEqual(restored.inventory,a.inventory);
 for(const blocked of [{modal:'settings'},{screen:'game'},{retryRead:()=>{}},{savedError:true},{loading:true}]){
  const b=new Controller(p);Object.assign(b,blocked);b.action('trial-item-time');assert.equal(b.inventory.time,10);
 }
 restored.action('trial-item-time');assert.equal(restored.inventory.time,11);
 a.action('trial-item-invalid');assert.deepEqual(a.inventory,{time:11,life:11,shuffle:11});
 a.inventory.time=10000000;a.action('trial-item-time');assert.equal(a.inventory.time,10000000);
});
