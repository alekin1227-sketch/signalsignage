import * as React from 'react'; import { Slot } from '@radix-ui/react-slot'; import { cn } from '../lib/utils';
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('ui-card rounded-xl border bg-card shadow-sm', className)} {...p}/>; }
export function Button({ className, variant='default', asChild=false, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?:'default'|'outline'|'ghost';asChild?:boolean}) {
  const Comp = asChild ? Slot : 'button'; return <Comp className={cn('ui-button inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:opacity-50',`ui-button--${variant}`,variant==='default'&&'bg-primary text-white',variant==='outline'&&'border bg-transparent',variant==='ghost'&&'bg-transparent',className)} {...p}/>;
}
export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...p} className={cn('ui-input h-10 w-full rounded-lg border bg-background px-3 outline-none',p.className)}/>; }
export function Badge({ online, children }: {online?:boolean;children:React.ReactNode}) { return <span className={cn('ui-badge rounded-full px-2.5 py-1 text-xs font-semibold',online?'ui-badge--online':'ui-badge--offline')}>{children}</span>; }
