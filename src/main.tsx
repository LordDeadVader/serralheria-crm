import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './authentication/AuthContext';
import { FeedbackProvider } from './components/feedback';
import { App } from './App';
import './index.css';
import { startCardTableLabels } from './lib/cardTables';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => count < 2 && (err as { status?: number }).status === 0,
      refetchOnWindowFocus: false,
    },
  },
});

// HashRouter: rotas no hash — atualizar a página dentro do app nunca gera 404 no servidor.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <FeedbackProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </FeedbackProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);

startCardTableLabels();

// App instalável: o service worker só existe na versão publicada (escopo /crm/).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {});
  });
}
// Guarda o convite de instalação do navegador para o botão "Instalar aplicativo".
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as unknown as { __installPrompt?: Event }).__installPrompt = e;
  window.dispatchEvent(new Event('installprompt'));
});

// Depois de uma nova publicação, abas abertas antes dela ainda pedem os arquivos antigos
// (ex.: gerador de PDF), que já não existem no servidor. Recarrega uma vez para pegar a versão nova.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'scrm.reloaded-for-update';
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30_000) return; // evita laço de recarga
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* sem sessionStorage: recarrega mesmo assim */
  }
  event.preventDefault();
  window.location.reload();
});
