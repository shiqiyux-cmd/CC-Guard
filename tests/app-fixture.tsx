/**
 * [INPUT]: Tauri 官方 mockIPC / mockWindows、真实 App 根组件与 contract.ts 的命令形状。
 * [OUTPUT]: 按契约造的内存假后端：设置（secret 只写不读）、线路检查三态、节点、连接快照、启动拦截、身份与语言、
 *           网页版浏览器快照（未运行 / 运行中两套核验项）与关闭定位；记录每条命令供审计。
 * [POS]: scripts/test-ui.ts 的离线入口；没有原生命令、真实账号、Clash 或网络，生产 rollup 不包含此页。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {createRoot} from 'react-dom/client';
import {mockIPC,mockWindows} from '@tauri-apps/api/mocks';
import type {LaunchEntry,LineCheck,LineConnections,Settings,Verdict} from '../src/contract';
import {defaultPolicy,type IdentityState} from '../src/identity-model';
import {App,Root} from '../src/main';
const EXIT='203.0.113.7';
const state={
  settings:{line:{controller:'',secret_set:false,port:0,node:'',expected_ip:'',services:['https://a.example.invalid','https://b.example.invalid'],claude_hosts:['anthropic.com','claude.ai','claude.com'],claude_processes:['claude.exe']},workspace:'C:\\Fixture'} as Settings,
  secret:'',
  force:null as Verdict|null,
  failCheck:false,
  exits:{7899:EXIT} as Record<number,string>,
  holdNextCheck:false,
  releaseCheck:null as (()=>void)|null,
  nodes:['JP-HY2','KR-HY2'],
  leaks:[] as LineConnections['leaks'],
  processMatching:false,
  language:'zh' as 'zh'|'en',
  launched:[] as LaunchEntry[],
  identities:{browser:{enabled:false,bound_ids:[]},browser_warning:null,active:'a',recovery:null,running:false,
    current:{present:true,display_name:'Fixture user',email:'fixture@example.invalid',organization:null,unavailable:false},
    records:[{id:'a',name:'Fixture user',saved_at:1780000000000,bytes:2048,policy:{...defaultPolicy}},{id:'b',name:'Work account',saved_at:1780000001000,bytes:4096,policy:{...defaultPolicy}}]} as IdentityState,
};
const browser={running:false,location:true as boolean|null};
// ----- 与 browser::network::checks 同形的核验项：未运行时全部待核验，运行中为一致 / 不一致混合 -----
function browserSnapshot(){
  const machine={platform:'windows',version:'10.0.26200',cores:8,timezone:'Asia/Shanghai',languages:['zh-CN'],locale:'zh-CN',location_enabled:browser.location,timezones:[]};
  const location=browser.location===true?'开启':browser.location===false?'关闭':'未核验';
  const pending=[
    ['目标地区网络出口','pending','需要打开浏览器实测出口。'],
    ['浏览器与机器出口','pending','点击检测机器出口；配置代理不等于已核验。'],
    ['时区一致','pending','本机：Asia/Shanghai；浏览器：待测；出口：待测'],
    ['目标语言与系统区域','pending','机器：zh-CN / zh-CN；浏览器：待测'],
    ['真实设备与 CPU','pending','windows 10.0.26200 · 8 核；浏览器版本 待测 · 待测 核'],
    ['浏览器版本','pending','引擎：140.0.7339.80；实测：待测'],
    ['地理位置关闭','pending',`机器定位：${location}；网页权限：待测`],
  ];
  const running=[
    ['目标地区网络出口','ok',`目标：美国 · 洛杉矶；实际：US · ${EXIT} · Los Angeles · Example ISP`],
    pending[1],
    ['时区一致','mismatch','本机：Asia/Shanghai；浏览器：America/Los_Angeles；出口：America/Los_Angeles'],
    ['目标语言与系统区域','mismatch','机器：zh-CN / zh-CN；浏览器：en-US'],
    ['真实设备与 CPU','ok','windows 10.0.26200 · 8 核；浏览器版本 10.0.26200 · 8 核'],
    ['浏览器版本','ok','引擎：140.0.7339.80；实测：140.0.7339.80'],
    ['地理位置关闭',browser.location===false?'ok':'mismatch',`机器定位：${location}；网页权限：denied`],
  ];
  const tail=[['真实图形与字体','pending','Canvas 与布局矩形使用稳定种子；不作为机器完全一致。'],['DNS / WebRTC 泄漏','pending','已设置代理 DNS、限制未代理 UDP、关闭 QUIC；尚未完成独立泄漏测试。']];
  return {ui_language:state.language,exit_services:[],region:{id:'us-la',label:'美国 · 洛杉矶',country:'US',language:'en-US',locale:'en-US',timezone:'America/Los_Angeles'},
    config:{seed:1,proxy:'',follow_machine:false,language:'en-US',timezone:'America/Los_Angeles',native_graphics:false},machine,
    engine_version:'140.0.7339.80',engine_ready:true,running:browser.running,profile:'C:\\Fixture\\profile',identity_linked:state.identities.browser.enabled,cache:[],cache_error:'',
    report:null,report_received_at:browser.running?Date.now()-4000:null,machine_exit:null,
    checks:[...(browser.running?running:pending),...tail].map(([title,status,detail])=>({title,status,detail}))};
}
const commands:{command:string;args:any}[]=[];
function check(line=state.settings.line):LineCheck{
  const base={mode:'rule',country:'',timezone:'',ip:'',checked_at:Date.now()};
  if(!line.controller||!line.port)return {...base,verdict:'unknown',label:'无法确认',reason:'controller 地址为空。'};
  const ip=state.force==='block'?'198.51.100.9':state.exits[line.port];
  const verdict=state.force??(!ip||!line.expected_ip?'unknown':ip===line.expected_ip?'pass':'block');
  if(verdict==='pass')return {...base,verdict,label:'通过',reason:`专用线路出口为 ${ip}，与期望一致。`,ip,country:'US',timezone:'America/Los_Angeles'};
  if(verdict==='block')return {...base,verdict,label:'拦住',reason:`实际出口 ${ip} 与期望出口 ${line.expected_ip} 不符，已拦住。`,ip,country:'JP',timezone:'Asia/Tokyo'};
  if(ip&&!line.expected_ip&&!state.force)return {...base,verdict,label:'无法确认',reason:`专用线路出口为 ${ip}，还没设定期望出口，无法确认。`,ip};
  return {...base,verdict,label:'无法确认',reason:'出口查询服务少于 2 个，无法确认。'};
}
mockWindows('main');
mockIPC(async(command,args:any)=>{
  commands.push({command,args:structuredClone(args)});
  await new Promise(resolve=>setTimeout(resolve,30));
  switch(command){
    case 'settings_read':return structuredClone(state.settings);
    case 'settings_write':{
      const {secret,...line}=args.patch.line??{};
      const candidate={...state.settings.line,...line};
      if(candidate.expected_ip&&Object.keys(args.patch.line??{}).length){
        const verified=check(candidate);
        if(verified.verdict!=='pass')throw verified.reason;
      }
      if(typeof secret==='string'){state.secret=secret;state.settings.line.secret_set=secret.length>0;}
      Object.assign(state.settings.line,line);
      return structuredClone(state.settings);
    }
    case 'line_check':{
      if(state.failCheck)throw '读取 mihomo 控制接口超时。';
      const result=check({...state.settings.line,...args?.patch?.line});
      if(!args?.patch&&state.holdNextCheck){
        state.holdNextCheck=false;
        await new Promise<void>(resolve=>{state.releaseCheck=resolve;});
        state.releaseCheck=null;
      }
      return result;
    }
    case 'line_nodes':if(!(args?.patch?.line?.controller??state.settings.line.controller))throw '连不上 mihomo 控制接口。';return [...state.nodes];
    case 'line_connections':{
      const verdict:Verdict=state.leaks.length?'block':'pass';
      return {verdict,label:verdict==='pass'?'通过':'拦住',reason:verdict==='pass'?`专用线路出口为 ${EXIT}，与期望一致。`:`实际出口 198.51.100.9 与期望出口 ${EXIT} 不符，已拦住。`,total:12,claude:3,leaks:structuredClone(state.leaks),process_matching:state.processMatching,checked_at:Date.now()} satisfies LineConnections;
    }
    case 'launch':{const result=check();if(result.verdict==='pass')state.launched.push(args.entry);return {launched:result.verdict==='pass',reason:result.verdict==='pass'?'':result.reason,check:result};}
    case 'workspace_choose':state.settings.workspace='D:\\Projects\\demo';return state.settings.workspace;
    case 'ui_language_read':return state.language;
    case 'ui_language_write':state.language=args.language;return null;
    case 'identities_read':return structuredClone(state.identities);
    case 'identities_stop':return {running:false};
    case 'identities_switch':{
      const target=state.identities.records.find(row=>row.id===args.targetId)!;
      state.identities.active=target.id;state.identities.current={...state.identities.current,display_name:target.name};
      return structuredClone(state.identities);
    }
    case 'claude_cli_read':return {method:'native',path:'C:\\Fixture\\claude.exe',version:'2.1.0'};
    case 'browser_read':return browserSnapshot();
    case 'system_disable_location':
      if(browser.location!==false){browser.location=false;throw '请在打开的 Windows 设置窗口中手动关闭定位权限。';}
      return {state:browserSnapshot().machine,message:'Windows 定位权限已成功禁用并核验。'};
    case 'plugin:window|is_visible':return true;
  }
  throw `Unexpected fixture command: ${command}`;
},{shouldMockEvents:true});
Object.assign(window,{appFixture:{state,commands,browser}});
createRoot(document.getElementById('fixture')!).render(<Root><App/></Root>);
