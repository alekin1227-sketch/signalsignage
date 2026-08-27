import { Activity, BarChart3, CalendarClock, ChevronRight, Cpu, Images, KeyRound, LayoutDashboard, ListVideo, LogOut, Menu, Monitor, Radio, UsersRound, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ThemeToggle } from './theme';
import { Button } from './ui';
import { cn } from '../lib/utils';

function session(){try{const saved=JSON.parse(localStorage.getItem('currentUser')??'null');if(saved)return saved;const token=localStorage.getItem('accessToken');if(!token)return null;return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return null}}

const roleLabel:Record<string,string>={ADMIN:'Administrador',EDITOR:'Editor',VIEWER:'Somente leitura'};

export function Layout(){
  const user=session(),route=useLocation(),[mobileOpen,setMobileOpen]=useState(false);
  const links=[
    ['/','Visão geral',BarChart3],['/devices','Dispositivos',Monitor],['/media','Mídias',Images],
    ['/widgets','Widgets de dados',LayoutDashboard],['/power-bi','Power BI',Activity],
    ['/playlists','Playlists',ListVideo],['/schedules','Programação',CalendarClock],
    ...(user?.role==='ADMIN'?[['/player-access','Acessos do Player',KeyRound] as const,['/users','Usuários do Painel',UsersRound] as const]:[]),
  ] as const;
  const current=links.find(([path])=>path==='/'?route.pathname==='/':route.pathname.startsWith(path));
  const logout=()=>{localStorage.clear();window.location.href='/login'};
  return <div className="app-shell">
    {mobileOpen&&<button className="sidebar-backdrop" aria-label="Fechar menu" onClick={()=>setMobileOpen(false)}/>}
    <aside className={cn('app-sidebar',mobileOpen&&'open')}>
      <div className="brand-block"><div className="brand-logo"><img src="/somai-logo.png" alt="SOMAI"/></div><div className="brand-copy"><strong>Signal<span className="brand-mark">.</span></strong><span>Digital Signage</span></div><button className="sidebar-close" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu"><X size={19}/></button></div>
      <div className="system-status"><span/><div><strong>Central operacional</strong><small>Núcleo SOMAI conectado</small></div><b className="status-signal">Live</b></div>
      <nav className="app-navigation"><span className="nav-caption">Gerenciamento</span>{links.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==='/' } onClick={()=>setMobileOpen(false)} className={({isActive})=>cn('nav-item',isActive&&'active')}><span className="nav-icon"><Icon size={18}/></span><span>{label}</span><ChevronRight className="nav-arrow" size={15}/></NavLink>)}</nav>
      <div className="sidebar-footer"><div className="user-avatar">{String(user?.name||'S').slice(0,1).toUpperCase()}</div><div><strong>{user?.name||'TV Corporativa'}</strong><span>{roleLabel[user?.role]||user?.role||''}</span></div><button onClick={logout} title="Sair"><LogOut size={17}/></button></div>
    </aside>
    <main className="app-main">
      <header className="app-header"><div className="header-title"><button className="menu-trigger" onClick={()=>setMobileOpen(true)} aria-label="Abrir menu"><Menu size={21}/></button><div><span>Signal Signage</span><strong>{current?.[1]||'Central SOMAI'}</strong></div><span className="header-separator"/><div className="header-context"><Cpu size={14}/><span>Ambiente</span><b>Produção local</b></div></div><div className="header-actions"><div className="live-indicator"><i/><Radio size={13}/><span>Operação online</span></div><ThemeToggle/><Button variant="ghost" className="desktop-logout" onClick={logout}><LogOut size={17}/><span>Sair</span></Button></div></header>
      <div className="app-content"><Outlet/></div>
    </main>
  </div>;
}
