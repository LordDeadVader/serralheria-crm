import { Link } from 'react-router-dom';
import { PageHeader, Panel } from '../components/ui';

/** Módulo ainda não implementado — exibido de forma transparente, sem simular funcionalidades. */
export function TemplatesPage() {
  return (
    <>
      <PageHeader title="Projetos e modelos" subtitle="Biblioteca de projetos-padrão (portões, grades, corrimãos) para agilizar orçamentos." />
      <Panel>
        <p className="text-sm font-medium text-gray-900">Módulo em desenvolvimento</p>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          A biblioteca de modelos com composição parametrizada por dimensões ainda não está disponível. Enquanto isso, use a função{' '}
          <strong>Duplicar</strong> em um orçamento existente para reaproveitar sua composição de materiais e mão de obra como modelo.
        </p>
        <Link to="/orcamentos" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
          Ir para orçamentos
        </Link>
      </Panel>
    </>
  );
}
