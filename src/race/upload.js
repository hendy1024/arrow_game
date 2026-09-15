'use strict';
const {period,VERSION}=require('./rules');
const history=require('./history');
function state(app){return app.raceUploadState||(app.raceUploadState={pending:new Map(),sent:new Map(),tail:Promise.resolve()});}
function upload(app,record){
 const s=state(app),key=record.period+':'+record.version,id=key+':'+record.elapsed;
 if(s.sent.get(key)<=record.elapsed)return Promise.resolve(true);
 if(s.pending.has(id))return s.pending.get(id);
 const promise=s.tail.catch(()=>{}).then(async()=>{
  if(s.sent.get(key)<=record.elapsed)return true;
  const sent=await app.platform.publishRace(record);
  if(sent!==false)s.sent.set(key,record.elapsed);
  return sent;
 });
 s.pending.set(id,promise);s.tail=promise;
 promise.then(()=>s.pending.delete(id),()=>s.pending.delete(id));
 return promise;
}
async function retry(app){
 if(!app.platform.publishRace||app.retryRead)return;
 try{
  const records=history.read(app.platform.storage),now=app.platform.now?.()??Date.now();
  for(const kind of ['daily','weekly']){
   const record=records.filter(r=>r.version===VERSION&&r.period===period(kind,now).key&&r.kind===kind).sort((a,b)=>a.elapsed-b.elapsed)[0];
   if(!record)continue;
   try{
    const sent=await upload(app,record);
    app.historyNotice=sent===false?'已跨期，仅保存本机成绩':'本期最佳已自动同步';
    if(app.race?.record?.id===record.id)app.race.publishStatus=sent===false?'已跨期，仅保存本机成绩':'好友成绩已同步';
    if(sent!==false&&app.rankTab==='friends'&&app.modal==='rank'&&app.friendPeriod===record.period)app.platform.showFriends?.(record.period);
   }catch(e){
    app.historyNotice='成绩已保存在本机，稍后自动重试同步';
    console.warn('竞速成绩自动同步失败',String(e?.errMsg||e?.message||e));
   }
  }
 }catch(e){app.historyNotice='历史成绩读取失败，原记录已保留';}
 app.dirty=true;
}
module.exports={upload,retry};
