import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './authentication/AuthContext';
import { FeedbackProvider } from './components/feedback';
import { App } from './App';
import './index.css';

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
