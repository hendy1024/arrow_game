'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {launch,delay}=require('../scripts/cdp.cjs');
test('P10 真实浏览器音乐解码播放，设置开关点击、持久化和小屏布局', {timeout:60000},async()=>{
 const b=await launch(),c=b.cdp,s=b.sessionId,e=x=>c.evaluate(x,s);
 async function wait(expr){for(let i=0;i<160;i++){if(await e(expr))return;await delay(30);}throw Error('Timed out '+expr);}
 async function button(id){const [x,y]=await e(`(()=>{const b=__arrowDebug.view.buttons.find(x=>x.id==='${id}'),r=document.querySelector('canvas').getBoundingClientRect();return [r.x+b.x+b.width/2,r.y+b.y+b.height/2];})()`);for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1},s);}
 try{
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.__audio=[];const NativeAudio=window.Audio;window.Audio=function(...args){const a=new NativeAudio(...args);window.__audio.push(a);return a;};"},s);
  await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},s);
  await c.send('Page.navigate',{url:b.url+'/?debug'},s);await wait('!!window.__arrowDebug');
  await button('settings');await wait('__audio.some(a=>a.src.endsWith("/music.wav")&&!a.paused&&a.currentTime>0)');
  assert.equal(await e('__audio.find(a=>a.src.endsWith("/music.wav")).duration'),16);
  assert.deepEqual(await e('__arrowDebug.view.buttons.map(b=>b.id)'),['music','sound','vibration','settings-done']);
  await button('music');assert.equal(await e('__audio[0].paused'),true);assert.equal(await e('__arrowDebug.app.settings.sound'),true);
  await button('sound');await button('vibration');
  const {data}=await c.send('Page.captureScreenshot',{format:'png'},s);fs.writeFileSync('reports/screenshots/audio-settings.png',Buffer.from(data,'base64'));
  await c.send('Page.reload',{},s);await wait('!!window.__arrowDebug && __arrowDebug.app.settings.music===false');assert.equal(await e('__audio.length'),0);
  await button('settings');await button('music');await wait('__audio.length===1&&!__audio[0].paused&&__audio[0].currentTime>0');
  assert.equal(await e('__arrowDebug.app.settings.sound'),false);assert.equal(await e('__arrowDebug.app.settings.vibration'),false);
  for(const [width,height] of [[320,568],[390,844]]){
   await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true},s);await delay(80);
   const boxes=await e('__arrowDebug.view.buttons');for(const q of boxes){assert.ok(q.x>=0&&q.y>=0&&q.x+q.width<=width&&q.y+q.height<=height);assert.ok(q.height>=44);}
  }
 }finally{await b.close();}
});
