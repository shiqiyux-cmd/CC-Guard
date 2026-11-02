// [INPUT]: Radix Toast 与调用方给出的标题、原因和色调。
// [OUTPUT]: ToastProvider、useToast()；右下角堆叠的信号灯卡片，block 红、info 信号蓝，无绿色；保存文案键，渲染时按当前语言翻译。
// [POS]: 启动失败、设置保存等一次性结果的提示通道；不持久化、不写日志。
import {createContext,useCallback,useContext,useState,type ReactNode} from 'react';
import {Toast as Primitive} from 'radix-ui';
import {X} from 'lucide-react';
import {cn} from './cn';
import {useI18n} from '../../i18n';
type Values=Record<string,string|number>;
type Item={id:number;title:string;values?:Values;description?:string;tone:'block'|'info'};
type Show=(item:Omit<Item,'id'>)=>void;
const Context=createContext<Show>(()=>{});
let sequence=0;
export function ToastProvider({children}:{children:ReactNode}){
  const {t}=useI18n();
  const [items,setItems]=useState<Item[]>([]);
  const show=useCallback<Show>(item=>setItems(old=>[...old.slice(-3),{...item,id:++sequence}]),[]);
  return <Context.Provider value={show}><Primitive.Provider duration={8000}>
    {children}
    {items.map(item=><Primitive.Root key={item.id} role={item.tone==='block'?'alert':'status'} data-tone={item.tone}
      onOpenChange={open=>{if(!open)setItems(old=>old.filter(row=>row.id!==item.id));}}
      className="flex items-start gap-3 rounded-2xl border border-border bg-raised p-3.5 pr-2.5 shadow-[0_20px_44px_-16px_rgb(0_0_0/0.35)]">
      <span aria-hidden="true" className={cn('mt-1 size-2.5 shrink-0 rounded-full ring-4',item.tone==='block'?'bg-block ring-block-bg':'bg-accent ring-accent-bg')}/>
      <div className="min-w-0 flex-1">
        <Primitive.Title className={cn('text-[13px] font-semibold',item.tone==='block'?'text-block':'text-fg')}>{t(item.title,item.values)}</Primitive.Title>
        {item.description&&<Primitive.Description className="mt-1 text-xs leading-relaxed text-fg-2">{t(item.description)}</Primitive.Description>}
      </div>
      <Primitive.Close aria-label={t('关闭弹窗')} className="rounded-md p-1 text-muted hover:bg-muted-bg hover:text-fg"><X className="size-3.5" aria-hidden="true"/></Primitive.Close>
    </Primitive.Root>)}
    <Primitive.Viewport className="fixed bottom-4 right-4 z-[60] flex w-84 max-w-[calc(100vw-32px)] flex-col gap-2 outline-none"/>
  </Primitive.Provider></Context.Provider>;
}
export const useToast=()=>useContext(Context);
