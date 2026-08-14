import { useEffect, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, FileText, GripVertical, Image, LayoutDashboard, ListVideo, Newspaper, Plus, Save, Trash2, Video } from 'lucide-react';
import { api } from '../lib/api';
import { compatibleUuid } from '../lib/id';
import { Button, Card, Input } from '../components/ui';

type Media={id:string;name:string;type:'IMAGE'|'VIDEO'|'PDF'|'URL'|'FEED'|'WIDGET';thumbnailUrl?:string;durationSec?:number};
type Item={id:string;mediaId:string;durationSec:number;useMediaDuration?:boolean;media:Media};
type Playlist={id:string;name:string;description?:string;items:Item[];loop:boolean;updatedAt?:string};

function SortableItem({item,onRemove,onDuration,onAutomatic}:{item:Item;onRemove:()=>void;onDuration:(n:number)=>void;onAutomatic:()=>void}){
  const {attributes,listeners,setNodeRef,transform,transition}=useSortable({id:item.id});
  const automatic=item.media.type==='VIDEO'&&item.useMediaDuration===true;
  return <div ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition}} className="flex items-center gap-3 rounded-lg border bg-card p-3">
    <button {...attributes} {...listeners} className="cursor-grab text-slate-400" aria-label="Arrastar"><GripVertical/></button>
    <span className="grid h-10 w-10 place-items-center rounded bg-muted">{item.media.type==='VIDEO'?<Video size={18}/>:item.media.type==='PDF'?<FileText size={18}/>:item.media.type==='FEED'?<Newspaper size={18}/>:item.media.type==='WIDGET'?<LayoutDashboard size={18}/>:<Image size={18}/>}</span>
    <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.media.name}</span>
    {item.media.type==='VIDEO'&&<Button type="button" variant={automatic?'default':'outline'} className="h-9 px-3" onClick={onAutomatic}>{automatic?'Automático':'Usar automático'}</Button>}
    <Input className="w-20" type="number" min="1" disabled={automatic} value={item.durationSec} onChange={e=>onDuration(Math.max(1,Number(e.target.value)))}/>
    <span className="min-w-14 text-xs text-slate-500">{automatic?(item.media.durationSec?`${item.media.durationSec}s reais`:'até o fim'):'seg'}</span>
    <Button type="button" variant="ghost" onClick={onRemove}><Trash2 size={17}/></Button>
  </div>;
}

