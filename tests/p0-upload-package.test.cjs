'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {prepare}=require('../scripts/upload-package.cjs');
test('P0 独立上传工程只含运行文件，启用压缩且不上传源码映射',()=>{
 const root=path.resolve('.'),report=prepare(root),config=JSON.parse(fs.readFileSync('dist/wechat/project.config.json'));
 assert.equal(config.miniprogramRoot,'./');assert.equal(config.appid,'wx47e5456f2f4f5ade');assert.equal(config.setting.minified,true);assert.equal(config.setting.uploadWithSourceMap,false);
 assert.ok(report.runtimeBytes<4*1024*1024);assert.equal(report.files.length,6);assert.ok(report.files.includes('open-data/index.js'));assert.ok(!report.files.some(f=>f.includes('reports')||f.endsWith('.map')));
 const outer=JSON.parse(fs.readFileSync('project.config.json'));assert.equal(outer.setting.minified,true);assert.equal(outer.setting.uploadWithSourceMap,false);
});
test('P0 上传检查拒绝混入开发文件及超过4MB，不静默删除文件',()=>{
 const root=fs.mkdtempSync(path.resolve('work/upload-check-'));fs.copyFileSync('project.config.json',path.join(root,'project.config.json'));
 const source=prepare(path.resolve('.'));for(const name of source.files){const full=path.join(root,'dist/wechat',name);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,'x');}
 assert.ok(prepare(root).runtimeBytes<100);
 const extra=path.join(root,'dist/wechat/screenshot.png');fs.writeFileSync(extra,'x');assert.throws(()=>prepare(root),/非运行文件/);assert.ok(fs.existsSync(extra));fs.renameSync(extra,path.join(root,'screenshot.png'));
 fs.writeFileSync(path.join(root,'dist/wechat/game.js'),Buffer.alloc(4*1024*1024));assert.throws(()=>prepare(root),/超过4MB/);
});
