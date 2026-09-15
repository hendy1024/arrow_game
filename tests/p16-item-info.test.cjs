'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {mount}=require('../src/runtime'),{fakePlatform}=require('./helpers.cjs');
test('P16 正式版道具点击只展示用途，按钮或空白关闭不改变库存和游戏进度',()=>{
 const p=fakePlatform(),g=mount(p),a=g.app;a.inventory={time:0,life:13,shuffle:7};a.unlocked=8;a.currentLevel=4;
 for(const [kind,phrase]of [['time','本关初始时间'],['life','本关初始次数'],['shuffle','仍然可解']]){
  g.render();const b=g.view.buttons.find(b=>b.id==='home-info-'+kind);p.callbacks.start(1,b.x+20,b.y+20,1);p.callbacks.end(1,b.x+20,b.y+20);
  assert.equal(a.modal,'item-info');assert.ok(p.ctx.calls.some(c=>c[0]==='fillText'&&String(c[1]).includes(phrase)));
  a.action('trial-item-'+kind);assert.deepEqual(a.inventory,{time:0,life:13,shuffle:7});
  if(kind==='life'){p.callbacks.start(2,1,1,1);p.callbacks.end(2,1,1);}else a.action('item-info-close');
  assert.equal(a.modal,null);assert.equal(a.screen,'home');assert.equal(a.currentLevel,4);assert.equal(a.unlocked,8);
 }
 g.stop();
});
