// [INPUT]: launch 命令（后端启动前重新检查线路）、workspace_choose / settings_read 与 Toast。
// [OUTPUT]: useLaunch（启动并把本次检查结果交给状态条，被拦或出错用 Toast 显示原因）；LaunchPanel：概览页三张启动卡片
//           「Claude Code / 桌面版 / 网页版」，各自说明怎么带上专用线路，Claude Code 卡片显示并可更改 CLI 工作目录。
// [POS]: 唯一启动入口；网页版照旧走 launch('web')，网页版页复用 useLaunch。
import {useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {FolderOpen,Globe,Monitor,Terminal} from 'lucide-react';
import type {LaunchEntry,LaunchResult,LineCheck,Settings} from './contract';
import {Button} from './components/ui/button';
import {useToast} from './components/ui/toast';
import {cn} from './components/ui/cn';
import {useI18n} from './i18n';
export const entries:{entry:LaunchEntry;label:string;name:string;hint:string;icon:typeof Terminal}[]=[
  {entry:'cli',label:'启动 Claude Code',name:'Claude Code',hint:'新开一个终端窗口，只给 Claude Code 注入专用端口代理，不改系统代理和环境变量。',icon:Terminal},
  {entry:'desktop',label:'启动桌面版',name:'桌面版',hint:'经桌面版执行别名带专用代理参数启动；桌面版已经在运行时需要先退出。',icon:Monitor},
  {entry:'web',label:'启动网页版',name:'网页版',hint:'在独立的指纹浏览器里打开，时区跟随本次检查到的出口。',icon:Globe},
];
export function useLaunch(onCheck:(check:LineCheck)=>void){
  const toast=useToast();
  const [pending,setPending]=useState<LaunchEntry|null>(null);
  async function launch(entry:LaunchEntry,label:string){
    setPending(entry);
    try{
      const result=await invoke<LaunchResult>('launch',{entry});
      onCheck(result.check);
      if(result.launched)toast({tone:'info',title:'已启动：{v0}',values:{v0:label}});
      else toast({tone:'block',title:'没有启动：{v0}',values:{v0:label},description:result.reason||result.check.reason});
    }catch(e){toast({tone:'block',title:'没有启动：{v0}',values:{v0:label},description:String(e)});}
    finally{setPending(null);}
  }
  return {pending,launch};
}
export function LaunchPanel({disabled,onCheck,settings,onSettings}:{disabled?:boolean;onCheck:(check:LineCheck)=>void;settings:Settings|null;onSettings:(settings:Settings)=>void}){
  const {t}=useI18n();
  const {pending,launch}=useLaunch(onCheck);
  const [choosing,setChoosing]=useState(false),[error,setError]=useState('');
  async function workspace(){
    setChoosing(true);setError('');
    try{if(await invoke<string|null>('workspace_choose')!==null)onSettings(await invoke<Settings>('settings_read'));}
    catch(e){setError(String(e));}finally{setChoosing(false);}
  }
  return <section className="space-y-3">
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="text-[15px] font-semibold">{t('启动 Claude')}</h2><span className="text-xs text-muted">{t('每次启动前都会重新检查线路，没通过就不启动。')}</span></div>
    <div className="grid gap-3 @2xl:grid-cols-3">
      {entries.map(({entry,label,name,hint,icon:Icon})=><div key={entry} className={cn('group flex flex-col rounded-2xl border bg-raised p-4 shadow-card transition-colors',entry==='cli'?'border-border-strong':'border-border')}>
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className={cn('grid size-9 place-items-center rounded-xl',entry==='cli'?'bg-primary text-primary-fg':'bg-muted-bg text-fg-2')}><Icon className="size-[18px]" strokeWidth={1.8}/></span>
          <h3 className="font-display text-[16px] font-semibold tracking-tight">{t(name)}</h3>
        </div>
        <p className="mt-2.5 flex-1 text-xs leading-relaxed text-muted">{t(hint)}</p>
        {entry==='cli'&&<div className="mt-3 flex items-center gap-1.5 rounded-lg bg-muted-bg py-1 pl-2.5 pr-1">
          <FolderOpen className="size-3.5 shrink-0 text-muted" aria-hidden="true"/>
          <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-fg-2" title={settings?.workspace||undefined}>{settings?.workspace||t('未设置')}</code>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" loading={choosing} disabled={!settings} onClick={()=>void workspace()} aria-label={t('更改 CLI 工作目录')}>{t('更改')}</Button>
        </div>}
        <Button className="mt-3 w-full justify-center" variant={entry==='cli'?'primary':'secondary'} loading={pending===entry} disabled={disabled||!!pending} onClick={()=>void launch(entry,label)}>
          {pending!==entry&&<Icon className="size-4" aria-hidden="true"/>}{t(label)}
        </Button>
      </div>)}
    </div>
    {error&&<p role="alert" className="text-xs text-block">{t(error)}</p>}
  </section>;
}
