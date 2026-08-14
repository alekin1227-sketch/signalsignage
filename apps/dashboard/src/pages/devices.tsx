import { useEffect, useMemo, useState } from 'react';
import { Monitor, Pause, Play, RefreshCw, RotateCcw, RotateCw, SkipBack, SkipForward, Trash2, Wifi, WifiOff } from 'lucide-react';
import { io } from 'socket.io-client';
import { api, SOCKET_URL } from '../lib/api';
import { Badge, Button, Card } from '../components/ui';

type Device={id:string;name:string;status:string;resolution?:string;lastSeenAt?:string;lastQueuePullAt?:string;nowPlayingName?:string;ipAddress?:string;playerAccess?:{label:string;username:string};forcedPlaylist?:{id:string;name:string}};
type Playlist={id:string;name:string};
type Action='PLAY'|'PAUSE'|'SEEK_FORWARD'|'SEEK_BACKWARD'|'NEXT'|'PREVIOUS';
const online=(device:Device)=>device.status==='ACTIVE'&&!!device.lastSeenAt&&Date.now()-new Date(device.lastSeenAt).getTime()<90000;

export function Devices(){
  const [devices,setDevices]=useState<Device[]>([]),[playlists,setPlaylists]=useState<Playlist[]>([]),[choice,setChoice]=useState<Record<string,string>>({}),[message,setMessage]=useState<Record<string,string>>({});
  const load=()=>Promise.all([api<Device[]>('/devices'),api<Playlist[]>('/playlists')]).then(([deviceList,playlistList])=>{setDevices(deviceList);setPlaylists(playlistList)});
  const control=(deviceId:string,action:Action,seconds?:number)=>api(`/devices/${deviceId}/control`,{method:'POST',body:JSON.stringify({action,seconds})});
  const playNow=async(device:Device)=>{try{setMessage(value=>({...value,[device.id]:'Enviando…'}));const result=await api<{realtimeRecipients:number;playlist:{name:string}}>(`/devices/${device.id}/emergency/${choice[device.id]}`,{method:'POST'});setMessage(value=>({...value,[device.id]:result.realtimeRecipients?`Tocando “${result.playlist.name}” agora.`:`Comando salvo. A TV receberá pelo polling em até 15 segundos.`}));await load()}catch(error){setMessage(value=>({...value,[device.id]:(error as Error).message}))}};
  const clearPlayNow=async(device:Device)=>{try{await api(`/devices/${device.id}/emergency/clear`,{method:'POST'});setMessage(value=>({...value,[device.id]:'Programação normal restaurada.'}));await load()}catch(error){setMessage(value=>({...value,[device.id]:(error as Error).message}))}};
  useEffect(()=>{load();const timer=setInterval(load,30000);const socket=io(`${SOCKET_URL}/signage`,{auth:{accessToken:localStorage.getItem('accessToken')}});socket.on('device-status',(event:any)=>setDevices(current=>current.map(device=>device.id===event.id?{...device,lastSeenAt:event.lastSeenAt}:device)));socket.on('now-playing',(event:any)=>setDevices(current=>current.map(device=>device.id===event.deviceId?{...device,nowPlayingName:event.name,lastSeenAt:event.at}:device)));return()=>{clearInterval(timer);socket.disconnect()}},[]);
  const count=useMemo(()=>devices.filter(online).length,[devices]);
  return <>
    <div className="mb-7 flex items-end justify-between"><div><h1 className="text-3xl font-bold">Dispositivos</h1><p className="text-slate-500">{count} de {devices.length} TVs online</p></div><Button variant="outline" onClick={load}><RefreshCw size={16}/>Atualizar</Button></div>
    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{devices.map(device=><Card key={device.id} className="overflow-hidden">
      <div className="aspect-video bg-slate-950 p-5 text-white"><div className="flex justify-between"><Monitor/><Badge online={online(device)}>{online(device)?'Online':'Offline'}</Badge></div><div className="mt-12"><p className="text-xs text-slate-400">EM EXIBIÇÃO</p><p className="mt-1 truncate font-semibold">{device.nowPlayingName||'Nenhuma mídia informada'}</p></div></div>
      <div className="p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold">{device.name}</h2><p className="text-sm text-slate-500">{device.resolution||'Resolução desconhecida'} · {device.ipAddress||'sem IP'}</p></div>{online(device)?<Wifi className="text-emerald-500"/>:<WifiOff className="text-slate-400"/>}</div>
        <p className="mt-4 text-xs text-slate-500">Último contato: {device.lastSeenAt?new Date(device.lastSeenAt).toLocaleString('pt-BR'):'nunca'}</p><p className="mt-1 text-xs text-slate-500">Acesso do Player: {device.playerAccess?`${device.playerAccess.label} (${device.playerAccess.username})`:'chave de provisionamento/legado'}</p>
        <div className="mt-4"><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Controle remoto</p><div className="grid grid-cols-6 gap-1">{[
          ['PREVIOUS',SkipBack,'Anterior'],['SEEK_BACKWARD',RotateCcw,'Voltar 10s'],['PLAY',Play,'Reproduzir'],['PAUSE',Pause,'Pausar'],['SEEK_FORWARD',RotateCw,'Avançar 10s'],['NEXT',SkipForward,'Próximo'],
        ].map(([action,Icon,label])=><Button key={String(action)} type="button" variant="outline" className="h-9 px-0" title={String(label)} disabled={!online(device)} onClick={()=>control(device.id,action as Action,10)}><Icon size={15}/></Button>)}</div></div>
        <div className="mt-4 flex gap-2"><select className="min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm" value={choice[device.id]||''} onChange={event=>setChoice(value=>({...value,[device.id]:event.target.value}))}><option value="">Escolha uma playlist</option>{playlists.map(playlist=><option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select><Button disabled={!choice[device.id]} onClick={()=>playNow(device)}>Tocar agora</Button></div>
        {device.forcedPlaylist&&<div className="mt-2 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><span>Forçado: {device.forcedPlaylist.name}</span><Button className="h-7" variant="ghost" onClick={()=>clearPlayNow(device)}>Voltar à programação</Button></div>}
        {message[device.id]&&<p className="mt-2 text-xs text-slate-500">{message[device.id]}</p>}
        <div className="mt-2 flex gap-2"><Button className="flex-1" variant="outline" onClick={()=>api(`/devices/${device.id}/refresh`,{method:'POST'})}><RefreshCw size={15}/>Sincronizar</Button><Button variant="ghost" title="Excluir dispositivo" onClick={async()=>{if(confirm(`Excluir o dispositivo “${device.name}”?`)){await api(`/devices/${device.id}`,{method:'DELETE'});load()}}}><Trash2 size={16}/></Button></div>
      </div>
    </Card>)}</section>
    {!devices.length&&<Card className="p-12 text-center text-slate-500">Nenhum player cadastrado. Abra a URL do player em um Mini PC para provisioná-lo.</Card>}
  </>;
}
