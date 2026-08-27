import { DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, FileVideo, Image, LayoutDashboard, Newspaper, Trash2, UploadCloud } from 'lucide-react';
import { API_URL, api } from '../lib/api';
import { Button, Card, Input } from '../components/ui';

type Media={id:string;name:string;type:'IMAGE'|'VIDEO'|'PDF'|'URL'|'FEED'|'WIDGET';thumbnailUrl?:string;url?:string;sizeBytes?:string;feedRefreshSec?:number;durationSec?:number};

const CHUNK_SIZE=50*1024*1024;
async function uploadLargeFile(file:File,onProgress:(value:string)=>void){
  const totalParts=Math.ceil(file.size/CHUNK_SIZE);
  const session=await api<{uploadId:string}>('/media/uploads/start',{method:'POST',body:JSON.stringify({originalName:file.name,mimeType:file.type||'application/octet-stream',sizeBytes:file.size,totalParts})});
  try{
    for(let partNumber=0;partNumber<totalParts;partNumber+=1){
      const start=partNumber*CHUNK_SIZE,end=Math.min(file.size,start+CHUNK_SIZE);
      onProgress(`Enviando ${file.name}: parte ${partNumber+1} de ${totalParts} (${Math.round((partNumber+1)/totalParts*100)}%)`);
      let sent=false,lastError:unknown;
      for(let attempt=1;attempt<=3&&!sent;attempt+=1){
        const form=new FormData();
        form.append('chunk',file.slice(start,end),file.name);
        try{await api(`/media/uploads/${session.uploadId}/part?partNumber=${partNumber}&totalParts=${totalParts}`,{method:'POST',body:form});sent=true}catch(error){lastError=error;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt*1200))}
      }
      if(!sent)throw lastError;
    }
    onProgress(`Montando e preparando ${file.name} no servidor…`);
    return await api(`/media/uploads/${session.uploadId}/complete`,{method:'POST'});
  }catch(error){await api(`/media/uploads/${session.uploadId}`,{method:'DELETE'}).catch(()=>undefined);throw error}
}

