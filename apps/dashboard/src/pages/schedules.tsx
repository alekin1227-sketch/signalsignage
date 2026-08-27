import { FormEvent, useEffect, useState } from 'react';
import { CalendarClock, Clock3, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Card, Input } from '../components/ui';

type Device={id:string;name:string};
type Playlist={id:string;name:string};
type Schedule={id:string;name:string;device:Device;playlist:Playlist;startTime:string;endTime:string;daysOfWeek:number[];enabled:boolean;priority:number};
const dayNames=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

export function Schedules(){
  const [devices,setDevices]=useState<Device[]>([]),[playlists,setPlaylists]=useState<Playlist[]>([]),[items,setItems]=useState<Schedule[]>([]);
  const load=()=>Promise.all([api<Device[]>('/devices'),api<Playlist[]>('/playlists'),api<Schedule[]>('/schedules')]).then(([d,p,s])=>{setDevices(d);setPlaylists(p);setItems(s)});
  useEffect(()=>{load()},[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget;const data=new FormData(form);
    await api('/schedules',{method:'POST',body:JSON.stringify({name:data.get('name'),deviceId:data.get('deviceId'),playlistId:data.get('playlistId'),daysOfWeek:data.getAll('days').map(Number),startTime:data.get('startTime'),endTime:data.get('endTime'),priority:Number(data.get('priority')||0),enabled:true})});
    form.reset();await load();
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">Automação de exibição</span><h1>Programação</h1><p>Defina o conteúdo de cada TV por dia, horário e prioridade operacional.</p></div><div className="live-indicator"><i/><span>{items.length} regras configuradas</span></div></div>
    <Card className="form-panel form-panel-accent mb-6 overflow-hidden">
      <div className="section-heading"><div><span className="eyebrow">Nova automação</span><h2>Criar regra de exibição</h2><p>Associe uma playlist a uma tela e escolha a janela de funcionamento.</p></div><CalendarClock size={20}/></div>
      <form onSubmit={submit} className="grid gap-3 p-5 lg:grid-cols-6">
        <Input name="name" placeholder="Nome da regra" required/>
        <select name="deviceId" className="px-3" required><option value="">Selecionar TV</option>{devices.map(device=><option key={device.id} value={device.id}>{device.name}</option>)}</select>
        <select name="playlistId" className="px-3" required><option value="">Selecionar playlist</option>{playlists.map(playlist=><option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select>
        <Input name="startTime" type="time" defaultValue="08:00" required/>
        <Input name="endTime" type="time" defaultValue="18:00" required/>
        <Input name="priority" type="number" defaultValue="0" title="Prioridade"/>
        <div className="flex flex-wrap gap-3 lg:col-span-5">{dayNames.map((day,index)=><label key={day} className="flex items-center gap-1.5 rounded-lg border bg-card/60 px-3 py-2 text-xs"><input name="days" type="checkbox" value={index} defaultChecked={index>0&&index<6}/>{day}</label>)}</div>
        <Button><CalendarClock size={17}/>Agendar</Button>
      </form>
    </Card>
    <div className="record-list">{items.map(schedule=><Card key={schedule.id} className="record-row flex flex-wrap items-center gap-4 p-4">
      <span className="record-icon"><Clock3/></span><div className="min-w-40 flex-1"><p className="font-semibold">{schedule.name}</p><p className="text-sm text-slate-500">{schedule.device.name} → {schedule.playlist.name}</p></div><p className="text-sm">{schedule.daysOfWeek.map(index=>dayNames[index]).join(', ')} · {schedule.startTime}–{schedule.endTime}</p><span className="status-chip">Prioridade {schedule.priority}</span><Button variant="ghost" title="Excluir regra" onClick={async()=>{await api(`/schedules/${schedule.id}`,{method:'DELETE'});load()}}><Trash2 size={17}/></Button>
    </Card>)}</div>
    {!items.length&&<Card className="empty-state"><CalendarClock/><strong>Nenhuma programação criada</strong><p>Crie a primeira regra acima para automatizar a exibição das TVs.</p></Card>}
  </>;
}
