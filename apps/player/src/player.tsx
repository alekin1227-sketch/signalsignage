import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { clearDeviceAuth, playerFetch, type Queue, type QueueItem, SOCKET_URL } from './api';
import { offlineQueue, playableUrl, syncQueue } from './cache';
import { NewsFeed } from './news-feed';
import { DataWidget } from './data-widget';

type Control={action:'PLAY'|'PAUSE'|'SEEK_FORWARD'|'SEEK_BACKWARD'|'NEXT'|'PREVIOUS';seconds?:number};
type ActiveMedia={item:QueueItem;src:string;objectUrl:boolean};

export function Player(){
  const [queue,setQueue]=useState<Queue|null>(()=>offlineQueue());
  const [index,setIndex]=useState(0),[cycle,setCycle]=useState(0),[active,setActive]=useState<ActiveMedia|null>(null),[connected,setConnected]=useState(navigator.onLine),[finished,setFinished]=useState(false),[playbackError,setPlaybackError]=useState('');
  const [muted,setMuted]=useState(()=>localStorage.getItem('playerMuted')==='true');
  const [audioBlocked,setAudioBlocked]=useState(false);
  const queueRef=useRef<Queue|null>(queue),indexRef=useRef(0),socketRef=useRef<Socket|null>(null),videoRef=useRef<HTMLVideoElement|null>(null),timer=useRef<number>(),itemRef=useRef<QueueItem>(),activeRef=useRef<ActiveMedia|null>(null),advancingRef=useRef(false),mutedRef=useRef(muted);
  useEffect(()=>{indexRef.current=index},[index]);
  useEffect(()=>{mutedRef.current=muted},[muted]);

  const startVideo=useCallback(async(video:HTMLVideoElement)=>{
    video.volume=1;
    video.muted=mutedRef.current;
    try{
      await video.play();
      setAudioBlocked(false);
    }catch{
      // Navegadores comuns podem bloquear autoplay com som. Mantemos a imagem
      // rodando sem áudio e oferecemos um único toque para liberar o som.
      if(!mutedRef.current){
        video.muted=true;
        try{await video.play();setAudioBlocked(true)}catch{setPlaybackError('O navegador bloqueou a reprodução automática do vídeo.')}
      }else setPlaybackError('O navegador bloqueou a reprodução automática do vídeo.');
    }
  },[]);

  const toggleAudio=useCallback(()=>{
    const video=videoRef.current;
    const nextMuted=audioBlocked?false:!(video?.muted??muted);
    setMuted(nextMuted);localStorage.setItem('playerMuted',String(nextMuted));setAudioBlocked(false);
    if(video){video.muted=nextMuted;video.volume=1;if(!nextMuted)video.play().catch(()=>setAudioBlocked(true))}
  },[audioBlocked,muted]);

  const scheduleTimedAdvance=useCallback((seconds:number,callback:()=>void)=>{
    clearTimeout(timer.current);
    timer.current=window.setTimeout(callback,Math.max(1,seconds)*1000);
  },[]);

  const next=useCallback(()=>{
    clearTimeout(timer.current);
    if(advancingRef.current)return;
    const currentQueue=queueRef.current;
    if(!currentQueue?.items.length)return;
    const current=indexRef.current;
    const currentItem=currentQueue.items[current];

    // Um único vídeo em loop reinicia o mesmo elemento já carregado. Não há
    // desmontagem, novo download, tela preta ou botão de reprodução.
    if(currentQueue.items.length===1&&currentQueue.playlist?.loop!==false&&currentItem.type==='VIDEO'&&videoRef.current){
      videoRef.current.currentTime=0;
      void startVideo(videoRef.current);
      if(!currentItem.useMediaDuration)scheduleTimedAdvance(currentItem.durationSec,next);
      return;
    }

    advancingRef.current=true;
    if(current<currentQueue.items.length-1){setIndex(current+1);return}
    if(currentQueue.playlist?.loop!==false){setIndex(0);setCycle(value=>value+1);return}
    setFinished(true);
  },[scheduleTimedAdvance,startVideo]);

  const previous=useCallback(()=>{
    clearTimeout(timer.current);
    if(advancingRef.current)return;
    const currentQueue=queueRef.current;
    const current=indexRef.current;
    if(currentQueue?.items.length===1&&currentQueue.items[0].type==='VIDEO'&&videoRef.current){
      videoRef.current.currentTime=0;
      void startVideo(videoRef.current);
      if(!currentQueue.items[0].useMediaDuration)scheduleTimedAdvance(currentQueue.items[0].durationSec,next);
      return;
    }
    advancingRef.current=true;setFinished(false);
    const last=Math.max(0,(currentQueue?.items.length??1)-1);
    const target=current>0?current-1:currentQueue?.playlist?.loop!==false?last:0;
    setIndex(target);if(target===current)setCycle(value=>value+1);
  },[next,scheduleTimedAdvance,startVideo]);

  const applyQueue=useCallback((value:Queue)=>{
    queueRef.current=value;setQueue(value);setIndex(0);setCycle(current=>current+1);setFinished(false);
  },[]);

  const refresh=useCallback(async(path='/player/queue',force=false)=>{
    try{
      const fresh=await playerFetch<Queue>(path);
      if(force||fresh.version!==queueRef.current?.version)applyQueue(await syncQueue(fresh));
      setConnected(true);
    }catch(error){
      setConnected(false);
      if((error as Error).message==='DEVICE_UNAUTHORIZED')location.reload();
      else if(!queueRef.current){const saved=offlineQueue();if(saved)applyQueue(saved)}
    }
  },[applyQueue]);

  const control=useCallback((command:Control)=>{
    const video=videoRef.current;const seconds=command.seconds??10;
    if(command.action==='NEXT')return next();
    if(command.action==='PREVIOUS')return previous();
    if(!video)return;
    if(command.action==='PLAY'){
      void startVideo(video);
      if(!itemRef.current?.useMediaDuration)scheduleTimedAdvance(itemRef.current?.durationSec??30,next);
    }
    if(command.action==='PAUSE'){video.pause();clearTimeout(timer.current)}
    if(command.action==='SEEK_FORWARD')video.currentTime=Math.min(video.duration||Infinity,video.currentTime+seconds);
    if(command.action==='SEEK_BACKWARD')video.currentTime=Math.max(0,video.currentTime-seconds);
  },[next,previous,scheduleTimedAdvance,startVideo]);

  useEffect(()=>{
    const keyboard=(event:KeyboardEvent)=>{if(event.key.toLowerCase()==='m')toggleAudio()};
    window.addEventListener('keydown',keyboard);return()=>window.removeEventListener('keydown',keyboard);
  },[toggleAudio]);

  useEffect(()=>{
    refresh();
    const poll=window.setInterval(()=>refresh(),15000);
    const socket=io(`${SOCKET_URL}/signage`,{auth:{deviceToken:localStorage.getItem('deviceToken')},transports:['polling','websocket'],reconnection:true,reconnectionDelay:1500});
    socketRef.current=socket;
    socket.on('connect',()=>setConnected(true));
    socket.on('connect_error',()=>setConnected(false));
    socket.on('disconnect',reason=>{setConnected(false);if(reason==='io server disconnect'){clearDeviceAuth();location.reload()}});
    socket.on('refresh-queue',()=>refresh());
    socket.on('emergency',(event:{playlistId:string})=>refresh(`/player/playlist/${event.playlistId}`,true));
    socket.on('player-control',control);
    const online=()=>refresh();window.addEventListener('online',online);
    return()=>{clearInterval(poll);window.removeEventListener('online',online);socket.disconnect();socketRef.current=null};
  },[refresh,control]);

  const requestedItem=queue?.items[index];
  useEffect(()=>{
    advancingRef.current=false;
    let cancelled=false;
    clearTimeout(timer.current);setPlaybackError('');
    if(!requestedItem||finished){
      const previousActive=activeRef.current;activeRef.current=null;setActive(null);
      if(previousActive?.objectUrl)window.setTimeout(()=>URL.revokeObjectURL(previousActive.src),250);
      return;
    }

    playableUrl(requestedItem).then(src=>{
      if(cancelled){if(src.startsWith('blob:'))URL.revokeObjectURL(src);return}
      const previousActive=activeRef.current;
      const nextActive={item:requestedItem,src,objectUrl:src.startsWith('blob:')};
      activeRef.current=nextActive;itemRef.current=requestedItem;setActive(nextActive);
      if(previousActive?.objectUrl&&previousActive.src!==src)window.setTimeout(()=>URL.revokeObjectURL(previousActive.src),1000);
      if(requestedItem.type!=='VIDEO')scheduleTimedAdvance(requestedItem.durationSec,next);
      localStorage.setItem('nowPlaying',JSON.stringify(requestedItem));
      playerFetch('/player/heartbeat',{method:'POST',body:JSON.stringify({resolution:`${screen.width}x${screen.height}`,nowPlayingId:requestedItem.mediaId,nowPlayingName:requestedItem.name})}).catch(()=>{});
      socketRef.current?.emit('now-playing',{mediaId:requestedItem.mediaId,name:requestedItem.name});
    }).catch(()=>{
      if(cancelled)return;
      setPlaybackError('Não foi possível baixar esta mídia para o armazenamento local.');
      window.setTimeout(next,5000);
    });
    return()=>{cancelled=true;clearTimeout(timer.current)};
  },[requestedItem?.id,queue?.version,cycle,finished,next,scheduleTimedAdvance]);

  useEffect(()=>()=>{
    clearTimeout(timer.current);
    if(activeRef.current?.objectUrl)URL.revokeObjectURL(activeRef.current.src);
  },[]);

  if(finished)return <div className="stage"><div className="empty"><strong>Playlist concluída</strong>O looping está desativado. Aguarde uma nova programação.</div><div className="status">{connected?'● Online':'○ Offline'}</div></div>;
  if(!requestedItem&&!active)return <div className="stage"><div className="empty"><strong>Aguardando programação</strong>O player está conectado e verificará novamente em breve.</div><div className="status">{connected?'● Online':'○ Offline'}</div></div>;

  const displayItem=active?.item;
  const nativeLoop=!!(displayItem?.type==='VIDEO'&&queue?.playlist?.loop!==false&&queue?.items.length===1&&displayItem.useMediaDuration);
  const videoError=()=>{
    const code=videoRef.current?.error?.code;
    setPlaybackError(code===2?'O vídeo local está correto, mas ocorreu um erro durante a leitura.':code===3?'O dispositivo não conseguiu decodificar o vídeo preparado pelo servidor.':code===4?'A fonte local do vídeo não pôde ser aberta.':'Falha ao carregar o vídeo.');
  };
  const videoPlaying=()=>{
    setPlaybackError('');
    if(displayItem?.type==='VIDEO'&&!displayItem.useMediaDuration)scheduleTimedAdvance(displayItem.durationSec,next);
  };

  return <div className="stage">
    {!active&&<div className="empty"><strong>Baixando mídia para esta TV…</strong>{requestedItem?.name}</div>}
    {active&&displayItem?.type==='IMAGE'&&<img src={active.src} alt="" onLoad={()=>setPlaybackError('')} onError={()=>setPlaybackError('Não foi possível abrir a imagem local.')}/>} 
    {active&&displayItem?.type==='VIDEO'&&<video ref={videoRef} key={`${active.src}-${displayItem.id}`} src={active.src} autoPlay muted={muted} playsInline preload="auto" controls={false} disablePictureInPicture loop={nativeLoop} onCanPlay={event=>void startVideo(event.currentTarget)} onPlaying={videoPlaying} onEnded={nativeLoop?undefined:next} onError={videoError}/>} 
    {active&&displayItem?.type==='PDF'&&<iframe src={`${active.src}#toolbar=0&navpanes=0&view=Fit`} title={displayItem.name}/>} 
    {active&&displayItem?.type==='URL'&&<iframe src={active.src} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title={displayItem.name}/>} 
    {active&&displayItem?.type==='FEED'&&<NewsFeed url={active.src}/>} 
    {active&&displayItem?.type==='WIDGET'&&<DataWidget url={active.src}/>} 
    {active&&displayItem?.type==='VIDEO'&&audioBlocked&&<button type="button" className="audio-unlock" onClick={toggleAudio}><span>🔊</span><strong>Ativar áudio</strong><small>O navegador exige um clique apenas na primeira reprodução.</small></button>}
    {active&&displayItem?.type==='VIDEO'&&!audioBlocked&&<button type="button" className="audio-toggle" onClick={toggleAudio} title="Ativar ou desativar áudio (tecla M)">{videoRef.current?.muted?'🔇':'🔊'}</button>}
    <div className={`status ${playbackError?'status-error':''}`}>{playbackError||`${connected?'● Online':'○ Offline'} · ${displayItem?.name??requestedItem?.name??''}${displayItem?.type==='VIDEO'&&displayItem.useMediaDuration?' · Automático':''}${queue?.playlist?.forced?' · Tocar agora':''}`}</div>
  </div>;
}
