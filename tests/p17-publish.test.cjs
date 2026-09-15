'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {parse,publish,cliCommand}=require('../scripts/publish.cjs');
function harness(fail){const calls=[];return {calls,deps:{log:()=>{},findTools:()=>({dir:'C:/工具 有空格',executable:'C:/工具 有空格/微信开发者工具.exe',entry:'C:/工具 有空格/cli.js'}),run:(cmd,args,opts)=>{calls.push({cmd,args,opts});if(fail==='test'&&calls.length===1||fail==='open'&&args.includes('open')||fail==='upload'&&args.includes('upload'))throw Error(fail);},build:()=>{calls.push('build');if(fail==='build')throw Error(fail);},check:()=>{calls.push('check');if(fail==='check')throw Error(fail);return {runtimeBytes:1200000};}}};}
test('P17 上传前依次测试/构建/包检查，固定上传运行目录，自定义版本说明按原文传递',()=>{
 const h=harness(),desc='音乐 & 道具 "说明" %PATH% $(literal)';const r=publish({version:'1.2.3-beta',desc},h.deps);
 assert.equal(r.uploaded,true);assert.equal(h.calls.length,5);assert.ok(h.calls[0].args[0].endsWith('test.cjs'));assert.equal(h.calls[1],'build');assert.equal(h.calls[2],'check');assert.ok(h.calls[3].args.includes('open'));assert.ok(h.calls[4].args.includes('upload'));assert.ok(h.calls[4].args.includes(desc));assert.ok(h.calls[4].args.includes('1.2.3-beta'));assert.ok(h.calls[4].args.includes(path.resolve('dist/wechat')));assert.ok(!h.calls.some(c=>c.args?.includes('submit')));
});
test('P17 任一测试/构建/包检查/打开失败均停止，不执行上传；上传失败不报成功',()=>{
 for(const fail of ['test','build','check','open','upload']){const h=harness(fail);assert.throws(()=>publish({version:'2.0'},h.deps),new RegExp(fail));if(fail!=='upload')assert.equal(h.calls.some(c=>c.args?.includes('upload')),false);}
});
test('P17 演练执行检查但不启动微信或上传，缺失或非法参数拒绝',()=>{
 const h=harness(),r=publish({version:'2.0',dryRun:true},h.deps);assert.equal(r.uploaded,false);assert.equal(h.calls.length,3);
 for(const version of ['', '1.0\n2','1.0 & exit'])assert.throws(()=>publish({version},h.deps),/版本号/);
 assert.throws(()=>parse(['--version']),/缺少/);assert.throws(()=>parse(['--skip-tests']),/未知/);assert.deepEqual(parse(['--version','1.2','--desc','测试','--dry-run']),{version:'1.2',desc:'测试',dryRun:true});
});
test('P17 微信启动使用独立参数与Electron运行模式，不拼接命令字符串',()=>{
 const c=cliCommand({executable:'x.exe',entry:'c:/目录/cli.js',dir:'c:/目录'},['upload','--desc','a & b']);assert.equal(c.command,'x.exe');assert.equal(c.args.at(-1),'a & b');assert.equal(c.env.ELECTRON_RUN_AS_NODE,'1');assert.equal(c.cwd,'c:/目录');
});
test('P17 指定相关测试阶段逐项执行，任何失败仍阻止上传，空阶段拒绝',()=>{
 const options=parse(['--version','1.0.1','--test-stages','p13,p20']);const h=harness();publish(options,h.deps);assert.equal(h.calls[0].args[1],'p13');assert.equal(h.calls[1].args[1],'p20');assert.equal(h.calls[2],'build');
 const f=harness('test');assert.throws(()=>publish(options,f.deps),/test/);assert.equal(f.calls.length,1);
 for(const testStages of ['',',','p13,','all'])assert.throws(()=>publish({version:'1.0.1',testStages},harness().deps),/测试阶段/);
});
