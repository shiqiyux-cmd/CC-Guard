/**
 * [INPUT]: settings_read、line_check（经 useLineCheck）、line_connections（经 useConnections）、ui_language_read、窗口可见与托盘拦截事件、各页面组件。
 * [OUTPUT]: CC-Guard 主窗口：纸面画布上的左侧栏（概览、账号、连接、网页版，底部设置；概览旁是线路信号灯，连接旁是漏网数），
 *           右侧内容纸张（非概览页顶部固定线路信号条），首次设置向导，Toast。
 * [POS]: 单窗口编排层；隐藏到托盘时停止轮询；连接监控在这一层，漏网记录跨页面保留；身份事务进行中锁定导航。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {invoke} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {Activity,Globe,LayoutDashboard,Settings as SettingsIcon,UsersRound} from 'lucide-react';
import type {Settings} from './contract';
import {needsSetup} from './line-model';
import {StatusBar,useLineCheck} from './status-bar';
import {Overview} from './overview';
import {IdentityPanel} from './identities';
import {ConnectionsPanel,useConnections} from './connections';
import {BrowserPanel} from './browser-panel';
import {SettingsPanel} from './settings';
import {SetupWizard} from './wizard';
import {ToastProvider,useToast} from './components/ui/toast';
import {TooltipProvider} from './components/ui/tooltip';
import {cn} from './components/ui/cn';
import {setLocale,useI18n,type Locale} from './i18n';
import {applyTheme} from './theme';
import logo from '../assets/cc-guard.svg';
import './index.css';
type Page='overview'|'accounts'|'connections'|'browser'|'settings';
const pages:{page:Page;label:string;icon:typeof Activity}[]=[
  {page:'overview',label:'概览',icon:LayoutDashboard},
  {page:'accounts',label:'账号',icon:UsersRound},
  {page:'connections',label:'连接',icon:Activity},
  {page:'browser',label:'网页版',icon:Globe},
];
export function App(){
  const {t}=useI18n();
  const toast=useToast();
  const [page,setPage]=useState<Page>('overview'),[busy,setBusy]=useState(false);
  const [settings,setSettings]=useState<Settings|null>(null),[settingsError,setSettingsError]=useState('');
  const [wizard,setWizard]=useState(false);
  const [visible,setVisible]=useState(document.visibilityState!=='hidden');
  const line=useLineCheck(visible);
  const monitor=useConnections(visible,page==='connections');
  useEffect(()=>{
    void getCurrentWindow().isVisible().then(setVisible).catch(()=>{});
    const off=listen<boolean>('window-visible',event=>setVisible(event.payload));
    return()=>{void off.then(stop=>stop());};
  },[]);
  useEffect(()=>{
    const off=listen<string>('proxy-launch-blocked',event=>toast({tone:'block',title:'没有启动',description:event.payload}));
    return()=>{void off.then(stop=>stop());};
  },[toast]);
  useEffect(()=>{void invoke<Locale>('ui_language_read').then(setLocale).catch(()=>{});},[]);
  useEffect(()=>{
    invoke<Settings>('settings_read').then(next=>{setSettings(next);setSettingsError('');if(needsSetup(next))setWizard(true);}).catch(e=>setSettingsError(String(e)));
  },[]);
  const recheck=useCallback(()=>line.run(true),[line.run]);
  const leaks=monitor.latest?.leaks.length??0;
  const slot=(target:Page)=>target==='overview'?<span aria-hidden="true" className={cn('size-2 rounded-full',line.verdict==='pass'?'bg-pass':line.verdict==='block'?'bg-block':'bg-unknown/60',line.busy&&'lamp-busy')}/>
    :target==='connections'&&leaks?<span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-block px-1 font-display text-[10.5px] font-semibold text-white tabular dark:text-[#1a0b0b]">{leaks}</span>:null;
  const nav=(target:Page,label:string,Icon:typeof Activity)=><button key={target} type="button" disabled={busy} aria-current={page===target?'page':undefined} onClick={()=>setPage(target)}
    className={cn('relative flex h-9 w-full items-center gap-2.5 rounded-[10px] px-3 text-[13px] transition-colors disabled:opacity-50',page===target?'bg-raised font-semibold text-fg shadow-card ring-1 ring-border':'text-fg-2 hover:bg-raised/60 hover:text-fg')}>
    {page===target&&<span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent"/>}
    <Icon className="size-4 shrink-0" strokeWidth={page===target?2.2:1.8} aria-hidden="true"/><span className="flex-1 truncate text-left">{t(label)}</span>{slot(target)}</button>;
  return <div className="flex h-full">
    <aside className="flex w-[208px] shrink-0 flex-col px-3 pb-3 pt-5">
      <div className="mb-7 flex items-center gap-2.5 px-2">
        <img src={logo} alt="" width={30} height={30} draggable={false}/>
        <div className="min-w-0 leading-none"><strong className="block font-display text-[16px] font-semibold tracking-tight">CC-Guard</strong><span className="mt-1 block font-mono text-[10.5px] text-muted">v{__APP_VERSION__}</span></div>
      </div>
      <nav aria-label={t('主要页面')} className="space-y-1">{pages.map(item=>nav(item.page,item.label,item.icon))}</nav>
      <div className="mt-auto">{nav('settings','设置',SettingsIcon)}</div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col py-2 pr-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-border bg-surface shadow-sheet">
        {page!=='overview'&&<div className="mx-auto w-full max-w-[1080px] px-7 pt-5"><StatusBar line={line}/></div>}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1080px] px-7 pb-10 pt-6">
            {settingsError&&<p role="alert" className="mb-4 rounded-xl border border-block/35 bg-block-bg px-3.5 py-2.5 text-[13px] text-block">{t(settingsError)}</p>}
            {settings&&needsSetup(settings)&&!wizard&&<div role="note" className="mb-5 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-bg px-4 py-3 text-[13px]"><span className="flex-1">{t('线路还没设置好，Claude 无法启动。')}</span><button type="button" className="font-semibold text-accent hover:underline" onClick={()=>setWizard(true)}>{t('开始设置')}</button></div>}
            {page==='overview'&&<Overview line={line} settings={settings} onSettings={setSettings} monitor={monitor} onNavigate={setPage} onCheck={line.accept}/>}
            {page==='accounts'&&<IdentityPanel onBusy={setBusy}/>}
            {page==='connections'&&<ConnectionsPanel monitor={monitor} settings={settings}/>}
            {page==='browser'&&<BrowserPanel active={visible} onCheck={line.accept}/>}
            {page==='settings'&&<SettingsPanel settings={settings} onSettings={setSettings} onRecheck={recheck}/>}
          </div>
        </main>
      </div>
    </div>
    {settings&&wizard&&<SetupWizard open settings={settings} onSettings={setSettings} onRecheck={recheck} onClose={()=>setWizard(false)}/>}
  </div>;
}
export function Root({children}:{children:ReactNode}){
  return <TooltipProvider delayDuration={500}><ToastProvider>{children}</ToastProvider></TooltipProvider>;
}
const mount=document.getElementById('app');
if(mount){applyTheme();createRoot(mount).render(<Root><App/></Root>);}
