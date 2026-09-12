'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {launch,delay}=require('../scripts/cdp.cjs');
test('P8 浏览器总览入口、奖励详情、空白关闭、选关和翻页', {timeout:45000},async()=>{
 require('../scripts/build.cjs').build();const b=await launch(),c=b.cdp,s=b.sessionId,e=x=>c.evaluate(x,s);
 const click=async id=>{const p=await e(`(()=>{const b=__arrowDebug.view.buttons.find(b=>b.id==='${id}'),r=document.querySelector('canvas').getBoundingClientRect();if(!b)throw Error('missing ${id}');return [r.x+b.x+b.width/2,r.y+b.y+b.height/2]})()`);for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,x:p[0],y:p[1],button:'left',clickCount:1},s);};
 try{
 await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},s);await c.send('Page.navigate',{url:b.url+'/?debug'},s);for(let i=0;i<100&&!await e('!!window.__arrowDebug');i++)await delay(50);
 await click('level-map');assert.equal(await e('__arrowDebug.view.buttons.filter(b=>b.id.startsWith("map-level-")).length'),20);
 fs.mkdirSync('reports/screenshots',{recursive:true});let shot=await c.send('Page.captureScreenshot',{format:'png'},s);fs.writeFileSync('reports/screenshots/campaign-map.png',Buffer.from(shot.data,'base64'));
 await click('map-level-20');assert.equal(await e('__arrowDebug.app.modal'),'level-detail');assert.equal(await e('__arrowDebug.view.buttons.some(b=>b.id==="map-play")'),false);
 shot=await c.send('Page.captureScreenshot',{format:'png'},s);fs.writeFileSync('reports/screenshots/campaign-reward.png',Buffer.from(shot.data,'base64'));
 for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,x:2,y:2,button:'left',clickCount:1},s);assert.equal(await e('__arrowDebug.app.modal'),null);
 await e('__arrowDebug.app.unlocked=21;__arrowDebug.render()');await click('map-next');assert.equal(await e('__arrowDebug.app.mapPage'),1);await click('map-level-21');await click('map-play');await delay(100);assert.equal(await e('__arrowDebug.app.currentLevel'),21);assert.equal(await e('__arrowDebug.app.session.level.seed'),710021);
 }finally{await b.close();}
});
