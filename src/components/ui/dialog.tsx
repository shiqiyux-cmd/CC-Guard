// [INPUT]: Radix Dialog / AlertDialog 受控状态、标题、说明、内容与底部按钮。
// [OUTPUT]: AppDialog；alert 模式默认聚焦 [data-dialog-cancel]、顶部红色警示线，遮罩点击不关闭，关闭后焦点回到原处。
// [POS]: 身份切换、删除、CLI 维护与改名等全部确认窗的唯一外壳。
import {useId,useRef,type ReactNode} from 'react';
import {Dialog as DialogPrimitive,AlertDialog as AlertPrimitive} from 'radix-ui';
import {X} from 'lucide-react';
import {useI18n} from '../../i18n';
import {cn} from './cn';
type Props={open:boolean;onOpenChange:(open:boolean)=>void;title:string;description?:string;children?:ReactNode;footer?:ReactNode;className?:string;alert?:boolean};
export function AppDialog({open,onOpenChange,title,description,children,footer,className,alert=false}:Props){
  const {t}=useI18n();
  const titleId=useId(),descriptionId=useId();
  const Primitive=alert?AlertPrimitive:DialogPrimitive;
  const content=useRef<HTMLDivElement>(null);
  const previousFocus=useRef<HTMLElement|null>(null);
  return <Primitive.Root open={open} onOpenChange={onOpenChange}>
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-40 bg-[rgb(12_12_10/0.42)] backdrop-blur-[2px]"/>
      <Primitive.Content ref={content} tabIndex={-1} aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined}
        className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[20px] border border-border bg-raised text-fg shadow-[0_32px_80px_-24px_rgb(0_0_0/0.45)] outline-none',alert&&'border-t-[3px] border-t-block',className)}
        onOpenAutoFocus={event=>{
          previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
          event.preventDefault();
          const safe=alert?content.current?.querySelector<HTMLElement>('[data-dialog-cancel]'):null;
          (safe||content.current)?.focus();
        }}
        onCloseAutoFocus={event=>{event.preventDefault();previousFocus.current?.focus();}}>
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="space-y-1.5">
            <Primitive.Title id={titleId} className="font-display text-[19px] font-semibold leading-tight tracking-tight">{title}</Primitive.Title>
            {description&&<Primitive.Description id={descriptionId} className="text-[13px] leading-relaxed text-muted">{description}</Primitive.Description>}
          </div>
          {!alert&&<button type="button" aria-label={t('关闭弹窗')} onClick={()=>onOpenChange(false)} className="-mr-1.5 rounded-lg p-1.5 text-muted transition-colors hover:bg-muted-bg hover:text-fg"><X className="size-4" aria-hidden="true"/></button>}
        </div>
        <div className="min-h-0 overflow-y-auto px-6 py-5 text-[13px] leading-relaxed">{children}</div>
        {footer&&<div className="flex justify-end gap-2 border-t border-border bg-surface px-6 py-3.5">{footer}</div>}
      </Primitive.Content>
    </Primitive.Portal>
  </Primitive.Root>;
}
