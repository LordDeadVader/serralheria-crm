import { STATUS_LABEL, type QuoteStatus } from '../types/domain';
import { Badge } from './ui';

const TONE: Record<QuoteStatus, Parameters<typeof Badge>[0]['tone']> = {
  rascunho: 'gray',
  em_elaboracao: 'gray',
  enviado: 'blue',
  em_negociacao: 'amber',
  aprovado: 'green',
  reprovado: 'red',
  cancelado: 'red',
  em_producao: 'violet',
  concluido: 'brand',
};

export function StatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={TONE[status]}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export const DemoBadge = () => <Badge tone="amber">Exemplo</Badge>;
