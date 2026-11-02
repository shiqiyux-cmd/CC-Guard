// [INPUT]: 原生 button 属性、视觉变体与加载状态。
// [OUTPUT]: Button，主按钮（墨色）/ 次按钮 / 幽灵 / 危险四种变体，sm / md / lg / icon 四种尺寸。
// [POS]: 全部页面的按钮；绿色不出现在按钮上，绿色只属于 pass。
import type {ButtonHTMLAttributes} from 'react';
import {cn} from './cn';
type Variant='primary'|'secondary'|'ghost'|'danger';
type Size='sm'|'md'|'lg'|'icon';
const variants:Record<Variant,string>={
  primary:'bg-primary text-primary-fg shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_1px_2px_rgb(0_0_0/0.18)] hover:opacity-90',
  secondary:'border border-border-strong/80 bg-raised text-fg shadow-card hover:bg-muted-bg',
  ghost:'text-fg-2 hover:bg-muted-bg hover:text-fg',
  danger:'bg-block text-white shadow-[0_1px_2px_rgb(0_0_0/0.18)] hover:opacity-90 dark:text-[#1a0b0b]',
};
const sizes:Record<Size,string>={sm:'h-8 px-3 text-xs gap-1.5 rounded-[9px]',md:'h-9 px-4 text-[13px] gap-2 rounded-[10px]',lg:'h-10 px-5 text-sm gap-2 rounded-[11px]',icon:'size-8 justify-center rounded-[9px]'};
export function Button({variant='secondary',size='md',loading=false,className,disabled,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:Variant;size?:Size;loading?:boolean}){
  return <button type="button" {...props} disabled={disabled||loading} data-loading={loading||undefined}
    className={cn('inline-flex shrink-0 select-none items-center font-medium transition-[background-color,opacity,box-shadow] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45',variants[variant],sizes[size],className)}>
    {loading&&<span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"/>}
    {children}
  </button>;
}
