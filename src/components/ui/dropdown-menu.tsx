// [INPUT]: Radix DropdownMenu 与菜单项。
// [OUTPUT]: Menu，「⋯」更多操作菜单。
// [POS]: 账号卡片的改名 / 删除入口。
import type {ReactNode} from 'react';
import {DropdownMenu as Primitive} from 'radix-ui';
import {cn} from './cn';
export type MenuItem={label:string;onSelect:()=>void;danger?:boolean;disabled?:boolean};
export function Menu({trigger,items}:{trigger:ReactNode;items:MenuItem[]}){
  return <Primitive.Root modal={false}><Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
    <Primitive.Portal><Primitive.Content align="end" sideOffset={6} className="z-50 min-w-36 rounded-xl border border-border bg-raised p-1 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.25)]">
      {items.map(item=><Primitive.Item key={item.label} disabled={item.disabled} onSelect={item.onSelect}
        className={cn('cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] outline-none data-[highlighted]:bg-muted-bg data-[disabled]:opacity-45',item.danger?'text-block':'text-fg')}>{item.label}</Primitive.Item>)}
    </Primitive.Content></Primitive.Portal>
  </Primitive.Root>;
}
