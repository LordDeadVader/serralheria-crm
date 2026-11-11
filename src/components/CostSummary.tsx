import type { CalcResult } from '../calculations/engine';
import { formatBRL, formatPct } from '../calculations/money';
import { cx } from './ui';

/** Painel interno de custos — NUNCA é usado no PDF do cliente. */
export function CostSummary({ r, quantity, compact }: { r: CalcResult; quantity: number; compact?: boolean }) {
  const row = (label: string, value: string, opts: { strong?: boolean; muted?: boolean; tone?: 'neg' | 'pos' } = {}) => (
    <div className={cx('flex items-baseline justify-between gap-3 py-1', opts.strong && 'font-semibold text-gray-900', opts.muted && 'text-gray-500')}>
      <span className="text-[13px]">{label}</span>
      <span className={cx('num text-[13px]', opts.tone === 'neg' && 'text-red-700', opts.tone === 'pos' && 'text-emerald-700')}>{value}</span>
    </div>
  );
  return (
    <div className="text-gray-700">
      {row('Materiais', formatBRL(r.materialsCost))}
      {row('Desperdício', formatBRL(r.wasteCost))}
      {row('Mão de obra', formatBRL(r.laborCost))}
      {row('Custos indiretos', formatBRL(r.overheadCost))}
      {r.transportCost > 0 && row('Transporte', formatBRL(r.transportCost))}
      {r.otherCost > 0 && row('Outras despesas', formatBRL(r.otherCost))}
      <div className="my-1 border-t border-gray-200" />
      {row('Custo total', formatBRL(r.totalCost), { strong: true })}
      {!compact && row(`Impostos, taxas e comissão`, formatBRL(r.taxes + r.fees + r.commission), { muted: true })}
      <div className="my-1 border-t border-gray-200" />
      {row(r.isManualPrice ? 'Preço de venda (manual)' : 'Preço de venda', formatBRL(r.finalPrice), { strong: true })}
      {r.isManualPrice && row('Preço sugerido', formatBRL(r.suggestedPrice), { muted: true })}
      {quantity > 1 && row('Preço por unidade', formatBRL(r.unitPrice), { muted: true })}
      {row('Lucro estimado', formatBRL(r.profit), { tone: r.profit < 0 ? 'neg' : 'pos' })}
      {row('Margem efetiva', formatPct(r.effectiveMarginPct), { tone: r.effectiveMarginPct < 0 ? 'neg' : undefined })}
      {!r.valid && (
        <ul className="mt-2 space-y-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {r.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
