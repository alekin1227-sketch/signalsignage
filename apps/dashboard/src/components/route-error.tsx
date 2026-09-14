import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

function errorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) return error.statusText || `Erro ${error.status}`;
  if (error instanceof Error) return error.message;
  return 'Ocorreu uma falha inesperada ao abrir esta página.';
}

export function RouteError() {
  const error = useRouteError();
  return <main className="route-error">
    <section className="route-error-card">
      <span className="route-error-icon"><AlertTriangle/></span>
      <span className="eyebrow">Falha temporária</span>
      <h1>Não foi possível abrir este módulo</h1>
      <p>{errorMessage(error)}</p>
      <div className="route-error-actions">
        <button type="button" className="ui-button ui-button--default" onClick={() => location.reload()}><RefreshCw size={16}/>Tentar novamente</button>
        <a className="ui-button ui-button--outline" href="/"><Home size={16}/>Voltar ao início</a>
      </div>
    </section>
  </main>;
}
