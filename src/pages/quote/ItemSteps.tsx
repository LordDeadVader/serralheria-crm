import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, MapPin, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { NumInput } from '../../components/NumInput';
import { DurationInput } from '../../components/DurationInput';
import { useFeedback } from '../../components/feedback';
import { Badge, Button, Checkbox, Empty, Input, Panel, Select, cx } from '../../components/ui';
import { formatBRL, formatNumber, formatPct } from '../../calculations/money';
import { laborUnits } from '../../calculations/quote';
import { travelCosts } from '../../calculations/travel';
import { UNITS, unitShort, type Unit } from '../../calculations/units';
import { applyTemplate, materialUnitCost } from '../../lib/applyTemplate';
import { formatDuration, newKey } from '../../lib/format';
import { mapsRouteUrl, routeDistance } from '../../lib/route';
import { MaterialFormModal } from '../MaterialsPage';
import { clientsRepo, materialsRepo, servicesRepo, templatesRepo } from '../../repositories';
import type { QuoteDocument } from '../../schemas/quote';
import type { Material, Template } from '../../types/domain';
import type { StepProps } from './Steps';

/** Linhas alternadas com leve diferença de cor para separar visualmente os itens. */
export const zebra = (i: number) => (i % 2 ? 'bg-slate-50' : 'bg-white');

/* --------------------------- Modelos e kits --------------------------- */

function useCatalog() {
  const mats = useQuery({ queryKey: ['materials', ''], queryFn: () => materialsRepo.list('') });
  const svcs = useQuery({ queryKey: ['services'], queryFn: servicesRepo.list });
  const tpls = useQuery({ queryKey: ['templates'], queryFn: templatesRepo.list });
  return { mats, svcs, tpls };
}

/**
 * Aplica um modelo (serviço predefinido) ou kit ao orçamento.
 * Projeto: preenche descrição/especificações vazias e adiciona materiais, insumos e mão de obra.
 * Kit: adiciona os itens multiplicados pela quantidade.
 */
