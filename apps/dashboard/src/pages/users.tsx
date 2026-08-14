import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, Shield, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { api } from '../lib/api';
import { PasswordResetDialog } from '../components/password-reset';
import { Button, Card, Input } from '../components/ui';

type Role='ADMIN'|'EDITOR'|'VIEWER';
type User={id:string;name:string;email:string;role:Role;createdAt:string};
const roleLabel:Record<Role,string>={ADMIN:'Administrador',EDITOR:'Editor',VIEWER:'Somente leitura'};

export function UsersPage(){
  const [users,setUsers]=useState<User[]>([]),[resetUser,setResetUser]=useState<User|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const load=()=>api<User[]>('/users').then(setUsers).catch(event=>setError(event.message));
  useEffect(()=>{load()},[]);
  async function create(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setBusy(true);setError('');setMessage('');try{await api('/users',{method:'POST',body:JSON.stringify({name:data.get('name'),email:data.get('email'),password:data.get('password'),role:data.get('role')})});form.reset();setMessage('Usuário criado. Ele já pode acessar o Dashboard.');await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function changeRole(user:User,role:Role){try{const updated=await api<User>(`/users/${user.id}`,{method:'PATCH',body:JSON.stringify({role})});setUsers(current=>current.map(item=>item.id===user.id?updated:item))}catch(e){setError((e as Error).message)}}
  async function resetPassword(password:string){if(!resetUser)return;await api(`/users/${resetUser.id}`,{method:'PATCH',body:JSON.stringify({password})});setMessage(`Senha de ${resetUser.name} redefinida com sucesso.`)}
  async function remove(user:User){if(!confirm(`Excluir o acesso de ${user.name}?`))return;try{await api(`/users/${user.id}`,{method:'DELETE'});await load()}catch(e){setError((e as Error).message)}}
  return <>
    <div className="mb-7"><h1 className="text-3xl font-bold">Usuários do Painel</h1><p className="text-slate-500">Crie e controle quem pode acessar o Dashboard.</p></div>
    {error&&<div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}
    {message&&<div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">{message}</div>}
    <Card className="mb-6 p-5"><div className="mb-4 flex items-center gap-2"><UserPlus className="text-primary"/><h2 className="font-semibold">Novo usuário</h2></div><form onSubmit={create} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><Input name="name" placeholder="Nome completo" required/><Input name="email" type="email" placeholder="E-mail" required/><Input name="password" type="password" minLength={8} placeholder="Senha (mín. 8 caracteres)" required/><select name="role" className="h-10 rounded-lg border bg-background px-3" defaultValue="EDITOR"><option value="ADMIN">Administrador</option><option value="EDITOR">Editor</option><option value="VIEWER">Somente leitura</option></select><Button disabled={busy}><UserPlus size={17}/>{busy?'Criando...':'Criar acesso'}</Button></form></Card>
    <div className="space-y-3">{users.map(user=><Card key={user.id} className="flex flex-wrap items-center gap-4 p-4"><span className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary"><UsersRound/></span><div className="min-w-48 flex-1"><p className="font-semibold">{user.name}</p><p className="text-sm text-slate-500">{user.email}</p></div><span className="flex items-center gap-2 text-sm text-slate-500"><Shield size={15}/>{roleLabel[user.role]}</span><select className="h-9 rounded-lg border bg-background px-2 text-sm" value={user.role} onChange={event=>changeRole(user,event.target.value as Role)}><option value="ADMIN">Administrador</option><option value="EDITOR">Editor</option><option value="VIEWER">Somente leitura</option></select><Button variant="outline" onClick={()=>setResetUser(user)}><KeyRound size={16}/>Redefinir senha</Button><Button variant="ghost" title="Excluir usuário" onClick={()=>remove(user)}><Trash2 size={17}/></Button></Card>)}</div>
    <PasswordResetDialog open={!!resetUser} target={resetUser?.name??''} onClose={()=>setResetUser(null)} onSubmit={resetPassword}/>
  </>;
}
