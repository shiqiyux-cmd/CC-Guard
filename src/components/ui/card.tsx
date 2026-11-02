// [INPUT]: 任意内容。
// [OUTPUT]: Card，纸面上的白色卡片（细线描边 + 轻阴影）；CardTitle，卡片内的标题行（标题、说明、右侧操作）。
// [POS]: 账号、连接、网页版、设置分组的容器。
import type {HTMLAttributes,ReactNode} from 'react';
import {cn} from './cn';
export function Card({className,...props}:HTMLAttributes<HTMLDivElement>){
  return <div {...props} className={cn('rounded-2xl border border-border bg-raised p-5 shadow-card',className)}/>;
}
export function CardTitle({title,hint,action,className}:{title:ReactNode;hint?:ReactNode;action?:ReactNode;className?:string}){
  return <div className={cn('flex items-start gap-3',className)}>
    <div className="min-w-0 flex-1"><h2 className="text-[15px] font-semibold text-fg">{title}</h2>{hint&&<p className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</p>}</div>
    {action}
  </div>;
}
