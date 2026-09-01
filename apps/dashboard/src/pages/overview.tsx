import { useEffect, useMemo, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Activity, CalendarClock, Cloud, Database, HardDrive, Image, Monitor, PlugZap, Radio, Wifi } from 'lucide-react';
import { api } from '../lib/api';
import { Card } from '../components/ui';

ChartJS.register(ArcElement,Tooltip,Legend);
type Stats={media:number;devices:number;online:number;schedules:number;integrations:number;integrationsOnline:number;mediaByType:{image:number;video:number;pdf:number;url:number;feed:number;widget:number}};

export function Overview(){
  const [stats,setStats]=useState<Stats>(),[error,setError]=useState('');
  useEffect(()=>{api<Stats>('/dashboard/stats').then(setStats).catch(cause=>setError(cause.message))},[]);
  const distribution=useMemo(()=>stats?[stats.mediaByType.image,stats.mediaByType.video,stats.mediaByType.pdf,stats.mediaByType.url,stats.mediaByType.feed,stats.mediaByType.widget]:[],[stats]);
  const onlineRate=stats?.devices?Math.round(stats.online/stats.devices*100):0;
  const cards=[
    {label:'Biblioteca',value:stats?.media??'—',detail:'itens disponíveis',icon:Image,tone:'blue'},
    {label:'TVs online',value:`${stats?.online??0}/${stats?.devices??0}`,detail:`${onlineRate}% da rede ativa`,icon:Wifi,tone:'green'},
    {label:'Dispositivos',value:stats?.devices??'—',detail:'Players cadastrados',icon:Monitor,tone:'cyan'},
    {label:'Programações',value:stats?.schedules??'—',detail:'regras configuradas',icon:CalendarClock,tone:'gold'},
    {label:'Integrações',value:`${stats?.integrationsOnline??0}/${stats?.integrations??0}`,detail:'APIs e BI conectados',icon:PlugZap,tone:'blue'},
  ];
  return <>
    <div className="page-heading"><div><span className="eyebrow">Centro de comando</span><h1>Visão geral</h1><p>Acompanhe a rede de telas, conteúdos e programações da SOMAI.</p></div><div className="live-indicator"><i/><span>Atualização em tempo real</span></div></div>
    {error&&<div className="notice notice-error">{error}</div>}
    <section className="overview-metrics">{cards.map(({label,value,detail,icon:Icon,tone})=><Card key={label} className={`overview-stat tone-${tone}`}><div className="stat-icon"><Icon/></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><Activity className="stat-wave"/></Card>)}</section>
    <section className="overview-grid">
      <Card className="overview-panel"><div className="section-heading"><div><span className="eyebrow">Conteúdo</span><h2>Biblioteca por formato</h2><p>Distribuição do acervo disponível nas playlists.</p></div><HardDrive size={20}/></div><div className="chart-content"><div className="chart-wrap">{stats&&<Doughnut data={{labels:['Imagens','Vídeos','PDFs','URLs','Feeds','Widgets'],datasets:[{data:distribution,backgroundColor:['#159bd2','#17c3e8','#f06a6a','#7e7cf1','#f2b640','#24bd88'],borderWidth:0,hoverOffset:5}]}} options={{cutout:'72%',plugins:{legend:{display:false}},maintainAspectRatio:true}}/>}<div className="chart-center"><strong>{stats?.media??0}</strong><span>itens</span></div></div><div className="chart-legend">{[['Imagens',stats?.mediaByType.image,'#159bd2'],['Vídeos',stats?.mediaByType.video,'#17c3e8'],['PDFs',stats?.mediaByType.pdf,'#f06a6a'],['URLs',stats?.mediaByType.url,'#7e7cf1'],['Feeds',stats?.mediaByType.feed,'#f2b640'],['Widgets',stats?.mediaByType.widget,'#24bd88']].map(([label,value,color])=><div key={String(label)}><i style={{background:String(color)}}/><span>{label}</span><strong>{value??0}</strong></div>)}</div></div></Card>
      <Card className="overview-panel"><div className="section-heading"><div><span className="eyebrow">Infraestrutura</span><h2>Operação resiliente</h2><p>Camadas que mantêm as TVs atualizadas.</p></div><Radio size={20}/></div><div className="health-list">
        <article><span className="health-icon"><Cloud/></span><div><strong>Entrega segura</strong><p>Preparado para HTTPS e Cloudflare Tunnel sem portas públicas no servidor.</p></div><i className="health-ok">Disponível</i></article>
        <article><span className="health-icon"><Radio/></span><div><strong>Comandos instantâneos</strong><p>WebSocket com polling de contingência a cada 15 segundos.</p></div><i className="health-ok">Ativo</i></article>
        <article><span className="health-icon"><HardDrive/></span><div><strong>Cache inteligente</strong><p>Nova playlist é preparada e arquivos obsoletos são removidos.</p></div><i className="health-ok">Automático</i></article>
        <article><span className="health-icon"><Database/></span><div><strong>Dados persistentes</strong><p>PostgreSQL e mídias preservados em volumes independentes.</p></div><i className="health-ok">Protegido</i></article>
      </div></Card>
    </section>
  </>;
}
