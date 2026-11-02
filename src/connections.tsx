// [INPUT]: line_connections 只读快照；窗口可见时在主窗口层持续读取（连接页每 2 秒，其他页每 10 秒），线路设置里的节点、Claude 域名与进程名。
// [OUTPUT]: useConnections（漏网记录跨页面保留，侧栏与概览可见）；连接页：判定与原因、Claude / 全部 / 漏网读数、识别规则、
//           漏网连接标红置顶（本次仍在的最前，含首次与最近时间）；process_matching=false 时提示只按域名核对。
// [POS]: 只观察，不拦截、不修复、不断开任何连接；启动决定在后端 launch。
import {useCallback,useEffect,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {Info,RadioTower} from 'lucide-react';
import type {LineConnections,Settings,Verdict} from './contract';
import {mergeLeaks,type SeenLeak} from './line-model';
import {Badge,type Tone} from './components/ui/badge';
import {Button} from './components/ui/button';
import {Card,CardTitle} from './components/ui/card';
import {Chip,PageHeader,Stat} from './components/ui/page';
import {cn} from './components/ui/cn';
import {useI18n} from './i18n';
export const verdictTone:Record<Verdict,Tone>={pass:'pass',block:'block',unknown:'unknown'};
export const verdictWord:Record<Verdict,string>={pass:'通过',block:'拦住',unknown:'无法确认'};
export type ConnectionsState={latest:LineConnections|null;seen:SeenLeak[];error:string;verdict:Verdict;clear:()=>void};
export function useConnections(active:boolean,fast:boolean):ConnectionsState{
  const [latest,setLatest]=useState<LineConnections|null>(null),[seen,setSeen]=useState<SeenLeak[]>([]),[error,setError]=useState('');
  const live=useRef(true);
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  useEffect(()=>{
    if(!active)return;
    let pending=false;
    const look=async()=>{
      if(pending||document.visibilityState==='hidden')return;
      pending=true;
      try{
        const next=await invoke<LineConnections>('line_connections');
        if(live.current){setLatest(next);setSeen(old=>mergeLeaks(old,next.leaks,Date.now()));setError('');}
      }catch(e){if(live.current)setError(String(e));}
      finally{pending=false;}
    };
    void look();
    const timer=window.setInterval(()=>void look(),fast?2000:10_000);
    return()=>window.clearInterval(timer);
  },[active,fast]);
  const verdict:Verdict=error||!latest?'unknown':latest.verdict==='pass'||latest.verdict==='block'?latest.verdict:'unknown';
  const clear=useCallback(()=>setSeen([]),[]);
  return {latest,seen,error,verdict,clear};
}
export function ConnectionsPanel({monitor,settings}:{monitor:ConnectionsState;settings:Settings|null}){
  const {t,locale}=useI18n();
  const {latest,seen,error,verdict}=monitor;
  const time=(at:number)=>new Date(at).toLocaleTimeString(locale==='zh'?'zh-CN':'en-US');
  const liveLeaks=latest?.leaks.length??0;
  const line=settings?.line;
  return <section className="reveal @container space-y-6">
    <PageHeader title={t('连接')} hint={t('只读：每 2 秒看一次 Claude 的连接走了哪个节点，不会断开或修改任何东西。')}
      actions={<Button size="sm" disabled={!seen.length} onClick={monitor.clear}>{t('清空记录')}</Button>}/>
    <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
      <div className="col-span-2 flex flex-col justify-between gap-2 rounded-2xl border border-border bg-raised px-4 py-3.5 shadow-card">
        <div className="flex items-center gap-2"><p className="caption flex-1">{t('核对结果')}</p><Badge tone={verdictTone[verdict]} dot data-verdict={verdict}>{t(verdictWord[verdict])}</Badge></div>
        <p className="text-[13px] leading-snug text-fg-2">{t(error||latest?.reason||'正在读取连接…')}</p>
        {latest&&<p className="text-[11px] text-muted tabular">{t('检查于 {v0}',{v0:time(latest.checked_at)})}</p>}
      </div>
      <Stat label={t('Claude 连接')} value={latest?latest.claude:'—'} detail={latest?t('全部连接 {v0}',{v0:latest.total}):undefined}/>
      <Stat label={t('漏网')} value={latest?liveLeaks:'—'} tone={liveLeaks?'block':'neutral'} detail={t('累计记录 {v0}',{v0:seen.length})}/>
    </div>
    {latest&&!latest.process_matching&&<p role="note" className="flex items-start gap-2 rounded-xl border border-border bg-muted-bg px-3.5 py-2.5 text-xs leading-relaxed text-fg-2"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true"/>{t('只按域名核对：Clash 没有开启 find-process-mode: always，认不出发起连接的程序。')}</p>}
    <Card className="space-y-4">
      <CardTitle title={t('怎么认 Claude 流量')} hint={t('命中任一规则即算 Claude 连接；链路里没有指定节点或包含它的代理组就记为漏网。规则可在设置里修改。')}/>
      <dl className="grid gap-3 text-xs @xl:grid-cols-[7rem_minmax(0,1fr)]">
        <dt className="pt-1 text-muted">{t('应走节点')}</dt><dd className="flex flex-wrap gap-1.5">{line?.node?<Chip>{line.node}</Chip>:<Chip muted>{t('未设置')}</Chip>}</dd>
        <dt className="pt-1 text-muted">{t('按域名后缀')}</dt><dd className="flex flex-wrap gap-1.5">{line?.claude_hosts.length?line.claude_hosts.map(host=><Chip key={host}>{host}</Chip>):<Chip muted>{t('无')}</Chip>}</dd>
        <dt className="pt-1 text-muted">{t('按进程名')}</dt><dd className="flex flex-wrap items-center gap-1.5">{line?.claude_processes.length?line.claude_processes.map(name=><Chip key={name} muted={latest?.process_matching===false}>{name}</Chip>):<Chip muted>{t('无')}</Chip>}
          {latest?.process_matching===false&&<span className="text-muted">{t('当前未生效')}</span>}</dd>
      </dl>
    </Card>
    <div className="space-y-3">
      <div className="flex items-baseline gap-2"><h2 className="text-[15px] font-semibold">{t('漏网记录')}</h2><span className="text-xs text-muted">{t('本次仍在的排最前，最多保留 200 条')}</span></div>
      <div className="leak-list space-y-2" aria-label={t('漏网连接')}>
        {seen.map(row=><div key={`${row.host}|${row.process}|${row.inbound}|${row.node}`} data-leak={row.live?'live':'seen'}
          className={cn('leak-row relative flex items-center gap-3 overflow-hidden rounded-xl border border-block/35 py-3 pl-4 pr-3.5',row.live?'bg-block-bg':'bg-raised')}>
          <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1 bg-block',!row.live&&'opacity-40')}/>
          <Badge tone="block" dot={row.live}>{t('漏网')}</Badge>
          <div className="min-w-0 flex-1"><strong className="block truncate font-mono text-[13px] font-semibold">{row.host||'—'}</strong>
            <span className="text-xs text-fg-2">{[row.process||t('未知程序'),t('入口 {v0}',{v0:row.inbound||'—'}),t('实际节点 {v0}',{v0:row.node||'—'})].join(' · ')}</span></div>
          <div className="shrink-0 text-right text-[11px] leading-relaxed text-muted tabular">
            <time className={cn('block',row.live&&'font-semibold text-block')}>{t(row.live?'现在':'最近 {v0}',{v0:time(row.last)})}</time>
            <time className="block">{t('首次 {v0}',{v0:time(row.first)})}</time>
          </div>
        </div>)}
        {!seen.length&&<div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-muted-bg text-muted"><RadioTower className="size-5" aria-hidden="true"/></span>
          <p className="text-sm font-medium text-fg">{t(latest?'没有看到漏网连接。':'还没有连接记录。')}</p>
          <p className="max-w-sm text-xs text-muted">{t('一旦有 Claude 连接没走指定节点，会在这里标红，并在侧栏「连接」旁显示数量。')}</p>
        </div>}
      </div>
    </div>
  </section>;
}
