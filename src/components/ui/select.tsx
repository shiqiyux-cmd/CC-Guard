// [INPUT]: Radix Select 受控值与选项列表。
// [OUTPUT]: Select，下拉选择（节点、语言、主题），选中项带信号蓝对勾。
// [POS]: 有限选项的表单控件；选项值不能为空串（Radix 约束）。
import {Select as Primitive} from 'radix-ui';
import {Check,ChevronsUpDown} from 'lucide-react';
import {cn} from './cn';
import {field} from './input';
export type Option={value:string;label:string};
type Props={value:string;onValueChange:(value:string)=>void;options:Option[];placeholder?:string;disabled?:boolean;className?:string;id?:string;'aria-label'?:string};
export function Select({value,onValueChange,options,placeholder,disabled,className,...aria}:Props){
  return <Primitive.Root value={value||undefined} onValueChange={onValueChange} disabled={disabled}>
    <Primitive.Trigger {...aria} className={cn(field,'inline-flex h-9 items-center justify-between gap-2 text-left data-[placeholder]:text-muted',className)}>
      <span className="min-w-0 truncate"><Primitive.Value placeholder={placeholder}/></span>
      <Primitive.Icon><ChevronsUpDown className="size-3.5 text-muted" aria-hidden="true"/></Primitive.Icon>
    </Primitive.Trigger>
    <Primitive.Portal><Primitive.Content position="popper" sideOffset={6} className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-raised shadow-[0_16px_40px_-12px_rgb(0_0_0/0.25)]">
      <Primitive.Viewport className="p-1">{options.map(option=>
        <Primitive.Item key={option.value} value={option.value} className="flex cursor-pointer items-center gap-2 rounded-lg py-1.5 pl-2 pr-3 text-[13px] text-fg outline-none data-[highlighted]:bg-muted-bg data-[state=checked]:font-semibold">
          <span className="grid size-4 place-items-center"><Primitive.ItemIndicator><Check className="size-3.5 text-accent" aria-hidden="true"/></Primitive.ItemIndicator></span>
          <Primitive.ItemText>{option.label}</Primitive.ItemText>
        </Primitive.Item>)}</Primitive.Viewport>
    </Primitive.Content></Primitive.Portal>
  </Primitive.Root>;
}
