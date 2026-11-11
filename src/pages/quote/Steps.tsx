import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { ClientFormModal, formatAddress } from '../../components/ClientFormModal';
import { NumInput } from '../../components/NumInput';
import { Badge, Button, Checkbox, Empty, Input, Panel, Select, Textarea, cx } from '../../components/ui';
import type { CalcResult } from '../../calculations/engine';
import { paymentPlan } from '../../calculations/engine';
import { formatBRL, formatNumber, formatPct, roundMoney } from '../../calculations/money';
import { UNITS, safeCostPerUsageUnit, unitShort, type Unit } from '../../calculations/units';
import { newKey } from '../../lib/format';
import { MaterialFormModal } from '../MaterialsPage';
import { clientsRepo, materialsRepo, servicesRepo } from '../../repositories';
import type { QuoteDocument } from '../../schemas/quote';
import type { Company, Material } from '../../types/domain';
import { SERVICE_TYPES } from './defaults';

export interface StepProps {
  doc: QuoteDocument;
  update: (fn: (d: QuoteDocument) => void) => void;
  errors: Record<string, string>;
  calc: CalcResult;
  company: Company | null;
}

/* ------------------------------ 1. Cliente ----------------------------- */

export function ClientStep({ doc, update, errors }: StepProps) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: ['clients', q, 'ativos'], queryFn: () => clientsRepo.list(q, false) });
  const selected = useQuery({ queryKey: ['clients', 'detail', doc.clientId], queryFn: () => clientsRepo.get(doc.clientId), enabled: !!doc.clientId });

  return (
    <Panel
      title="Cliente"
      actions={
        <Button size="sm" icon={<UserPlus className="size-3.5" />} onClick={() => setCreating(true)}>
          Cadastrar novo
        </Button>
      }
    >
      {selected.data && (
        <div className="mb-4 rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm">
          <p className="font-medium text-brand-800">{selected.data.name}</p>
          <p className="text-gray-600">{[selected.data.document, selected.data.whatsapp || selected.data.phone, formatAddress(selected.data)].filter(Boolean).join(' · ')}</p>
        </div>
      )}
      <Input placeholder="Pesquisar cliente por nome, documento ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar cliente" />
      {errors.clientId && <p className="mt-1 text-xs text-red-600">{errors.clientId}</p>}
      <div className="mt-3 max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
        {list.data?.length === 0 && <Empty title="Nenhum cliente encontrado" action={<Button onClick={() => setCreating(true)}>Cadastrar cliente</Button>} />}
        {list.data?.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => update((d) => void (d.clientId = c.id))}
            className={cx('flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50', doc.clientId === c.id && 'bg-brand-50')}
          >
            <span>
              <span className="font-medium text-gray-900">{c.name}</span>
              <span className="ml-2 text-gray-500">{c.whatsapp || c.phone}</span>
            </span>
            <span className="text-xs text-gray-500">{[c.city, c.state].filter(Boolean).join('/')}</span>
          </button>
        ))}
      </div>
      <ClientFormModal open={creating} onClose={() => setCreating(false)} onSaved={(c) => update((d) => void (d.clientId = c.id))} />
    </Panel>
  );
}

/* ------------------------------ 2. Projeto ----------------------------- */

