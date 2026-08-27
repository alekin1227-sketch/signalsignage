import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, Monitor, Power, Trash2, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import { PasswordResetDialog } from '../components/password-reset';
import { Button, Card, Input } from '../components/ui';

type PlayerDevice={id:string;name:string;status:string;lastSeenAt?:string};
type PlayerAccess={id:string;label:string;username:string;enabled:boolean;deviceLimit:number;lastUsedAt?:string;devices:PlayerDevice[]};

export function PlayerAccessPage(){
  const [items,setItems]=useState<PlayerAccess[]>([]),[resetAccess,setResetAccess]=useState<PlayerAccess|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const load=()=>api<PlayerAccess[]>('/player-access').then(setItems).catch(event=>setError(event.message));
  useEffect(()=>{load()},[]);
  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setBusy(true);setError('');setMessage('');
    try{await api('/player-access',{method:'POST',body:JSON.stringify({label:data.get('label'),username:data.get('username'),password:data.get('password'),deviceLimit:Number(data.get('deviceLimit')||1)})});form.reset();setMessage('Acesso criado. Use esse usuário e senha na tela do Mini PC.');await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function toggle(item:PlayerAccess){try{await api(`/player-access/${item.id}`,{method:'PATCH',body:JSON.stringify({enabled:!item.enabled})});await load()}catch(e){setError((e as Error).message)}}
  async function changeLimit(item:PlayerAccess,value:number){if(!Number.isInteger(value)||value<1||value>100)return load();try{await api(`/player-access/${item.id}`,{method:'PATCH',body:JSON.stringify({deviceLimit:value})});await load()}catch(e){setError((e as Error).message)}}
  async function resetPassword(password:string){if(!resetAccess)return;await api(`/player-access/${resetAccess.id}`,{method:'PATCH',body:JSON.stringify({password})});setMessage(`Senha do acesso ${resetAccess.label} redefinida com sucesso.`)}
  async function remove(item:PlayerAccess){if(!confirm(`Excluir o acesso “${item.label}”? As TVs já ativadas continuarão cadastradas.`))return;try{await api(`/player-access/${item.id}`,{method:'DELETE'});await load()}catch(e){setError((e as Error).message)}}
  return <>
    <div className="page-heading"><div><span className="eyebrow">Segurança dos dispositivos</span><h1>Acessos do Player</h1><p>Crie credenciais exclusivas para ativar Mini PCs e TVs com controle de limite.</p></div><div className="live-indicator"><i/><span>{items.filter(item=>item.enabled).length} acessos ativos</span></div></div>
    {error&&<div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}
    {message&&<div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">{message}</div>}
    <Card className="mb-6 p-5"><div className="mb-4 flex items-center gap-2"><UserPlus className="text-primary"/><h2 className="font-semibold">Novo acesso para TV</h2></div><form onSubmit={create} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><Input name="label" placeholder="Identificação: Recepção" required/><Input name="username" minLength={3} placeholder="Usuário: tv-recepcao" required/><Input name="password" type="password" minLength={8} placeholder="Senha (mín. 8 caracteres)" required/><Input name="deviceLimit" type="number" min={1} max={100} defaultValue={1} title="Quantidade de TVs permitidas"/><Button disabled={busy}><KeyRound size={17}/>{busy?'Criando...':'Criar acesso'}</Button></form><p className="mt-3 text-xs text-slate-500">O limite define quantas TVs diferentes podem usar esse mesmo acesso.</p></Card>
    <div className="space-y-3">{items.map(item=><Card key={item.id} className="flex flex-wrap items-center gap-4 p-4"><span className={`grid h-11 w-11 place-items-center rounded-full ${item.enabled?'bg-emerald-500/15 text-emerald-500':'bg-slate-500/15 text-slate-500'}`}><KeyRound/></span><div className="min-w-48 flex-1"><p className="font-semibold">{item.label}</p><p className="text-sm text-slate-500">Usuário: {item.username}</p></div><div className="min-w-40 text-sm"><p className="flex items-center gap-2"><Monitor size={15}/>{item.devices.length} de {item.deviceLimit} TV(s)</p><p className="text-xs text-slate-500">{item.devices.map(device=>device.name).join(', ')||'Nenhuma TV ativada'}</p></div><label className="flex items-center gap-2 text-sm">Limite <Input className="w-20" type="number" min={1} max={100} defaultValue={item.deviceLimit} onBlur={event=>changeLimit(item,Number(event.target.value))}/></label><Button variant="outline" onClick={()=>setResetAccess(item)}><KeyRound size={16}/>Redefinir senha</Button><Button variant="outline" onClick={()=>toggle(item)}><Power size={16}/>{item.enabled?'Desativar':'Ativar'}</Button><Button variant="ghost" title="Excluir acesso" onClick={()=>remove(item)}><Trash2 size={17}/></Button></Card>)}</div>
    {!items.length&&<Card className="p-10 text-center text-slate-500">Nenhum acesso criado. Crie um acima para ativar o primeiro Mini PC.</Card>}
    <PasswordResetDialog open={!!resetAccess} target={resetAccess?.label??''} onClose={()=>setResetAccess(null)} onSubmit={resetPassword}/>
  </>;
}
