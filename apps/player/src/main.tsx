import React from 'react'; import ReactDOM from 'react-dom/client'; import './index.css'; import { Player } from './player'; import { Setup } from './setup';
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
function App(){const token=localStorage.getItem('deviceToken');return token?<Player/>:<Setup done={()=>location.reload()}/>}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
