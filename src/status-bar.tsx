// [INPUT]: line_check 命令结果（或启动 / 向导带回的检查结果）与窗口可见性。
// [OUTPUT]: useLineCheck 状态；StatusBar 两种形态——各页顶部的信号条（判定、原因、出口地区 / IP / 分流模式、检查时间、「重新检查」），
//           概览页的大号信号面板（children 放线路图）；pass 绿、block 红、unknown 灰。
// [POS]: 全局线路状态的唯一呈现；保存线路设置会使旧结果与进行中的旧检查失效。
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {ShieldAlert,ShieldCheck,ShieldQuestion,RefreshCw} from 'lucide-react';
import type {LineCheck,Verdict} from './contract';
import {modeLabel,shownVerdict,type Received} from './line-model';
import {Button} from './components/ui/button';
import {cn} from './components/ui/cn';
import {useI18n} from './i18n';
export type LineState={result:Received|null;error:string;busy:boolean;verdict:Verdict;run:(reset?:boolean)=>Promise<LineCheck|null>;accept:(check:LineCheck)=>void};
export function useLineCheck(active:boolean):LineState{
  const [result,setResult]=useState<Received|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now());
  const generation=useRef(0),pending=useRef<number|null>(null);
  const publish=useCallback((check:LineCheck)=>{setResult({check,at:Date.now()});setError('');setNow(Date.now());},[]);
  const renderedGeneration=generation.current;
  const accept=useCallback((check:LineCheck)=>{
    if(renderedGeneration===generation.current)publish(check);
  },[renderedGeneration,publish]);
  const run=useCallback(async(reset=false)=>{
    if(reset){generation.current++;setResult(null);setError('');}
    const started=generation.current;
    if(pending.current===started)return null;
    pending.current=started;setBusy(true);
    try{
      const check=await invoke<LineCheck>('line_check');
      if(started!==generation.current)return null;
      publish(check);return check;
    }catch(e){if(started===generation.current)setError(String(e));return null;}
    finally{if(pending.current===started){pending.current=null;setBusy(false);}}
  },[publish]);
  useEffect(()=>{
    if(!active)return;
    void run();
    const timer=window.setInterval(()=>{setNow(Date.now());void run();},60_000);
    return()=>window.clearInterval(timer);
  },[active,run]);
  return {result,error,busy,verdict:shownVerdict(result,error,now),run,accept};
}
export const verdictLook:Record<Verdict,{icon:typeof ShieldCheck;title:string;text:string;soft:string;ring:string}>={
  pass:{icon:ShieldCheck,title:'线路通过',text:'text-pass',soft:'bg-pass-bg',ring:'border-pass/30'},
  block:{icon:ShieldAlert,title:'已拦住',text:'text-block',soft:'bg-block-bg',ring:'border-block/35'},
  unknown:{icon:ShieldQuestion,title:'无法确认',text:'text-unknown',soft:'bg-unknown-bg',ring:'border-unknown/30'},
};
// ----- 显示用：过期、出错时不再展示旧事实，只说明原因 -----
const isStale=({verdict,result,error}:LineState)=>!!result&&!error&&verdict==='unknown'&&result.check.verdict!=='unknown';
export const freshCheck=(line:LineState):LineCheck|null=>line.result&&!line.error&&!isStale(line)?line.result.check:null;
function useShown(line:LineState){
  const {t,locale}=useI18n();
  const {result,error,busy}=line;
  const check=result?.check;
  const reason=error||(isStale(line)?'结果已过期，请重新检查。':'')||(check?check.reason:'')||(busy?'正在检查线路…':'还没有检查结果。');
  const fresh=freshCheck(line);
  const checkedAt=result?t('检查于 {v0}',{v0:new Date(result.at).toLocaleTimeString(locale==='zh'?'zh-CN':'en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}):'';
  return {t,reason:t(reason),fresh,checkedAt};
}
function Lamp({verdict,busy,large=false}:{verdict:Verdict;busy:boolean;large?:boolean}){
  const look=verdictLook[verdict];
  const Icon=look.icon;
  return <span aria-hidden="true" className={cn('relative grid shrink-0 place-items-center border bg-raised',look.ring,large?'size-14 rounded-[18px]':'size-10 rounded-xl')}>
    <Icon className={cn(look.text,large?'size-7':'size-5',busy&&'lamp-busy')} strokeWidth={1.8}/>
    <span className={cn('absolute rounded-full ring-2 ring-raised',large?'right-2 top-2 size-2.5':'right-1.5 top-1.5 size-2',verdict==='pass'?'bg-pass':verdict==='block'?'bg-block':'bg-unknown',busy&&'lamp-busy')}/>
  </span>;
}
export function StatusBar({line,hero=false,children}:{line:LineState;hero?:boolean;children?:ReactNode}){
  const {t,reason,fresh,checkedAt}=useShown(line);
  const {verdict,busy}=line;
  const look=verdictLook[verdict];
  const recheck=<Button size="sm" variant="secondary" loading={busy} onClick={()=>void line.run()}>{!busy&&<RefreshCw className="size-3.5" aria-hidden="true"/>}{t('重新检查')}</Button>;
  if(hero)return <section role="status" aria-live="polite" data-verdict={verdict} className={cn('status-bar relative overflow-hidden rounded-[22px] border bg-raised shadow-card',look.ring)}>
    <div aria-hidden="true" className={cn('pointer-events-none absolute -right-20 -top-28 size-72 rounded-full blur-3xl',look.soft)}/>
    <div className="relative flex items-start gap-4 p-6 pb-2">
      <Lamp verdict={verdict} busy={busy} large/>
      <div className="min-w-0 flex-1">
        <p className="caption">{t('线路状态')}</p>
        <strong className="mt-0.5 block font-display text-[26px] font-semibold leading-tight tracking-tight text-fg">{t(look.title)}</strong>
        <p className="status-reason mt-1 text-[13px] leading-relaxed text-fg-2">{reason}</p>
      </div>
      {recheck}
    </div>
    <div className="relative px-6 pb-5 pt-4">{children}</div>
    <footer className="relative flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface/70 px-6 py-2.5 text-xs text-muted">
      <span className="tabular">{checkedAt||t('还没有检查结果。')}</span>
      <span>{t('界面打开时每分钟复查一次，启动前一定重新检查。')}</span>
    </footer>
  </section>;
  const facts=fresh?[
    fresh.country&&[t('出口地区'),[fresh.country,fresh.timezone].filter(Boolean).join(' · ')],
    fresh.ip&&[t('出口 IP'),fresh.ip],
    fresh.mode&&[t('分流模式'),t(modeLabel(fresh.mode))],
  ].filter((fact):fact is string[]=>!!fact):[];
  return <div role="status" aria-live="polite" data-verdict={verdict} className={cn('status-bar flex items-center gap-3.5 rounded-2xl border py-2.5 pl-2.5 pr-3',look.soft,look.ring)}>
    <Lamp verdict={verdict} busy={busy}/>
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <strong className="shrink-0 text-[13.5px] font-semibold text-fg">{t(look.title)}</strong>
        <p className="status-reason min-w-0 truncate text-xs text-fg-2" title={reason}>{reason}</p>
      </div>
      {!!facts.length&&<div className="mt-0.5 flex flex-wrap gap-x-4 text-[11.5px] text-muted">
        {facts.map(([label,value])=><span key={label}>{label} <b className="font-medium text-fg-2 tabular">{value}</b></span>)}
      </div>}
    </div>
    {checkedAt&&<span className="hidden shrink-0 text-[11px] text-muted tabular lg:inline">{checkedAt}</span>}
    {recheck}
  </div>;
}
