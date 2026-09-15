'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { drawArrow } = require('../src/rendering/board');
const { recordingContext } = require('./helpers.cjs');

test('P2 加粗箭身和放大箭头仍为相邻格保留清晰间隔，缩放后同步增粗',()=>{
 const {drawBoard}=require('../src/rendering/board');
 for(const cell of [6,8,12,24,48]){
  const ctx=recordingContext(),widths=[];ctx.stroke=()=>widths.push(ctx.lineWidth);
  drawBoard(ctx,{width:3,height:2,arrows:[{id:'a',path:[[0,0],[1,0]],direction:'right'}]}, {x:0,y:0,width:cell*3,height:cell*2});
  assert.equal(widths.length,1);assert.ok(widths[0]>Math.max(cell<13?1.8:2.4,cell*.11));assert.ok(widths[0]<=cell*.34);
  const points=ctx.calls.filter(c=>c[0]==='lineTo').slice(-2),headWidth=Math.abs(points[0][2]-points[1][2]);
  assert.ok(headWidth>Math.min(cell*.30,10)*.58*2);assert.ok(headWidth<cell*.6);
 }
});

test('P2 四个方向和密集棋盘的线帽均收在箭头内部', () => {
    for (const [direction, d] of Object.entries({ right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] })) {
        for (const unit of [6, 12, 24, 48]) {
            const width = Math.min(unit * .34, Math.max(2.5, unit * .18)), ctx = recordingContext();
            const points = [[-d[0] * 100, -d[1] * 100], [0, 0]], original = JSON.stringify(points);
            drawArrow(ctx, points, direction, undefined, width, unit);
            const stroke = ctx.calls.findIndex(c => c[0] === 'stroke');
            const end = ctx.calls.slice(0, stroke).filter(c => c[0] === 'lineTo').at(-1);
            const tip = ctx.calls.slice(stroke + 1).find(c => c[0] === 'moveTo');
            assert.ok(end[1] * d[0] + end[2] * d[1] + width / 2 < tip[1] * d[0] + tip[2] * d[1], direction + ':' + unit);
            assert.equal(JSON.stringify(points), original, '绘制不得改变碰撞和移动路径');
        }
    }
});

test('P2 动画中的短末段和短残余路径不会产生反向杆或无效坐标', () => {
    for (const points of [[[0, 30], [0, 0], [1, 0]], [[0, 0], [0.1, 0]], [[0, 0], [0, 0]]]) {
        const ctx = recordingContext();
        drawArrow(ctx, points, 'right');
        assert.equal(ctx.calls.filter(c => c[0] === 'fill').length, 1);
        for (const call of ctx.calls) for (const value of call.slice(1)) assert.ok(Number.isFinite(value));
        if (points.length === 2) assert.equal(ctx.calls.some(c => c[0] === 'stroke'), false);
    }
});
