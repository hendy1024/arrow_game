'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createMusic}=require('../src/platform/music');
const {Controller}=require('../src/ui/controller'),{snapshot,restore}=require('../src/persistence/store');
const {fakeWx,fakePlatform}=require('./helpers.cjs');
test('P10 背景音复用单个循环音源，开关即时生效，失败可重试且销毁后不再播放',async()=>{
 let made=0,plays=0,pauses=0,destroyed=0,error;
 const a={play(){plays++;},pause(){pauses++;},destroy(){destroyed++;},onError(fn){error=fn;}};
 const m=createMusic(()=>{made++;return a;});m.set(false);assert.equal(made,0);
 m.set(true);m.set(true);assert.equal(made,1);assert.equal(plays,1);assert.equal(a.loop,true);assert.equal(a.volume,.18);
 m.set(false);assert.equal(pauses,1);m.set(true);assert.equal(plays,2);
 error();m.set(true);assert.equal(plays,3);
 a.play=()=>{plays++;return Promise.reject(Error('autoplay'));};m.set(false);m.set(true);await Promise.resolve();a.play=()=>{plays++;};m.set(true);assert.equal(plays,5);
 m.destroy();m.set(true);assert.equal(destroyed,1);assert.equal(plays,5);
 assert.doesNotThrow(()=>createMusic(()=>{throw Error('unsupported');}).set(true));
});
test('P10 微信实际平台挂载：默认播放，后台停止，前台恢复，音效和音乐独立且选择持久化',()=>{
 const {wx,handlers}=fakeWx(),audio=[];
 wx.createInnerAudioContext=()=>{const a={plays:0,pauses:0,play(){this.plays++;},pause(){this.pauses++;},stop(){},destroy(){},onError(){}};audio.push(a);return a;};
 const platform=require('../src/platform/wechat').createWechatPlatform(wx,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
 const game=require('../src/runtime').mount(platform),a=game.app;const music=audio.find(x=>x.src==='assets/music.wav');
 assert.ok(music);assert.equal(music.plays,1);assert.deepEqual(a.settings,{music:true,sound:true,vibration:true});
 a.action('settings');a.action('sound');assert.equal(a.settings.music,true);assert.equal(music.pauses,0);
 handlers.Hide();assert.equal(music.pauses,1);a.changed();assert.equal(music.plays,1);handlers.Show();assert.equal(music.plays,2);
 a.action('music');assert.equal(music.pauses,2);handlers.Hide();handlers.Show();assert.equal(music.plays,2);
 const b=new Controller(fakePlatform());restore(b,snapshot(a));assert.deepEqual(b.settings,a.settings);
 const old=snapshot(a);delete old.settings.music;restore(b,old);assert.equal(b.settings.music,true);assert.equal(b.settings.sound,false);
 a.action('sound');platform.feedback('removed',a.settings);assert.equal(audio.find(x=>x.src==='assets/removed.wav').plays,1);assert.equal(music.plays,2);
 a.action('music');assert.equal(music.plays,3);game.stop();assert.equal(music.pauses,3);
});
test('P10 原创背景音为16秒可循环PCM，音量无削波、接缝连续且随上传包交付',()=>{
 const {musicWav}=require('../scripts/audio.cjs'),b=musicWav();
 assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt32LE(24),22050);assert.equal((b.length-44)/44100,16);
 let peak=0,energy=0;for(let i=44;i<b.length;i+=2){const x=b.readInt16LE(i);peak=Math.max(peak,Math.abs(x));energy+=x*x;}
 assert.ok(peak>3000&&peak<30000);assert.ok(Math.sqrt(energy/((b.length-44)/2))>1000);
 assert.ok(Math.abs(b.readInt16LE(44)-b.readInt16LE(b.length-2))<600);
 assert.deepEqual(fs.readFileSync('dist/wechat/assets/music.wav'),b);
 assert.ok(JSON.parse(fs.readFileSync('reports/upload-package.json')).runtimeBytes<4*1024*1024);
});
