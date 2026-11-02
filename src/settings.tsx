// [INPUT]: settings_read / settings_write / line_nodes / line_check / workspace_choose、ui_language_* 与本地主题偏好。
// [OUTPUT]: 设置页三组卡片：线路（草稿探测、验证并更换出口）、通用（语言、主题、CLI 工作目录）、关于（含 CLI 卸载 / 重装）。
// [POS]: 线路设置的常规入口；secret 只写不读，输入框保存后立即清空，从不回填、不进 localStorage。
import {useEffect,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {FolderOpen} from 'lucide-react';
import type {LineCheck,Settings,SettingsPatch} from './contract';
import {Button} from './components/ui/button';
import {Card} from './components/ui/card';
import {Input} from './components/ui/input';
import {Select} from './components/ui/select';
import {useToast} from './components/ui/toast';
import {ClaudeCliPanel} from './claude-cli-panel';
import {setLocale,useI18n,type Locale} from './i18n';
import {setTheme,useTheme,type Theme} from './theme';
import type {ReactNode} from 'react';
type LinePatch=NonNullable<SettingsPatch['line']>;
export function Field({label,hint,children,htmlFor}:{label:string;hint?:string;children:ReactNode;htmlFor?:string}){
  return <div className="grid gap-1 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-3">
    <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
    <div className="space-y-1">{children}{hint&&<p className="text-xs text-muted">{hint}</p>}</div>
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
  return <section className="space-y-4">
    <header><h1 className="text-lg font-semibold">{t('设置')}</h1></header>
    {settings?<LineCard settings={settings} onSettings={onSettings} onRecheck={onRecheck}/>:<Card className="text-sm text-muted">{t('正在读取设置…')}</Card>}
    <GeneralCard settings={settings} onSettings={onSettings}/>
    <Card className="space-y-4">
      <h2 className="text-sm font-semibold">{t('关于')}</h2>
      <p className="text-sm"><strong>CC-Guard</strong> <span className="text-muted">· {t('让 Claude 只走你指定的 Clash 节点，没通过检查就不启动。')}</span></p>
      <p className="text-xs text-muted">{t('开源软件，MIT 许可。不上传任何账号或线路信息。')}</p>
      <ClaudeCliPanel/>
    </Card>
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
  return <Card><fieldset disabled={!!busy} className="space-y-3">
    <h2 className="text-sm font-semibold">{t('线路')}</h2>
    <Field label={t('Clash 控制地址')} htmlFor="line-controller" hint={t('Clash Verge：设置 → 外部控制，例如 127.0.0.1:9097')}><Input id="line-controller" value={controller} onChange={e=>setController(e.target.value)} placeholder="127.0.0.1:9097" spellCheck={false}/></Field>
    <Field label={t('控制密钥')} htmlFor="line-secret" hint={t(controller.trim()!==line.controller?'地址已更改，请填写新控制端的密钥。无需密钥时留空。':line.secret_set?'已设置；留空表示不修改。':'未设置；Clash 没设密钥时留空。')}><Input id="line-secret" type="password" autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)} placeholder={t(line.secret_set&&controller.trim()===line.controller?'已设置':'未设置')}/></Field>
    <Field label={t('Claude 专用端口')} htmlFor="line-port" hint={t('填写为 Claude 单独配置的 HTTP 入站端口，不能与 Clash 的日常代理端口相同。')}><Input id="line-port" inputMode="numeric" value={port} onChange={e=>setPort(e.target.value)} placeholder="7899"/></Field>
    <Field label={t('指定节点')} htmlFor="line-node" hint={nodesError?t(nodesError):undefined}>
      <div className="flex gap-2"><NodeSelect id="line-node" value={node} onChange={setNode} nodes={nodes}/><Button size="md" loading={busy==='nodes'} disabled={!!busy||!controller.trim()} onClick={()=>void loadNodes()}>{t('刷新节点')}</Button></div>
    </Field>
    <Field label={t('期望出口 IP')} htmlFor="line-expected" hint={t('先在 Clash 中更新 Claude 专用线路，再填写服务商提供的新公网出口 IP。可探测实际出口作核对，验证一致后才会保存。')}>
      {line.expected_ip&&<p className="text-xs text-muted">{t('已保存的出口：{v0}',{v0:line.expected_ip})}</p>}
      <div className="flex gap-2"><Input id="line-expected" value={expected} onChange={e=>setExpected(e.target.value)} placeholder="203.0.113.7" spellCheck={false}/><Button loading={busy==='exit'} disabled={!!busy} onClick={()=>void probeExit()}>{t('探测专用出口')}</Button></div>
      {observed&&<p role="status" className="text-sm">{t('本次探测的出口：{v0}',{v0:observed})}</p>}
    </Field>
    {error&&<p role="alert" className="text-sm text-block">{t(error)}</p>}
    <div className="flex justify-end"><Button variant="primary" loading={busy==='save'} disabled={!!busy} onClick={()=>void save()}>{t(replacing?'验证并更换出口':'保存线路设置')}</Button></div>
  </fieldset></Card>;
}
function GeneralCard({settings,onSettings}:{settings:Settings|null;onSettings:(settings:Settings)=>void}){
  const {t,locale}=useI18n();
  const theme=useTheme();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function language(next:string){
    if(next!=='zh'&&next!=='en'||next===locale)return;
    setBusy(true);setError('');
    try{await invoke('ui_language_write',{language:next});setLocale(next as Locale);}catch(e){setError(String(e));}finally{setBusy(false);}
  }
  async function workspace(){
    setBusy(true);setError('');
    try{if(await invoke<string|null>('workspace_choose')!==null)onSettings(await invoke<Settings>('settings_read'));}
    catch(e){setError(String(e));}finally{setBusy(false);}
  }
  return <Card className="space-y-3">
    <h2 className="text-sm font-semibold">{t('通用')}</h2>
    <Field label={t('界面语言')} htmlFor="general-language"><Select id="general-language" aria-label={t('界面语言')} value={locale} disabled={busy} onValueChange={value=>void language(value)} options={[{value:'zh',label:'中文'},{value:'en',label:'English'}]}/></Field>
    <Field label={t('主题')} htmlFor="general-theme"><Select id="general-theme" aria-label={t('主题')} value={theme} onValueChange={value=>setTheme(value as Theme)} options={[{value:'system',label:t('跟随系统')},{value:'light',label:t('浅色')},{value:'dark',label:t('深色')}]}/></Field>
    <Field label={t('CLI 工作目录')} hint={t('启动 Claude Code 时打开的文件夹。')}>
      <div className="flex items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-lg bg-muted-bg px-3 py-2 text-xs">{settings?.workspace||t('未设置')}</code><Button disabled={busy||!settings} onClick={()=>void workspace()}><FolderOpen className="size-4" aria-hidden="true"/>{t('更改')}</Button></div>
    </Field>
    {error&&<p role="alert" className="text-sm text-block">{t(error)}</p>}
  </Card>;
}
