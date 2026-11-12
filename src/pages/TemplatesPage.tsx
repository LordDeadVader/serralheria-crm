import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { DurationInput } from '../components/DurationInput';
import { ImportPresetsButton } from '../components/ImportPresetsButton';
import { NumInput } from '../components/NumInput';
import { useFeedback } from '../components/feedback';
import { Badge, Button, Empty, ErrorBox, Input, Modal, PageHeader, Segmented, Select, Spinner, Textarea, cx } from '../components/ui';
import { formatBRL, formatNumber } from '../calculations/money';
import { UNITS, unitShort, type Unit } from '../calculations/units';
import { materialUnitCost, normName } from '../lib/applyTemplate';
import { formatDuration } from '../lib/format';
import { materialsRepo, servicesRepo, templatesRepo } from '../repositories';
import { templateSchema, type TemplateInput } from '../schemas/templates';
import type { Material, Template } from '../types/domain';
import { SERVICE_TYPES } from './quote/defaults';
import { zebra } from './quote/ItemSteps';

const EMPTY: TemplateInput = { name: '', kind: 'projeto', serviceType: '', description: '', specifications: '', finish: '', notes: '', materials: [], labor: [], extras: [] };

export function TemplatesPage() {
  const [kind, setKind] = useState<'projeto' | 'kit'>('projeto');
  const [editing, setEditing] = useState<{ t: Template | null; copy?: boolean } | null>(null);
  const fb = useFeedback();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['templates'], queryFn: templatesRepo.list });
  const mats = useQuery({ queryKey: ['materials', ''], queryFn: () => materialsRepo.list('') });
  const rows = (list.data ?? []).filter((t) => t.kind === kind);
  const byName = useMemo(() => new Map((mats.data ?? []).map((m) => [normName(m.name), m])), [mats.data]);

  async function remove(t: Template) {
    if (!(await fb.confirm({ title: 'Excluir modelo', message: `Excluir "${t.name}"? Orçamentos já feitos com ele não são afetados.`, confirmLabel: 'Excluir', danger: true }))) return;
    try {
      await templatesRepo.remove(t.id);
      await qc.invalidateQueries({ queryKey: ['templates'] });
      fb.ok('Modelo excluído.');
    } catch (e) {
      fb.error(e);
    }
  }

  return (
    <>
      <PageHeader
        title="Modelos e kits"
        subtitle="Serviços predefinidos que já puxam materiais, insumos e mão de obra para o orçamento — e kits para somar a qualquer orçamento."
        actions={
          <>
            <ImportPresetsButton />
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing({ t: null })}>
              Novo {kind === 'kit' ? 'kit' : 'modelo'}
            </Button>
          </>
        }
      />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'projeto', label: 'Serviços predefinidos' },
            { value: 'kit', label: 'Kits de insumos' },
          ]}
        />
        <p className="text-xs text-gray-500">
          {kind === 'projeto' ? 'Use em Orçamento → Projeto → “Começar a partir de um serviço predefinido”.' : 'Use em Orçamento → Materiais → “Adicionar kit”, com a quantidade.'}
        </p>
      </div>
      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : !rows.length ? (
        <div className="rounded-lg border border-gray-200 bg-white">
          <Empty title={kind === 'kit' ? 'Nenhum kit' : 'Nenhum serviço predefinido'} action={<Button variant="primary" onClick={() => setEditing({ t: null })}>Criar</Button>}>
            Você também pode salvar um orçamento pronto como modelo (botão “Salvar como modelo” no orçamento).
          </Empty>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => {
            const missing = t.materials.filter((m) => {
              const mm = byName.get(normName(m.name));
              return !mm || !materialUnitCost(mm);
            }).length;
            const hours = t.labor.filter((l) => l.mode === 'hour').reduce((s, l) => s + l.qty * l.workers, 0);
            return (
              <article key={t.id} className="flex flex-col rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  {t.isDemo && <Badge tone="brand">Predefinido</Badge>}
                </div>
                {t.description && <p className="mt-1 text-sm text-gray-600">{t.description}</p>}
                <ul className="mt-2 space-y-0.5 text-[13px] text-gray-600">
                  <li>{t.materials.length} material(is) e insumo(s)</li>
                  <li>
                    {t.labor.length} serviço(s){hours ? ` · ${formatDuration(hours)} de mão de obra` : ''}
                  </li>
                  {t.notes && <li className="text-xs text-gray-500">{t.notes}</li>}
                </ul>
                {missing > 0 && <p className="mt-2 text-xs text-amber-800">{missing} item(ns) ainda sem preço no cadastro de materiais.</p>}
                <div className="mt-auto flex justify-end gap-1 pt-3">
                  <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} onClick={() => setEditing({ t, copy: true })} title="Duplicar" aria-label={`Duplicar ${t.name}`} />
                  <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5 text-red-600" />} onClick={() => remove(t)} title="Excluir" aria-label={`Excluir ${t.name}`} />
                  <Button size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditing({ t })}>
                    Editar
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <TemplateModal state={editing} defaultKind={kind} onClose={() => setEditing(null)} />
    </>
  );
}

