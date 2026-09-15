'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{launch,delay}=require('../scripts/cdp.cjs');
test('P18 真指针每日领奖、三种教学、数量门、钥匙门、长方形棋盘',{timeout:45000},async()=>{
 require('../scripts/build.cjs').build();const b=await launch(),c=b.cdp,s=b.sessionId,e=x=>c.evaluate(x,s);
 async function wait(expr){for(let n=0;n<200;n++){if(await e(expr))return;await delay(25);}throw Error(expr);}
 async function tap(x,y){for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1},s);await delay(30);}
 async function button(id){const p=await e('(()=>{const b=__arrowDebug.view.buttons.find(b=>b.id==='+JSON.stringify(id)+');if(!b)throw Error("missing button");return [b.x+b.width/2,b.y+b.height/2];})()');await tap(...p);}
 async function arrow(id){const p=await e('(()=>{const a=__arrowDebug.app.session.level.arrows.find(a=>a.id==='+JSON.stringify(id)+');return __arrowDebug.view.transform.toScreen(a.path.at(-1));})()');await tap(...p);}
 async function shot(name){const r=await c.send('Page.captureScreenshot',{format:'png'},s);fs.mkdirSync('reports/screenshots',{recursive:true});fs.writeFileSync('reports/screenshots/'+name+'.png',Buffer.from(r.data,'base64'));}
 try{
 await c.send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true},s);await c.send('Page.navigate',{url:b.url+'/?debug'},s);await wait('!!window.__arrowDebug');
 await button('daily-reward');assert.equal(await e('__arrowDebug.app.modal'),'reward-items');assert.deepEqual(await e('__arrowDebug.app.inventory'),{time:11,life:11,shuffle:11});await shot('daily-reward-items');await button('reward-close');assert.equal(await e('__arrowDebug.view.buttons.find(b=>b.id==="daily-reward").label'),'已领取');await shot('home-daily-claimed');
 for(const n of [4,8,12]){
 await e('__arrowDebug.app.session=null;__arrowDebug.app.lifeIntroDone=true;__arrowDebug.app.start('+n+')');await wait('__arrowDebug.app.modal==="mechanic-intro"');const remaining=await e('__arrowDebug.app.session.remainingMs');await delay(120);assert.equal(await e('__arrowDebug.app.session.remainingMs'),remaining);await shot('guide-'+n);await button('mechanic-accept');await shot('mechanic-'+n);
 if(n>=8){
 const d=await e('__arrowDebug.app.session.level.doors[0]');assert.ok(d.edges.length>=6);
 if(n===12)assert.equal(await e('__arrowDebug.app.session.classify('+JSON.stringify(d.keyArrowId)+').type'),'blocked');
 let opened=false;for(let moves=0;moves<90&&!opened;moves++){
 const id=await e('__arrowDebug.app.session.level.arrows.find(a=>__arrowDebug.app.session.classify(a.id).type==="allowed")?.id');assert.ok(id);await arrow(id);await wait('__arrowDebug.app.session.removed.has('+JSON.stringify(id)+')');
 opened=await e(d.keyArrowId?'__arrowDebug.app.session.removed.has('+JSON.stringify(d.keyArrowId)+')':'__arrowDebug.app.session.removed.size>='+d.required);
 }assert.ok(opened);assert.ok(await e('__arrowDebug.app.session.remaining>0'));assert.equal(await e('__arrowDebug.app.session.lives'),3);await shot('gate-open-'+n);
 }
 }
 await e('__arrowDebug.app.session=null;__arrowDebug.app.start(25)');await wait('__arrowDebug.app.currentLevel===25&&!__arrowDebug.app.loading');assert.ok(await e('__arrowDebug.view.transform.height>__arrowDebug.view.transform.width'));await shot('rectangular-level-25');
 }finally{await b.close();}
});
