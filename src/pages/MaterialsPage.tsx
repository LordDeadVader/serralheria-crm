import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Pencil, Plus, Trash2 } from 'lucide-react';
import { DemoBadge } from '../components/StatusBadge';
import { NumInput } from '../components/NumInput';
import { useFeedback } from '../components/feedback';
import { Badge, Button, Empty, ErrorBox, Input, Modal, PageHeader, SearchInput, Select, Spinner, TableWrap, Textarea } from '../components/ui';
import { formatBRL, formatNumber } from '../calculations/money';
import { UNITS, UNIT_INFO, isCompatible, safeCostPerUsageUnit, unitShort, type Unit } from '../calculations/units';
import { useForm } from '../hooks/useForm';
import { formatDate, formatDateTime } from '../lib/format';
import { materialsRepo, suppliersRepo } from '../repositories';
import { materialSchema, type MaterialInput } from '../schemas/entities';
import { MATERIAL_CATEGORIES, PURCHASE_UNITS, type Material } from '../types/domain';

export function MaterialsPage() {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Material | null | undefined>(undefined);
  const [hist, setHist] = useState<Material | null>(null);
  const fb = useFeedback();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['materials', q], queryFn: () => materialsRepo.list(q) });

  async function remove(m: Material) {
    const ok = await fb.confirm({
      title: 'Excluir material',
      message: `Excluir "${m.name}"? Orçamentos já salvos mantêm o custo registrado na época.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await materialsRepo.remove(m.id);
      await qc.invalidateQueries({ queryKey: ['materials'] });
      fb.ok('Material excluído.');
    } catch (e) {
      fb.error(e);
    }
  }

  return (
    <>
      <PageHeader
        title="Materiais"
        subtitle="Preço de compra, conversão para a unidade de uso e histórico de preços."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing(null)}>
            Novo material
          </Button>
        }
      />
      <div className="mb-3">
        <SearchInput value={q} onChange={setQ} placeholder="Nome, código ou categoria…" />
      </div>
      {list.data?.some((m) => m.isDemo) && (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Itens marcados como <strong>Exemplo</strong> são dados de demonstração com preços ilustrativos, que não servem como referência de mercado. Atualize-os com seus preços reais ou exclua-os.
        </p>
      )}
      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <TableWrap>
          <Empty title="Nenhum material encontrado" action={<Button variant="primary" onClick={() => setEditing(null)}>Cadastrar material</Button>} />
        </TableWrap>
      ) : (
        <TableWrap>
          <table className="tbl">
            <thead>
              <tr>
                <th className="hidden sm:table-cell">Código</th>
                <th>Material</th>
                <th className="hidden lg:table-cell">Categoria</th>
                <th className="text-right">Compra</th>
                <th className="text-right">Custo de uso</th>
                <th className="hidden md:table-cell">Atualizado</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {list.data.map((m) => {
                const c = safeCostPerUsageUnit({ purchasePrice: m.purchasePrice, packQty: m.packQty, packUnit: m.packUnit, usageUnit: m.usageUnit, packWeightKg: m.weightKg });
                return (
                  <tr key={m.id} className={m.status === 'inativo' ? 'opacity-60' : ''}>
                    <td className="hidden text-gray-500 sm:table-cell">{m.code || '—'}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-gray-900">{m.name}</span>
                        {m.isDemo && <DemoBadge />}
                        {m.status === 'inativo' && <Badge>Inativo</Badge>}
                      </div>
                      {m.supplierName && <p className="text-xs text-gray-500">{m.supplierName}</p>}
                    </td>
                    <td className="hidden text-gray-600 lg:table-cell">{m.category || '—'}</td>
                    <td className="num text-right">
                      {formatBRL(m.purchasePrice)}
                      <span className="block text-xs text-gray-500">
                        {m.purchaseUnit} · {formatNumber(m.packQty, 3)} {unitShort(m.packUnit)}
                      </span>
                    </td>
                    <td className="num text-right font-medium">
                      {c.value != null ? (
                        <>
                          {formatBRL(c.value)}
                          <span className="text-xs font-normal text-gray-500">/{unitShort(m.usageUnit)}</span>
                        </>
                      ) : (
                        <span className="text-xs text-red-600">Conversão inválida</span>
                      )}
                    </td>
                    <td className="hidden text-gray-500 md:table-cell">{formatDate(m.priceUpdatedAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Histórico de preços" onClick={() => setHist(m)} icon={<History className="size-3.5" />} />
                        <Button size="sm" variant="ghost" title="Editar" onClick={() => setEditing(m)} icon={<Pencil className="size-3.5" />} />
                        <Button size="sm" variant="ghost" title="Excluir" onClick={() => remove(m)} icon={<Trash2 className="size-3.5 text-red-600" />} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
      <MaterialFormModal open={editing !== undefined} material={editing ?? null} onClose={() => setEditing(undefined)} />
      <PriceHistoryModal material={hist} onClose={() => setHist(null)} />
    </>
  );
}

const EMPTY: MaterialInput = {
  code: '',
  name: '',
  category: '',
  description: '',
  purchaseUnit: 'barra',
  packQty: 6,
  packUnit: 'm',
  usageUnit: 'm',
  purchasePrice: 0,
  supplierId: null,
  lengthMm: null,
  widthMm: null,
  thicknessMm: null,
  weightKg: null,
  status: 'ativo',
};

export function MaterialFormModal({ open, material, onClose, onSaved }: { open: boolean; material: Material | null; onClose: () => void; onSaved?: (m: Material) => void }) {
  const fb = useFeedback();
  const qc = useQueryClient();
  const f = useForm<MaterialInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const suppliers = useQuery({ queryKey: ['suppliers', ''], queryFn: () => suppliersRepo.list(''), enabled: open });

  useEffect(() => {
    if (!open) return;
    f.setErrors({});
    if (material) {
      const { code, name, category, description, purchaseUnit, packQty, packUnit, usageUnit, purchasePrice, supplierId, lengthMm, widthMm, thicknessMm, weightKg, status } = material;
      f.setValues({ code, name, category, description, purchaseUnit, packQty, packUnit, usageUnit, purchasePrice, supplierId, lengthMm, widthMm, thicknessMm, weightKg, status });
    } else f.setValues(EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, material]);

  const v = f.values;
  const cost = useMemo(
    () => safeCostPerUsageUnit({ purchasePrice: v.purchasePrice, packQty: v.packQty, packUnit: v.packUnit, usageUnit: v.usageUnit, packWeightKg: v.weightKg }),
    [v.purchasePrice, v.packQty, v.packUnit, v.usageUnit, v.weightKg],
  );

  async function save() {
    const data = f.validate(materialSchema);
    if (!data) return;
    if (cost.error) {
      f.setErrors({ usageUnit: cost.error });
      return;
    }
    setBusy(true);
    try {
      const saved = material ? await materialsRepo.update(material.id, data) : await materialsRepo.create(data);
      await qc.invalidateQueries({ queryKey: ['materials'] });
      fb.ok(material ? 'Material atualizado.' : 'Material cadastrado.');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      f.applyApiError(e);
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }

  const unitOptions = UNITS.map((u) => (
    <option key={u} value={u}>
      {UNIT_INFO[u].label}
    </option>
  ));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={material ? 'Editar material' : 'Novo material'}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            Salvar material
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <Input wrapClass="sm:col-span-1" label="Código" value={v.code} onChange={(e) => f.set('code', e.target.value)} />
        <Input wrapClass="sm:col-span-3" label="Nome *" value={v.name} onChange={(e) => f.set('name', e.target.value)} error={f.errors.name} autoFocus />
        <Select wrapClass="sm:col-span-2" label="Categoria" value={v.category} onChange={(e) => f.set('category', e.target.value)}>
          <option value="">—</option>
          {MATERIAL_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 sm:col-span-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Compra e conversão</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Select label="Unidade de compra *" value={v.purchaseUnit} onChange={(e) => f.set('purchaseUnit', e.target.value)} error={f.errors.purchaseUnit}>
              {PURCHASE_UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
            <NumInput label="Preço de compra *" value={v.purchasePrice} onChange={(n) => f.set('purchasePrice', n ?? 0)} error={f.errors.purchasePrice} suffix="R$" />
            <NumInput label="Contém *" value={v.packQty} onChange={(n) => f.set('packQty', n ?? 0)} error={f.errors.packQty} hint="Qtde. por unidade de compra" />
            <Select label="Medida" value={v.packUnit} onChange={(e) => f.set('packUnit', e.target.value as Unit)}>
              {unitOptions}
            </Select>
            <Select label="Unidade de utilização *" value={v.usageUnit} onChange={(e) => f.set('usageUnit', e.target.value as Unit)} error={f.errors.usageUnit}>
              {unitOptions}
            </Select>
          </div>
          <p className="mt-3 text-sm">
            {cost.value != null ? (
              <>
                Custo de utilização: <strong className="num">{formatBRL(cost.value)}</strong> por {unitShort(v.usageUnit)}
                <span className="text-gray-500">
                  {' '}
                  ({v.purchaseUnit} de {formatNumber(v.packQty, 3)} {unitShort(v.packUnit)} a {formatBRL(v.purchasePrice)})
                </span>
              </>
            ) : (
              <span className="text-red-700">{cost.error}</span>
            )}
          </p>
          {!isCompatible(v.packUnit, v.usageUnit) && UNIT_INFO[v.usageUnit].dimension === 'massa' && (
            <p className="mt-1 text-xs text-gray-600">Para usar em unidade de massa, informe o peso da unidade de compra abaixo.</p>
          )}
        </div>

        <NumInput wrapClass="sm:col-span-1" label="Comprimento" suffix="mm" nullable value={v.lengthMm} onChange={(n) => f.set('lengthMm', n)} />
        <NumInput wrapClass="sm:col-span-1" label="Largura" suffix="mm" nullable value={v.widthMm} onChange={(n) => f.set('widthMm', n)} />
        <NumInput wrapClass="sm:col-span-1" label="Espessura" suffix="mm" nullable value={v.thicknessMm} onChange={(n) => f.set('thicknessMm', n)} />
        <NumInput wrapClass="sm:col-span-1" label="Peso (un. compra)" suffix="kg" nullable value={v.weightKg} onChange={(n) => f.set('weightKg', n)} />
        <Select wrapClass="sm:col-span-2" label="Fornecedor" value={v.supplierId ?? ''} onChange={(e) => f.set('supplierId', e.target.value || null)} error={f.errors.supplierId}>
          <option value="">—</option>
          {suppliers.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Textarea wrapClass="sm:col-span-5" label="Descrição" value={v.description} onChange={(e) => f.set('description', e.target.value)} rows={2} />
        <Select wrapClass="sm:col-span-1" label="Status" value={v.status} onChange={(e) => f.set('status', e.target.value as 'ativo' | 'inativo')}>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </Select>
      </div>
    </Modal>
  );
}

function PriceHistoryModal({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const h = useQuery({ queryKey: ['materials', 'history', material?.id], queryFn: () => materialsRepo.history(material!.id), enabled: !!material });
  return (
    <Modal open={!!material} onClose={onClose} title={`Histórico de preços — ${material?.name ?? ''}`}>
      {h.isLoading ? (
        <Spinner />
      ) : !h.data?.length ? (
        <Empty title="Sem histórico" />
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Data</th>
              <th className="text-right">Preço</th>
              <th>Embalagem</th>
              <th>Usuário</th>
            </tr>
          </thead>
          <tbody>
            {h.data.map((r) => (
              <tr key={r.id}>
                <td>{formatDateTime(r.changedAt)}</td>
                <td className="num text-right">{formatBRL(r.price)}</td>
                <td>
                  {formatNumber(r.packQty, 3)} {unitShort(r.packUnit)}
                </td>
                <td className="text-gray-500">{r.userName ?? 'Sistema'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-gray-500">Orçamentos salvos guardam o custo vigente na data em que foram elaborados; alterações de preço não modificam orçamentos existentes.</p>
    </Modal>
  );
}
