'use strict';
const CONFIG = Object.freeze({
    challengeVisible: false, title: '箭间', version: 1, generatorVersion: 4, profileVersion: 8,
    speed: 24, distanceSpeed: 2, lengthSpeed: 4, feedbackMs: 600, messageMs: 1200, dragTolerance: 10,
    lifeStart: 3, lives: 3, campaignLength: 20,
    profiles: [
        { name: '初见', size: 6, minFill: .35, maxFill: .50, maxLength: 6, maxTurns: 2, minDepth: 1, maxOpenRatio: 1 },
        { name: '寻路', size: 8, minFill: .50, maxFill: .63, maxLength: 9, maxTurns: 3, minDepth: 2, maxOpenRatio: .8 },
        { name: '交错', size: 10, minFill: .63, maxFill: .73, maxLength: 12, maxTurns: 4, minDepth: 3, maxOpenRatio: .7 },
        { name: '解围', size: 12, minFill: .70, maxFill: .82, maxLength: 16, maxTurns: 5, minDepth: 4, maxOpenRatio: .6 },
        { name: '深锁', size: 14, minFill: 1, maxFill: 1, maxLength: 9, maxTurns: 7, minDepth: 10, maxOpenRatio: .05, minArrows: 36, maxInitialOpen: 1, dense: true },
        ...[16, 18, 20].map((size, i) => ({ name: ['迷阵', '重围', '极境'][i], size, minFill: 1, maxFill: 1, maxLength: 9, maxTurns: 7, minDepth: 12 + i * 2, maxOpenRatio: .05, minArrows: Math.floor(size * size / 5), maxInitialOpen: 1, dense: true }))
    ]
});
function profileIndex(number) { return number <= 1 ? 0 : number <= 2 ? 1 : 4 + Math.min(3, Math.floor((number - 3) / 5)); }
function lifeLimit(number) { return number >= CONFIG.lifeStart ? CONFIG.lives : null; }
function obstacleCount(number) { return number < 15 ? 0 : Math.min(4, 1 + Math.floor((number - 15) / 5)); }
function timeLimit(number) { return number < 20 ? null : Math.max(120, 180 - Math.floor((number - 20) / 5) * 10) * 1000; }
module.exports = { CONFIG, profileIndex, lifeLimit, obstacleCount, timeLimit };





