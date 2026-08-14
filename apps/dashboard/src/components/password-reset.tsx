import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { Button, Card, Input } from './ui';

export function PasswordResetDialog({open,target,onClose,onSubmit}:{open:boolean;target:string;onClose:()=>void;onSubmit:(password:string)=>Promise<void>}){
  const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(open){setPassword('');setConfirmation('');setError('')}},[open,target]);
  if(!open)return null;
  async function submit(event:FormEvent){event.preventDefault();if(password.length<8)return setError('A senha precisa ter pelo menos 8 caracteres.');if(password!==confirmation)return setError('As senhas não são iguais.');setBusy(true);setError('');try{await onSubmit(password);onClose()}catch(event){setError((event as Error).message)}finally{setBusy(false)}}
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4"><Card className="w-full max-w-md bg-card p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary"><KeyRound size={20}/></span><h2 className="text-xl font-bold">Redefinir senha</h2><p className="mt-1 text-sm text-slate-500">Defina uma nova senha para {target}.</p></div><Button type="button" variant="ghost" className="h-9 px-2" onClick={onClose}><X size={18}/></Button></div><form className="space-y-3" onSubmit={submit}><Input autoFocus type="password" value={password} onChange={event=>setPassword(event.target.value)} minLength={8} placeholder="Nova senha (mín. 8 caracteres)" required/><Input type="password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} minLength={8} placeholder="Confirme a nova senha" required/>{error&&<p className="text-sm text-red-500">{error}</p>}<div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={busy}><KeyRound size={16}/>{busy?'Salvando...':'Redefinir senha'}</Button></div></form></Card></div>;
}
