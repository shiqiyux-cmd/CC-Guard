// [INPUT]: 色调与文字。
// [OUTPUT]: Badge（可带信号灯圆点）；pass 是唯一绿色色调，block 红、unknown 灰、info 信号蓝、neutral 纸灰。
// [POS]: 状态与标签的小徽标。
import type {HTMLAttributes} from 'react';
import {cn} from './cn';
export type Tone='pass'|'block'|'unknown'|'info'|'neutral';
const tones:Record<Tone,string>={
  pass:'bg-pass-bg text-pass border-pass/25',
  block:'bg-block-bg text-block border-block/25',
  unknown:'bg-unknown-bg text-unknown border-unknown/25',
  info:'bg-accent-bg text-accent border-accent/25',
  neutral:'bg-muted-bg text-fg-2 border-border',
};
export function Badge({tone='neutral',dot=false,className,children,...props}:HTMLAttributes<HTMLSpanElement>&{tone?:Tone;dot?:boolean}){
  return <span {...props} data-tone={tone} className={cn('inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[11.5px] font-medium',tones[tone],className)}>
    {dot&&<span aria-hidden="true" className="size-1.5 rounded-full bg-current"/>}{children}
  </span>;
}
