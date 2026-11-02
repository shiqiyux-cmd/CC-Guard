/**
 * [INPUT]: 线路检查状态（useLineCheck）、线路设置、主窗口层的连接监控、identities_read 只读快照。
 * [OUTPUT]: 概览页：大号信号面板 + Claude 流量线路图（Claude → 专用端口 → 指定节点 → 公网出口，轨道颜色只随判定变化），
 *           三张启动卡片，当前账号与连接监控摘要（可跳转到对应页面）。
 * [POS]: 默认首页，回答「现在能不能安全地用 Claude、用的是哪个账号」；只读展示，启动仍由后端重新检查。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {useEffect,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {ArrowRight} from 'lucide-react';
import type {LineCheck,Settings,Verdict} from './contract';
import {modeLabel} from './line-model';
import {StatusBar,freshCheck,type LineState} from './status-bar';
import {LaunchPanel} from './launch-bar';
import {verdictTone,verdictWord,type ConnectionsState} from './connections';
import type {IdentityState} from './identity-model';
import {Avatar} from './components/ui/avatar';
import {Badge} from './components/ui/badge';
import {Button} from './components/ui/button';
import {Card,CardTitle} from './components/ui/card';
import {PageHeader} from './components/ui/page';
import {cn} from './components/ui/cn';
import {useI18n} from './i18n';
const rail:Record<Verdict,{text:string;border:string}>={pass:{text:'text-pass',border:'border-pass'},block:{text:'text-block',border:'border-block'},unknown:{text:'text-border-strong',border:'border-border-strong'}};
function RouteMap({line,settings}:{line:LineState;settings:Settings|null}){
  const {t}=useI18n();
  const check=freshCheck(line),verdict=line.verdict,saved=settings?.line;
  const mismatch=verdict==='block'&&!!check?.ip&&!!saved?.expected_ip&&check.ip!==saved.expected_ip;
  const stops:{caption:string;value:string|null;empty?:string;sub:string;warn?:string}[]=[
    {caption:'起点',value:'Claude',sub:t('Claude Code · 桌面版 · 网页版')},
    {caption:'专用端口',value:saved?.port?`:${saved.port}`:null,sub:t('Clash 里的 Claude 专用入站')},
    {caption:'指定节点',value:saved?.node||null,sub:check?.mode?t('分流模式 {v0}',{v0:t(modeLabel(check.mode))}):t('由 Clash 管理')},
    {caption:'公网出口',value:check?.ip||null,empty:'尚未测到',sub:[check?.country,check?.timezone].filter(Boolean).join(' · ')||(saved?.expected_ip?t('期望 {v0}',{v0:saved.expected_ip}):t('还没有记住出口')),warn:mismatch?t('期望 {v0}',{v0:saved!.expected_ip}):undefined},
  ];
  return <ol aria-label={t('Claude 流量路径')} className="relative grid grid-cols-4">
    <li aria-hidden="true" className={cn('absolute left-[7px] top-[6px] w-3/4 list-none',rail[verdict].text)}><span className={cn('rail block',verdict==='pass'&&'rail-flow')}/></li>
    {stops.map((stop,index)=><li key={stop.caption} className="relative min-w-0 list-none pr-3">
      <span aria-hidden="true" className={cn('relative z-10 block size-[15px] rounded-full border-[3px] bg-raised',rail[verdict].border,index===3&&verdict==='pass'&&'bg-pass')}/>
      <p className="caption mt-3">{t(stop.caption)}</p>
      <p className="mt-1 truncate font-mono text-[14px] font-semibold text-fg" title={stop.value??undefined}>{stop.value??<span className="font-sans text-[13px] font-normal text-muted">{t(stop.empty||'未设置')}</span>}</p>
      <p className="mt-0.5 truncate text-xs text-muted" title={stop.sub}>{stop.sub}</p>
      {stop.warn&&<p className="mt-0.5 truncate font-mono text-xs font-semibold text-block">{stop.warn}</p>}
    </li>)}
  </ol>;
}
function AccountSummary({onOpen}:{onOpen:()=>void}){
  const {t}=useI18n();
  const [state,setState]=useState<IdentityState|null>(null),[error,setError]=useState('');
  useEffect(()=>{invoke<IdentityState>('identities_read').then(setState).catch(e=>setError(String(e)));},[]);
  const current=state?.current;
  const saved=state?.records.filter(row=>!current?.present||row.id!==state.active).length??0;
  const name=current?.present===false?t('空账号'):current?.display_name||current?.email?.split('@')[0]||state?.records.find(row=>row.id===state.active)?.name||t('当前身份');
  return <Card className="flex flex-col gap-4">
    <CardTitle title={t('当前账号')} action={<Button size="sm" variant="ghost" onClick={onOpen}>{t('管理账号')}<ArrowRight className="size-3.5" aria-hidden="true"/></Button>}/>
    {error?<p role="alert" className="text-xs text-block">{t(error)}</p>:<div className="flex items-center gap-3">
      <Avatar name={name} empty={current?.present===false}/>
      <div className="min-w-0"><p className="truncate font-semibold">{state?name:t('检查中')}</p>
        <p className="truncate text-xs text-muted">{current?.present===false?t('没有登录任何账号。新账号登录前请先切到这里。'):[current?.email,current?.organization].filter(Boolean).join(' · ')||t(current?.unavailable?'账号信息暂不可读':'账号信息未识别')}</p></div>
    </div>}
    {state&&<div className="flex flex-wrap gap-1.5">
      <Badge dot>{t(state.running?'Claude 运行中':'Claude 未运行')}</Badge>
      <Badge>{t('已暂存 {v0} 个',{v0:saved})}</Badge>
      <Badge>{t(state.browser.enabled?'网页资料按账号隔离':'网页资料未联动')}</Badge>
      {state.recovery&&<Badge tone="block">{t('有一次身份切换尚未完成')}</Badge>}
    </div>}
  </Card>;
}
function ConnectionSummary({monitor,onOpen}:{monitor:ConnectionsState;onOpen:()=>void}){
  const {t}=useI18n();
  const {latest,error,verdict,seen}=monitor;
  const leaks=latest?.leaks.length??0;
  return <Card className="flex flex-col gap-4">
    <CardTitle title={t('连接监控')} action={<Button size="sm" variant="ghost" onClick={onOpen}>{t('查看连接')}<ArrowRight className="size-3.5" aria-hidden="true"/></Button>}/>
    <div className="flex items-end gap-6">
      <div><p className="caption">{t('Claude 连接')}</p><p className="mt-1 font-display text-[24px] font-semibold leading-none tabular">{latest?latest.claude:'—'}</p></div>
      <div><p className="caption">{t('漏网')}</p><p className={cn('mt-1 font-display text-[24px] font-semibold leading-none tabular',leaks&&'text-block')}>{latest?leaks:'—'}</p></div>
      <div className="ml-auto"><Badge tone={verdictTone[verdict]} dot>{t(verdictWord[verdict])}</Badge></div>
    </div>
    <p className="line-clamp-2 text-xs text-muted">{t(error||latest?.reason||'正在读取连接…')}{seen.length>leaks?' '+t('累计记录 {v0}',{v0:seen.length}):''}</p>
  </Card>;
}
export function Overview({line,settings,onSettings,monitor,onNavigate,onCheck}:{line:LineState;settings:Settings|null;onSettings:(settings:Settings)=>void;monitor:ConnectionsState;onNavigate:(page:'accounts'|'connections')=>void;onCheck:(check:LineCheck)=>void}){
  const {t}=useI18n();
  return <section className="reveal @container space-y-6">
    <PageHeader title={t('概览')} hint={t('Claude 只走你在 Clash 里指定的线路；没通过检查就不启动。')}/>
    <StatusBar line={line} hero><RouteMap line={line} settings={settings}/></StatusBar>
    <LaunchPanel onCheck={onCheck} settings={settings} onSettings={onSettings}/>
    <div className="grid gap-3 @2xl:grid-cols-2">
      <AccountSummary onOpen={()=>onNavigate('accounts')}/>
      <ConnectionSummary monitor={monitor} onOpen={()=>onNavigate('connections')}/>
    </div>
  </section>;
}
