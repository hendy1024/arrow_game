'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {mount}=require('../src/runtime'),{fakePlatform}=require('./helpers.cjs');
const {generate}=require('../src/generation/generator');
function setup(){const p=fakePlatform(),g=mount(p,{generate:async(n,s)=>generate(n,s)});return {...g,p};}
function tap(p,x,y){p.callbacks.start(1,x,y,1);p.callbacks.end(1,x,y);}
test('P4 外部空白关闭设置、排行榜和竞速选择，内部空白不关闭，重置按取消处理',()=>{
 const {app,view,render,p}=setup();app.currentLevel=app.unlocked=15;
 app.action('settings');render();tap(p,view.dialogRect.x+20,view.dialogRect.y+30);assert.equal(app.modal,'settings');tap(p,1,1);assert.equal(app.modal,null);
 p.isTrial=true;app.action('reset-progress-ask');render();assert.equal(app.modal,'reset-progress');tap(p,1,1);assert.equal(app.currentLevel,15);assert.equal(app.unlocked,15);
 app.action('race');render();assert.deepEqual(view.buttons.map(b=>b.id),['race-daily','race-weekly']);tap(p,1,1);assert.equal(app.modal,null);
 app.action('rank');assert.equal(app.rankTab,'friends');app.action('rank-personal');assert.equal(app.rankTab,'personal');
 for(const [width,height]of [[320,568],[390,844]]){view.render(app,{width,height,safeTop:24,menuBottom:54,safeBottom:24});for(const b of view.buttons)assert.ok(b.y+b.height<=height-24);}
 render();tap(p,1,1);assert.equal(app.modal,null);assert.equal(app.screen,'home');
});
test('P4 外部关闭暂停和重开确认恢复原棋盘，关闭耗尽提示不扣库存',async()=>{
 const {app,render,p}=setup();await app.start(3);app.action('life-accept');const level=app.session.level;
 app.action('pause');render();tap(p,1,1);assert.equal(app.session.state,'playing');assert.equal(app.modal,null);
 app.action('pause');app.action('restart-ask');render();tap(p,1,1);assert.equal(app.session.level,level);assert.equal(app.session.state,'playing');
 app.inventory.life=0;app.action('item-life');render();assert.equal(app.modal,'item-empty');tap(p,1,1);assert.equal(app.modal,null);assert.equal(app.inventory.life,0);
});
test('P4 关闭生成及旧版重排弹窗，异步晚到结果不重开页面、不扣库存',async()=>{
 const {app}=setup();app.unlocked=15;let resolve;app.raceGenerate=()=>new Promise(r=>resolve=r);app.action('race');const preparing=app.action('race-daily');app.action('dismiss-modal');resolve(require('../src/race/fallbacks'));await preparing;assert.equal(app.mode,'campaign');assert.equal(app.screen,'home');assert.equal(app.modal,null);
 await app.start(25);app.action('life-accept');const original=app.session;app.generate=()=>new Promise(r=>resolve=r);const task=app.shuffle();assert.equal(app.modal,'shuffling');app.action('dismiss-modal');app.generate=async(n,s)=>generate(n,s);resolve(generate(25,51));await task;assert.equal(app.session,original);assert.equal(app.session.state,'playing');assert.equal(app.inventory.shuffle,10);assert.equal(app.modal,null);
});
