'use strict';
const CONFIG = Object.freeze({
    title: '箭间', version: 1, generatorVersion: 1, profileVersion: 1,
    speed: 12, feedbackMs: 200, messageMs: 1200, dragTolerance: 10,
    lifeStart: 21, lives: 3, campaignLength: 30,
    profiles: [
        { name: '初见', size: 6, minFill: .35, maxFill: .50, maxLength: 6, maxTurns: 2, minDepth: 1, maxOpenRatio: 1 },
        { name: '寻路', size: 8, minFill: .50, maxFill: .63, maxLength: 9, maxTurns: 3, minDepth: 2, maxOpenRatio: .8 },
        { name: '交错', size: 10, minFill: .63, maxFill: .73, maxLength: 12, maxTurns: 4, minDepth: 3, maxOpenRatio: .7 },
        { name: '解围', size: 12, minFill: .70, maxFill: .82, maxLength: 16, maxTurns: 5, minDepth: 4, maxOpenRatio: .6 },
        { name: '从容', size: 12, minFill: .75, maxFill: .85, maxLength: 18, maxTurns: 6, minDepth: 5, maxOpenRatio: .5 }
    ]
});
function profileIndex(number) { return number <= 3 ? 0 : number <= 8 ? 1 : number <= 15 ? 2 : number <= 20 ? 3 : 4; }
function lifeLimit(number) { return number >= CONFIG.lifeStart ? CONFIG.lives : null; }
module.exports = { CONFIG, profileIndex, lifeLimit };
