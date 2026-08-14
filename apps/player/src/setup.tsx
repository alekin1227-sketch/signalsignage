import { FormEvent, useState } from 'react';
import { API_URL } from './api';
import { compatibleUuid } from './id';

function hardwareId(){let id=localStorage.getItem('hardwareId');if(!id){id=compatibleUuid();localStorage.setItem('hardwareId',id)}return id}

export function Setup({done}:{done:()=>void}){
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[useKey,setUseKey]=useState(false);
  const suggestedName=new URLSearchParams(location.search).get('location')?.trim()??'';
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setError('');
    try{
      const headers:Record<string,string>={'Content-Type':'application/json'};
      if(useKey)headers['X-Enrollment-Key']=String(form.get('key')??'');
      const response=await fetch(`${API_URL}/player/register`,{method:'POST',headers,body:JSON.stringify({
        hardwareId:hardwareId(),name:form.get('name'),resolution:`${screen.width}x${screen.height}`,appVersion:'1.1.0',
        ...(!useKey?{accessUsername:form.get('username'),accessPassword:form.get('password')}:{}),
      })});
      if(!response.ok)throw new Error((await response.json().catch(()=>null))?.message??`Erro ${response.status}`);
      const data=await response.json();localStorage.setItem('deviceToken',data.deviceToken);localStorage.setItem('deviceId',data.deviceId);done();
    }catch(event){setError(String((event as Error).message))}finally{setBusy(false)}
  }
  return <main className="setup"><form className="panel" onSubmit={submit}><h1>Ativar esta TV</h1><p>Use o acesso do Player criado pelo administrador no Dashboard.</p><input name="name" required defaultValue={suggestedName} placeholder="Nome/local da TV: Recepção"/>{useKey?<input name="key" required type="password" placeholder="Chave de provisionamento"/>:<><input name="username" required minLength={3} autoComplete="username" placeholder="Usuário do Player"/><input name="password" required minLength={8} type="password" autoComplete="current-password" placeholder="Senha do Player"/></>}{error&&<p className="setup-error">{error}</p>}<button disabled={busy}>{busy?'Ativando...':'Ativar dispositivo'}</button><label className="setup-mode"><input type="checkbox" checked={useKey} onChange={event=>setUseKey(event.target.checked)}/>Usar chave de provisionamento (modo legado)</label></form></main>;
}
