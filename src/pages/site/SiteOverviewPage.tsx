import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { ErrorBox, Panel, Spinner, Stat } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import { siteRepo } from '../../repositories/site';

export function SiteOverviewPage() {
  const ov = useQuery({ queryKey: ['site', 'overview'], queryFn: siteRepo.overview });
  const leads = useQuery({ queryKey: ['site', 'leads'], queryFn: siteRepo.leads });
  if (ov.isLoading) return <Spinner />;
  if (ov.error) return <ErrorBox error={ov.error} onRetry={() => ov.refetch()} />;
  const c = ov.data!.counts;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Solicitações novas" value={c.newLeads} sub={`${c.leads} no total`} />
        <Stat label="Projetos publicados" value={c.projects} sub={c.demoProjects ? `${c.demoProjects} de demonstração` : 'todos reais'} />
        <Stat label="Serviços ativos" value={c.services} />
        <Stat label="Depoimentos" value={c.testimonials} sub={c.testimonials ? 'publicados' : 'seção oculta no site'} />
      </div>

      {ov.data!.pending.length > 0 && (
        <Panel title="Para completar o site">
          <p className="mb-3 text-sm text-gray-600">Itens ainda não preenchidos. O site esconde o que estiver vazio, mas cada item ajuda o cliente a confiar e a entrar em contato.</p>
          <ul className="space-y-1.5">
            {ov.data!.pending.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-gray-800">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link className="font-medium text-brand-800 hover:underline" to="/site/conteudo">
              Preencher textos e contato →
            </Link>
            <Link className="font-medium text-brand-800 hover:underline" to="/site/projetos">
              Cadastrar projetos reais →
            </Link>
          </div>
        </Panel>
      )}

      <Panel
        title="Últimas solicitações"
        actions={
          <Link to="/site/solicitacoes" className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 hover:underline">
            Ver todas <ArrowRight className="size-4" />
          </Link>
        }
      >
        {(leads.data ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma solicitação recebida pelo site ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {leads.data!.slice(0, 5).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <strong className="font-medium text-gray-900">{l.name}</strong>
                  <span className="text-gray-500"> · {l.service || 'Serviço não informado'} · {l.city}</span>
                </span>
                <span className="text-xs text-gray-500">
                  {l.status === 'novo' && <span className="mr-2 rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-800">NOVA</span>}
                  {formatDateTime(l.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
