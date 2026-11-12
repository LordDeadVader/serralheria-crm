import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  Factory,
  Download,
  FileText,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shapes,
  Truck,
  Users,
  Warehouse,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../authentication/AuthContext';
import { useInstall } from '../hooks/useInstall';
import { cx } from '../components/ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/orcamentos', label: 'Orçamentos', icon: FileText },
  { to: '/materiais', label: 'Materiais', icon: Boxes },
  { to: '/servicos', label: 'Serviços e mão de obra', icon: Wrench },
  { to: '/fornecedores', label: 'Fornecedores', icon: Truck },
  { to: '/estoque', label: 'Estoque', icon: Warehouse },
  { to: '/modelos', label: 'Modelos e kits', icon: Shapes },
  { to: '/producao', label: 'Produção', icon: Factory },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/site', label: 'Site e solicitações', icon: Globe },
];

export function AppLayout() {
  const { company, user, logout } = useAuth();
  const inst = useInstall();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 border-b border-gray-200 px-4">
        <img src={`${import.meta.env.BASE_URL}logo.webp`} alt="" className="h-8 w-auto shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">WJR Gestão</p>
          <p className="truncate text-[11px] text-gray-500">{company?.name ?? 'Área restrita'}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Menu principal">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium',
                isActive ? 'bg-brand-50 text-brand-800' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )
            }
          >
            <n.icon className="size-4 shrink-0" strokeWidth={1.8} />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-200 p-3">
        <p className="truncate text-[13px] font-medium text-gray-800">{user?.name}</p>
        <p className="truncate text-[11px] text-gray-500">{user?.email}</p>
        <button onClick={() => void logout()} className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-gray-600 hover:text-gray-900">
          <LogOut className="size-3.5" /> Sair
        </button>
        {!inst.installed && inst.canPrompt && (
          <button onClick={() => void inst.install()} className="mt-2 flex items-center gap-1.5 text-[13px] text-brand-800 hover:text-brand-900">
            <Download className="size-3.5" /> Instalar aplicativo
          </button>
        )}
        <a href="/" target="_blank" rel="noopener" className="mt-2 flex items-center gap-1.5 text-[13px] text-gray-600 hover:text-gray-900">
          <Globe className="size-3.5" /> Abrir o site
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-gray-200 bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-gray-900/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-gray-200 bg-white">
            <button className="absolute right-2 top-3 rounded p-1 text-gray-500" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded p-1 text-gray-700" aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
        <img src={`${import.meta.env.BASE_URL}logo.webp`} alt="" className="h-7 w-auto" />
        <span className="truncate text-sm font-semibold">WJR Gestão</span>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <Outlet />
      </main>
    </div>
  );
}
