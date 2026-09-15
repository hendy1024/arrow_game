'use strict';
const DIRS = Object.freeze({ up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] });
const key = p => p[0] + ',' + p[1];
const inside = (p, level) => p[0] >= 0 && p[1] >= 0 && p[0] < level.width && p[1] < level.height;
const clone = value => JSON.parse(JSON.stringify(value));
function exitCells(a, level) {
    const d = DIRS[a.direction], h = a.path[a.path.length - 1], cells = [];
    for (let p = [h[0] + d[0], h[1] + d[1]]; inside(p, level); p = [p[0] + d[0], p[1] + d[1]])
        cells.push(p);
    return cells;
}
function validateLevel(level) {
    const errors = [];
    if (!level || !Number.isInteger(level.width) || !Number.isInteger(level.height) || level.width < 2 || level.height < 2 || level.width > 40 || level.height > 40 || !Array.isArray(level.arrows) || !level.arrows.length)
        return { valid: false, errors: ['invalid-board'] };
    if (level.lifeLimit !== null && (!Number.isInteger(level.lifeLimit) || level.lifeLimit < 1))
        errors.push('invalid-life-limit');
    const ids = new Set(), occupied = new Map();
    if (level.timeLimitMs != null && (!Number.isInteger(level.timeLimitMs) || level.timeLimitMs <= 0)) errors.push('invalid-time-limit');
    if (level.obstacles !== undefined && !Array.isArray(level.obstacles)) return { valid: false, errors: ['invalid-obstacles'] };
    for (const p of level.obstacles || []) {
        if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isInteger) || !inside(p, level)) { errors.push('invalid-obstacle'); continue; }
        if (occupied.has(key(p))) errors.push('overlap');
        occupied.set(key(p), '@stone:' + key(p));
    }
    for (const a of level.arrows) {
        if (!a || typeof a !== 'object') {
            errors.push('invalid-arrow');
            continue;
        }
        if (typeof a.id !== 'string' || !a.id || ids.has(a.id))
            errors.push('duplicate-or-invalid-id');
        ids.add(a.id);
        if (!DIRS[a.direction] || !Array.isArray(a.path) || a.path.length < 2) {
            errors.push('invalid-arrow');
            continue;
        }
        let valid = true;
        const own = new Set();
        for (let i = 0; i < a.path.length; i++) {
            const p = a.path[i];
            if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isInteger) || !inside(p, level)) {
                errors.push('out-of-bounds');
                valid = false;
                continue;
            }
            const k = key(p);
            if (own.has(k)) {
                errors.push('self-intersection');
                valid = false;
            }
            own.add(k);
            if (occupied.has(k) && occupied.get(k) !== a.id)
                errors.push('overlap');
            occupied.set(k, a.id);
            if (i && (!Array.isArray(a.path[i - 1]) || Math.abs(p[0] - a.path[i - 1][0]) + Math.abs(p[1] - a.path[i - 1][1]) !== 1)) {
                errors.push('disconnected-path');
                valid = false;
            }
        }
        if (!valid)
            continue;
        const h = a.path[a.path.length - 1], p = a.path[a.path.length - 2], d = DIRS[a.direction];
        if (h[0] - p[0] !== d[0] || h[1] - p[1] !== d[1])
            errors.push('head-direction-mismatch');
        if (exitCells(a, level).some(p => own.has(key(p))))
            errors.push('self-blocked');
    }
    if(level.doors!==undefined&&!Array.isArray(level.doors))errors.push('invalid-doors');
    const doorIds=new Set();
    for(const d of Array.isArray(level.doors)?level.doors:[]){
        if(!d||typeof d.id!=='string'||!d.id||doorIds.has(d.id)){errors.push('invalid-door');continue;}
        doorIds.add(d.id);
        if(d.keyArrowId ? !ids.has(d.keyArrowId)||d.required!==undefined : !Number.isInteger(d.required)||d.required<1)errors.push('invalid-door-trigger');
        if(d.edges!==undefined){
            if(d.cell!==undefined||!Array.isArray(d.edges)||!d.edges.length){errors.push('invalid-door-edges');continue;}
            for(const e of d.edges){
                if(!Array.isArray(e)||e.length!==2||!e.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isInteger))||Math.abs(e[0][0]-e[1][0])+Math.abs(e[0][1]-e[1][1])!==1||inside(e[0],level)===inside(e[1],level)){errors.push('invalid-door-edge');continue;}
                const k=require('./doors').edgeKey(...e);if(occupied.has(k))errors.push('overlap');occupied.set(k,d.id);
            }
        }else{
            if(!Array.isArray(d.cell)||d.cell.length!==2||!d.cell.every(Number.isInteger)||!inside(d.cell,level)){errors.push('invalid-door');continue;}
            if(occupied.has(key(d.cell)))errors.push('overlap');occupied.set(key(d.cell),'@door:'+d.id);
        }
    }
    if(level.doorProgress!==undefined&&(!Number.isInteger(level.doorProgress)||level.doorProgress<0))errors.push('invalid-door-progress');
    return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
function occupancy(level, excluded = new Set(), unlocked = excluded) {
    const map = new Map();
    for(const d of level.doors||[])if(!require('./doors').isOpen(d,level,unlocked))require('./doors').block(d,map);
    for (const p of level.obstacles || []) map.set(key(p), '@stone:' + key(p));
    for (const a of level.arrows)
        if (!excluded.has(a.id))
            for (const p of a.path)
                map.set(key(p), a.id);
    return map;
}
function firstBlocker(a, level, occupied) {
    const h=a.path[a.path.length-1],d=DIRS[a.direction];
    for(let x=h[0]+d[0],y=h[1]+d[1];x>=0&&y>=0&&x<level.width&&y<level.height;x+=d[0],y+=d[1]){const k=x+','+y;if(occupied.has(k))return {id:occupied.get(k),cell:[x,y]};}
    if(occupied.has('@has-edges')){
        const last=[d[0]?(d[0]>0?level.width-1:0):h[0],d[1]?(d[1]>0?level.height-1:0):h[1]];
        const edge=require('./doors').edgeKey(last,[last[0]+d[0],last[1]+d[1]]);
        if(occupied.has(edge))return {id:occupied.get(edge),cell:last};
    }
    return null;
}

module.exports = { DIRS, key, inside, clone, exitCells, validateLevel, occupancy, firstBlocker };
