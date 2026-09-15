'use strict';
const {exitCells,key}=require('../src/domain/board');
const { solve } = require('../src/generation/validate');
function spread(points, size, height = size) {
    if (!points.length) return true;
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    return Math.max(...xs)-Math.min(...xs)>=size*.4 && Math.max(...ys)-Math.min(...ys)>=height*.4 && points.every((p,i)=>points.slice(i+1).every(q=>Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]))>=3));
}
// A permanent stone must lie outside every arrow exit ray. Removing only such
// tail cells preserves all dependencies; independently solve the finished board.
function scatterSafe(level, count, minDepth, minAverage) {

    const initial=solve(level);if(!initial.valid||initial.metrics.depth<minDepth)return false;
    if(initial.metrics.averageLength-(count-level.obstacles.length)/level.arrows.length<minAverage)return false;
    while(level.obstacles.length<count){
        const rays=new Set(level.arrows.flatMap(a=>exitCells(a,level).map(key)));
        const candidates=level.arrows.filter(a=>a.path.length>2&&!rays.has(key(a.path[0]))).map(a=>({a,p:a.path[0],score:level.obstacles.length?Math.min(...level.obstacles.map(p=>Math.hypot(p[0]-a.path[0][0],p[1]-a.path[0][1]))):1})).filter(c=>level.obstacles.every(p=>Math.max(Math.abs(p[0]-c.p[0]),Math.abs(p[1]-c.p[1]))>=3)).sort((a,b)=>b.score-a.score);
        const c=candidates[0];
        if(c){c.a.path.shift();level.obstacles.push(c.p);continue;}
        // A corner at the head can also become a stone if the shortened arrow
        // points away from it. Revalidate geometry and all dependencies.
        let found=false;
        for(const a of level.arrows){
            if(a.path.length<3)continue;
            const p=a.path.at(-1),h=a.path.at(-2),t=a.path.at(-3);
            if(rays.has(key(p))||!level.obstacles.every(q=>Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]))>=3))continue;
            const direction=h[0]>t[0]?'right':h[0]<t[0]?'left':h[1]>t[1]?'down':'up';if(direction===a.direction)continue;
            const previous=a.direction;a.path.pop();a.direction=direction;level.obstacles.push(p);const v=solve(level);
            if(v.valid&&v.metrics.depth>=minDepth&&v.metrics.depth<=initial.metrics.depth&&v.metrics.initialOpen===initial.metrics.initialOpen&&v.metrics.averageLength>=minAverage){found=true;break;}
            level.obstacles.pop();a.path.push(p);a.direction=previous;
        }
        if(!found)return false;
    }
    const final=solve(level);
    return final.valid&&final.metrics.depth>=minDepth&&final.metrics.averageLength>=minAverage&&spread(level.obstacles,level.width,level.height);
}
module.exports={scatterSafe,spread};
