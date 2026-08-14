import { BarChart3, CalendarClock, Images, KeyRound, LayoutDashboard, ListVideo, LogOut, Monitor, UsersRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { ThemeToggle } from './theme'; import { Button } from './ui'; import { cn } from '../lib/utils';

function session(){try{const saved=JSON.parse(localStorage.getItem('currentUser')??'null');if(saved)return saved;const token=localStorage.getItem('accessToken');if(!token)return null;return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return null}}

export function Layout(){
  const user=session();
  const links=[['/','Visão geral',BarChart3],['/devices','Dispositivos',Monitor],['/media','Mídias',Images],['/widgets','Widgets de dados',LayoutDashboard],['/playlists','Playlists',ListVideo],['/schedules','Programação',CalendarClock],...(user?.role==='ADMIN'?[['/player-access','Acessos do Player',KeyRound] as const,['/users','Usuários do Painel',UsersRound] as const]:[])] as const;
  return <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]"><aside className="border-r bg-card p-5"><div className="mb-8"><img src="/somai-logo.png" className="h-14 w-full object-contain object-left"/><p className="mt-2 text-[10px] font-semibold uppercase tracking-[.24em] text-slate-400">Digital Signage</p></div><nav className="space-y-1">{links.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==='/'} className={({isActive})=>cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',isActive?'bg-primary text-white':'text-slate-500 hover:bg-muted hover:text-foreground')}><Icon size={18}/>{label}</NavLink>)}</nav></aside><main className="min-w-0"><header className="flex h-16 items-center justify-between border-b bg-card px-6"><div><p className="text-sm font-medium">{user?.name||'TV Corporativa'}</p><p className="text-xs text-slate-500">{user?.role||''}</p></div><div className="flex"><ThemeToggle/><Button variant="ghost" onClick={()=>{localStorage.clear();location.href='/login'}}><LogOut size={18}/></Button></div></header><div className="p-6 lg:p-8"><Outlet/></div></main></div>;
}
