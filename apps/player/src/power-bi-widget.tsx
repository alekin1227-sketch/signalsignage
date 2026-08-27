import { useEffect, useRef, useState } from 'react';

type PowerBiData = {
  mode: 'PUBLIC' | 'EMBEDDED';
  reportId?: string;
  embedUrl: string;
  accessToken?: string;
  expiresAt?: string;
  pageName?: string;
  showFilterPane?: boolean;
  showNavigation?: boolean;
};

export function PowerBiWidget({ data, name }: { data: PowerBiData; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (data.mode !== 'EMBEDDED' || !host.current) return;
    if (!data.reportId || !data.accessToken) {
      setError('Configuração segura do Power BI incompleta.');
      return;
    }
    let cancelled = false;
    let powerbi: import('powerbi-client').service.Service | undefined;
    void import('powerbi-client').then(({ factories, models, service }) => {
      if (cancelled || !host.current) return;
      powerbi = new service.Service(factories.hpmFactory, factories.wpmpFactory, factories.routerFactory);
      const report = powerbi.embed(host.current, {
        type: 'report', id: data.reportId, embedUrl: data.embedUrl,
        accessToken: data.accessToken, tokenType: models.TokenType.Embed,
        pageName: data.pageName || undefined,
        permissions: models.Permissions.Read,
        settings: {
          panes: {
            filters: { visible: data.showFilterPane === true, expanded: false },
            pageNavigation: { visible: data.showNavigation !== false },
          },
          bars: { statusBar: { visible: false }, actionBar: { visible: false } },
          background: models.BackgroundType.Transparent,
        },
      });
      report.on('loaded', () => setError(''));
      report.on('error', event => setError((event.detail as any)?.message || 'O Power BI não conseguiu abrir este relatório.'));
    }).catch(() => setError('Não foi possível carregar o módulo do Power BI.'));
    return () => { cancelled = true; if (host.current && powerbi) powerbi.reset(host.current); };
  }, [data.accessToken, data.embedUrl, data.mode, data.pageName, data.reportId, data.showFilterPane, data.showNavigation]);

  if (data.mode === 'PUBLIC') return <div className="powerbi-stage"><iframe src={data.embedUrl} title={name} allowFullScreen sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"/></div>;
  return <div className="powerbi-stage"><div ref={host} className="powerbi-host"/>{error && <div className="powerbi-error"><img src="/somai-logo.png"/><strong>Power BI temporariamente indisponível</strong><p>{error}</p><small>O Player renovará o token automaticamente.</small></div>}</div>;
}