export function Playlists(){
  const [playlists,setPlaylists]=useState<Playlist[]>([]);
  const [media,setMedia]=useState<Media[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [name,setName]=useState('');
  const [items,setItems]=useState<Item[]>([]);
  const [loop,setLoop]=useState(true);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  function selectPlaylist(playlist:Playlist){
    setSelectedId(playlist.id);setName(playlist.name);setItems(playlist.items.map(item=>({...item})));setLoop(playlist.loop!==false);setMessage('');setError('');
  }
  function newPlaylist(){setSelectedId(null);setName('Nova playlist');setItems([]);setLoop(true);setMessage('');setError('')}
  async function load(){
    try{
      const [saved,library]=await Promise.all([api<Playlist[]>('/playlists'),api<Media[]>('/media')]);
      setPlaylists(saved);setMedia(library);
      if(saved.length) selectPlaylist(saved[0]); else newPlaylist();
    }catch(e){setError((e as Error).message)}
  }
  useEffect(()=>{load()},[]);

  function drag(event:DragEndEvent){
    if(event.over&&event.active.id!==event.over.id){
      setItems(value=>arrayMove(value,value.findIndex(item=>item.id===event.active.id),value.findIndex(item=>item.id===event.over!.id)));
    }
  }
  function add(item:Media){
    setItems(value=>[...value,{id:`draft-${compatibleUuid()}`,mediaId:item.id,durationSec:item.durationSec??(item.type==='VIDEO'?30:item.type==='FEED'||item.type==='WIDGET'?60:10),useMediaDuration:item.type==='VIDEO',media:item}]);
  }
  async function save(){
    if(!name.trim()||!items.length)return;
    setBusy(true);setError('');setMessage('');
    try{
      const payloadItems=items.map(item=>({mediaId:item.mediaId,durationSec:item.durationSec,useMediaDuration:item.media.type==='VIDEO'&&item.useMediaDuration===true}));
      let saved:Playlist;
      if(!selectedId){
        saved=await api<Playlist>('/playlists',{method:'POST',body:JSON.stringify({name:name.trim(),loop,items:payloadItems})});
        setPlaylists(current=>[saved,...current]);
      }else{
        await api(`/playlists/${selectedId}`,{method:'PATCH',body:JSON.stringify({name:name.trim(),loop})});
        saved=await api<Playlist>(`/playlists/${selectedId}/items`,{method:'PATCH',body:JSON.stringify({items:payloadItems})});
        setPlaylists(current=>current.map(item=>item.id===saved.id?saved:item));
      }
      selectPlaylist(saved);setMessage('Playlist salva com sucesso.');
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function removePlaylist(playlist:Playlist){
    if(!confirm(`Excluir a playlist “${playlist.name}”?`))return;
    try{
      await api(`/playlists/${playlist.id}`,{method:'DELETE'});
      const remaining=playlists.filter(item=>item.id!==playlist.id);setPlaylists(remaining);
      if(selectedId===playlist.id){if(remaining.length)selectPlaylist(remaining[0]);else newPlaylist()}
    }catch(e){setError((e as Error).message)}
  }

  return <>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-bold">Playlists</h1><p className="text-slate-500">Crie, visualize e organize o conteúdo de cada programação.</p></div>
      <Button onClick={newPlaylist}><Plus size={17}/>Nova playlist</Button>
    </div>

    <Card className="mb-6 p-5">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Playlists salvas</h2><span className="text-xs text-slate-500">{playlists.length} cadastradas</span></div>
      {playlists.length?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{playlists.map(playlist=>{
        const automaticCount=playlist.items.filter(item=>item.media.type==='VIDEO'&&item.useMediaDuration).length;
        const unknownAutomatic=playlist.items.some(item=>item.media.type==='VIDEO'&&item.useMediaDuration&&!item.media.durationSec);
        const duration=playlist.items.reduce((total,item)=>total+(item.useMediaDuration&&item.media.durationSec?item.media.durationSec:item.durationSec),0);
        return <button key={playlist.id} onClick={()=>selectPlaylist(playlist)} className={`rounded-xl border p-4 text-left transition hover:bg-muted ${selectedId===playlist.id?'border-primary ring-2 ring-primary/20':'bg-background'}`}>
          <div className="mb-4 flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary"><ListVideo size={18}/></span><span onClick={event=>event.stopPropagation()}><Button type="button" variant="ghost" className="h-8 px-2" onClick={()=>removePlaylist(playlist)}><Trash2 size={15}/></Button></span></div>
          <p className="truncate font-semibold">{playlist.name}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500"><span>{playlist.items.length} itens</span><span className="flex items-center gap-1"><Clock size={12}/>{unknownAutomatic?'duração automática':`${duration}s`}{automaticCount?` · ${automaticCount} auto`:''}</span><span>{playlist.loop!==false?'Loop ligado':'Loop desligado'}</span></div>
        </button>;
      })}</div>:<div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Nenhuma playlist salva. Clique em “Nova playlist” para começar.</div>}
    </Card>

    <div className="mb-5 flex flex-wrap gap-3">
      <Input className="max-w-sm" value={name} onChange={event=>setName(event.target.value)} placeholder="Nome da playlist"/>
      <label className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm"><input type="checkbox" checked={loop} onChange={event=>setLoop(event.target.checked)}/><span>Repetir em looping</span></label>
      <Button onClick={save} disabled={busy||!items.length||!name.trim()}><Save size={17}/>{busy?'Salvando...':'Salvar playlist'}</Button>
      {message&&<span className="self-center text-sm text-emerald-500">{message}</span>}
      {error&&<span className="self-center text-sm text-red-500">{error}</span>}
    </div>

    <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
      <Card className="p-5"><h2 className="mb-4 font-semibold">Biblioteca de mídias</h2><div className="max-h-[65vh] space-y-2 overflow-auto">{media.map(item=><div key={item.id} className="flex items-center gap-3 rounded-lg border p-3"><span className="grid h-10 w-10 place-items-center rounded bg-muted">{item.type==='VIDEO'?<Video size={18}/>:item.type==='PDF'?<FileText size={18}/>:item.type==='FEED'?<Newspaper size={18}/>:item.type==='WIDGET'?<LayoutDashboard size={18}/>:<Image size={18}/>}</span><span className="min-w-0 flex-1 truncate text-sm">{item.name}{item.type==='VIDEO'&&<small className="ml-2 text-slate-500">{item.durationSec?`${item.durationSec}s`:'duração automática'}</small>}</span><Button type="button" variant="ghost" onClick={()=>add(item)}><Plus size={17}/></Button></div>)}</div></Card>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Ordem de exibição</h2><span className="text-xs text-slate-500">{items.length} itens</span></div><DndContext collisionDetection={closestCenter} onDragEnd={drag}><SortableContext items={items.map(item=>item.id)} strategy={verticalListSortingStrategy}><div className="space-y-2">{items.map((item,index)=><SortableItem key={item.id} item={item} onRemove={()=>setItems(value=>value.filter(current=>current.id!==item.id))} onDuration={duration=>setItems(value=>value.map((current,currentIndex)=>currentIndex===index?{...current,durationSec:duration}:current))} onAutomatic={()=>setItems(value=>value.map((current,currentIndex)=>currentIndex===index?{...current,useMediaDuration:!current.useMediaDuration}:current))}/>)}</div></SortableContext></DndContext>{!items.length&&<div className="rounded-xl border border-dashed p-12 text-center text-sm text-slate-500">Adicione mídias usando o botão +</div>}</Card>
    </div>
  </>;
}
