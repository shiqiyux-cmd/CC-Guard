// [INPUT]: Radix Switch 受控状态、标签与可选说明。
// [OUTPUT]: Switch，带可点击文字标签与说明的开关（开启为信号蓝）。
// [POS]: 布尔选项（如联动浏览器）。
import {useId} from 'react';
import {Switch as Primitive} from 'radix-ui';
export function Switch({label,hint,checked,onCheckedChange,disabled}:{label:string;hint?:string;checked:boolean;onCheckedChange:(value:boolean)=>void;disabled?:boolean}){
  const id=useId();
  return <span className="flex items-start gap-3 text-[13px]">
    <Primitive.Root id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled}
      className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-border-strong transition-colors data-[state=checked]:bg-accent disabled:opacity-50">
      <Primitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform data-[state=checked]:translate-x-[18px]"/>
    </Primitive.Root>
    <span className="min-w-0"><label htmlFor={id} className="cursor-pointer select-none font-medium text-fg">{label}</label>{hint&&<span className="mt-0.5 block text-xs leading-relaxed text-muted">{hint}</span>}</span>
  </span>;
}
