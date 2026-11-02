/**
 * [INPUT]: browser_read 只读快照（引擎、运行状态、资料联动、目标地区、起始页回传与逐项核验、本机状态）、system_disable_location、useLaunch('web')。
 * [OUTPUT]: 网页版页：引擎 / 运行 / 资料 / 回传四格读数，目标环境，环境核验清单（一致 / 不一致 / 待核验），这台电脑的时区、语言与 Windows 定位。
 * [POS]: 指纹浏览器在主窗口里的唯一呈现；页面可见时每 10 秒重读；关闭定位只打开 Windows 设置，由用户手动完成；启动仍走 launch 门禁。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {CircleCheck,CircleDashed,CircleX,Globe,MapPinOff,RefreshCw} from 'lucide-react';
import type {LineCheck} from './contract';
import type {BrowserState} from './browser-model';
import {useLaunch} from './launch-bar';
import {Badge} from './components/ui/badge';
import {Button} from './components/ui/button';
import {Card,CardTitle} from './components/ui/card';
import {PageHeader} from './components/ui/page';
import {cn} from './components/ui/cn';
import {useI18n} from './i18n';
const marks={ok:{icon:CircleCheck,text:'text-pass',label:'一致'},mismatch:{icon:CircleX,text:'text-block',label:'不一致'},pending:{icon:CircleDashed,text:'text-unknown',label:'待核验'}} as const;
function Reading({label,value,detail}:{label:string;value:ReactNode;detail?:ReactNode}){
  return <div className="min-w-0 rounded-2xl border border-border bg-raised px-4 py-3.5 shadow-card">
    <p className="caption">{label}</p>
    <p className="mt-1.5 truncate font-display text-[17px] font-semibold leading-tight">{value}</p>
    {detail&&<p className="mt-1 truncate text-xs text-muted">{detail}</p>}
  </div>;
}
function Row({label,children}:{label:string;children:ReactNode}){
  return <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-0"><dt className="shrink-0 text-xs text-muted">{label}</dt><dd className="min-w-0 truncate text-right text-xs font-medium text-fg tabular">{children}</dd></div>;
}
export function BrowserPanel({active,onCheck}:{active:boolean;onCheck:(check:LineCheck)=>void}){
  const {t,locale}=useI18n();
  const {pending,launch}=useLaunch(onCheck);
  const [state,setState]=useState<BrowserState|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [locating,setLocating]=useState(false),[notice,setNotice]=useState('');
  const reading=useRef(false);
  const read=useCallback(async()=>{
    if(reading.current)return;
    reading.current=true;setLoading(true);
    try{setState(await invoke<BrowserState>('browser_read'));setError('');}
    catch(e){setError(String(e));}finally{reading.current=false;setLoading(false);}
  },[]);
  useEffect(()=>{
    if(!active)return;
    void read();
    const timer=window.setInterval(()=>void read(),10_000);
    return()=>window.clearInterval(timer);
  },[active,read]);
  async function disableLocation(){
    setLocating(true);setNotice('');
    try{const result=await invoke<{message?:string}>('system_disable_location');setNotice(result.message||'');await read();}
    catch(e){setNotice(String(e));}finally{setLocating(false);}
  }
  const time=(at:number)=>new Date(at).toLocaleTimeString(locale==='zh'?'zh-CN':'en-US');
  const counts={ok:0,mismatch:0,pending:0};
  state?.checks.forEach(check=>{counts[check.status]++;});
  const machine=state?.machine,region=state?.region,location=machine?.location_enabled;
  return <section className="reveal @container space-y-6">
    <PageHeader title={t('网页版环境')} hint={t('独立指纹浏览器的状态与环境核验。这里只读展示，启动网页版仍要先通过线路检查。')}
      actions={<><Button size="sm" variant="ghost" disabled={loading} onClick={()=>void read()}><RefreshCw className={cn('size-3.5',loading&&'animate-spin')} aria-hidden="true"/>{t('刷新')}</Button>
        <Button size="sm" variant="primary" loading={pending==='web'} disabled={!!pending} onClick={()=>void launch('web','启动网页版')}>{pending!=='web'&&<Globe className="size-3.5" aria-hidden="true"/>}{t('启动网页版')}</Button></>}/>
    {error&&<p role="alert" className="rounded-xl border border-block/35 bg-block-bg px-3.5 py-2.5 text-[13px] text-block">{t(error)}</p>}
    <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
      <Reading label={t('浏览器引擎')} value={state?state.engine_ready?<span className="font-mono text-[15px]">{state.engine_version}</span>:t('未就绪'):'—'} detail={state?state.engine_ready?'Fingerprint Chromium':t('安装包里没有找到指纹浏览器引擎。'):undefined}/>
      <Reading label={t('运行状态')} value={state?t(state.running?'运行中':'未运行'):'—'}/>
      <Reading label={t('网页资料')} value={state?t(state.identity_linked?'按账号隔离':'通用资料'):'—'} detail={state?t(state.identity_linked?'切换账号时自动切换网页资料':'可在账号页开启联动浏览器'):undefined}/>
      <Reading label={t('最近回传')} value={state?.report_received_at?time(state.report_received_at):t('尚未回传')} detail={state&&!state.running?t('打开网页版后起始页会实测并回传'):undefined}/>
    </div>
    <div className="grid items-start gap-3 @min-[700px]:grid-cols-[minmax(0,1fr)_17rem]">
      <Card className="space-y-3">
        <CardTitle title={t('环境核验')} hint={t('起始页在浏览器里实测后回传，逐项与目标地区和这台电脑对照。')}
          action={state&&<div className="flex gap-1.5"><Badge tone={counts.mismatch?'block':'neutral'}>{t('不一致 {v0}',{v0:counts.mismatch})}</Badge><Badge>{t('待核验 {v0}',{v0:counts.pending})}</Badge></div>}/>
        <ul className="divide-y divide-border">
          {state?.checks.map(check=>{const mark=marks[check.status];const Icon=mark.icon;return <li key={check.title} className="flex items-start gap-3 py-2.5">
            <Icon className={cn('mt-0.5 size-4 shrink-0',mark.text)} aria-hidden="true"/>
            <div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{t(check.title)}</p><p className="mt-0.5 break-words text-xs leading-relaxed text-muted">{t(check.detail)}</p></div>
            <span className={cn('shrink-0 text-[11px] font-medium',mark.text)}>{t(mark.label)}</span>
          </li>;})}
          {!state&&!error&&<li className="py-6 text-center text-xs text-muted">{t('正在读取浏览器与网络…')}</li>}
        </ul>
      </Card>
      <div className="space-y-3">
        <Card className="space-y-2">
          <CardTitle title={t('目标环境')}/>
          <dl>
            <Row label={t('目标地区')}>{region?t(region.label):t('自定义组合，未确定国家')}</Row>
            <Row label={t('目标语言')}>{region?.language||state?.config.language||'—'}</Row>
            <Row label={t('目标时区')}>{region?.timezone||state?.config.timezone||'—'}</Row>
          </dl>
          <p className="text-[11px] leading-relaxed text-muted">{t('每次启动时，浏览器时区跟随本次检查到的出口时区，语言为 en-US。')}</p>
        </Card>
        <Card className="space-y-2">
          <CardTitle title={t('这台电脑')}/>
          <dl>
            <Row label={t('系统')}>{machine?`${machine.platform} ${machine.version}`:'—'}</Row>
            <Row label={t('逻辑 CPU')}>{machine?.cores??'—'}</Row>
            <Row label={t('本机时区')}>{machine?.timezone||'—'}</Row>
            <Row label={t('本机语言 / 区域')}>{machine?`${machine.languages.join(' → ')} / ${machine.locale}`:'—'}</Row>
            <Row label={t('Windows 定位')}><span className={location?'text-block':undefined}>{t(location===true?'开启':location===false?'关闭':'未核验')}</span></Row>
          </dl>
          {machine&&location!==false&&<Button size="sm" className="w-full justify-center" loading={locating} onClick={()=>void disableLocation()}>{!locating&&<MapPinOff className="size-3.5" aria-hidden="true"/>}{t('在 Windows 设置中关闭定位')}</Button>}
          {notice&&<p role="status" className="text-xs leading-relaxed text-fg-2">{t(notice)}</p>}
        </Card>
      </div>
    </div>
  </section>;
}
