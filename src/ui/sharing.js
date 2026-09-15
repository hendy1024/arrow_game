'use strict';
const {period}=require('../race/rules');
const rescue={life:require('./life-rescue'),time:require('./time-rescue')};
const now=app=>app.platform.now?app.platform.now():Date.now();
function quota(app){const day=period('daily',now(app)).key;return app.share.day===day?app.share:{day,rewardClaimed:false,rescues:0};}
function start(app,kind){
 if(app.sharePending||app.retryRead||app.savedError)return;
 const q=quota(app),daily=kind==='daily';
 if(!daily&&q.rescues>=10){app.say('今日分享续关次数已用完');return;}
 if(!daily&&!rescue[kind].eligible(app))return;
 const s=app.session,pending={kind,session:s,modal:app.modal,wasPlaying:s?.state==='playing',departed:false};
 app.sharePending=pending;s?.pause();app.modal='share-wait';app.changed();
 try{if(!app.platform.share)throw Error('请在微信中使用分享');app.platform.share();}catch(e){cancel(app);app.say(e.message||'分享未打开，请重试');}
}
function cancel(app){const p=app.sharePending;if(!p)return;app.sharePending=null;app.modal=p.modal;if(p.wasPlaying)p.session.resume();app.changed();}
function returned(app){
 const p=app.sharePending;if(!p?.departed)return;app.sharePending=null;app.modal=p.modal;
 const q=quota(app);app.share=q;
 if(p.kind==='daily'){
  const gained=!q.rewardClaimed;
  if(!q.rewardClaimed){q.rewardClaimed=true;app.say('已领取：加时、容错、提示各5个',3500);}
  else app.say('今日奖励已领取，可继续分享',3500);
  if(p.wasPlaying)p.session.resume();app.modal='share-reward';
  if(gained)require('./rewards').grant(app,{time:5,life:5,shuffle:5},'每日分享奖励','share-reward');
 }else if(app.session===p.session&&q.rescues<10&&rescue[p.kind].eligible(app)){
  q.rescues++;rescue[p.kind].revive(app,false);
 }
 app.changed();
}
function action(app,name){
 if(app.sharePending){if(name==='share-cancel'||name==='dismiss-modal')cancel(app);return true;}
 if(name==='share'&&!app.modal&&!app.loading&&!app.retryRead){app.shareReturn={screen:app.screen,wasPlaying:app.session?.state==='playing'};app.session?.pause();app.modal='share-reward';quota(app);app.changed();return true;}
 if(name==='share-close'&&app.modal==='share-reward'){app.modal=null;if(app.shareReturn?.wasPlaying)app.session?.resume();app.changed();return true;}
 if(name==='share-start'&&app.modal==='share-reward'){start(app,'daily');return true;}
 if(name==='share-life'&&app.modal==='life-rescue'){start(app,'life');return true;}
 if(name==='share-time'&&app.modal==='time-rescue'){start(app,'time');return true;}
 return false;
}
module.exports={quota,action,returned,cancel};
