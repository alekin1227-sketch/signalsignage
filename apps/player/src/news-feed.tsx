import { useEffect, useState } from 'react';

type Article={id:string;title:string;description?:string;image?:string;source?:string;publishedAt?:string};
type Feed={name:string;updatedAt:string;refreshSeconds:number;articles:Article[]};

export function NewsFeed({url}:{url:string}){
  const key=`feed:${url}`;
  const [feed,setFeed]=useState<Feed|null>(()=>{try{return JSON.parse(localStorage.getItem(key)??'null')}catch{return null}});
  const [index,setIndex]=useState(0);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;let refreshTimer:number;
    const load=async()=>{try{const response=await fetch(url,{cache:'no-store'});const details=await response.json().catch(()=>null);if(!response.ok)throw new Error(Array.isArray(details?.message)?details.message.join(' · '):details?.message||`Erro HTTP ${response.status}`);const value=details as Feed;if(active){setError('');setFeed(value);localStorage.setItem(key,JSON.stringify(value));refreshTimer=window.setTimeout(load,(value.refreshSeconds||300)*1000)}}catch(cause){if(active)setError((cause as Error).message||'Fonte de notícias indisponível');refreshTimer=window.setTimeout(load,60000)}};
    load();return()=>{active=false;clearTimeout(refreshTimer)};
  },[url,key]);
  useEffect(()=>{const timer=window.setInterval(()=>setIndex(value=>feed?.articles.length?(value+1)%feed.articles.length:0),8000);return()=>clearInterval(timer)},[feed?.articles.length]);
  const article=feed?.articles[index];
  if(!article)return <div className="dynamic-error"><img src="/somai-logo.png"/><span className="dynamic-error-label">Fonte de notícias</span><strong>{feed?.name||'Conteúdo indisponível'}</strong><p>{error||'Aguardando notícias da fonte configurada.'}</p><small>O Player tentará novamente automaticamente em 60 segundos.</small></div>;
  return <article className="news-card" style={article.image?{backgroundImage:`linear-gradient(90deg,rgba(2,6,23,.96),rgba(2,6,23,.72),rgba(2,6,23,.2)),url(${article.image})`}:undefined}><div className="news-content"><span className="news-label">{article.source||feed?.name||'Notícias'}</span><h1>{article.title}</h1>{article.description&&<p>{article.description}</p>}<footer>{article.publishedAt?new Date(article.publishedAt).toLocaleString('pt-BR'):''}<span>{index+1} / {feed?.articles.length}</span></footer></div></article>;
}