/* ------------------------------- Editor ------------------------------- */

function TemplateModal({ state, defaultKind, onClose }: { state: { t: Template | null; copy?: boolean } | null; defaultKind: 'projeto' | 'kit'; onClose: () => void }) {
  const fb = useFeedback();
  const qc = useQueryClient();
  const mats = useQuery({ queryKey: ['materials', ''], queryFn: () => materialsRepo.list(''), enabled: !!state });
  const svcs = useQuery({ queryKey: ['services'], queryFn: servicesRepo.list, enabled: !!state });
  const [v, setV] = useState<TemplateInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [mpick, setMpick] = useState('');
  const [spick, setSpick] = useState('');

  useEffect(() => {
    if (!state) return;
    setErrors({});
    if (state.t) {
      const { id: _id, isDemo: _d, updatedAt: _u, ...rest } = state.t;
      setV({ ...rest, name: state.copy ? `${rest.name} (cópia)` : rest.name });
    } else setV({ ...EMPTY, kind: defaultKind });
  }, [state, defaultKind]);

  const matGroups = useMemo(() => group(mats.data ?? [], (m) => m.category || 'Sem categoria'), [mats.data]);
  const svcGroups = useMemo(() => group(svcs.data ?? [], (s) => s.category || 'Outros'), [svcs.data]);
  const matById = useMemo(() => new Map((mats.data ?? []).map((m) => [m.id, m])), [mats.data]);
  const matByName = useMemo(() => new Map((mats.data ?? []).map((m) => [normName(m.name), m])), [mats.data]);
  const set = <K extends keyof TemplateInput>(k: K, val: TemplateInput[K]) => setV((s) => ({ ...s, [k]: val }));
  const edit = (fn: (d: TemplateInput) => void) =>
    setV((s) => {
      const d = structuredClone(s);
      fn(d);
      return d;
    });

  async function save() {
    const r = templateSchema.safeParse(v);
    if (!r.success) {
      const e: Record<string, string> = {};
      for (const i of r.error.issues) e[i.path.join('.')] ??= i.message;
      setErrors(e);
      fb.error(Object.values(e)[0]);
      return;
    }
    setBusy(true);
    try {
      if (state?.t && !state.copy) await templatesRepo.update(state.t.id, r.data);
      else await templatesRepo.create(r.data);
      await qc.invalidateQueries({ queryKey: ['templates'] });
      fb.ok('Modelo salvo.');
      onClose();
    } catch (e) {
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }

  const lineMat = (m: TemplateInput['materials'][number]): Material | undefined => (m.materialId ? matById.get(m.materialId) : undefined) ?? matByName.get(normName(m.name));

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      size="xl"
      title={state?.t && !state.copy ? `Editar: ${state.t.name}` : v.kind === 'kit' ? 'Novo kit' : 'Novo serviço predefinido'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <Input wrapClass="sm:col-span-3" label="Nome *" value={v.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="Ex.: Testeira em ACM adesivada" />
          <Select wrapClass="sm:col-span-1" label="Tipo" value={v.kind} onChange={(e) => set('kind', e.target.value as TemplateInput['kind'])}>
            <option value="projeto">Serviço predefinido</option>
            <option value="kit">Kit de insumos</option>
          </Select>
          <Select wrapClass="sm:col-span-2" label="Tipo de serviço" value={v.serviceType} onChange={(e) => set('serviceType', e.target.value)}>
            <option value="">—</option>
            {[...new Set([v.serviceType, ...SERVICE_TYPES].filter(Boolean))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Textarea wrapClass="sm:col-span-3" label="Descrição (vai para a proposta)" value={v.description} onChange={(e) => set('description', e.target.value)} rows={2} hint="O orçamentista completa o resto da descrição no orçamento." />
          <Textarea wrapClass="sm:col-span-3" label="Especificações técnicas" value={v.specifications} onChange={(e) => set('specifications', e.target.value)} rows={2} />
          <Input wrapClass="sm:col-span-3" label="Acabamento" value={v.finish} onChange={(e) => set('finish', e.target.value)} />
          <Input wrapClass="sm:col-span-3" label="Observação interna" value={v.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ex.: quantidades para ~5 m²" />
        </div>

        {/* Materiais e insumos */}
        <section>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Materiais e insumos (por unidade)</h3>
            <div className="flex gap-2">
              <Select
                value={mpick}
                aria-label="Adicionar material"
                className="sm:w-72"
                onChange={(e) => {
                  const m = (mats.data ?? []).find((x) => x.id === e.target.value);
                  if (m) edit((d) => void d.materials.unshift({ materialId: m.id, name: m.name, unit: m.usageUnit, qty: 1, wastePct: null }));
                  setMpick('');
                }}
              >
                <option value="">Adicionar do cadastro…</option>
                {matGroups.map(([cat, list]) => (
                  <optgroup key={cat} label={cat}>
                    {list.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              <Button size="sm" variant="ghost" onClick={() => edit((d) => void d.materials.unshift({ materialId: null, name: '', unit: 'un', qty: 1, wastePct: null }))}>
                Avulso
              </Button>
            </div>
          </div>
          {v.materials.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500">Nenhum material.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="tbl tbl-cards">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="w-40 text-right">Qtde.</th>
                    <th className="w-28 text-right">Desperd. %</th>
                    <th className="w-36 text-right">Preço atual</th>
                    <th className="w-px" />
                  </tr>
                </thead>
                <tbody>
                  {v.materials.map((m, i) => {
                    const cat = lineMat(m);
                    const cost = cat ? materialUnitCost(cat) : 0;
                    return (
                      <tr key={i} className={zebra(i)}>
                        <td className="c-full">
                          <Input value={m.name} onChange={(e) => edit((d) => void (d.materials[i] = { ...d.materials[i], name: e.target.value, materialId: null }))} aria-label="Material" error={errors[`materials.${i}.name`]} />
                        </td>
                        <td className="c-half">
                          {cat ? (
                            <NumInput ariaLabel="Quantidade" value={m.qty} onChange={(n) => edit((d) => void (d.materials[i].qty = n ?? 0))} suffix={unitShort(cat.usageUnit)} />
                          ) : (
                            <div className="grid grid-cols-[1fr_4.5rem] gap-1">
                              <NumInput ariaLabel="Quantidade" value={m.qty} onChange={(n) => edit((d) => void (d.materials[i].qty = n ?? 0))} />
                              <Select value={m.unit} onChange={(e) => edit((d) => void (d.materials[i].unit = e.target.value as Unit))} aria-label="Unidade">
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
                          <NumInput ariaLabel="Desperdício" nullable placeholder="padrão" value={m.wastePct} onChange={(n) => edit((d) => void (d.materials[i].wastePct = n))} suffix="%" />
                        </td>
                        <td className="c-grow num text-right text-sm">
                          {cost ? `${formatBRL(cost)}/${unitShort(cat!.usageUnit)}` : <Badge tone="amber">{cat ? 'Sem preço' : 'Fora do cadastro'}</Badge>}
                        </td>
                        <td className="c-actions">
                          <Button size="sm" variant="ghost" aria-label="Remover" icon={<Trash2 className="size-3.5 text-red-600" />} onClick={() => edit((d) => void d.materials.splice(i, 1))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">O preço vem sempre do cadastro de materiais na hora de usar o modelo. Desperdício em branco usa o padrão da empresa.</p>
        </section>

        {/* Mão de obra */}
        <section>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Mão de obra e serviços</h3>
            <div className="flex gap-2">
              <Select
                value={spick}
                aria-label="Adicionar serviço"
                className="sm:w-72"
                onChange={(e) => {
                  const s = (svcs.data ?? []).find((x) => x.id === e.target.value);
                  if (s) edit((d) => void d.labor.unshift({ serviceId: s.id, name: s.name, mode: s.mode, qty: s.mode === 'hour' ? s.estimatedHours || 1 : 1, workers: 1, rate: 0 }));
                  setSpick('');
                }}
              >
                <option value="">Adicionar do cadastro…</option>
                {svcGroups.map(([cat, list]) => (
                  <optgroup key={cat} label={cat}>
                    {list.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              <Button size="sm" variant="ghost" onClick={() => edit((d) => void d.labor.unshift({ serviceId: null, name: '', mode: 'hour', qty: 1, workers: 1, rate: 0 }))}>
                Avulso
              </Button>
            </div>
          </div>
          {v.labor.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500">Nenhum serviço.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="tbl tbl-cards">
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th className="w-32">Cobrança</th>
                    <th className="w-44 text-right">Tempo</th>
                    <th className="w-24 text-right">Funcionários</th>
                    <th className="w-32 text-right">Valor</th>
                    <th className="w-px" />
                  </tr>
                </thead>
                <tbody>
                  {v.labor.map((l, i) => (
                    <tr key={i} className={zebra(i)}>
                      <td className="c-full">
                        <Input value={l.name} onChange={(e) => edit((d) => void (d.labor[i] = { ...d.labor[i], name: e.target.value, serviceId: null }))} aria-label="Serviço" error={errors[`labor.${i}.name`]} />
                      </td>
                      <td className="c-full">
                        <Select value={l.mode} aria-label="Cobrança" onChange={(e) => edit((d) => void (d.labor[i].mode = e.target.value as 'hour' | 'fixed'))}>
                          <option value="hour">Por hora</option>
                          <option value="fixed">Preço fixo</option>
                        </Select>
                      </td>
                      {l.mode === 'hour' ? (
                        <>
                          <td className="c-half">
                            <DurationInput ariaLabel="Tempo" value={l.qty} onChange={(h) => edit((d) => void (d.labor[i].qty = h))} />
                          </td>
                          <td className="c-half">
                            <NumInput ariaLabel="Funcionários" value={l.workers} onChange={(n) => edit((d) => void (d.labor[i].workers = Math.max(1, Math.round(n ?? 1))))} />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="max-md:hidden text-right text-gray-400">—</td>
                          <td className="max-md:hidden text-right text-gray-400">—</td>
                        </>
                      )}
                      <td className="c-full">
                        <NumInput ariaLabel="Valor" value={l.rate} onChange={(n) => edit((d) => void (d.labor[i].rate = n ?? 0))} suffix={l.mode === 'hour' ? 'R$/h' : 'R$'} hint={l.rate ? undefined : 'Usa o cadastro'} />
                      </td>
                      <td className="c-actions">
                        <Button size="sm" variant="ghost" aria-label="Remover" icon={<Trash2 className="size-3.5 text-red-600" />} onClick={() => edit((d) => void d.labor.splice(i, 1))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">Valor 0 = usa o valor do cadastro de serviços (ou o custo/hora padrão da empresa).</p>
        </section>

        {/* Despesas */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Despesas fixas (opcional)</h3>
            <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => edit((d) => void d.extras.unshift({ description: '', kind: 'outro', amount: 0 }))}>
              Adicionar
            </Button>
          </div>
          {v.extras.map((x, i) => (
            <div key={i} className={cx('mb-2 grid grid-cols-[1fr_8rem_auto] gap-2 rounded-md p-2', zebra(i))}>
              <Input value={x.description} onChange={(e) => edit((d) => void (d.extras[i].description = e.target.value))} aria-label="Descrição" placeholder="Ex.: Locação de andaime" />
              <NumInput ariaLabel="Valor" value={x.amount} onChange={(n) => edit((d) => void (d.extras[i].amount = n ?? 0))} suffix="R$" />
              <Button size="sm" variant="ghost" aria-label="Remover" icon={<Trash2 className="size-3.5 text-red-600" />} onClick={() => edit((d) => void d.extras.splice(i, 1))} />
            </div>
          ))}
        </section>
        <p className="text-xs text-gray-500">Resumo: {v.materials.length} material(is), {v.labor.length} serviço(s), {formatNumber(v.labor.filter((l) => l.mode === 'hour').reduce((s, l) => s + l.qty * l.workers, 0), 2)} h de mão de obra.</p>
      </div>
    </Modal>
  );
}

function group<X>(items: X[], key: (x: X) => string): Array<[string, X[]]> {
  const g = new Map<string, X[]>();
  for (const it of items) g.set(key(it), [...(g.get(key(it)) ?? []), it]);
  return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

