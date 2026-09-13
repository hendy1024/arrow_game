'use strict';
const { solve } = require('../src/generation/validate');
function spread(points, size) {
    if (!points.length) return true;
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    return Math.max(...xs)-Math.min(...xs)>=size*.4 && Math.max(...ys)-Math.min(...ys)>=size*.4 && points.every((p,i)=>points.slice(i+1).every(q=>Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]))>=3));
}
// Convert eligible tails to permanent stones, validating each change. This
// preserves full coverage without surrounding an unfinished fragment by stones.
function scatterSafe(level, count, minDepth, minAverage) {
    while(level.obstacles.length<count){
        const candidates=level.arrows.filter(a=>a.path.length>2).map(a=>({a,p:a.path[0],score:level.obstacles.length?Math.min(...level.obstacles.map(p=>Math.hypot(p[0]-a.path[0][0],p[1]-a.path[0][1]))):1})).filter(c=>level.obstacles.every(p=>Math.max(Math.abs(p[0]-c.p[0]),Math.abs(p[1]-c.p[1]))>=3)).sort((a,b)=>b.score-a.score);
        let found=false;
        for(const c of candidates){
            c.a.path.shift();level.obstacles.push(c.p);const v=solve(level);
            if(v.valid&&v.metrics.depth>=minDepth&&v.metrics.averageLength>=minAverage){found=true;break;}
            level.obstacles.pop();c.a.path.unshift(c.p);
        }
        if(!found)return false;
    }
    return spread(level.obstacles,level.width);
}
module.exports={scatterSafe,spread};
