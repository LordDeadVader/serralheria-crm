import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './authentication/AuthContext';
import { Spinner } from './components/ui';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { ServicesPage } from './pages/ServicesPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { StockPage } from './pages/StockPage';
import { QuotesPage } from './pages/QuotesPage';
import { QuoteEditorPage } from './pages/QuoteEditorPage';
import { QuoteViewPage } from './pages/QuoteViewPage';
import { ProductionPage } from './pages/ProductionPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TemplatesPage } from './pages/TemplatesPage';

export function App() {
  const { status } = useAuth();
  if (status === 'loading') return <Spinner label="Verificando sessão…" />;
  if (status === 'anonymous') {
    return (
      <Routes>
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="clientes/:id" element={<ClientDetailPage />} />
        <Route path="orcamentos" element={<QuotesPage />} />
        <Route path="orcamentos/novo" element={<QuoteEditorPage />} />
        <Route path="orcamentos/:id" element={<QuoteViewPage />} />
        <Route path="orcamentos/:id/editar" element={<QuoteEditorPage />} />
        <Route path="materiais" element={<MaterialsPage />} />
        <Route path="servicos" element={<ServicesPage />} />
        <Route path="fornecedores" element={<SuppliersPage />} />
        <Route path="estoque" element={<StockPage />} />
        <Route path="modelos" element={<TemplatesPage />} />
        <Route path="producao" element={<ProductionPage />} />
        <Route path="relatorios" element={<ReportsPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
      </Route>
      <Route path="/entrar" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
