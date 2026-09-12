'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { launch, delay } = require('../scripts/cdp.cjs');
test('P6 真实 Edge 画布、输入、动画、存档及屏幕验收', { timeout: 120000 }, async (t) => {
    require('../scripts/build.cjs').build();
    const b = await launch(), c = b.cdp, s = b.sessionId;
    const dir = path.resolve('reports/screenshots');
    fs.mkdirSync(dir, { recursive: true });
    const evaluate = e => c.evaluate(e, s), report = { browser: b.version, environment: 'Windows headless Edge; not a phone or WeChat device', checks: [], screenshots: [] };
    async function until(expression, timeout = 6000) { const started = Date.now(); while (Date.now() - started < timeout) {
        if (await evaluate(expression))
            return;
        await delay(25);
    } throw new Error('Condition timed out: ' + expression + ' ' + await evaluate('JSON.stringify({modal:__arrowDebug.app.modal,loading:__arrowDebug.app.loading,error:__arrowDebug.app.loadError,screen:__arrowDebug.app.screen})')); }
    async function capture(name) { const { data } = await c.send('Page.captureScreenshot', { format: 'png' }, s); fs.writeFileSync(path.join(dir, name + '.png'), Buffer.from(data, 'base64')); report.screenshots.push(name + '.png'); }
    async function mouse(x, y) { await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, s); await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, s); }
    async function button(id) { const p = await evaluate(`(()=>{const b=__arrowDebug.view.buttons.find(b=>b.id===${JSON.stringify(id)});if(!b)throw Error('Missing button');const r=document.querySelector('canvas').getBoundingClientRect();return [r.x+b.x+b.width/2,r.y+b.y+b.height/2];})()`); await mouse(...p); }
    async function arrow(id) { const p = await evaluate(`(()=>{const g=__arrowDebug,a=g.app.session.level.arrows.find(a=>a.id===${JSON.stringify(id)}),p=g.view.transform.toScreen(a.path.at(-1)),r=document.querySelector('canvas').getBoundingClientRect();return [r.x+p[0],r.y+p[1]];})()`); await mouse(...p); }
    try {
        await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, s);
        await c.send('Page.navigate', { url: b.url + '/?debug' }, s);
        await until('!!window.__arrowDebug');
        await t.test('首页实际渲染，开始按钮接收真实指针事件', async () => { assert.equal(await evaluate('__arrowDebug.app.screen'), 'home'); await capture('home'); await button('start'); await until('__arrowDebug.app.session && !__arrowDebug.app.loading'); assert.equal(await evaluate('__arrowDebug.app.tutorialStep'), 1); await capture('tutorial'); report.checks.push('home-start'); });
        await t.test('折线实际跟随动画并通关，计数在尾部出界后变化', async () => {
            await arrow('first');
            assert.equal(await evaluate('__arrowDebug.app.session.remaining'), 3);
            await until('__arrowDebug.app.session.removed.has("first")');
            await arrow('second');
            await delay(70);
            assert.equal(await evaluate('__arrowDebug.app.session.moves.has("second")'), true);
            await capture('snake-moving');
            await until('__arrowDebug.app.session.removed.has("second")');
            await arrow('third');
            await until('__arrowDebug.app.modal==="won"');
            await capture('won');
            await button('next');
            await until('__arrowDebug.app.currentLevel===2 && !__arrowDebug.app.loading');
            report.checks.push('snake-and-win');
        });
        await t.test('暂停、设置、重新开始确认按真实点击完成', async () => { await button('pause'); assert.equal(await evaluate('__arrowDebug.app.session.state'), 'paused'); await capture('pause'); await button('settings'); await button('sound'); assert.equal(await evaluate('__arrowDebug.app.settings.sound'), false); await button('settings-done'); await button('restart-ask'); await button('restart-cancel'); assert.equal(await evaluate('__arrowDebug.app.session.state'), 'playing'); report.checks.push('modal-flow'); });
        await t.test('挑战关真实点击扣生命、失败、相同布局重试', async () => {
            await evaluate('__arrowDebug.level(3,51)');
            await button('life-accept');
            await capture('challenge');
            const before = await evaluate('JSON.stringify(__arrowDebug.app.session.level.arrows)'), id = await evaluate('__arrowDebug.app.session.level.arrows.find(a=>__arrowDebug.app.session.classify(a.id).type==="blocked").id');
            for (let i = 0; i < 3; i++) {
                await arrow(id);
                await delay(230);
            }
            await until('__arrowDebug.app.modal==="failed"');
            await capture('failed');
            await button('restart');
            assert.equal(await evaluate('__arrowDebug.app.session.lives'), 3);
            assert.equal(await evaluate('JSON.stringify(__arrowDebug.app.session.level.arrows)'), before);
            report.checks.push('lives-and-retry');
        });
        await t.test('浏览器重载恢复扣命后的真实持久化数据', async () => {
            const id = await evaluate('__arrowDebug.app.session.level.arrows.find(a=>__arrowDebug.app.session.classify(a.id).type==="blocked").id');
            await arrow(id);
            await delay(230);
            assert.equal(await evaluate('__arrowDebug.app.session.lives'), 2);
            const before = await evaluate('JSON.stringify(__arrowDebug.app.session.level)');
            await c.send('Page.reload', {}, s);
            await until('!!window.__arrowDebug && __arrowDebug.app.screen==="home"');
            await button('start');
            await until('__arrowDebug.app.screen==="game"');
            assert.equal(await evaluate('__arrowDebug.app.session.lives'), 2);
            assert.equal(await evaluate('JSON.stringify(__arrowDebug.app.session.level)'), before);
            report.checks.push('reload-recovery');
        });
        await t.test('320×568 小屏真实画布与弹窗按钮均在视口内', async () => { await c.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true }, s); await delay(150); await capture('small-challenge'); await button('pause'); await capture('small-pause'); assert.equal(await evaluate('__arrowDebug.view.buttons.every(b=>b.x>=0&&b.y>=0&&b.x+b.width<=320&&b.y+b.height<=568)'), true); await button('resume'); report.checks.push('small-screen'); });
        await t.test('最大棋盘真实放大拖动无误触，点击可见箭头有效', async () => {
            await evaluate('__arrowDebug.level(18,51)');
            await button('zoom-in'); await button('zoom-in');
            assert.equal(await evaluate('__arrowDebug.view.camera.zoom'), 3);
            const r = await evaluate('__arrowDebug.view.camera.rect');
            const x = r.x + r.width / 2, y = r.y + r.height / 2;
            await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, s);
            await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + 40, y: y + 40, button: 'left', buttons: 1 }, s);
            await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + 40, y: y + 40, button: 'left', clickCount: 1 }, s);
            assert.equal(await evaluate('__arrowDebug.app.session.lives'), 3);
            assert.equal(await evaluate('__arrowDebug.app.session.removed.size'), 0);
            const id = await evaluate(`(()=>{const g=__arrowDebug,a=g.app.session.level.arrows.find(a=>g.app.session.classify(a.id).type==='allowed'),p=g.view.transform.toScreen(a.path.at(-1)),r=g.view.camera.rect;g.view.camera.pan(r.x+r.width/2-p[0],r.y+r.height/2-p[1]);g.render();return a.id;})()`);
            await capture('zoomed-board'); await arrow(id);
            await until(`__arrowDebug.app.session.removed.has(${JSON.stringify(id)})`);
            assert.equal(await evaluate('__arrowDebug.app.session.lives'), 3);
            await button('zoom-reset'); assert.equal(await evaluate('__arrowDebug.view.camera.zoom'), 1);
            await capture('level-18-overview');
            report.checks.push('zoom-pan-hit');
        });
        await t.test('画布确有非空像素，交互期间无脚本异常', async () => { const stats = await evaluate(`(()=>{const d=document.querySelector('canvas').getContext('2d').getImageData(0,0,320,568).data;let ink=0;for(let i=0;i<d.length;i+=4)if(d[i]<100&&d[i+1]<150&&d[i+2]<140)ink++;return {ink};})()`); assert.ok(stats.ink > 1000); const errors = c.events.filter(e => e.method === 'Runtime.exceptionThrown'); assert.deepEqual(errors, []); report.checks.push('pixels-and-no-errors'); });
        await t.test('普通预览不暴露调试对象', async () => { await c.send('Page.navigate', { url: b.url + '/' }, s); await until('document.readyState==="complete"'); assert.equal(await evaluate('typeof window.__arrowDebug'), 'undefined'); report.checks.push('debug-hidden'); });
        await t.test('高密度真实画布帧率和反复重建内存采样', async () => {
            await c.send('Page.navigate', { url: b.url + '/?debug' }, s);
            await until('!!window.__arrowDebug');
            await evaluate('__arrowDebug.level(21,100); __arrowDebug.app.lifeIntroDone=true; __arrowDebug.app.modal=null; __arrowDebug.app.session.resume()');
            const frameStats = await evaluate(`new Promise(resolve=>{const intervals=[];let last;function step(now){if(last!==undefined)intervals.push(now-last);last=now;if(intervals.length<90)requestAnimationFrame(step);else{const sorted=intervals.slice().sort((a,b)=>a-b);resolve({medianMs:sorted[45],p95Ms:sorted[85],averageMs:intervals.reduce((a,b)=>a+b,0)/90});}}requestAnimationFrame(step);})`);
            assert.ok(frameStats.medianMs <= 1000 / 30, '本地画布持续帧率低于30：' + JSON.stringify(frameStats));
            await c.send('Performance.enable', {}, s);
            await c.send('HeapProfiler.collectGarbage', {}, s);
            const before = (await c.send('Performance.getMetrics', {}, s)).metrics.find(m => m.name === 'JSHeapUsedSize').value;
            await evaluate('for(let i=0;i<200;i++){__arrowDebug.level(21,4000+i);__arrowDebug.app.session.tick(16);__arrowDebug.render();}');
            await c.send('HeapProfiler.collectGarbage', {}, s);
            const after = (await c.send('Performance.getMetrics', {}, s)).metrics.find(m => m.name === 'JSHeapUsedSize').value;
            assert.ok(after - before < 5 * 1024 * 1024, '重建200次后保留堆增长超过5MB');
            report.performance = { ...frameStats, heapBefore: before, heapAfter: after, iterations: 200 };
            report.checks.push('local-performance');
        });
        await t.test('录制真实画布的并行移动与折线跟随样例', async () => {
            await evaluate(`__arrowDebug.fixture('tutorial');
                window.demoChunks=[];
                window.demoStream=document.querySelector('canvas').captureStream(30);
                window.demoRecorder=new MediaRecorder(demoStream,{mimeType:'video/webm;codecs=vp8'});
                demoRecorder.ondataavailable=e=>{if(e.data.size)demoChunks.push(e.data);};
                window.demoDone=new Promise(resolve=>demoRecorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(demoChunks,{type:'video/webm'}));});
                demoRecorder.start();`);
            await delay(200);
            assert.equal(await evaluate('__arrowDebug.app.currentLevel'), 1);
            await arrow('first');
            await arrow('third');
            assert.equal(await evaluate('__arrowDebug.app.session.moves.size'), 2);
            await delay(200);
            await arrow('second');
            await until('__arrowDebug.app.session.state==="won"');
            await delay(300);
            const data = await evaluate('demoRecorder.stop(); demoStream.getTracks().forEach(t=>t.stop()); demoDone');
            const video = Buffer.from(data, 'base64');
            assert.ok(video.length > 1000, '未录得有效视频数据');
            fs.writeFileSync('reports/snake-and-parallel.webm', video);
            report.video = 'snake-and-parallel.webm';
            report.checks.push('recorded-movement');
        });
        await t.test('设置不显示重置，主页真实点击取消及确认重置并持久化', async () => {
            await evaluate('__arrowDebug.level(3,51)');
            await until('__arrowDebug.app.currentLevel===3 && !__arrowDebug.app.loading');
            assert.equal(await evaluate('__arrowDebug.app.session.level.width'), 14);
            await capture('level-3-hard');
            await button('pause'); await button('settings');
            await capture('settings-reset');
            assert.deepEqual(await evaluate('__arrowDebug.view.buttons.map(b=>b.id)'), ['sound', 'vibration', 'settings-done']);
            assert.equal(await evaluate('__arrowDebug.app.currentLevel'), 3);
            await button('settings-done'); await button('home');
            await capture('home-reset');
            await button('reset-progress-ask'); await button('reset-progress-cancel');
            assert.equal(await evaluate('__arrowDebug.app.modal'), null);
            assert.equal(await evaluate('__arrowDebug.app.currentLevel'), 3);
            await button('reset-progress-ask'); await capture('reset-confirm');
            await button('reset-progress-confirm');
            assert.equal(await evaluate('__arrowDebug.app.currentLevel'), 1);
            await c.send('Page.reload', {}, s); await until('!!window.__arrowDebug');
            assert.equal(await evaluate('__arrowDebug.app.currentLevel'), 1);
            assert.equal(await evaluate('__arrowDebug.app.unlocked'), 1);
            await button('start'); await until('__arrowDebug.app.tutorialStep===1');
            report.checks.push('reset-progress-persistence');
        });
        await t.test('限时说明与暂停冻结，真实超时失败及重试恢复', async () => {
            await evaluate('__arrowDebug.app.lifeIntroDone=true; __arrowDebug.level(20,51)');
            assert.equal(await evaluate('__arrowDebug.app.modal'), 'challenge-intro');
            await delay(150); assert.equal(await evaluate('__arrowDebug.app.session.remainingMs'), 180000);
            await capture('timer-intro'); await button('challenge-accept');
            await delay(150); await button('pause');
            const remaining = await evaluate('__arrowDebug.app.session.remainingMs');
            await delay(200); assert.equal(await evaluate('__arrowDebug.app.session.remainingMs'), remaining);
            await button('resume'); await capture('obstacles-timer');
            await evaluate('__arrowDebug.app.session.remainingMs=100');
            await until('__arrowDebug.app.modal==="failed"');
            assert.equal(await evaluate('__arrowDebug.app.session.failureReason'), 'timeout');
            await capture('timeout-failed'); await button('restart');
            assert.equal(await evaluate('__arrowDebug.app.session.remainingMs'), 180000);
            assert.equal(await evaluate('__arrowDebug.app.session.lives'), 3);
            report.checks.push('timer-pause-timeout-retry');
        });
        await t.test('主页实际进入挑战，90秒说明及失败后恢复普通进度', async () => {
            await button('challenge-accept'); await button('pause'); await button('home');
            const number = await evaluate('__arrowDebug.app.currentLevel');
            await evaluate('__arrowDebug.app.unlocked=20;__arrowDebug.app.challengeUnlockSeen=true;__arrowDebug.app.changed();__arrowDebug.render()'); await capture('home-challenge-mode');
            await button('challenge'); await until('__arrowDebug.app.modal==="rush-ready"');
            await capture('challenge-mode-ready');
            assert.equal(await evaluate('__arrowDebug.app.session.remainingMs'), 90000);
            assert.equal(await evaluate('__arrowDebug.app.session.level.obstacles.length'), 4);
            await button('rush-accept'); await capture('challenge-mode-playing');
            await evaluate('__arrowDebug.app.session.remainingMs=100');
            await until('__arrowDebug.app.modal==="failed"');
            await button('home'); assert.equal(await evaluate('__arrowDebug.app.currentLevel'), number);
            assert.equal(await evaluate('__arrowDebug.app.mode'), 'campaign');
            await c.send('Page.reload', {}, s); await until('!!window.__arrowDebug');
            assert.equal(await evaluate('__arrowDebug.app.currentLevel'), number);
            report.checks.push('independent-challenge-mode');
        });
        await t.test('真实点击三种道具，重排剩余数量不变且刷新不补道具', async () => {
            await button('start'); await until('__arrowDebug.app.screen==="game"');
            assert.equal(await evaluate('__arrowDebug.view.buttons.some(b=>b.id==="items")'), false);
            const count = await evaluate('__arrowDebug.app.session.remaining'), before = await evaluate('__arrowDebug.app.session.remainingMs');
            await button('item-time'); await button('item-time');
            assert.equal(await evaluate('__arrowDebug.app.inventory.time'), 8);
            const after = await evaluate('__arrowDebug.app.session.remainingMs'); assert.ok(after > before + 59000 && after <= before + 60000);
            await button('item-life'); assert.equal(await evaluate('__arrowDebug.app.session.lives'), 4);
            await button('item-shuffle'); await until('__arrowDebug.app.modal===null && __arrowDebug.app.inventory.shuffle===9');
            assert.equal(await evaluate('__arrowDebug.app.session.remaining'), count);
            assert.equal(await evaluate('__arrowDebug.solve(__arrowDebug.app.session.level).valid'), true);
            await capture('items-used');
            await c.send('Page.reload', {}, s); await until('!!window.__arrowDebug');
            assert.equal(await evaluate('__arrowDebug.app.session.items.shuffle'), 0); assert.equal(await evaluate('__arrowDebug.app.inventory.shuffle'), 9);
            assert.equal(await evaluate('__arrowDebug.app.session.lives'), 4);
            report.checks.push('items-and-reshuffle-persistence');
        });
        await t.test('第19关通关实际弹出挑战解锁提示', async () => {
            await evaluate("__arrowDebug.fixture('boundary'); __arrowDebug.app.currentLevel=19; __arrowDebug.app.session.level.number=19; __arrowDebug.app.unlocked=19; __arrowDebug.app.challengeUnlockSeen=false; __arrowDebug.render()");
            await arrow('a'); await until('__arrowDebug.app.modal==="rush-unlocked"');
            await capture('challenge-unlocked'); await button('rush-notice-close');
            assert.equal(await evaluate('__arrowDebug.app.modal'), 'won');
            report.checks.push('challenge-unlock-notice');
        });
    }
    finally {
        fs.writeFileSync('reports/browser.json', JSON.stringify(report, null, 2));
        await b.close();
    }
});



