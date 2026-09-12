'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {launch,delay}=require('../scripts/cdp.cjs');
test('P7 真实浏览器首页竞速入口、日周切换、计时与历史页', {timeout:45000},async()=>{
 require('../scripts/build.cjs').build();const b=await launch(),c=b.cdp,s=b.sessionId,e=x=>c.evaluate(x,s);
 async function until(expr){for(let i=0;i<500;i++){if(await e(expr))return;await delay(20);}throw Error(expr);}
 async function click(id){const p=await e(`(()=>{const b=__arrowDebug.view.buttons.find(b=>b.id===${JSON.stringify(id)}),r=document.querySelector('canvas').getBoundingClientRect();if(!b)throw Error('missing '+${JSON.stringify(id)});return [r.x+b.x+b.width/2,r.y+b.y+b.height/2]})()`);for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,x:p[0],y:p[1],button:'left',clickCount:1},s);}
 async function shot(name){const {data}=await c.send('Page.captureScreenshot',{format:'png'},s);fs.mkdirSync('reports/screenshots',{recursive:true});fs.writeFileSync('reports/screenshots/'+name+'.png',Buffer.from(data,'base64'));}
 try{
 await c.send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true},s);await c.send('Page.navigate',{url:b.url+'/?debug'},s);await until('!!window.__arrowDebug');await e('__arrowDebug.app.unlocked=15;__arrowDebug.app.raceUnlockSeen=true;__arrowDebug.render()');await shot('race-home-small');await click('race');await shot('race-menu-small');await click('race-period');assert.equal(await e('__arrowDebug.app.raceKind'),'weekly');await click('race-history');await shot('race-history');await click('race-back');await click('race-start');await until('__arrowDebug.app.modal==="race-ready"');await shot('race-ready-small');await click('race-accept');assert.equal(await e('__arrowDebug.app.mode'),'race');assert.equal(await e('__arrowDebug.view.buttons.some(b=>b.id==="items")'),false);await shot('race-playing');await click('pause');const time=await e('Date.now()-__arrowDebug.app.race.startedAt');await delay(100);assert.ok(await e('Date.now()-__arrowDebug.app.race.startedAt')>time);await click('home');assert.equal(await e('__arrowDebug.app.mode'),'campaign');
 }finally{await b.close();}
});
