import { useQuery } from '@tanstack/react-query';
import { ErrorBox, PageHeader, Spinner } from '../components/ui';
import { quotesRepo } from '../repositories';
import { Kanban } from './QuotesPage';

/** Produção: acompanha orçamentos aprovados até a conclusão (dados reais dos orçamentos). */
export function ProductionPage() {
  const list = useQuery({ queryKey: ['quotes', 'list', '', ''], queryFn: () => quotesRepo.list({}) });
  return (
    <>
      <PageHeader
        title="Produção"
        subtitle="Orçamentos aprovados, em produção e concluídos. Arraste os cartões para atualizar o andamento."
      />
      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <Kanban rows={(list.data ?? []).filter((q) => ['aprovado', 'em_producao', 'concluido'].includes(q.status))} statuses={['aprovado', 'em_producao', 'concluido']} />
      )}
      <p className="mt-4 text-xs text-gray-500">
        Ordens de serviço detalhadas, apontamento de horas e lista de corte ainda não estão disponíveis neste módulo.
      </p>
    </>
  );
}
