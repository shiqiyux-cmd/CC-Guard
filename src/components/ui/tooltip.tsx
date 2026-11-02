// [INPUT]: Radix Tooltip 与提示文字。
// [OUTPUT]: TooltipProvider、Tooltip，悬停或聚焦时显示简短说明（墨色气泡）。
// [POS]: 图标按钮与状态条的补充说明。
import type {ReactNode} from 'react';
import {Tooltip as Primitive} from 'radix-ui';
export const TooltipProvider=Primitive.Provider;
export function Tooltip({content,children}:{content:ReactNode;children:ReactNode}){
  return <Primitive.Root><Primitive.Trigger asChild>{children}</Primitive.Trigger>
    <Primitive.Portal><Primitive.Content sideOffset={6} className="z-50 max-w-xs rounded-lg bg-primary px-2.5 py-1.5 text-xs text-primary-fg shadow-lg">{content}</Primitive.Content></Primitive.Portal>
  </Primitive.Root>;
}
