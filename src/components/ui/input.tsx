// [INPUT]: 原生 input / textarea 属性。
// [OUTPUT]: Input、Textarea 与共用的 field 样式：统一描边、信号蓝焦点环与禁用样式。
// [POS]: 表单输入；secret 输入框由调用方保证只写不回显。
import type {InputHTMLAttributes,TextareaHTMLAttributes} from 'react';
import {cn} from './cn';
export const field='w-full rounded-[10px] border border-border-strong/80 bg-raised px-3 text-[13px] text-fg shadow-[0_1px_1px_rgb(0_0_0/0.03)_inset] transition-[border-color,box-shadow] placeholder:text-muted/80 focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_22%,transparent)] focus-visible:outline-none disabled:opacity-50';
export function Input({className,...props}:InputHTMLAttributes<HTMLInputElement>){
  return <input {...props} className={cn(field,'h-9',className)}/>;
}
export function Textarea({className,...props}:TextareaHTMLAttributes<HTMLTextAreaElement>){
  return <textarea {...props} className={cn(field,'min-h-[84px] resize-y py-2 font-mono text-xs leading-5',className)}/>;
}
