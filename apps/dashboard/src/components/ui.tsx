import * as React from 'react'; import { Slot } from '@radix-ui/react-slot'; import { cn } from '../lib/utils';
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('rounded-xl border bg-card shadow-sm', className)} {...p}/>; }
export function Button({ className, variant='default', asChild=false, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?:'default'|'outline'|'ghost';asChild?:boolean}) {
  const Comp = asChild ? Slot : 'button'; return <Comp className={cn('inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:opacity-50', variant==='default'&&'bg-primary text-white hover:opacity-90',variant==='outline'&&'border bg-transparent hover:bg-muted',variant==='ghost'&&'hover:bg-muted',className)} {...p}/>;
}
export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...p} className={cn('h-10 w-full rounded-lg border bg-background px-3 outline-none ring-primary focus:ring-2',p.className)}/>; }
export function Badge({ online, children }: {online?:boolean;children:React.ReactNode}) { return <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold',online?'bg-emerald-500/15 text-emerald-500':'bg-slate-500/15 text-slate-500')}>{children}</span>; }
