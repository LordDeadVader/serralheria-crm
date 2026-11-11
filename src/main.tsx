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

// HashRouter: o GitHub Pages não reescreve rotas; com hash, atualizar a página nunca gera 404.
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