export function TemplatePicker({ doc, update, company, kind }: Pick<StepProps, 'doc' | 'update' | 'company'> & { kind: 'projeto' | 'kit' }) {
  const fb = useFeedback();
  const { mats, svcs, tpls } = useCatalog();
  const [id, setId] = useState('');
  const [mult, setMult] = useState(1);
  const list = (tpls.data ?? []).filter((t) => (kind === 'kit' ? true : t.kind === 'projeto'));
  const ready = mats.data && svcs.data;

  async function apply(t: Template) {
    if (kind === 'projeto' && (doc.materials.length || doc.labor.length)) {
      const ok = await fb.confirm({
        title: `Usar o modelo "${t.name}"`,
        message: 'Os itens do modelo serão adicionados no topo das listas, junto com os que já estão no orçamento. Campos de texto já preenchidos não são substituídos.',
        confirmLabel: 'Adicionar itens',
      });
      if (!ok) return;
    }
    // Preços sempre atuais: busca o cadastro de novo antes de aplicar.
    const [fm, fs] = await Promise.all([mats.refetch(), svcs.refetch()]);
    let r: ReturnType<typeof applyTemplate> | null = null;
    update((d) => {
      r = applyTemplate(d, t, {
        materials: fm.data ?? mats.data ?? [],
        services: fs.data ?? svcs.data ?? [],
        defaultWastePct: company?.settings.financial.wastePct ?? 5,
        defaultHourlyCost: company?.settings.financial.hourlyCost ?? 0,
      }, { multiplier: kind === 'kit' ? mult : 1, asProject: kind === 'projeto' });
    });
    const res = r as ReturnType<typeof applyTemplate> | null;
    if (!res) return;
    const parts = [`${res.materials} material(is)`, `${res.labor} serviço(s)`, res.extras ? `${res.extras} despesa(s)` : ''].filter(Boolean).join(', ');
    if (res.missingPrices.length) fb.error(`${t.name}: ${parts} adicionados. ${res.missingPrices.length} item(ns) sem preço no cadastro — destacados em amarelo para preencher.`);
    else fb.ok(`${t.name}: ${parts} adicionados.`);
    setId('');
    setMult(1);
  }

  if (!list.length) return null;
  return (
    <div className={cx('flex flex-col gap-2 sm:flex-row sm:items-end', kind === 'projeto' && 'rounded-md border border-brand-200 bg-brand-50/60 p-3')}>
      <Select
        wrapClass="flex-1"
        label={kind === 'projeto' ? 'Começar a partir de um serviço predefinido' : 'Adicionar kit / modelo'}
        hint={kind === 'projeto' ? 'Preenche a descrição e já puxa materiais, insumos e mão de obra. Depois é só ajustar.' : undefined}
        value={id}
        onChange={(e) => setId(e.target.value)}
        disabled={!ready}
      >
        <option value="">{kind === 'projeto' ? 'Escolha um serviço predefinido…' : 'Escolha um kit…'}</option>
        {(kind === 'kit' ? (['kit', 'projeto'] as const) : (['projeto'] as const)).map((k) => (
          <optgroup key={k} label={k === 'kit' ? 'Kits de insumos' : 'Serviços predefinidos'}>
            {list
              .filter((t) => t.kind === k)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </optgroup>
        ))}
      </Select>
      {kind === 'kit' && <NumInput wrapClass="sm:w-24" label="Quantidade" value={mult} onChange={(n) => setMult(n && n > 0 ? n : 1)} />}
      <Button
        variant={kind === 'projeto' ? 'primary' : 'secondary'}
        icon={<PackagePlus className="size-4" />}
        disabled={!id || !ready}
        onClick={() => {
          const t = list.find((x) => x.id === id);
          if (t) void apply(t);
        }}
      >
        {kind === 'projeto' ? 'Usar modelo' : 'Adicionar'}
      </Button>
    </div>
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
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [active]);

  const add = (m: Material) =>
    update((d) => void d.materials.unshift({ key: newKey(), materialId: m.id, code: m.code, name: m.name, unit: m.usageUnit, qty: 1, unitCost: materialUnitCost(m), wastePct: defWaste }));

  return (
    <Panel title="Materiais e insumos (por unidade do produto)" bodyClass="p-0">
      <div className="space-y-3 border-b border-gray-200 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
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
                {list.map((m) => {
                  const c = materialUnitCost(m);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} — {c ? `${formatBRL(c)}/${unitShort(m.usageUnit)}` : 'sem preço'}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Novo material
            </Button>
            <Button variant="ghost" onClick={() => update((d) => void d.materials.unshift({ key: newKey(), materialId: null, code: '', name: '', unit: 'un', qty: 1, unitCost: 0, wastePct: defWaste }))}>
              Item avulso
            </Button>
          </div>
        </div>
        <TemplatePicker doc={doc} update={update} company={company} kind="kit" />
      </div>
      {doc.materials.length === 0 ? (
        <Empty title="Nenhum material adicionado">Selecione do cadastro ou adicione um kit (ex.: holofote com braço, pintura por m²). Novos itens entram no topo da lista.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl tbl-cards md:min-w-[720px]">
            <thead>
              <tr>
                <th className="min-w-[12rem]">Material</th>
                <th className="w-36 text-right">Qtde.</th>
                <th className="w-32 text-right">Custo/un.</th>
                <th className="w-24 text-right">Desperd. %</th>
                <th className="w-28 text-right">Subtotal</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {doc.materials.map((l, i) => {
                const noPrice = !(l.unitCost > 0);
                return (
                  <tr key={l.key} className={zebra(i)}>
                    <td className="c-full">
                      {l.materialId ? (
                        <p className="text-sm font-medium leading-snug text-gray-900" title="Material do cadastro">
                          {l.name}
                        </p>
                      ) : (
                        <Input value={l.name} onChange={(e) => update((d) => void (d.materials[i].name = e.target.value))} error={errors[`materials.${i}.name`]} aria-label="Material" placeholder="Nome do item avulso" />
                      )}
                    </td>
                    <td className="c-half">
                      {l.materialId ? (
                        <NumInput ariaLabel="Quantidade" value={l.qty} onChange={(n) => update((d) => void (d.materials[i].qty = n ?? 0))} suffix={unitShort(l.unit)} />
                      ) : (
                        <div className="grid grid-cols-[1fr_4.5rem] gap-1">
                          <NumInput ariaLabel="Quantidade" value={l.qty} onChange={(n) => update((d) => void (d.materials[i].qty = n ?? 0))} />
                          <Select value={l.unit} onChange={(e) => update((d) => void (d.materials[i].unit = e.target.value as Unit))} aria-label="Unidade">
                            {UNITS.map((u) => (
                              <option key={u} value={u}>
                                {unitShort(u)}
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}
                    </td>
                    <td className="c-half">
                      <NumInput
                        ariaLabel="Custo unitário"
                        value={l.unitCost}
                        onChange={(n) => update((d) => void (d.materials[i].unitCost = n ?? 0))}
                        className={noPrice ? 'border-amber-400! bg-amber-50!' : ''}
                        suffix={`/${unitShort(l.unit)}`}
                      />
                    </td>
                    <td className="c-half">
                      <NumInput ariaLabel="Desperdício" value={l.wastePct} onChange={(n) => update((d) => void (d.materials[i].wastePct = n ?? 0))} error={errors[`materials.${i}.wastePct`]} suffix="%" />
                    </td>
                    <td className="c-grow num text-right font-medium md:font-normal">
                      <div>
                        {noPrice ? <Badge tone="amber">Sem preço</Badge> : formatBRL(calc.materialLines[i]?.total ?? 0)}
                        {(calc.materialLines[i]?.waste ?? 0) > 0 && <span className="block text-[11px] font-normal text-gray-500">+{formatBRL(calc.materialLines[i].waste)} desp.</span>}
                      </div>
                    </td>
                    <td className="c-actions">
                      <Button size="sm" variant="ghost" title="Remover" aria-label="Remover material" onClick={() => update((d) => void d.materials.splice(i, 1))} icon={<Trash2 className="size-3.5 text-red-600" />} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="text-right text-[13px] text-gray-600 max-md:block">
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
  const groups = useMemo(() => {
    const g = new Map<string, typeof active>();
    for (const s of active) g.set(s.category || 'Outros', [...(g.get(s.category || 'Outros') ?? []), s]);
    return [...g.entries()];
  }, [active]);
  const defRate = company?.settings.financial.hourlyCost ?? 0;

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
              update(
                (d) =>
                  void d.labor.unshift({
                    key: newKey(),
                    serviceId: s.id,
                    name: s.name,
                    mode: s.mode,
                    qty: s.mode === 'hour' ? s.estimatedHours || 1 : 1,
                    workers: 1,
                    rate: s.mode === 'hour' ? s.hourlyCost || defRate : s.fixedPrice,
                  }),
              );
            setPick('');
          }}
        >
          <option value="">Adicionar serviço / mão de obra do cadastro…</option>
          {groups.map(([cat, list]) => (
            <optgroup key={cat} label={cat}>
              {list.map((s) => {
                const v = s.mode === 'hour' ? s.hourlyCost : s.fixedPrice;
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} — {v ? (s.mode === 'hour' ? `${formatBRL(v)}/h` : formatBRL(v)) : s.mode === 'hour' && defRate ? `${formatBRL(defRate)}/h (padrão)` : 'sem valor'}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </Select>
        <Button variant="ghost" icon={<Plus className="size-4" />} onClick={() => update((d) => void d.labor.unshift({ key: newKey(), serviceId: null, name: '', mode: 'hour', qty: 1, workers: 1, rate: defRate }))}>
          Serviço avulso
        </Button>
      </div>
      {doc.labor.length === 0 ? (
        <Empty title="Nenhum serviço adicionado">Ex.: 2 h × 2 funcionários × R$ 50,00/h = R$ 200,00. Novos itens entram no topo da lista.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl tbl-cards md:min-w-[860px]">
            <thead>
              <tr>
                <th className="min-w-[11rem]">Serviço</th>
                <th className="w-36 min-w-[8.5rem]">Cobrança</th>
                <th className="w-44 min-w-[10rem] text-right">Tempo</th>
                <th className="w-20 text-right">Func.</th>
                <th className="w-32 min-w-[7rem] text-right">Valor</th>
                <th className="w-36 text-right">Subtotal</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {doc.labor.map((l, i) => {
                const hour = l.mode === 'hour';
                return (
                  <tr key={l.key} className={zebra(i)}>
                    <td className="c-full">
                      {l.serviceId ? (
                        <p className="text-sm font-medium leading-snug text-gray-900" title="Serviço do cadastro">
                          {l.name}
                        </p>
                      ) : (
                        <Input value={l.name} onChange={(e) => update((d) => void (d.labor[i].name = e.target.value))} error={errors[`labor.${i}.name`]} aria-label="Serviço" placeholder="Nome do serviço avulso" />
                      )}
                    </td>
                    <td className="c-full">
                      <Select
                        value={l.mode}
                        aria-label="Cobrança"
                        onChange={(e) =>
                          update((d) => {
                            const ln = d.labor[i];
                            ln.mode = e.target.value as 'hour' | 'fixed';
                            if (ln.mode === 'fixed') {
                              ln.qty = 1;
                              ln.workers = 1;
                            }
                          })
                        }
                      >
                        <option value="hour">Por hora</option>
                        <option value="fixed">Preço fixo</option>
                      </Select>
                    </td>
                    {hour ? (
                      <>
                        <td className="c-half">
                          <DurationInput ariaLabel="Tempo por funcionário" value={l.qty} onChange={(h) => update((d) => void (d.labor[i].qty = h))} />
                        </td>
                        <td className="c-half">
                          <NumInput ariaLabel="Funcionários" value={l.workers ?? 1} onChange={(n) => update((d) => void (d.labor[i].workers = Math.max(1, Math.round(n ?? 1))))} error={errors[`labor.${i}.workers`]} />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="max-md:hidden text-right text-gray-400">—</td>
                        <td className="max-md:hidden text-right text-gray-400">—</td>
                      </>
                    )}
                    <td className={hour ? 'c-half' : 'c-full'}>
                      <NumInput
                        ariaLabel={hour ? 'Valor por hora' : 'Valor do serviço'}
                        value={l.rate}
                        onChange={(n) => update((d) => void (d.labor[i].rate = n ?? 0))}
                        suffix={hour ? 'R$/h' : 'R$'}
                        className={!(l.rate > 0) ? 'border-amber-400! bg-amber-50!' : ''}
                      />
                    </td>
                    <td className="c-grow num text-right font-medium md:font-normal">
                      <div>
                        {formatBRL(calc.laborLines[i] ?? 0)}
                        {hour && (
                          <span className="block text-[11px] font-normal text-gray-500">
                            {formatDuration(l.qty)} × {l.workers ?? 1} func. = {formatDuration(laborUnits(l))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="c-actions">
                      <Button size="sm" variant="ghost" title="Remover" aria-label="Remover serviço" onClick={() => update((d) => void d.labor.splice(i, 1))} icon={<Trash2 className="size-3.5 text-red-600" />} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="text-right text-[13px] text-gray-600 max-md:block">
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

export function ExtrasStep(props: StepProps) {
  const { doc, update, errors, calc } = props;
  return (
    <div className="space-y-4">
      <TravelPanel {...props} />
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
        title="Outras despesas da obra (valor total, não multiplicado pela quantidade)"
        bodyClass="p-0"
        actions={
          <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => update((d) => void d.extras.unshift({ key: newKey(), description: '', kind: 'outro', amount: 0 }))}>
            Adicionar despesa
          </Button>
        }
      >
        {doc.extras.length === 0 ? (
          <Empty title="Nenhuma despesa adicional">Frete de material, locação de andaime ou plataforma, ART etc. O deslocamento da equipe é calculado no painel acima.</Empty>
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
                  <tr key={x.key} className={zebra(i)}>
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
                      <NumInput ariaLabel="Valor" value={x.amount} onChange={(n) => update((d) => void (d.extras[i].amount = n ?? 0))} suffix="R$" />
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

/* ----------------------------- Deslocamento ---------------------------- */

function TravelPanel({ doc, update, company }: StepProps) {
  const fb = useFeedback();
  const t = doc.travel;
  const c = travelCosts(t);
  const [busy, setBusy] = useState(false);
  const client = useQuery({ queryKey: ['clients', 'detail', doc.clientId], queryFn: () => clientsRepo.get(doc.clientId), enabled: !!doc.clientId && t.enabled });
  const set = <K extends keyof QuoteDocument['travel']>(k: K, v: QuoteDocument['travel'][K]) => update((d) => void (d.travel[k] = v));
  const crew = Math.max(1, ...doc.labor.filter((l) => l.mode === 'hour').map((l) => l.workers ?? 1));
  const clientAddress = client.data ? [client.data.street, client.data.number, client.data.district, client.data.city, client.data.state].filter(Boolean).join(', ') : '';
  const destination = t.destination || doc.project.installLocation || clientAddress;

  function enable(v: boolean) {
    update((d) => {
      d.travel.enabled = v;
      if (v) {
        if (!d.travel.origin) d.travel.origin = company?.address ?? '';
        if (!d.travel.destination) d.travel.destination = d.project.installLocation || clientAddress;
        d.travel.workers = crew;
      }
    });
  }

  async function calcDistance() {
    setBusy(true);
    try {
      const r = await routeDistance(t.origin, destination);
      update((d) => {
        d.travel.distanceKm = r.km;
        if (!d.travel.destination) d.travel.destination = destination;
      });
      fb.ok(`Distância de ida: ${formatNumber(r.km, 1)} km (cerca de ${Math.floor(r.minutes / 60) ? `${Math.floor(r.minutes / 60)} h ` : ''}${r.minutes % 60} min).`);
    } catch (e) {
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Deslocamento da equipe" actions={<Checkbox label="Incluir no orçamento" checked={t.enabled} onChange={enable} />}>
      {!t.enabled ? (
        <p className="text-sm text-gray-500">Calcula combustível pelo consumo do veículo, pedágios, alimentação e hospedagem por funcionário. Marque “Incluir no orçamento” para usar.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Saída (endereço da empresa)" value={t.origin} onChange={(e) => set('origin', e.target.value)} placeholder="Rua, número, cidade - UF" />
            <Input label="Destino (obra)" value={t.destination} onChange={(e) => set('destination', e.target.value)} placeholder={destination || 'Rua, número, cidade - UF'} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<MapPin className="size-4" />} loading={busy} onClick={calcDistance} disabled={!t.origin || !destination}>
              Calcular distância
            </Button>
            <a
              className={cx('inline-flex h-10 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 md:h-9', (!t.origin || !destination) && 'pointer-events-none opacity-50')}
              href={mapsRouteUrl(t.origin, destination)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4" /> Ver rota e pedágios no Google Maps
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumInput label="Distância (só ida)" suffix="km" value={t.distanceKm} onChange={(n) => set('distanceKm', n ?? 0)} />
            <NumInput label="Viagens (ida e volta)" value={t.trips} onChange={(n) => set('trips', Math.max(0, Math.round(n ?? 0)))} hint="Ex.: 3 dias indo e voltando = 3" />
            <NumInput label="Consumo do veículo" suffix="km/l" value={t.kmPerLiter} onChange={(n) => set('kmPerLiter', n ?? 0)} />
            <NumInput label="Preço do combustível" suffix="R$/l" value={t.fuelPrice} onChange={(n) => set('fuelPrice', n ?? 0)} className={!(t.fuelPrice > 0) ? 'border-amber-400! bg-amber-50!' : ''} />
            <NumInput label="Pedágios por viagem" suffix="R$" value={t.tollPerTrip} onChange={(n) => set('tollPerTrip', n ?? 0)} hint="Ida + volta. Confira no mapa." />
            <NumInput label="Funcionários" value={t.workers} onChange={(n) => set('workers', Math.max(0, Math.round(n ?? 0)))} hint={`Equipe da mão de obra: ${crew}`} />
            <NumInput label="Dias com alimentação" value={t.days} onChange={(n) => set('days', Math.max(0, Math.round(n ?? 0)))} />
            <NumInput label="Alimentação por pessoa/dia" suffix="R$" value={t.mealPerPersonDay} onChange={(n) => set('mealPerPersonDay', n ?? 0)} />
            <NumInput label="Noites de hospedagem" value={t.nights} onChange={(n) => set('nights', Math.max(0, Math.round(n ?? 0)))} />
            <NumInput label="Hospedagem por pessoa/noite" suffix="R$" value={t.lodgingPerPersonNight} onChange={(n) => set('lodgingPerPersonNight', n ?? 0)} />
          </div>
          <div className="grid gap-px overflow-hidden rounded-md border border-gray-200 bg-gray-200 text-sm sm:grid-cols-5">
            {[
              ['Combustível', `${formatNumber(c.totalKm, 1)} km ÷ ${formatNumber(t.kmPerLiter, 1)} km/l = ${formatNumber(c.liters, 1)} l`, c.fuel],
              ['Pedágios', `${t.trips} × ${formatBRL(t.tollPerTrip)}`, c.tolls],
              ['Alimentação', `${t.workers} × ${t.days} dia(s) × ${formatBRL(t.mealPerPersonDay)}`, c.meals],
              ['Hospedagem', `${t.workers} × ${t.nights} noite(s) × ${formatBRL(t.lodgingPerPersonNight)}`, c.lodging],
            ].map(([label, detail, value]) => (
              <div key={label as string} className="bg-white px-3 py-2">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="num font-medium">{formatBRL(value as number)}</p>
                <p className="text-[11px] text-gray-500">{detail}</p>
              </div>
            ))}
            <div className="bg-brand-50 px-3 py-2">
              <p className="text-xs text-brand-800">Total do deslocamento</p>
              <p className="num text-base font-semibold text-brand-800">{formatBRL(c.total)}</p>
              <p className="text-[11px] text-gray-500">Entra como transporte</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            A distância é calculada pelo OpenStreetMap (o endereço digitado é enviado a esse serviço). Pedágios mudam com frequência e por isso não são buscados automaticamente: confira o valor da rota no Google Maps. Padrões de
            consumo, combustível, alimentação e hospedagem ficam em Configurações.
          </p>
        </div>
      )}
    </Panel>
  );
}