export function ProjectStep({ doc, update, errors }: StepProps) {
  const p = doc.project;
  const set = <K extends keyof QuoteDocument['project']>(k: K, v: QuoteDocument['project'][K]) => update((d) => void (d.project[k] = v));
  return (
    <Panel title="Informações do projeto">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <Input wrapClass="sm:col-span-4" label="Nome do projeto *" value={p.name} onChange={(e) => set('name', e.target.value)} error={errors['project.name']} placeholder="Ex.: Portão de correr frontal" />
        <Select wrapClass="sm:col-span-2" label="Tipo de serviço" value={p.serviceType} onChange={(e) => set('serviceType', e.target.value)}>
          <option value="">—</option>
          {SERVICE_TYPES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Textarea wrapClass="sm:col-span-6" label="Descrição (aparece na proposta)" value={p.description} onChange={(e) => set('description', e.target.value)} rows={3} />
        <NumInput label="Largura" nullable value={p.width} onChange={(n) => set('width', n)} suffix={p.dimensionUnit} />
        <NumInput label="Altura" nullable value={p.height} onChange={(n) => set('height', n)} suffix={p.dimensionUnit} />
        <NumInput label="Profundidade" nullable value={p.depth} onChange={(n) => set('depth', n)} suffix={p.dimensionUnit} />
        <Select label="Unidade" value={p.dimensionUnit} onChange={(e) => set('dimensionUnit', e.target.value as 'm' | 'cm' | 'mm')}>
          <option value="m">metros</option>
          <option value="cm">centímetros</option>
          <option value="mm">milímetros</option>
        </Select>
        <NumInput wrapClass="sm:col-span-2" label="Quantidade *" value={p.quantity} onChange={(n) => set('quantity', n ?? 0)} error={errors['project.quantity']} hint="Materiais e mão de obra são informados por unidade." />
        <Input wrapClass="sm:col-span-3" label="Local de instalação" value={p.installLocation} onChange={(e) => set('installLocation', e.target.value)} />
        <Input wrapClass="sm:col-span-3" label="Acabamento" value={p.finish} onChange={(e) => set('finish', e.target.value)} placeholder="Ex.: fundo anticorrosivo + esmalte preto fosco" />
        <Textarea wrapClass="sm:col-span-6" label="Especificações técnicas (aparece na proposta)" value={p.specifications} onChange={(e) => set('specifications', e.target.value)} rows={3} />
        <Textarea wrapClass="sm:col-span-6" label="Observações internas" value={p.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
      </div>
    </Panel>
  );
}

/* ----------------------------- 3. Materiais ---------------------------- */

export function MaterialsStep({ doc, update, errors, calc, company }: StepProps) {
  const mats = useQuery({ queryKey: ['materials', ''], queryFn: () => materialsRepo.list('') });
  const [pick, setPick] = useState('');
  const [creating, setCreating] = useState(false);
  const defWaste = company?.settings.financial.wastePct ?? 5;
  const active = useMemo(() => (mats.data ?? []).filter((m) => m.status === 'ativo'), [mats.data]);
  const groups = useMemo(() => {
    const g = new Map<string, Material[]>();
    for (const m of active) g.set(m.category || 'Sem categoria', [...(g.get(m.category || 'Sem categoria') ?? []), m]);
    return [...g.entries()];
  }, [active]);

  function add(m: Material) {
    const c = safeCostPerUsageUnit({ purchasePrice: m.purchasePrice, packQty: m.packQty, packUnit: m.packUnit, usageUnit: m.usageUnit, packWeightKg: m.weightKg });
    update((d) =>
      void d.materials.push({ key: newKey(), materialId: m.id, code: m.code, name: m.name, unit: m.usageUnit, qty: 1, unitCost: c.value ?? 0, wastePct: defWaste }),
    );
  }

  return (
    <Panel title="Materiais (por unidade do produto)" bodyClass="p-0">
      <div className="flex flex-col gap-2 border-b border-gray-200 p-3 sm:flex-row">
        <Select
          value={pick}
          onChange={(e) => {
            const m = active.find((x) => x.id === e.target.value);
            if (m) add(m);
            setPick('');
          }}
          aria-label="Adicionar material do cadastro"
          className="sm:max-w-md"
        >
          <option value="">Adicionar material do cadastro…</option>
          {groups.map(([cat, list]) => (
            <optgroup key={cat} label={cat}>
              {list.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.isDemo ? ' (exemplo)' : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button size="md" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Novo material
          </Button>
          <Button
            size="md"
            variant="ghost"
            onClick={() => update((d) => void d.materials.push({ key: newKey(), materialId: null, code: '', name: '', unit: 'un', qty: 1, unitCost: 0, wastePct: defWaste }))}
          >
            Item avulso
          </Button>
        </div>
      </div>
      {doc.materials.length === 0 ? (
        <Empty title="Nenhum material adicionado">Selecione materiais do cadastro. O custo por unidade de uso é calculado automaticamente a partir do preço de compra.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl tbl-cards md:min-w-[760px]">
            <thead>
              <tr>
                <th>Material</th>
                <th className="w-24 text-right">Qtde.</th>
                <th className="w-24">Un.</th>
                <th className="w-32 text-right">Custo/un.</th>
                <th className="w-24 text-right">Desperd. %</th>
                <th className="w-32 text-right">Subtotal</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {doc.materials.map((l, i) => (
                <tr key={l.key}>
                  <td className="c-full">
                    <Input value={l.name} onChange={(e) => update((d) => void (d.materials[i].name = e.target.value))} error={errors[`materials.${i}.name`]} aria-label="Material" />
                  </td>
                  <td className="c-half">
                    <NumInput ariaLabel="Quantidade" value={l.qty} onChange={(n) => update((d) => void (d.materials[i].qty = n ?? 0))} />
                  </td>
                  <td className="c-half">
                    <Select value={l.unit} onChange={(e) => update((d) => void (d.materials[i].unit = e.target.value as Unit))} aria-label="Unidade" disabled={!!l.materialId}>
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {unitShort(u)}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="c-half">
                    <NumInput ariaLabel="Custo unitário" value={l.unitCost} onChange={(n) => update((d) => void (d.materials[i].unitCost = n ?? 0))} />
                  </td>
                  <td className="c-half">
                    <NumInput ariaLabel="Desperdício" value={l.wastePct} onChange={(n) => update((d) => void (d.materials[i].wastePct = n ?? 0))} error={errors[`materials.${i}.wastePct`]} />
                  </td>
                  <td className="c-grow num text-right font-medium md:font-normal">
                    <div>
                      {formatBRL(calc.materialLines[i]?.total ?? 0)}
                      {(calc.materialLines[i]?.waste ?? 0) > 0 && <span className="block text-[11px] font-normal text-gray-500">+{formatBRL(calc.materialLines[i].waste)} desp.</span>}
                    </div>
                  </td>
                  <td className="c-actions">
                    <Button size="sm" variant="ghost" title="Remover" aria-label="Remover material" onClick={() => update((d) => void d.materials.splice(i, 1))} icon={<Trash2 className="size-3.5 text-red-600" />} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="text-right text-[13px] text-gray-600 max-md:block">
                  Materiais {formatBRL(calc.materialsCost)} + desperdício {formatBRL(calc.wasteCost)}
                  {doc.project.quantity !== 1 && ` (× ${formatNumber(doc.project.quantity)} unidades)`}
                </td>
                <td className="num text-right font-semibold">{formatBRL(calc.materialsCost + calc.wasteCost)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <MaterialFormModal open={creating} material={null} onClose={() => setCreating(false)} onSaved={(m) => add(m)} />
    </Panel>
  );
}

/* ---------------------------- 4. Mão de obra --------------------------- */

export function LaborStep({ doc, update, errors, calc, company }: StepProps) {
  const svcs = useQuery({ queryKey: ['services'], queryFn: servicesRepo.list });
  const [pick, setPick] = useState('');
  const active = (svcs.data ?? []).filter((s) => s.status === 'ativo');
  return (
    <Panel title="Mão de obra e serviços (por unidade do produto)" bodyClass="p-0">
      <div className="flex flex-col gap-2 border-b border-gray-200 p-3 sm:flex-row">
        <Select
          value={pick}
          className="sm:max-w-md"
          aria-label="Adicionar serviço"
          onChange={(e) => {
            const s = active.find((x) => x.id === e.target.value);
            if (s)
              update((d) =>
                void d.labor.push({
                  key: newKey(),
                  serviceId: s.id,
                  name: s.name,
                  mode: s.mode,
                  qty: s.mode === 'hour' ? s.estimatedHours || 1 : 1,
                  rate: s.mode === 'hour' ? s.hourlyCost : s.fixedPrice,
                }),
              );
            setPick('');
          }}
        >
          <option value="">Adicionar serviço do cadastro…</option>
          {active.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.mode === 'hour' ? `${formatBRL(s.hourlyCost)}/h` : formatBRL(s.fixedPrice)}
              {s.isDemo ? ' (exemplo)' : ''}
            </option>
          ))}
        </Select>
        <Button
          variant="ghost"
          icon={<Plus className="size-4" />}
          onClick={() => update((d) => void d.labor.push({ key: newKey(), serviceId: null, name: '', mode: 'hour', qty: 1, rate: company?.settings.financial.hourlyCost ?? 0 }))}
        >
          Serviço avulso
        </Button>
      </div>
      {doc.labor.length === 0 ? (
        <Empty title="Nenhum serviço adicionado">Ex.: 4 horas de soldagem × R$ 35,00 = R$ 140,00.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl tbl-cards md:min-w-[680px]">
            <thead>
              <tr>
                <th>Serviço</th>
                <th className="w-32">Cobrança</th>
                <th className="w-28 text-right">Horas/Qtde.</th>
                <th className="w-32 text-right">Valor</th>
                <th className="w-32 text-right">Subtotal</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {doc.labor.map((l, i) => (
                <tr key={l.key}>
                  <td className="c-full">
                    <Input value={l.name} onChange={(e) => update((d) => void (d.labor[i].name = e.target.value))} error={errors[`labor.${i}.name`]} aria-label="Serviço" />
                  </td>
                  <td className="c-full">
                    <Select value={l.mode} onChange={(e) => update((d) => void (d.labor[i].mode = e.target.value as 'hour' | 'fixed'))} aria-label="Cobrança">
                      <option value="hour">Por hora</option>
                      <option value="fixed">Preço fixo</option>
                    </Select>
                  </td>
                  <td className="c-half">
                    <NumInput ariaLabel="Quantidade" value={l.qty} onChange={(n) => update((d) => void (d.labor[i].qty = n ?? 0))} suffix={l.mode === 'hour' ? 'h' : ''} />
                  </td>
                  <td className="c-half">
                    <NumInput ariaLabel="Valor" value={l.rate} onChange={(n) => update((d) => void (d.labor[i].rate = n ?? 0))} />
                  </td>
                  <td className="c-grow num text-right font-medium md:font-normal">{formatBRL(calc.laborLines[i] ?? 0)}</td>
                  <td className="c-actions">
                    <Button size="sm" variant="ghost" title="Remover" aria-label="Remover serviço" onClick={() => update((d) => void d.labor.splice(i, 1))} icon={<Trash2 className="size-3.5 text-red-600" />} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="text-right text-[13px] text-gray-600 max-md:block">
                  Total de mão de obra{doc.project.quantity !== 1 && ` (× ${formatNumber(doc.project.quantity)} unidades)`}
                </td>
                <td className="num text-right font-semibold">{formatBRL(calc.laborCost)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ----------------------------- 5. Despesas ----------------------------- */

const KIND_LABEL = { indireto: 'Despesa indireta', transporte: 'Transporte', outro: 'Outra despesa' } as const;

export function ExtrasStep({ doc, update, errors, calc }: StepProps) {
  return (
    <div className="space-y-4">
      <Panel title="Custos indiretos">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumInput
            label="Rateio de custos indiretos"
            suffix="%"
            value={doc.pricing.overheadPct}
            onChange={(n) => update((d) => void (d.pricing.overheadPct = n ?? 0))}
            error={errors['pricing.overheadPct']}
            hint="Aluguel, energia, administrativo… aplicado sobre o custo direto."
          />
          <div className="text-sm text-gray-600 sm:col-span-2 sm:pt-6">
            Custo direto {formatBRL(calc.directCost)} × {formatPct(doc.pricing.overheadPct)} = <strong className="num text-gray-900">{formatBRL(calc.overheadPctCost)}</strong>
            <p className="mt-1 text-xs text-gray-500">Para evitar dupla contagem, não lance como despesa abaixo um custo que já está coberto por este percentual.</p>
          </div>
        </div>
      </Panel>
      <Panel
        title="Despesas da obra (valor total, não multiplicado pela quantidade)"
        bodyClass="p-0"
        actions={
          <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => update((d) => void d.extras.push({ key: newKey(), description: '', kind: 'transporte', amount: 0 }))}>
            Adicionar despesa
          </Button>
        }
      >
        {doc.extras.length === 0 ? (
          <Empty title="Nenhuma despesa adicional">Frete, deslocamento, aluguel de equipamento, ART etc.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl tbl-cards md:min-w-[560px]">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th className="w-44">Tipo</th>
                  <th className="w-36 text-right">Valor</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {doc.extras.map((x, i) => (
                  <tr key={x.key}>
                    <td className="c-full">
                      <Input value={x.description} onChange={(e) => update((d) => void (d.extras[i].description = e.target.value))} error={errors[`extras.${i}.description`]} aria-label="Descrição" />
                    </td>
                    <td className="c-half">
                      <Select value={x.kind} onChange={(e) => update((d) => void (d.extras[i].kind = e.target.value as keyof typeof KIND_LABEL))} aria-label="Tipo">
                        {Object.entries(KIND_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="c-half">
                      <NumInput ariaLabel="Valor" value={x.amount} onChange={(n) => update((d) => void (d.extras[i].amount = n ?? 0))} />
                    </td>
                    <td className="c-actions">
                      <Button size="sm" variant="ghost" title="Remover" aria-label="Remover despesa" onClick={() => update((d) => void d.extras.splice(i, 1))} icon={<Trash2 className="size-3.5 text-red-600" />} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------- 6. Impostos e margem ------------------------ */

export function PricingStep({ doc, update, errors, calc }: StepProps) {
  const p = doc.pricing;
  const set = (k: 'taxPct' | 'feePct' | 'commissionPct' | 'marginPct', n: number | null) => update((d) => void (d.pricing[k] = n ?? 0));
  const sum = p.taxPct + p.feePct + p.commissionPct + p.marginPct;
  return (
    <Panel title="Impostos, taxas, comissão e margem">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumInput label="Impostos" suffix="%" value={p.taxPct} onChange={(n) => set('taxPct', n)} error={errors['pricing.taxPct']} />
        <NumInput label="Taxas (cartão, boleto)" suffix="%" value={p.feePct} onChange={(n) => set('feePct', n)} error={errors['pricing.feePct']} />
        <NumInput label="Comissão" suffix="%" value={p.commissionPct} onChange={(n) => set('commissionPct', n)} error={errors['pricing.commissionPct']} />
        <NumInput label="Margem de lucro" suffix="%" value={p.marginPct} onChange={(n) => set('marginPct', n)} error={errors['pricing.marginPct']} />
      </div>
      <div className={cx('mt-4 rounded-md border px-4 py-3 text-sm', sum >= 100 ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-200 bg-gray-50 text-gray-700')}>
        <p className="font-medium">Preço de venda = Custo total ÷ (1 − impostos − taxas − comissão − margem)</p>
        <p className="num mt-1">
          {formatBRL(calc.totalCost)} ÷ (1 − {formatPct(sum)}) = <strong>{calc.valid ? formatBRL(calc.suggestedPrice) : '—'}</strong>
        </p>
        {sum >= 100 && <p className="mt-1">A soma dos percentuais deve ser menor que 100%.</p>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <NumInput
          label="Preço final manual (opcional)"
          suffix="R$"
          nullable
          value={p.manualPrice}
          onChange={(n) => update((d) => void (d.pricing.manualPrice = n && n > 0 ? n : null))}
          hint="Deixe vazio para usar o preço sugerido."
        />
        <div className="text-sm sm:col-span-2 sm:pt-6">
          {p.manualPrice ? (
            <span>
              Preço manual aplicado. Margem efetiva: <strong className={cx('num', calc.effectiveMarginPct < 0 && 'text-red-700')}>{formatPct(calc.effectiveMarginPct)}</strong>
              {calc.profit < 0 && <Badge tone="red">Abaixo do custo</Badge>}
              <Button size="sm" variant="ghost" className="ml-2" onClick={() => update((d) => void (d.pricing.manualPrice = null))}>
                Usar sugerido
              </Button>
            </span>
          ) : (
            <span className="text-gray-500">Usando preço sugerido. Arredondar para: </span>
          )}
          {!p.manualPrice && calc.valid && (
            <span className="ml-1 inline-flex gap-1">
              {[10, 50, 100].map((step) => (
                <Button key={step} size="sm" onClick={() => update((d) => void (d.pricing.manualPrice = Math.ceil(calc.suggestedPrice / step) * step))}>
                  {formatBRL(Math.ceil(calc.suggestedPrice / step) * step)}
                </Button>
              ))}
            </span>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------ 7. Condições comerciais ---------------------- */

export function CommercialStep({ doc, update, calc }: StepProps) {
  const c = doc.commercial;
  const set = <K extends keyof QuoteDocument['commercial']>(k: K, v: QuoteDocument['commercial'][K]) => update((d) => void (d.commercial[k] = v));
  const plan = paymentPlan(calc.finalPrice, c.downPaymentPct, c.installments);
  return (
    <Panel title="Condições comerciais">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumInput label="Validade da proposta" suffix="dias" value={c.validityDays} onChange={(n) => set('validityDays', Math.round(n ?? 0))} />
        <NumInput label="Prazo de fabricação" suffix="dias" value={c.fabricationDays} onChange={(n) => set('fabricationDays', Math.round(n ?? 0))} />
        <NumInput label="Prazo de instalação" suffix="dias" value={c.installationDays} onChange={(n) => set('installationDays', Math.round(n ?? 0))} />
        <Input label="Responsável" value={c.responsible} onChange={(e) => set('responsible', e.target.value)} />
        <NumInput label="Entrada" suffix="%" value={c.downPaymentPct} onChange={(n) => set('downPaymentPct', Math.min(100, Math.max(0, n ?? 0)))} />
        <NumInput label="Parcelas do saldo" value={c.installments} onChange={(n) => set('installments', Math.round(Math.max(0, n ?? 0)))} />
        <div className="col-span-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Entrada <strong className="num">{formatBRL(plan.downPayment)}</strong>
          {plan.installments > 0 && plan.remaining > 0 && (
            <>
              {' '}
              + {plan.installments}× <strong className="num">{formatBRL(plan.installmentValue)}</strong>
              {plan.lastInstallmentValue !== plan.installmentValue && <span className="text-xs text-gray-500"> (última {formatBRL(plan.lastInstallmentValue)})</span>}
            </>
          )}
        </div>
        <Textarea wrapClass="col-span-2 sm:col-span-4" label="Condições de pagamento" value={c.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} rows={2} />
        <Textarea wrapClass="col-span-2 sm:col-span-4" label="Garantia" value={c.warranty} onChange={(e) => set('warranty', e.target.value)} rows={2} />
        <Textarea wrapClass="col-span-2 sm:col-span-4" label="Observações da proposta" value={c.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
        <div className="col-span-2 sm:col-span-4">
          <Checkbox
            label="Exibir itens detalhados na proposta"
            hint="Mostra materiais e serviços com quantidades e valores de venda proporcionais. Desmarcado: apenas o valor global. Custos internos nunca aparecem."
            checked={c.showItemized}
            onChange={(v) => set('showItemized', v)}
          />
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------ 8. Revisão ----------------------------- */

export function ReviewStep({ doc, calc, goTo }: StepProps & { goTo: (i: number) => void }) {
  const client = useQuery({ queryKey: ['clients', 'detail', doc.clientId], queryFn: () => clientsRepo.get(doc.clientId), enabled: !!doc.clientId });
  const Section = ({ title, step, children }: { title: string; step: number; children: React.ReactNode }) => (
    <div className="border-b border-gray-100 py-3 last:border-0">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        <button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => goTo(step)}>
          Editar
        </button>
      </div>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
  const p = doc.project;
  const dims = [p.width, p.height, p.depth].filter((x) => x != null).map((x) => formatNumber(x as number, 3));
  return (
    <Panel title="Revisão">
      <Section title="Cliente" step={0}>
        {client.data?.name ?? <span className="text-red-600">Nenhum cliente selecionado</span>}
      </Section>
      <Section title="Projeto" step={1}>
        <p className="font-medium">{p.name || <span className="text-red-600">Sem nome</span>}</p>
        <p className="text-gray-600">
          {[p.serviceType, dims.length ? `${dims.join(' × ')} ${p.dimensionUnit}` : '', `${formatNumber(p.quantity)} un.`, p.finish].filter(Boolean).join(' · ')}
        </p>
      </Section>
      <Section title="Composição" step={2}>
        {doc.materials.length} material(is), {doc.labor.length} serviço(s), {doc.extras.length} despesa(s)
      </Section>
      <Section title="Precificação" step={5}>
        Impostos {formatPct(doc.pricing.taxPct)} · Taxas {formatPct(doc.pricing.feePct)} · Comissão {formatPct(doc.pricing.commissionPct)} · Margem {formatPct(doc.pricing.marginPct)}
        {doc.pricing.manualPrice ? ` · Preço manual ${formatBRL(doc.pricing.manualPrice)}` : ''}
      </Section>
      <Section title="Condições" step={6}>
        Validade {doc.commercial.validityDays} dias · Fabricação {doc.commercial.fabricationDays} dias · Instalação {doc.commercial.installationDays} dias · Entrada {formatPct(doc.commercial.downPaymentPct, 0)}
        {doc.commercial.installments > 0 && ` + ${doc.commercial.installments} parcela(s)`} · {doc.commercial.showItemized ? 'Itens detalhados' : 'Valor global'}
      </Section>
      <div className="mt-3 flex items-baseline justify-between rounded-md bg-gray-900 px-4 py-3 text-white">
        <span className="text-sm">Valor da proposta</span>
        <span className="num text-xl font-semibold">{formatBRL(calc.finalPrice)}</span>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Lucro estimado {formatBRL(calc.profit)} ({formatPct(calc.effectiveMarginPct)}) sobre custo de {formatBRL(calc.totalCost)}. Unitário {formatBRL(roundMoney(calc.unitPrice))}.
      </p>
    </Panel>
  );
}
