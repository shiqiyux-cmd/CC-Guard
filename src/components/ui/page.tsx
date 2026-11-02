// [INPUT]: 页面标题、说明、右侧操作；统计项的标签、数值与色调。
// [OUTPUT]: PageHeader（Bahnschrift 大标题）、Stat（仪表读数格）、Section（设置页左栏标题 + 右栏内容）、Chip（等宽小标签）。
// [POS]: 各页面共用的版式骨架；只负责排版，不含业务判断。
import type {ReactNode} from 'react';
import {cn} from './cn';
export function PageHeader({title,hint,actions}:{title:string;hint?:string;actions?:ReactNode}){
  return <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
    <div className="min-w-0 flex-1">
      <h1 className="font-display text-[28px] font-semibold leading-none tracking-tight text-fg">{title}</h1>
      {hint&&<p className="mt-2 max-w-[40em] text-[13px] leading-relaxed text-muted">{hint}</p>}
    </div>
    {actions&&<div className="flex items-center gap-2">{actions}</div>}
  </header>;
}
export function Stat({label,value,detail,tone='neutral',className}:{label:string;value:ReactNode;detail?:ReactNode;tone?:'neutral'|'block'|'pass';className?:string}){
  return <div className={cn('rounded-2xl border bg-raised px-4 py-3.5 shadow-card',tone==='block'?'border-block/35 bg-block-bg':'border-border',className)}>
    <p className="caption">{label}</p>
    <p className={cn('mt-1.5 font-display text-[26px] font-semibold leading-none tabular',tone==='block'?'text-block':tone==='pass'?'text-pass':'text-fg')}>{value}</p>
    {detail&&<p className="mt-1.5 truncate text-xs text-muted">{detail}</p>}
  </div>;
}
export function Section({title,hint,children}:{title:string;hint?:string;children:ReactNode}){
  return <section className="grid gap-x-8 gap-y-3 @min-[720px]:grid-cols-[13rem_minmax(0,1fr)]">
    <div className="@min-[720px]:pt-1"><h2 className="text-[15px] font-semibold text-fg">{title}</h2>{hint&&<p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}</div>
    <div className="min-w-0">{children}</div>
  </section>;
}
export function Chip({children,muted=false}:{children:ReactNode;muted?:boolean}){
  return <span className={cn('inline-flex h-6 max-w-full items-center truncate rounded-md border px-2 font-mono text-[11.5px]',muted?'border-dashed border-border-strong text-muted':'border-border bg-muted-bg text-fg')}>{children}</span>;
}