export function MediaPage(){
  const [media,setMedia]=useState<Media[]>([]),[busy,setBusy]=useState(false),[dragging,setDragging]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
  const inputRef=useRef<HTMLInputElement|null>(null);
  const load=()=>api<Media[]>('/media').then(setMedia).catch(event=>setError(event.message));
  useEffect(()=>{load()},[]);
  async function uploadFiles(selected:FileList|File[]){
    const files=Array.from(selected);if(!files.length||busy)return;setBusy(true);setError('');setMessage('');let completed=0;const failures:string[]=[];
    for(let index=0;index<files.length;index+=1){const file=files[index];setProgress(`Processando ${index+1} de ${files.length}: ${file.name}`);try{if(file.size>80*1024*1024)await uploadLargeFile(file,setProgress);else{const data=new FormData();data.append('file',file);await api('/media/upload',{method:'POST',body:data})}completed+=1}catch(event){failures.push(`${file.name}: ${(event as Error).message}`)}}
    if(inputRef.current)inputRef.current.value='';if(completed)setMessage(`${completed} arquivo(s) salvo(s) no armazenamento local de mídias.`);if(failures.length)setError(failures.join(' · '));setProgress('');setBusy(false);await load();
  }
  function drop(event:DragEvent<HTMLLabelElement>){event.preventDefault();setDragging(false);void uploadFiles(event.dataTransfer.files)}
  async function addUrl(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setError('');try{await api('/media/url',{method:'POST',body:JSON.stringify({name:data.get('name'),type:'URL',url:data.get('url')})});form.reset();await load()}catch(e){setError((e as Error).message)}}
  async function remove(item:Media){
    if(!confirm(`Excluir “${item.name}”? Se estiver em alguma playlist, também será removido dela.`))return;
    setError('');setMessage('');
    try{
      const result=await api<{deleted:boolean;removedFromPlaylists:number}>(`/media/${item.id}`,{method:'DELETE'});
      setMessage(result.removedFromPlaylists?`Mídia excluída e removida de ${result.removedFromPlaylists} playlist(s).`:'Mídia excluída.');
      await load();
    }catch(e){setError((e as Error).message)}
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">Biblioteca digital</span><h1>Mídias</h1><p>Envie imagens, vídeos e PDFs ou incorpore páginas externas com segurança.</p></div><div className="live-indicator"><i/><span>{media.length} itens disponíveis</span></div></div>
    {error&&<div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}
    {message&&<div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">{message}</div>}
    <div className="mb-6 grid gap-4 xl:grid-cols-3">
      <Card className="form-panel form-panel-accent p-5 xl:col-span-2"><h2 className="mb-1 font-semibold">Adicionar arquivos</h2><p className="mb-3 text-xs text-slate-500">Envio otimizado em blocos de 50 MB para arquivos grandes, com retomada automática.</p><label onDragEnter={event=>{event.preventDefault();setDragging(true)}} onDragOver={event=>event.preventDefault()} onDragLeave={event=>{event.preventDefault();setDragging(false)}} onDrop={drop} className={`upload-zone grid min-h-44 cursor-pointer place-items-center rounded-xl border-2 border-dashed p-6 text-center transition ${dragging?'border-primary bg-primary/10':'border-slate-300 hover:border-primary dark:border-slate-700'}`}><input ref={inputRef} className="hidden" type="file" multiple accept="image/*,video/*,application/pdf,.mkv,.avi,.mov,.wmv,.m4v,.webm,.mpeg,.mpg,.ts,.mts,.m2ts,.3gp,.ogv,.flv,.heic,.heif,.tif,.tiff,.svg,.avif,.bmp" onChange={event=>event.target.files&&void uploadFiles(event.target.files)} disabled={busy}/><span><UploadCloud className="mx-auto mb-3 text-primary" size={34}/><strong className="block">{busy?'Enviando e preparando arquivos…':'Solte os arquivos aqui'}</strong><small className="mt-1 block text-slate-500">Imagens, vídeos e PDF · até 2 GB por arquivo</small>{progress&&<small className="mt-3 block font-medium text-primary">{progress}</small>}</span></label></Card>
      <Card className="form-panel p-5"><h2 className="mb-3 font-semibold">Página externa</h2><p className="mb-4 text-xs text-slate-500">Para sites ou sistemas que permitem exibição por iframe.</p><form onSubmit={addUrl} className="space-y-3"><Input name="name" placeholder="Nome da página" required/><Input name="url" type="url" placeholder="https://..." required/><Button className="w-full"><ExternalLink size={16}/>Adicionar URL</Button></form></Card>
    </div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{media.map(item=><Card key={item.id} className="media-card"><div className="media-thumb grid aspect-video place-items-center">{item.thumbnailUrl?<img className="h-full w-full object-cover" src={`${API_URL.replace(/\/api$/,'')}${item.thumbnailUrl}`} alt=""/>:item.type==='VIDEO'?<FileVideo size={40}/>:item.type==='PDF'?<FileText size={40}/>:item.type==='URL'?<ExternalLink size={40}/>:item.type==='FEED'?<Newspaper size={40}/>:item.type==='WIDGET'?<LayoutDashboard size={40}/>:<Image size={40}/>}</div><div className="flex items-center gap-2 p-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="text-[10px] text-slate-500">{item.type==='WIDGET'?`Widget · ${item.feedRefreshSec??300}s`:item.type==='FEED'?`Feed · ${item.feedRefreshSec??300}s`:item.type==='VIDEO'?`Vídeo${item.durationSec?` · ${item.durationSec}s`:''}`:item.type==='PDF'?'PDF':item.type}</p></div><Button variant="ghost" title="Excluir mídia" onClick={()=>remove(item)}><Trash2 size={17}/></Button></div></Card>)}</section>
  </>;
}
