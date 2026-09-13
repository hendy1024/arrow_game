'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Controller}=require('../src/ui/controller'),{Session}=require('../src/domain/session'),{fixtures}=require('../src/fixtures'),{fakePlatform,fakeWx}=require('./helpers.cjs'),{snapshot,restore}=require('../src/persistence/store');
function expired(stock=2){const a=new Controller(fakePlatform());a.lifeIntroDone=true;a.session=new Session({...fixtures.tutorial,number:3,lifeLimit:3,timeLimitMs:100});a.screen='game';a.currentLevel=3;a.inventory.time=stock;a.clickArrow('first');a.tick(100);assert.equal(a.modal,'time-rescue');return a;}
test('P11 超时可重置初始时间续关，保留布局/生命/移动进度，不重复扣库存，排除道具纪录',()=>{
 const a=expired(),s=a.session,level=JSON.stringify(s.level),moves=JSON.stringify([...s.moves]);a.tick(5000);assert.equal(JSON.stringify([...s.moves]),moves);assert.equal(s.remainingMs,0);
 a.action('time-rescue-use');assert.equal(s.state,'playing');assert.equal(s.remainingMs,100);assert.equal(s.lives,3);assert.equal(a.inventory.time,1);assert.equal(JSON.stringify(s.level),level);assert.equal(s.recordEligible,false);assert.equal(s.itemUses.time,1);a.action('time-rescue-use');assert.equal(a.inventory.time,1);
 const b=new Controller(fakePlatform());restore(b,snapshot(a));assert.equal(b.session.remainingMs,100);assert.equal(b.inventory.time,1);
 a.tick(100);assert.equal(a.modal,'time-rescue');a.action('time-rescue-use');assert.equal(a.inventory.time,0);assert.equal(s.remainingMs,100);
});
test('P11 超时放弃、空库存、重载不会补发时间，竞速不出现加时提示',()=>{
 const a=expired(0);a.action('time-rescue-use');assert.equal(a.session.remainingMs,0);assert.equal(a.inventory.time,0);a.action('dismiss-modal');assert.equal(a.modal,'failed');a.syncModal();assert.equal(a.modal,'failed');const b=new Controller(fakePlatform());restore(b,snapshot(a));b.syncModal();assert.equal(b.modal,'failed');
 const c=expired();c.mode='race';assert.equal(require('../src/ui/time-rescue').eligible(c),false);c.mode='campaign';c.session.lives=0;assert.equal(require('../src/ui/time-rescue').eligible(c),false);
});
test('P11 iOS音频路由在音源创建前配置，首次音效不停止，开关开启有试听',()=>{
 const {wx}=fakeWx(),events=[],sounds=[];wx.setInnerAudioOption=o=>{events.push('route');assert.equal(o.obeyMuteSwitch,false);assert.equal(o.speakerOn,true);};wx.createInnerAudioContext=()=>{events.push('create');const a={play(){events.push('play');},stop(){events.push('stop');},onError(){},pause(){},destroy(){}};sounds.push(a);return a;};
 const p=require('../src/platform/wechat').createWechatPlatform(wx,{});p.feedback('removed',{sound:true});assert.deepEqual(events,['route','create','play']);assert.equal(sounds[0].obeyMuteSwitch,false);assert.equal(sounds[0].volume,.6);p.feedback('removed',{sound:true});assert.deepEqual(events.slice(-2),['stop','play']);
 const a=new Controller(p);a.action('settings');a.action('sound');const n=events.filter(e=>e==='play').length;a.action('sound');assert.ok(events.filter(e=>e==='play').length>n);assert.ok(sounds.some(s=>s.src==='assets/won.wav'));
});
test('P11 长箭头按长度额外提速，远出口更快，实际末尾出界才清除',()=>{
 function level(length,offset=0){return {number:3,width:32,height:32,lifeLimit:3,arrows:[{id:'a',direction:'right',path:Array.from({length},(_,i)=>[32-offset-length+i,5])}],obstacles:[]};}
 const small=new Session(level(4)),long=new Session(level(20)),far=new Session(level(20,5));for(const s of [small,long,far])s.click('a');assert.ok(long.moves.get('a').speed>small.moves.get('a').speed*3);assert.ok(far.moves.get('a').speed>long.moves.get('a').speed);
 const end=require('../src/movement/path').completionDistance(long.level.arrows[0],long.level)*1000/long.moves.get('a').speed;assert.ok(end<300);long.tick(end-.1);assert.equal(long.remaining,1);long.tick(.2);assert.equal(long.remaining,0);
});
