// [INPUT]: 账号显示名。
// [OUTPUT]: Avatar，按名字稳定取色的首字母头像（靛蓝 / 紫 / 天蓝 / 沙色，不用绿和红，以免与线路判定混淆）。
// [POS]: 账号卡片与概览当前账号的头像。
import {UserRound} from 'lucide-react';
import {cn} from './cn';
const hues=[
  'bg-[#e4e8fb] text-[#2f45a8] dark:bg-[#1e2547] dark:text-[#aab9ff]',
  'bg-[#efe6fb] text-[#6435b5] dark:bg-[#2a1f45] dark:text-[#c9b0ff]',
  'bg-[#e0eef8] text-[#1d5f8a] dark:bg-[#14293a] dark:text-[#93cdf0]',
  'bg-[#f1ece0] text-[#6b5a2e] dark:bg-[#2b261b] dark:text-[#e0cfa0]',
];
export function Avatar({name,size='md',empty=false}:{name:string;size?:'md'|'lg';empty?:boolean}){
  const hue=hues[Array.from(name).reduce((sum,char)=>sum+char.codePointAt(0)!,0)%hues.length];
  const initial=Array.from(name)[0]?.toUpperCase();
  return <span aria-hidden="true" className={cn('grid shrink-0 place-items-center font-display font-semibold',size==='lg'?'size-14 rounded-[18px] text-[22px]':'size-9 rounded-xl text-sm',empty?'border border-dashed border-border-strong text-muted':hue)}>
    {!empty&&initial||<UserRound className={size==='lg'?'size-6':'size-4'}/>}
  </span>;
}
