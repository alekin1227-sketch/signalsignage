import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Eye, KeyRound, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Card, Input } from '../components/ui';

type Mode = 'PUBLIC' | 'EMBEDDED';
type PowerBiMapping = {
  mode: Mode;
  workspaceId: string;
  reportId: string;
  pageName: string;
  showFilterPane: boolean;
  showNavigation: boolean;
};
type PowerBiWidget = {
  id: string;
  endpoint: string;
  template: string;
  refreshSeconds: number;
  mapping: PowerBiMapping;
  enabled: boolean;
  lastSuccessAt?: string;
  lastError?: string;
  media: { id: string; name: string };
};
type Preview = { data: { mode: Mode; embedUrl: string; expiresAt?: string } };

const emptyMapping: PowerBiMapping = {
  mode: 'PUBLIC', workspaceId: '', reportId: '', pageName: '',
  showFilterPane: false, showNavigation: true,
};

export function PowerBiPage() {
  const [items, setItems] = useState<PowerBiWidget[]>([]);
  const [editing, setEditing] = useState<PowerBiWidget | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Painel Power BI');
  const [endpoint, setEndpoint] = useState('');
  const [mapping, setMapping] = useState<PowerBiMapping>(emptyMapping);
  const [refreshSeconds, setRefreshSeconds] = useState(300);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);

  const powerBiItems = useMemo(() => items.filter(item => item.template === 'POWER_BI'), [items]);
  const load = () => api<PowerBiWidget[]>('/widgets').then(setItems).catch(cause => setError(cause.message));
  useEffect(() => { void load(); }, []);

  function reset() {
    setEditing(null); setName('Painel Power BI'); setEndpoint(''); setMapping(emptyMapping);
    setRefreshSeconds(300); setPreview(null); setError(''); setMessage(''); setOpen(false);
  }
  function begin(item?: PowerBiWidget) {
    setEditing(item ?? null); setName(item?.media.name ?? 'Painel Power BI'); setEndpoint(item?.endpoint ?? '');
    setMapping({ ...emptyMapping, ...(item?.mapping ?? {}) }); setRefreshSeconds(item?.refreshSeconds ?? 300);
    setPreview(null); setError(''); setMessage(''); setOpen(true);
  }
  function payload() {
    const resolvedEndpoint = mapping.mode === 'EMBEDDED'
      ? `https://app.powerbi.com/reportEmbed?reportId=${encodeURIComponent(mapping.reportId)}&groupId=${encodeURIComponent(mapping.workspaceId)}`
      : endpoint;
    return {
      name: name.trim(), endpoint: resolvedEndpoint, template: 'POWER_BI', refreshSeconds,
      mapping, style: { backgroundColor: '#03111f', primaryColor: '#13a8e4', accentColor: '#f5b942' },
      enabled: true,
    };
  }
  async function test() {
    setBusy(true); setError(''); setMessage(''); setPreview(null);
    try {
      const value = await api<Preview>('/widgets/preview', { method: 'POST', body: JSON.stringify(payload()) });
      setPreview(value); setMessage(mapping.mode === 'EMBEDDED' ? 'Credenciais e relatório validados pela Microsoft.' : 'Link público validado.');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await api(editing ? `/widgets/${editing.id}` : '/widgets', {
        method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload()),
      });
      reset(); await load();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(item: PowerBiWidget) {
    if (!confirm(`Excluir o widget “${item.media.name}”? Ele também será retirado das playlists.`)) return;
    setError('');
    try { await api(`/widgets/${item.id}`, { method: 'DELETE' }); await load(); }
    catch (cause) { setError((cause as Error).message); }
  }

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">Integrações corporativas</span><h1>Power BI</h1><p>Transforme relatórios públicos ou privados em widgets para qualquer playlist.</p></div>
      <Button onClick={() => begin()}><Plus size={17}/>Novo relatório</Button>
    </div>
    {error && <div className="notice notice-error">{error}</div>}
    <section className="grid gap-4 md:grid-cols-3">
      <Card className="metric-card"><BarChart3/><div><span>Relatórios cadastrados</span><strong>{powerBiItems.length}</strong></div></Card>
      <Card className="metric-card"><ShieldCheck/><div><span>Integração segura</span><strong>App owns data</strong></div></Card>
      <Card className="metric-card"><RefreshCw/><div><span>Tokens</span><strong>Renovação automática</strong></div></Card>
    </section>

    <Card className="mt-6 overflow-hidden">
      <div className="section-heading"><div><h2>Widgets Power BI</h2><p>Depois de salvar, adicione o widget normalmente em Playlists.</p></div></div>
      {powerBiItems.length === 0 ? <div className="empty-state"><BarChart3/><strong>Nenhum relatório cadastrado</strong><p>Comece com um link público de demonstração ou configure o modo Embedded seguro.</p><Button onClick={() => begin()}><Plus size={16}/>Cadastrar primeiro relatório</Button></div>
        : <div className="data-list">{powerBiItems.map(item => <article key={item.id}>
          <div className={`integration-icon ${item.mapping.mode === 'EMBEDDED' ? 'secure' : ''}`}><BarChart3/></div>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="truncate">{item.media.name}</strong><span className="status-chip">{item.mapping.mode === 'EMBEDDED' ? 'Embedded seguro' : 'Link público'}</span></div><p>{item.mapping.mode === 'EMBEDDED' ? `Workspace ${item.mapping.workspaceId.slice(0, 8)}…` : item.endpoint}</p>{item.lastError && <small className="text-red-500">{item.lastError}</small>}</div>
          <Button variant="ghost" title="Editar" onClick={() => begin(item)}><Pencil size={16}/></Button>
          <Button variant="ghost" title="Excluir" onClick={() => remove(item)}><Trash2 size={16}/></Button>
        </article>)}</div>}
    </Card>

    {open && <div className="modal-backdrop" onMouseDown={event => event.currentTarget === event.target && reset()}><Card className="modal-card">
      <div className="section-heading"><div><span className="eyebrow">Widget de dados</span><h2>{editing ? 'Editar relatório' : 'Novo Power BI'}</h2></div><Button variant="ghost" onClick={reset}><X size={18}/></Button></div>
      <form onSubmit={save} className="space-y-5 p-6 pt-1">
        <label className="field-label">Nome do widget<Input value={name} onChange={event => setName(event.target.value)} required/></label>
        <div className="mode-grid">
          <button type="button" className={mapping.mode === 'PUBLIC' ? 'selected' : ''} onClick={() => setMapping(value => ({ ...value, mode: 'PUBLIC' }))}><Eye/><strong>Link público</strong><small>Gratuito, somente para dados não confidenciais.</small></button>
          <button type="button" className={mapping.mode === 'EMBEDDED' ? 'selected' : ''} onClick={() => setMapping(value => ({ ...value, mode: 'EMBEDDED' }))}><KeyRound/><strong>Embedded seguro</strong><small>Token automático, sem login nas TVs.</small></button>
        </div>
        {mapping.mode === 'PUBLIC' ? <label className="field-label">Link “Publicar na Web”<Input type="url" value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="https://app.powerbi.com/view?r=..." required/><small>Qualquer pessoa com esse endereço poderá visualizar o relatório.</small></label>
          : <div className="grid gap-4 md:grid-cols-2">
            <label className="field-label">Workspace ID<Input value={mapping.workspaceId} onChange={event => setMapping(value => ({ ...value, workspaceId: event.target.value }))} placeholder="00000000-0000-..." required/></label>
            <label className="field-label">Report ID<Input value={mapping.reportId} onChange={event => setMapping(value => ({ ...value, reportId: event.target.value }))} placeholder="00000000-0000-..." required/></label>
            <div className="secure-note md:col-span-2"><ShieldCheck/><p><strong>Segredo protegido no servidor</strong><br/>Tenant ID, Client ID e Client Secret ficam no arquivo de ambiente da API e nunca são enviados ao Player.</p></div>
          </div>}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="field-label">Página inicial<Input value={mapping.pageName} onChange={event => setMapping(value => ({ ...value, pageName: event.target.value }))} placeholder="ReportSection (opcional)"/></label>
          <label className="field-label">Renovar configuração<select value={refreshSeconds} onChange={event => setRefreshSeconds(Number(event.target.value))}><option value="300">A cada 5 minutos</option><option value="600">A cada 10 minutos</option><option value="1800">A cada 30 minutos</option></select></label>
        </div>
        {mapping.mode === 'EMBEDDED' && <div className="flex flex-wrap gap-5"><label className="check-label"><input type="checkbox" checked={mapping.showNavigation} onChange={event => setMapping(value => ({ ...value, showNavigation: event.target.checked }))}/>Navegação de páginas</label><label className="check-label"><input type="checkbox" checked={mapping.showFilterPane} onChange={event => setMapping(value => ({ ...value, showFilterPane: event.target.checked }))}/>Painel de filtros</label></div>}
        {message && <div className="notice notice-success"><CheckCircle2 size={17}/>{message}</div>}
        {preview?.data.mode === 'PUBLIC' && <div className="powerbi-preview"><iframe src={preview.data.embedUrl} title="Prévia do Power BI"/></div>}
        <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={test} disabled={busy}><Eye size={16}/>{busy ? 'Validando…' : 'Testar conexão'}</Button><Button disabled={busy}><CheckCircle2 size={16}/>{editing ? 'Salvar alterações' : 'Criar widget'}</Button></div>
      </form>
    </Card></div>}
  </>;
}
