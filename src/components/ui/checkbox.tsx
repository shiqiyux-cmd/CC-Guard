// [INPUT]: Radix Checkbox 受控状态与标签。
// [OUTPUT]: Checkbox，身份保留策略与删除确认的勾选框（选中为信号蓝）。
// [POS]: 需要逐项勾选的确认场景。
import {useId} from 'react';
import {Checkbox as Primitive} from 'radix-ui';
export function Checkbox({label,checked,onCheckedChange,disabled}:{label:string;checked:boolean;onCheckedChange:(value:boolean)=>void;disabled?:boolean}){
  const id=useId();
  return <span className="inline-flex items-center gap-2 text-[13px]">
    <Primitive.Root id={id} checked={checked} onCheckedChange={value=>onCheckedChange(value===true)} disabled={disabled}
      className="grid size-[17px] shrink-0 place-items-center rounded-[5px] border border-border-strong bg-raised transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-50">
      <Primitive.Indicator><svg viewBox="0 0 12 12" className="size-3 text-white dark:text-[#0b0d18]" aria-hidden="true"><path d="M2.5 6.5l2.2 2.2L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg></Primitive.Indicator>
    </Primitive.Root>
    <label htmlFor={id} className="cursor-pointer select-none text-fg-2">{label}</label>
  </span>;
}
