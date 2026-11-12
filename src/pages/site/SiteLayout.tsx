import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { cx } from '../../components/ui';
import { siteRepo } from '../../repositories/site';

const TABS = [
  { to: '/site', label: 'Visão geral', end: true },
  { to: '/site/solicitacoes', label: 'Solicitações' },
  { to: '/site/projetos', label: 'Projetos' },
  { to: '/site/servicos', label: 'Serviços' },
  { to: '/site/conteudo', label: 'Textos e contato' },
  { to: '/site/depoimentos', label: 'Depoimentos' },
];

/** Painel do site: atualiza o conteúdo público. Não é um CRM — as vendas continuam no CRM. */
export function SiteLayout() {
  const ov = useQuery({ queryKey: ['site', 'overview'], queryFn: siteRepo.overview });
  const fresh = ov.data?.counts.newLeads ?? 0;
  return (
    <div>
      <div className="-mx-4 -mt-5 mb-6 bg-[#17191b] px-4 pt-5 text-white sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-7 lg:px-8 lg:pt-7">
        <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-white/50 uppercase">Painel do site</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Site institucional</h1>
          </div>
          <a href="/" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-md border border-white/25 px-3 py-2 text-sm hover:bg-white hover:text-gray-900">
            Ver o site <ExternalLink className="size-4" />
          </a>
        </div>
        <nav className="-mb-px flex gap-5 overflow-x-auto text-sm [scrollbar-width:none]" aria-label="Seções do painel do site">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cx('flex shrink-0 items-center gap-1.5 border-b-2 py-2.5 whitespace-nowrap', isActive ? 'border-white text-white' : 'border-transparent text-white/60 hover:text-white')
              }
            >
              {t.label}
              {t.to === '/site/solicitacoes' && fresh > 0 && <span className="rounded-full bg-[#2c14c4] px-1.5 text-[11px] font-semibold">{fresh}</span>}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
