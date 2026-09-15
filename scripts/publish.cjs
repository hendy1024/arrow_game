'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
function parse(args){
 const options={};
 for(let i=0;i<args.length;i++){
  const name=args[i];
  if(name==='--dry-run')options.dryRun=true;
  else if(name==='--help')options.help=true;
  else if(['--version','--desc','--tools-dir','--test-stages'].includes(name)){
   if(!args[i+1]||args[i+1].startsWith('--'))throw Error(name+' 缺少参数');
   options[{'--version':'version','--desc':'desc','--tools-dir':'toolsDir','--test-stages':'testStages'}[name]]=args[++i];
  }else throw Error('未知参数：'+name);
 }
 return options;
}
function devtools(directory){
 const candidates=[directory,process.env.WECHAT_DEVTOOLS_DIR,
  path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Tencent/微信web开发者工具'),
  path.join(process.env.ProgramFiles||'C:/Program Files','Tencent/微信web开发者工具')].filter(Boolean);
 for(const dir of candidates){
  const executable=path.join(dir,'微信开发者工具.exe'),entry=path.join(dir,'resources/app.asar.unpacked/js/common/cli/index.js');
  if(fs.existsSync(executable)&&fs.existsSync(entry))return {executable,entry,dir};
  if(directory)break;
 }
 throw Error('未找到微信开发者工具。请用 --tools-dir 指定安装目录，或设置 WECHAT_DEVTOOLS_DIR。');
}
// Follow the installed cli.bat bootstrap, using an argument array without cmd.exe.
// Version descriptions (including quotes, &, %, and Chinese) are passed literally.
function cliCommand(tools,args){
 const bootstrap="const e=process.argv[1],a=process.argv.slice(2);process.argv=[process.execPath,'--ms-enable-electron-run-as-node',e,'--electron'].concat(a);require(e)";
 return {command:tools.executable,args:['-e',bootstrap,tools.entry,...args],env:{...process.env,ELECTRON_RUN_AS_NODE:'1',cwd:ROOT},cwd:tools.dir};
}
function run(command,args,options={}){
 const result=spawnSync(command,args,{cwd:ROOT,stdio:'inherit',windowsHide:true,shell:false,...options});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('执行失败，已停止后续步骤（退出码 '+result.status+'）：'+path.basename(command));
}
function publish(options,deps={}){
 const log=deps.log||console.log;
 const version=String(options.version||'').trim(),desc=String(options.desc||'版本更新').trim();
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version))throw Error('版本号请使用1—64位字母、数字、点、横线或下划线，例如 1.0.1 或 1.0.1-beta。');
 if(!desc||/[\r\n\0]/.test(desc))throw Error('版本说明不能为空或包含换行。');
 const tools=(deps.findTools||devtools)(options.toolsDir),execute=deps.run||run;
 const project=path.join(ROOT,'dist/wechat');
 log('项目：'+project+'\n版本：'+version+'\n说明：'+desc);
 const stages=options.testStages===undefined?null:String(options.testStages).split(',');
 if(stages&&(!stages.length||stages.some(s=>!/^p[0-9]+$/.test(s))))throw Error('测试阶段格式不正确，例如 p13,p20');
 log('1/3 '+(stages?'运行相关测试：'+stages.join(','):'运行全部测试')+'，失败则停止');
 for(const stage of stages||[null])execute(process.execPath,[path.join(__dirname,'test.cjs'),...(stage?[stage]:[])]);
 log('2/3 构建最新代码并检查4MB上传包');
 (deps.build||(()=>require('./build.cjs').build()))();
 const info=(deps.check||(()=>require('./upload-package.cjs').prepare(ROOT)))();
 log('本地运行包：'+(info.runtimeBytes/1024).toFixed(1)+' KB');
 if(options.dryRun){log('检查完成。仅演练，未打开微信工程、未上传。');return {uploaded:false,project,version};}
 const report=path.join(ROOT,'reports','upload-'+Date.now()+'-'+require('node:crypto').randomUUID()+'.json');
 log('3/3 打开微信工程，编译并上传');
 for(const args of [['open','--project',project],['upload','--project',project,'--version',version,'--desc',desc,'--info-output',report]]){
  const call=cliCommand(tools,args);execute(call.command,call.args,{cwd:call.cwd,env:call.env});
 }
 log('上传完成：'+version+'\n上传信息：'+report+'\n此操作只上传开发版本；设置体验版、提审及正式发布请在微信后台操作。');
 return {uploaded:true,project,version,report};
}
async function main(){
 const options=parse(process.argv.slice(2));
 if(options.help){console.log('用法：node scripts/publish.cjs [--version 1.0.1] [--desc "更新说明"] [--tools-dir "安装目录"] [--test-stages p13,p20] [--dry-run]\n不传版本时交互输入。--dry-run 执行测试和构建，但不上传。');return;}
 if(!options.version){
  if(!process.stdin.isTTY)throw Error('请通过 --version 指定版本号。');
  const rl=require('node:readline/promises').createInterface({input:process.stdin,output:process.stdout});
  try{options.version=await rl.question('请输入上传版本号（例如 1.0.1）：');if(!options.desc)options.desc=(await rl.question('请输入版本说明（回车使用“版本更新”）：'))||'版本更新';}finally{rl.close();}
 }
 publish(options);
}
if(require.main===module)main().catch(e=>{
 console.error('\n未完成上传：'+e.message+'\n若微信命令失败，请确认开发者工具已登录，并在 设置 → 安全设置 中开启服务端口；配置了 CLI 令牌时设置 WECHAT_DEVTOOLS_CLI_TOKEN。');process.exitCode=1;
});
module.exports={parse,devtools,cliCommand,publish};
