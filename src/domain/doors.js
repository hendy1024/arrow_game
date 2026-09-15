'use strict';
function isOpen(door,level,removed){
 if(door.keyArrowId)return removed.has(door.keyArrowId);
 const keys=new Set((level.doors||[]).map(d=>d.keyArrowId).filter(Boolean));
 return (level.doorProgress||0)+level.arrows.filter(a=>removed.has(a.id)&&!keys.has(a.id)).length>=door.required;
}
function left(door,level,removed){return Math.max(0,door.required-(level.doorProgress||0)-level.arrows.filter(a=>removed.has(a.id)&&!(level.doors||[]).some(d=>d.keyArrowId===a.id)).length);}
const edgeKey=(a,b)=>'@edge:'+([a.join(','),b.join(',')].sort().join('/'));
function block(door,map){if(door.edges)map.set('@has-edges',true);if(door.edges)for(const [a,b] of door.edges)map.set(edgeKey(a,b),'@door:'+door.id);else map.set(door.cell.join(','),'@door:'+door.id);}
function transform(door,point){return {...door,...(door.edges?{edges:door.edges.map(e=>e.map(point))}:{cell:point(door.cell)})};}
function guideHint(session){
 if(!session.level.guide||![4,8,12].includes(session.level.number))return '';
 const d=session.level.doors?.[0];if(!d)return '观察出口方向，逐层清理遮挡，灰色石块不会消失。';
 if(isOpen(d,session.level,session.removed))return '闸门已打开，现在清理新出口后面的箭头。';
 if(!d.keyArrowId)return '先清理外侧：还需移出 '+left(d,session.level,session.removed)+' 条普通箭头。';
 const state=session.classify(d.keyArrowId).type;return state==='allowed'?'钥匙出口已畅通，可以移出彩色钥匙了。':state==='moving'?'钥匙正在移出，随后闸门打开。':'先清理钥匙前方的遮挡，给彩色钥匙让路。';
}
module.exports={isOpen,left,edgeKey,block,transform,guideHint};
