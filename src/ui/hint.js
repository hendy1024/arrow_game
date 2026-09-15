'use strict';
// Keep the legacy inventory key so existing stock and configured rewards carry over.
function use(app) {
 const s=app.session;
 if(!s||s.moves.size||!['playing','paused'].includes(s.state))return;
 if(s.hintUntil>s.time){app.say('蓝色箭头可以移出，请先试一试');app.changed();return;}
 const paused=s.state==='paused';if(paused)s.resume();
 const ids=s.level.arrows.filter(a=>s.classify(a.id).type==='allowed').map(a=>a.id);
 if(!ids.length){if(paused)s.pause();app.say('暂时没有可提示的箭头，道具已保留');app.changed();return;}
 s.hintIds=[ids[Math.floor(Math.random()*ids.length)]];s.hintUntil=s.time+5000;app.consumeItem('shuffle');
 app.modal=null;app.say('蓝色箭头可以移出，提示持续5秒',5000);app.changed();
}
module.exports={use};
