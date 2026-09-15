'use strict';
const DAILY=require('../../config/rewards.json').daily;
if(!DAILY||Object.entries(DAILY).length!==3||!['time','life','shuffle'].every(k=>Number.isInteger(DAILY[k])&&DAILY[k]>0&&DAILY[k]<=1000))throw Error('Invalid daily rewards');
const day=app=>'daily:'+new Date((app.platform.now?app.platform.now():Date.now())+8*3600000).toISOString().slice(0,10);
function claimed(app){return app.dailyRewardDay===day(app);}
function show(app,items,title,returnModal=app.modal){
 if(!Object.keys(items).length)return;
 app.rewardPopup={items:{...items},title,returnModal,wasPlaying:app.session?.state==='playing'};
 app.session?.pause();app.modal='reward-items';
}
function grant(app,items,title,returnModal){for(const [k,n] of Object.entries(items))app.inventory[k]+=n;show(app,items,title,returnModal);}
function action(app,name){
 if(name==='daily-reward'){
  if(app.screen!=='home'||app.modal||app.loading||app.retryRead||app.savedError)return true;
  if(claimed(app)){app.say('今日奖励已领取，明天再来');return true;}
  app.dailyRewardDay=day(app);grant(app,DAILY,'每日道具奖励',null);app.changed();return true;
 }
 if(name==='reward-close'&&app.modal==='reward-items'){
  const p=app.rewardPopup;app.rewardPopup=null;app.modal=p?.returnModal||null;
  if(p?.wasPlaying&&!app.modal)app.session?.resume();if(app.modal==='won'&&app.session)app.syncModal();app.changed();return true;
 }
 return false;
}
module.exports={DAILY,day,claimed,show,grant,action};
