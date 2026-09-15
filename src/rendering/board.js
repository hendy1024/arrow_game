'use strict';
function trimShaft(points, distance) {
    const result = points.map(p => p.slice());
    while (result.length > 1) {
        const end = result[result.length - 1], previous = result[result.length - 2];
        const length = Math.hypot(end[0] - previous[0], end[1] - previous[1]);
        if (length <= distance) {
            distance -= length;
            result.pop();
        } else {
            result[result.length - 1] = [end[0] + (previous[0] - end[0]) * distance / length, end[1] + (previous[1] - end[1]) * distance / length];
            break;
        }
    }
    return result;
}
function drawArrow(ctx, points, direction, color = '#283b37', width = 3.2, unit = 24) {
    if (points.length < 2)
        return;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const length = Math.min(unit * .44, 14), half = length * .65;
    // Keep the rounded shaft cap inside the filled arrowhead, including at small cell sizes.
    const shaft = trimShaft(points, length * .7 + width / 2);
    if (shaft.length > 1) {
        ctx.beginPath();
        ctx.moveTo(shaft[0][0], shaft[0][1]);
        for (const p of shaft.slice(1))
            ctx.lineTo(p[0], p[1]);
        ctx.stroke();
    }
    const h = points[points.length - 1];
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
    ctx.beginPath();
    ctx.moveTo(h[0] + d[0] * length * .25, h[1] + d[1] * length * .25);
    ctx.lineTo(h[0] - d[0] * length - d[1] * half, h[1] - d[1] * length + d[0] * half);
    ctx.lineTo(h[0] - d[0] * length + d[1] * half, h[1] - d[1] * length - d[0] * half);
    ctx.closePath();
    ctx.fill();
}
function boardTransform(level, rect) {
    const cell = Math.min(rect.width / level.width, rect.height / level.height);
    return { cell, x: rect.x + (rect.width - cell * level.width) / 2, y: rect.y + (rect.height - cell * level.height) / 2,
        width: cell * level.width, height: cell * level.height,
        toScreen(p) { return [this.x + (p[0] + .5) * cell, this.y + (p[1] + .5) * cell]; },
        toBoard(p) { return [(p[0] - this.x) / cell - .5, (p[1] - this.y) / cell - .5]; } };
}
function drawBoard(ctx, level, rect, options = {}) {
    const t = boardTransform(level, rect);
    ctx.save();
    ctx.beginPath();
    ctx.rect(t.x, t.y, t.width, t.height);
    ctx.clip();
    if (options.grid) {
        ctx.fillStyle = '#c7d0c9';
        for (let x = 0; x < level.width; x++)
            for (let y = 0; y < level.height; y++) {
                const p = t.toScreen([x, y]);
                ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
            }
    }
    for (const p of level.obstacles || []) {
        const s = t.toScreen(p), size = t.cell * .7;
        ctx.fillStyle = '#88918b'; ctx.fillRect(s[0] - size / 2, s[1] - size / 2, size, size);
        ctx.strokeStyle = '#fffef9'; ctx.lineWidth = Math.max(1, t.cell * .06);
        ctx.beginPath(); ctx.moveTo(s[0] - size * .2, s[1] - size * .2); ctx.lineTo(s[0] + size * .2, s[1] + size * .2); ctx.moveTo(s[0] + size * .2, s[1] - size * .2); ctx.lineTo(s[0] - size * .2, s[1] + size * .2); ctx.stroke();
    }
    const removed=options.removed||new Set(),palette=['#a86900','#176bb0','#8c489f'];
    for (const a of level.arrows) {
        if (options.removed?.has(a.id))
            continue;
        const path = options.paths?.get(a.id) || a.path;
        const offset = options.offsets?.get(a.id) || 0;
        const strokeWidth = Math.min(t.cell * .34, Math.max(2.5, t.cell * .18));
        const keyIndex=(level.doors||[]).findIndex(d=>d.keyArrowId===a.id), keyColor=keyIndex<0?undefined:palette[keyIndex%3];
        drawArrow(ctx, path.map(p => { const s = t.toScreen(p); return [s[0] + offset, s[1]]; }), a.direction, options.colors?.get(a.id)||keyColor, strokeWidth, t.cell);
        if(keyIndex>=0){
            const [x,y]=t.toScreen(path[0]),u=t.cell;ctx.strokeStyle=options.colors?.get(a.id)||keyColor;ctx.lineWidth=Math.max(1.5,u*.12);
            ctx.fillStyle='#fffef9';ctx.beginPath();ctx.arc(x,y,u*.25,0,Math.PI*2);ctx.fill();ctx.stroke();
            ctx.beginPath();ctx.moveTo(x+u*.25,y);ctx.lineTo(x+u*.65,y);ctx.lineTo(x+u*.65,y+u*.2);ctx.moveTo(x+u*.46,y);ctx.lineTo(x+u*.46,y+u*.17);ctx.stroke();
        }
    }
    ctx.restore();
    ctx.save();
    for(const [i,d] of (level.doors||[]).entries()){
        const opened=require('../domain/doors').isOpen(d,level,removed),effect=options.doorEffects?.get(d.id);
        if(opened&&!effect)continue;
        if(d.edges){
            const mids=d.edges.map(([a,b])=>t.toScreen([(a[0]+b[0])/2,(a[1]+b[1])/2]));
            const vertical=d.edges[0][0][0]!==d.edges[0][1][0],color=palette[i%3],fraction=opened?Math.max(0,(effect.until-options.time)/900):1;
            const axis=vertical?1:0;mids.sort((a,b)=>a[axis]-b[axis]);
            const start=mids[0].slice(),end=mids.at(-1).slice();start[axis]-=t.cell*.5;end[axis]+=t.cell*.5;
            const normal=1-axis,sign=mids[0][normal]<(normal===0?t.x+t.width/2:t.y+t.height/2)?-1:1;
            for(const p of [start,end,...mids])p[normal]+=sign*12;
            end[axis]=start[axis]+(end[axis]-start[axis])*fraction;
            ctx.save();ctx.globalAlpha=opened?fraction:1;ctx.strokeStyle=color;ctx.lineWidth=Math.max(4,Math.min(9,t.cell*.35));ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...start);ctx.lineTo(...end);ctx.stroke();
            if(!opened){
                ctx.strokeStyle='#fff3c4';ctx.lineWidth=1.2;ctx.beginPath();for(const m of mids){const x=m[0],y=m[1];if(vertical){ctx.moveTo(x-2,y);ctx.lineTo(x+2,y);}else{ctx.moveTo(x,y-2);ctx.lineTo(x,y+2);}}ctx.stroke();
                ctx.fillStyle=color;for(const p of [start,end])ctx.fillRect(p[0]-4,p[1]-4,8,8);
                const center=[(start[0]+end[0])/2,(start[1]+end[1])/2];
                ctx.fillStyle=color;ctx.fillRect(center[0]-12,center[1]-10,24,20);ctx.fillStyle='#fffef9';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
                if(d.keyArrowId){ctx.beginPath();ctx.arc(center[0],center[1]-2,3,0,Math.PI*2);ctx.fill();ctx.fillRect(center[0]-1,center[1],2,6);}else ctx.fillText(String(require('../domain/doors').left(d,level,removed)),...center);
            }ctx.restore();continue;
        }
        const [x,y]=t.toScreen(d.cell),u=t.cell,color=palette[i%3];
        ctx.fillStyle=color;ctx.fillRect(x-u*.43,y-u*.43,u*.86,u*.86);
        ctx.fillStyle='#fffef9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold '+Math.max(7,u*.6)+'px sans-serif';
        if(d.keyArrowId){ctx.beginPath();ctx.arc(x,y-u*.1,u*.14,0,Math.PI*2);ctx.fill();ctx.fillRect(x-u*.055,y,u*.11,u*.23);}
        else ctx.fillText(String(require('../domain/doors').left(d,level,removed)),x,y);
    }
    for(const p of options.blockers||[]){const s=t.toScreen(p);ctx.strokeStyle='#e23b36';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(s[0],s[1],Math.max(5,t.cell*.5),0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    return t;
}
module.exports = { drawArrow, boardTransform, drawBoard };
