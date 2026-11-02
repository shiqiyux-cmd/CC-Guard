// [INPUT]: settings_read / settings_write / line_nodes / line_check、ui_language_* 与本地主题偏好。
// [OUTPUT]: 设置页五组：线路（草稿探测、验证并更换出口）、检查规则（出口查询服务、Claude 域名与进程名，可编辑）、外观（语言、主题）、
//           后台守护（界面 / 托盘 / 启动 / 连接页的检查节奏说明）、关于（含 CLI 卸载 / 重装）。CLI 工作目录在概览的 Claude Code 卡片里。
// [POS]: 线路设置的常规入口；secret 只写不读，输入框保存后立即清空，从不回填、不进 localStorage。
import {useEffect,useState,type ReactNode} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {Activity,MonitorUp,RefreshCw,ShieldCheck} from 'lucide-react';
import type {LineCheck,Settings,SettingsPatch} from './contract';
import {Button} from './components/ui/button';
import {Card} from './components/ui/card';
import {Input,Textarea} from './components/ui/input';
import {Section} from './components/ui/page';
import {Select} from './components/ui/select';
import {useToast} from './components/ui/toast';
import {ClaudeCliPanel} from './claude-cli-panel';
import {setLocale,useI18n,type Locale} from './i18n';
import {setTheme,useTheme,type Theme} from './theme';
import logo from '../assets/cc-guard.svg';
type LinePatch=NonNullable<SettingsPatch['line']>;
export function Field({label,hint,children,htmlFor}:{label:string;hint?:string;children:ReactNode;htmlFor?:string}){
  return <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block text-xs font-medium text-fg-2">{label}</label>
    {children}
    {hint&&<p className="text-[11.5px] leading-relaxed text-muted">{hint}</p>}
  </div>;
}
export const parsePort=(value:string)=>/^\d{1,5}$/.test(value.trim())&&Number(value)>=1&&Number(value)<=65535?Number(value):null;
export function NodeSelect({value,onChange,nodes,id}:{value:string;onChange:(value:string)=>void;nodes:string[];id?:string}){
  const {t}=useI18n();
  const options=[...new Set([...(value?[value]:[]),...nodes])].map(node=>({value:node,label:node}));
  return <Select id={id} aria-label={t('指定节点')} value={value} onValueChange={onChange} options={options} placeholder={t(nodes.length?'选择节点':'先连上 Clash 再选节点')} disabled={!options.length}/>;
}
export function SettingsPanel({settings,onSettings,onRecheck}:{settings:Settings|null;onSettings:(settings:Settings)=>void;onRecheck:()=>void}){
  const {t}=useI18n();
  return <section className="reveal @container space-y-8">
    <header><h1 className="font-display text-[28px] font-semibold leading-none tracking-tight">{t('设置')}</h1></header>
    <Section title={t('线路')} hint={t('Claude 专用的 Clash 入口、节点与出口。更换出口前会用新配置实测，不一致就不保存。')}>
      {settings?<LineCard settings={settings} onSettings={onSettings} onRecheck={onRecheck}/>:<Card className="text-[13px] text-muted">{t('正在读取设置…')}</Card>}
    </Section>
    <Section title={t('检查规则')} hint={t('决定怎样确认出口，以及哪些连接算 Claude 流量。一般不用改。')}>
      {settings?<RulesCard settings={settings} onSettings={onSettings} onRecheck={onRecheck}/>:<Card className="text-[13px] text-muted">{t('正在读取设置…')}</Card>}
    </Section>
    <Section title={t('外观')}><GeneralCard/></Section>
    <Section title={t('后台守护')} hint={t('CC-Guard 在这些时候自动检查，你不用手动盯着。')}><GuardCard/></Section>
    <Section title={t('关于')}>
      <Card className="space-y-5">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" width={40} height={40} draggable={false}/>
          <div className="min-w-0 flex-1"><p className="font-display text-[17px] font-semibold">CC-Guard <span className="font-mono text-xs font-normal text-muted">v{__APP_VERSION__}</span></p>
            <p className="text-xs text-muted">{t('让 Claude 只走你指定的 Clash 节点，没通过检查就不启动。')}</p></div>
        </div>
        <p className="text-xs text-muted">{t('开源软件，MIT 许可。不上传任何账号或线路信息。')}</p>
        <div className="border-t border-border pt-4"><ClaudeCliPanel/></div>
      </Card>
    </Section>
  </section>;
}
function LineCard({settings,onSettings,onRecheck}:{settings:Settings;onSettings:(settings:Settings)=>void;onRecheck:()=>void}){
  const {t}=useI18n();
  const toast=useToast();
  const line=settings.line;
  const [controller,setController]=useState(line.controller),[secret,setSecret]=useState(''),[port,setPort]=useState(line.port?String(line.port):''),[node,setNode]=useState(line.node),[expected,setExpected]=useState(line.expected_ip);
  const [nodes,setNodes]=useState<string[]>([]),[nodesError,setNodesError]=useState('');
  const [observed,setObserved]=useState('');
  const [busy,setBusy]=useState<''|'save'|'nodes'|'exit'>(''),[error,setError]=useState('');
  useEffect(()=>{setController(line.controller);setPort(line.port?String(line.port):'');setNode(line.node);setExpected(line.expected_ip);},[line.controller,line.port,line.node,line.expected_ip]);
  useEffect(()=>{if(line.controller)void loadNodes();},[]);
  useEffect(()=>{setObserved('');},[controller,secret,port,node]);
  function controllerPatch():LinePatch{
    const patch:LinePatch={};
    if(controller.trim()!==line.controller)patch.controller=controller.trim();
    if(secret)patch.secret=secret;
    return patch;
  }
  async function loadNodes(){
    setBusy('nodes');
    try{setNodes(await invoke<string[]>('line_nodes',{patch:{line:controllerPatch()}}));setNodesError('');}
    catch(e){setNodes([]);setNodesError(String(e));}finally{setBusy('');}
  }
  function draft():LinePatch{
    const portNumber=parsePort(port);
    if(port.trim()&&portNumber===null)throw new Error('专用端口要填 1–65535 的数字。');
    const patch=controllerPatch();
    if((portNumber??0)!==line.port)patch.port=portNumber??0;
    if(node!==line.node)patch.node=node;
    return patch;
  }
  const replacing=!!line.expected_ip&&expected.trim()!==line.expected_ip;
  async function save(){
    setBusy('save');setError('');
    try{
      const patch=draft();
      if(replacing&&!expected.trim())throw new Error('请填写服务商提供的新出口 IP。');
      if(expected.trim()!==line.expected_ip)patch.expected_ip=expected.trim();
      onSettings(await invoke<Settings>('settings_write',{patch:{line:patch}}));
      setSecret('');
      toast({tone:'info',title:'线路设置已保存，正在重新检查。'});
      onRecheck();
    }catch(e){setError(e instanceof Error?e.message:String(e));onRecheck();}finally{setBusy('');}
  }
  async function probeExit(){
    setBusy('exit');setError('');setObserved('');
    try{
      const check=await invoke<LineCheck>('line_check',{patch:{line:{...draft(),expected_ip:''}}});
      if(check.ip)setObserved(check.ip);else setError(check.reason||'没有读到当前出口。');
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy('');}
  }
  return <Card className="p-0"><fieldset disabled={!!busy} className="grid gap-4 p-5 @min-[560px]:grid-cols-2">
    <Field label={t('Clash 控制地址')} htmlFor="line-controller" hint={t('Clash Verge：设置 → 外部控制，例如 127.0.0.1:9097')}><Input id="line-controller" className="font-mono" value={controller} onChange={e=>setController(e.target.value)} placeholder="127.0.0.1:9097" spellCheck={false}/></Field>
    <Field label={t('控制密钥')} htmlFor="line-secret" hint={t(controller.trim()!==line.controller?'地址已更改，请填写新控制端的密钥。无需密钥时留空。':line.secret_set?'已设置；留空表示不修改。':'未设置；Clash 没设密钥时留空。')}><Input id="line-secret" type="password" autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)} placeholder={t(line.secret_set&&controller.trim()===line.controller?'已设置':'未设置')}/></Field>
    <Field label={t('Claude 专用端口')} htmlFor="line-port" hint={t('填写为 Claude 单独配置的 HTTP 入站端口，不能与 Clash 的日常代理端口相同。')}><Input id="line-port" className="font-mono" inputMode="numeric" value={port} onChange={e=>setPort(e.target.value)} placeholder="7899"/></Field>
    <Field label={t('指定节点')} htmlFor="line-node" hint={nodesError?t(nodesError):t('Claude 流量必须经过的节点或代理组。')}>
      <div className="flex gap-2"><NodeSelect id="line-node" value={node} onChange={setNode} nodes={nodes}/><Button size="icon" className="size-9" loading={busy==='nodes'} disabled={!!busy||!controller.trim()} onClick={()=>void loadNodes()} aria-label={t('刷新节点')}>{busy!=='nodes'&&<RefreshCw className="size-3.5" aria-hidden="true"/>}</Button></div>
    </Field>
    <div className="@min-[560px]:col-span-2">
      <Field label={t('期望出口 IP')} htmlFor="line-expected" hint={t('先在 Clash 中更新 Claude 专用线路，再填写服务商提供的新公网出口 IP。可探测实际出口作核对，验证一致后才会保存。')}>
        <div className="flex gap-2"><Input id="line-expected" className="font-mono" value={expected} onChange={e=>setExpected(e.target.value)} placeholder="203.0.113.7" spellCheck={false}/><Button loading={busy==='exit'} disabled={!!busy} onClick={()=>void probeExit()}>{t('探测专用出口')}</Button></div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {line.expected_ip&&<span className="text-muted">{t('已保存的出口：{v0}',{v0:line.expected_ip})}</span>}
          {observed&&<span role="status" className="font-medium text-fg">{t('本次探测的出口：{v0}',{v0:observed})}</span>}
        </div>
      </Field>
    </div>
  </fieldset>
    <div className="flex items-center gap-3 rounded-b-2xl border-t border-border bg-surface px-5 py-3">
      <p role={error?'alert':undefined} className="min-w-0 flex-1 text-xs text-block">{error&&t(error)}</p>
      <Button variant="primary" loading={busy==='save'} disabled={!!busy} onClick={()=>void save()}>{t(replacing?'验证并更换出口':'保存线路设置')}</Button>
    </div>
  </Card>;
}
const lines=(value:string)=>value.split(/[\n,，]+/).map(item=>item.trim()).filter(Boolean);
const same=(a:string[],b:string[])=>a.length===b.length&&a.every((item,i)=>item===b[i]);
function RulesCard({settings,onSettings,onRecheck}:{settings:Settings;onSettings:(settings:Settings)=>void;onRecheck:()=>void}){
  const {t}=useI18n();
  const toast=useToast();
  const line=settings.line;
  const [services,setServices]=useState(line.services.join('\n')),[hosts,setHosts]=useState(line.claude_hosts.join('\n')),[processes,setProcesses]=useState(line.claude_processes.join('\n'));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setServices(line.services.join('\n'));setHosts(line.claude_hosts.join('\n'));setProcesses(line.claude_processes.join('\n'));},[line.services,line.claude_hosts,line.claude_processes]);
  const patch:LinePatch={};
  if(!same(lines(services),line.services))patch.services=lines(services);
  if(!same(lines(hosts),line.claude_hosts))patch.claude_hosts=lines(hosts);
  if(!same(lines(processes),line.claude_processes))patch.claude_processes=lines(processes);
  const dirty=Object.keys(patch).length>0;
  async function save(){
    setBusy(true);setError('');
    try{
      if(patch.services&&patch.services.length<2)throw new Error('出口查询服务至少要 2 个，按域名去重后计算。');
      if(patch.claude_hosts&&!patch.claude_hosts.length)throw new Error('至少保留一个 Claude 域名。');
      onSettings(await invoke<Settings>('settings_write',{patch:{line:patch}}));
      toast({tone:'info',title:'检查规则已保存，正在重新检查。'});
      onRecheck();
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  function reset(){setServices(line.services.join('\n'));setHosts(line.claude_hosts.join('\n'));setProcesses(line.claude_processes.join('\n'));setError('');}
  return <Card className="p-0"><fieldset disabled={busy} className="grid gap-4 p-5 @min-[560px]:grid-cols-3">
    <div className="@min-[560px]:col-span-3"><Field label={t('出口查询服务')} htmlFor="rules-services" hint={t('经专用端口逐个查询公网出口，至少 2 个成功且一致、并等于期望出口才算通过。每行一个网址。')}><Textarea id="rules-services" rows={3} value={services} onChange={e=>setServices(e.target.value)} spellCheck={false}/></Field></div>
    <div className="@min-[560px]:col-span-2"><Field label={t('Claude 域名')} htmlFor="rules-hosts" hint={t('按域名后缀认 Claude 连接，例如 claude.ai 也包含 api.claude.ai。')}><Textarea id="rules-hosts" rows={3} value={hosts} onChange={e=>setHosts(e.target.value)} spellCheck={false}/></Field></div>
    <Field label={t('Claude 进程名')} htmlFor="rules-processes" hint={t('不分大小写；需要 Clash 开启 find-process-mode: always。')}><Textarea id="rules-processes" rows={3} value={processes} onChange={e=>setProcesses(e.target.value)} spellCheck={false}/></Field>
  </fieldset>
    <div className="flex items-center gap-3 rounded-b-2xl border-t border-border bg-surface px-5 py-3">
      <p role={error?'alert':undefined} className="min-w-0 flex-1 text-xs text-block">{error&&t(error)}</p>
      <Button variant="ghost" disabled={busy||!dirty} onClick={reset}>{t('还原')}</Button>
      <Button variant="primary" loading={busy} disabled={!dirty} onClick={()=>void save()}>{t('保存检查规则')}</Button>
    </div>
  </Card>;
}
function GeneralCard(){
  const {t,locale}=useI18n();
  const theme=useTheme();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function language(next:string){
    if(next!=='zh'&&next!=='en'||next===locale)return;
    setBusy(true);setError('');
    try{await invoke('ui_language_write',{language:next});setLocale(next as Locale);}catch(e){setError(String(e));}finally{setBusy(false);}
  }
  return <Card className="grid gap-4 @min-[560px]:grid-cols-2">
    <Field label={t('界面语言')} htmlFor="general-language"><Select id="general-language" aria-label={t('界面语言')} value={locale} disabled={busy} onValueChange={value=>void language(value)} options={[{value:'zh',label:'中文'},{value:'en',label:'English'}]}/></Field>
    <Field label={t('主题')} htmlFor="general-theme"><Select id="general-theme" aria-label={t('主题')} value={theme} onValueChange={value=>setTheme(value as Theme)} options={[{value:'system',label:t('跟随系统')},{value:'light',label:t('浅色')},{value:'dark',label:t('深色')}]}/></Field>
    {error&&<p role="alert" className="text-xs text-block @min-[560px]:col-span-2">{t(error)}</p>}
  </Card>;
}
const guards:{icon:typeof Activity;title:string;detail:string}[]=[
  {icon:ShieldCheck,title:'每次启动前',detail:'Claude Code、桌面版、网页版启动前都重新检查线路，没通过就不启动。'},
  {icon:RefreshCw,title:'界面打开时',detail:'每分钟复查一次线路；结果超过 3 分钟没更新就显示为无法确认。'},
  {icon:MonitorUp,title:'托盘后台',detail:'托盘每 5 分钟检查一次，线路出故障和恢复时各通知一次；窗口隐藏时界面暂停刷新。'},
  {icon:Activity,title:'连接核对',detail:'窗口可见时持续核对 Claude 连接：连接页每 2 秒，其他页面每 10 秒，漏网数显示在侧栏。'},
];
function GuardCard(){
  const {t}=useI18n();
  return <Card className="p-0"><ul className="divide-y divide-border">{guards.map(({icon:Icon,title,detail})=><li key={title} className="flex items-start gap-3 px-5 py-3.5">
    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted-bg text-fg-2"><Icon className="size-4" strokeWidth={1.8}/></span>
    <div className="min-w-0"><p className="text-[13px] font-medium">{t(title)}</p><p className="mt-0.5 text-xs leading-relaxed text-muted">{t(detail)}</p></div>
  </li>)}</ul></Card>;
}
