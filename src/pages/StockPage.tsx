import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, History, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { NumInput } from '../components/NumInput';
import { useFeedback } from '../components/feedback';
import { Badge, Button, Empty, ErrorBox, Input, Modal, PageHeader, SearchInput, Segmented, Select, Spinner, Stat, TableWrap, Textarea, cx } from '../components/ui';
import { formatNumber } from '../calculations/money';
import { useForm } from '../hooks/useForm';
import { formatDate, formatDateTime } from '../lib/format';
import { materialsRepo, stockRepo } from '../repositories';
import { STOCK_KINDS, stockItemSchema, stockMovementSchema, type StockItemInput, type StockMovementInput } from '../schemas/entities';
import { STOCK_KIND_LABEL, type StockItem } from '../types/domain';

type Level = 'ok' | 'baixo' | 'zerado';
const level = (i: StockItem): Level => (i.quantity <= 0 ? 'zerado' : i.minQuantity > 0 && i.quantity <= i.minQuantity ? 'baixo' : 'ok');
const qtyFmt = (n: number) => formatNumber(n, 3);

const UNIT_SUGGESTIONS = ['un', 'pç', 'par', 'm', 'm²', 'kg', 'g', 'l', 'rolo', 'cx', 'pct', 'barra', 'chapa', 'tubo', 'lata', 'jogo'];

export function StockPage() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [only, setOnly] = useState<'todos' | 'repor'>('todos');
  const [editing, setEditing] = useState<StockItem | null | undefined>(undefined);
  const [moving, setMoving] = useState<{ item: StockItem; type: StockMovementInput['type'] } | null>(null);
  const [hist, setHist] = useState<StockItem | null>(null);
  const fb = useFeedback();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['stock', q, kind], queryFn: () => stockRepo.list({ q, kind }) });

  const all = list.data ?? [];
  const rows = only === 'repor' ? all.filter((i) => level(i) !== 'ok') : all;
  const low = all.filter((i) => level(i) === 'baixo').length;
  const zero = all.filter((i) => level(i) === 'zerado').length;

  async function remove(i: StockItem) {
    const ok = await fb.confirm({
      title: 'Excluir item do estoque',
      message: `Excluir "${i.name}"? Se o item já teve movimentações, ele será arquivado e o histórico preservado.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await stockRepo.remove(i.id);
      await qc.invalidateQueries({ queryKey: ['stock'] });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
      fb.ok(r.archived ? 'Item arquivado (histórico preservado).' : 'Item excluído.');
    } catch (e) {
      fb.error(e);
    }
  }

  return (
    <>
      <PageHeader
        title="Estoque"
        subtitle="Materiais, insumos, ferramentas e EPIs: saldo atual, entradas, saídas e o que precisa repor."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing(null)}>
            Novo item
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200">
        <div className="bg-white p-3 sm:p-4">
          <Stat label="Itens" value={all.length} />
        </div>
        <button type="button" className="bg-white p-3 text-left hover:bg-amber-50/50 sm:p-4" onClick={() => setOnly('repor')}>
          <Stat label="Abaixo do mínimo" value={<span className={low ? 'text-amber-700' : ''}>{low}</span>} />
        </button>
        <button type="button" className="bg-white p-3 text-left hover:bg-red-50/50 sm:p-4" onClick={() => setOnly('repor')}>
          <Stat label="Zerados" value={<span className={zero ? 'text-red-700' : ''}>{zero}</span>} />
        </button>
      </div>

      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput value={q} onChange={setQ} placeholder="Nome, categoria ou local…" />
          <Select value={kind} onChange={(e) => setKind(e.target.value)} className="sm:w-48" aria-label="Filtrar por tipo">
            <option value="">Todos os tipos</option>
            {STOCK_KINDS.map((k) => (
              <option key={k} value={k}>
                {STOCK_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </div>
        <Segmented
          value={only}
          onChange={setOnly}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'repor', label: `A repor${low + zero ? ` (${low + zero})` : ''}` },
          ]}
        />
      </div>

      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : !rows.length ? (
        <TableWrap>
          {only === 'repor' && all.length ? (
            <Empty title="Nada para repor">Todos os itens estão acima do estoque mínimo.</Empty>
          ) : (
            <Empty title={q || kind ? 'Nenhum item encontrado' : 'Estoque vazio'} action={!q && !kind && <Button variant="primary" onClick={() => setEditing(null)}>Cadastrar item</Button>}>
              {!q && !kind && 'Cadastre o que você tem na oficina — chapas, tubos, estanho, eletrodos, discos, luvas, ferramentas — com o saldo atual e o mínimo para repor.'}
            </Empty>
          )}
        </TableWrap>
      ) : (
        <TableWrap>
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th>Item</th>
                <th className="hidden lg:table-cell">Tipo</th>
                <th className="md:hidden lg:table-cell">Local</th>
                <th className="text-right">Saldo</th>
                <th className="text-right">Mínimo</th>
                <th className="md:hidden xl:table-cell">Última mov.</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const lv = level(i);
                return (
                  <tr key={i.id}>
                    <td className="c-main">
                      <p className="font-medium text-gray-900">{i.name}</p>
                      <p className="text-xs text-gray-500"><span className="lg:hidden">{STOCK_KIND_LABEL[i.kind]}{i.category || i.materialName ? ' · ' : ''}</span>
                        {[i.category, i.materialName && `Material: ${i.materialName}`].filter(Boolean).join(' · ')}</p>
                    </td>
                    <td className="hidden text-gray-600 lg:table-cell">{STOCK_KIND_LABEL[i.kind]}</td>
                    <td className={cx('text-gray-600 md:hidden lg:table-cell', !i.location && 'max-md:hidden')}>{i.location || '—'}</td>
                    <td className="c-side num text-right">
                      <span className={cx('font-semibold', lv === 'zerado' ? 'text-red-700' : lv === 'baixo' ? 'text-amber-700' : 'text-gray-900')}>
                        {qtyFmt(i.quantity)} <span className="text-xs font-normal text-gray-500">{i.unit}</span>
                      </span>
                      {lv !== 'ok' && (
                        <span className="ml-1.5">
                          <Badge tone={lv === 'zerado' ? 'red' : 'amber'}>{lv === 'zerado' ? 'Zerado' : 'Repor'}</Badge>
                        </span>
                      )}
                    </td>
                    <td className={cx('num text-right text-gray-600', !i.minQuantity && 'max-md:hidden')}>{i.minQuantity ? `${qtyFmt(i.minQuantity)} ${i.unit}` : '—'}</td>
                    <td className={cx('text-gray-500 md:hidden xl:table-cell', !i.lastMovementAt && 'max-md:hidden')}>{formatDate(i.lastMovementAt)}</td>
                    <td className="c-actions">
                      <div className="flex flex-wrap justify-end gap-1 md:flex-nowrap">
                        <Button size="sm" variant="secondary" title="Registrar entrada" aria-label={`Entrada de ${i.name}`} onClick={() => setMoving({ item: i, type: 'entrada' })} icon={<ArrowDownToLine className="size-3.5 text-emerald-700" />}>
                          <span className="md:hidden">Entrada</span>
                        </Button>
                        <Button size="sm" variant="secondary" title="Registrar saída" aria-label={`Saída de ${i.name}`} onClick={() => setMoving({ item: i, type: 'saida' })} icon={<ArrowUpFromLine className="size-3.5 text-red-700" />} disabled={i.quantity <= 0}>
                          <span className="md:hidden">Saída</span>
                        </Button>
                        <Button size="sm" variant="ghost" title="Ajustar saldo (inventário)" aria-label={`Ajustar saldo de ${i.name}`} onClick={() => setMoving({ item: i, type: 'ajuste' })} icon={<SlidersHorizontal className="size-3.5" />} />
                        <Button size="sm" variant="ghost" title="Histórico" aria-label={`Histórico de ${i.name}`} onClick={() => setHist(i)} icon={<History className="size-3.5" />} />
                        <Button size="sm" variant="ghost" title="Editar" aria-label={`Editar ${i.name}`} onClick={() => setEditing(i)} icon={<Pencil className="size-3.5" />} />
                        <Button size="sm" variant="ghost" title="Excluir" aria-label={`Excluir ${i.name}`} onClick={() => remove(i)} icon={<Trash2 className="size-3.5 text-red-600" />} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}

      <ItemModal open={editing !== undefined} item={editing ?? null} onClose={() => setEditing(undefined)} />
      <MovementModal state={moving} onClose={() => setMoving(null)} />
      <HistoryModal item={hist} onClose={() => setHist(null)} />
    </>
  );
}

/* ------------------------------ Cadastro ------------------------------ */

const EMPTY: StockItemInput = { name: '', kind: 'insumo', category: '', unit: 'un', minQuantity: 0, location: '', materialId: null, notes: '', initialQuantity: 0 };

function ItemModal({ open, item, onClose }: { open: boolean; item: StockItem | null; onClose: () => void }) {
  const fb = useFeedback();
  const qc = useQueryClient();
  const f = useForm<StockItemInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const mats = useQuery({ queryKey: ['materials', ''], queryFn: () => materialsRepo.list(''), enabled: open });
  useEffect(() => {
    if (!open) return;
    f.setErrors({});
    f.setValues(
      item
        ? { name: item.name, kind: item.kind, category: item.category, unit: item.unit, minQuantity: item.minQuantity, location: item.location, materialId: item.materialId, notes: item.notes }
        : EMPTY,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  async function save() {
    const data = f.validate(stockItemSchema);
    if (!data) return;
    setBusy(true);
    try {
      if (item) await stockRepo.update(item.id, data);
      else await stockRepo.create(data);
      await qc.invalidateQueries({ queryKey: ['stock'] });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
      fb.ok('Item salvo.');
      onClose();
    } catch (e) {
      f.applyApiError(e);
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }

  const v = f.values;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Editar item do estoque' : 'Novo item no estoque'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <Input wrapClass="sm:col-span-4" label="Nome *" value={v.name} onChange={(e) => f.set('name', e.target.value)} error={f.errors.name} placeholder="Ex.: Estanho 60/40, Luva de vaqueta, Esmerilhadeira 4½”" autoFocus />
        <Select wrapClass="sm:col-span-2" label="Tipo" value={v.kind} onChange={(e) => f.set('kind', e.target.value as StockItemInput['kind'])}>
          {STOCK_KINDS.map((k) => (
            <option key={k} value={k}>
              {STOCK_KIND_LABEL[k]}
            </option>
          ))}
        </Select>
        <Input wrapClass="sm:col-span-3" label="Categoria" value={v.category} onChange={(e) => f.set('category', e.target.value)} placeholder="Ex.: Solda, Abrasivos, Elétrica" />
        <Input wrapClass="sm:col-span-3" label="Local" value={v.location} onChange={(e) => f.set('location', e.target.value)} placeholder="Ex.: Prateleira 2, Almoxarifado" />
        <div className="sm:col-span-2">
          <Input label="Unidade *" value={v.unit} onChange={(e) => f.set('unit', e.target.value)} error={f.errors.unit} list="stock-units" />
          <datalist id="stock-units">
            {UNIT_SUGGESTIONS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
        {!item && (
          <NumInput wrapClass="sm:col-span-2" label="Saldo atual" value={v.initialQuantity ?? 0} onChange={(n) => f.set('initialQuantity', n ?? 0)} error={f.errors.initialQuantity} suffix={v.unit} hint="Quanto tem hoje." />
        )}
        <NumInput
          wrapClass={item ? 'sm:col-span-4' : 'sm:col-span-2'}
          label="Estoque mínimo"
          value={v.minQuantity}
          onChange={(n) => f.set('minQuantity', n ?? 0)}
          error={f.errors.minQuantity}
          suffix={v.unit}
          hint="Avisa quando chegar nesse valor. 0 = sem aviso."
        />
        {v.kind === 'material' && (
          <Select wrapClass="sm:col-span-6" label="Vincular ao cadastro de materiais (opcional)" value={v.materialId ?? ''} onChange={(e) => f.set('materialId', e.target.value || null)} error={f.errors.materialId}>
            <option value="">Não vincular</option>
            {(mats.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.isDemo ? ' (exemplo)' : ''}
              </option>
            ))}
          </Select>
        )}
        <Textarea wrapClass="sm:col-span-6" label="Observações" value={v.notes} onChange={(e) => f.set('notes', e.target.value)} rows={2} />
        {item && <p className="text-xs text-gray-500 sm:col-span-6">O saldo não é editado aqui: use Entrada, Saída ou Ajuste para que fique registrado no histórico.</p>}
      </div>
    </Modal>
  );
}

/* ---------------------------- Movimentação ---------------------------- */

const MOVE_TITLE = { entrada: 'Registrar entrada', saida: 'Registrar saída', ajuste: 'Ajustar saldo (inventário)' } as const;

function MovementModal({ state, onClose }: { state: { item: StockItem; type: StockMovementInput['type'] } | null; onClose: () => void }) {
  const fb = useFeedback();
  const qc = useQueryClient();
  const f = useForm<StockMovementInput>({ type: 'entrada', qty: 0, reference: '', note: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!state) return;
    f.setErrors({});
    f.setValues({ type: state.type, qty: state.type === 'ajuste' ? state.item.quantity : 0, reference: '', note: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const item = state?.item;
  const v = f.values;
  const result = useMemo(() => {
    if (!item) return 0;
    return v.type === 'entrada' ? item.quantity + v.qty : v.type === 'saida' ? item.quantity - v.qty : v.qty;
  }, [item, v.type, v.qty]);

  async function save() {
    if (!item) return;
    const data = f.validate(stockMovementSchema);
    if (!data) return;
    if (data.type === 'saida' && data.qty > item.quantity + 1e-9) {
      f.setErrors({ qty: `Maior que o saldo (${qtyFmt(item.quantity)} ${item.unit})` });
      return;
    }
    setBusy(true);
    try {
      const r = await stockRepo.move(item.id, data);
      await qc.invalidateQueries({ queryKey: ['stock'] });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
      fb.ok(`${item.name}: saldo ${qtyFmt(r.item.quantity)} ${item.unit}.`);
      onClose();
    } catch (e) {
      f.applyApiError(e);
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      size="sm"
      title={item ? `${MOVE_TITLE[v.type]} — ${item.name}` : ''}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            Confirmar
          </Button>
        </>
      }
    >
      {item && (
        <div className="space-y-3">
          <Segmented
            value={v.type}
            onChange={(t) => {
              f.set('type', t);
              f.set('qty', t === 'ajuste' ? item.quantity : 0);
            }}
            options={[
              { value: 'entrada', label: 'Entrada' },
              { value: 'saida', label: 'Saída' },
              { value: 'ajuste', label: 'Ajuste' },
            ]}
          />
          <NumInput
            label={v.type === 'ajuste' ? 'Quantidade contada no estoque' : v.type === 'entrada' ? 'Quantidade que entrou' : 'Quantidade que saiu'}
            value={v.qty}
            onChange={(n) => f.set('qty', n ?? 0)}
            error={f.errors.qty}
            suffix={item.unit}
          />
          <div className="flex justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-600">
              Saldo atual <strong className="num text-gray-900">{qtyFmt(item.quantity)}</strong>
            </span>
            <span className="text-gray-600">
              Depois <strong className={cx('num', result < 0 ? 'text-red-700' : 'text-gray-900')}>{qtyFmt(result)}</strong> {item.unit}
            </span>
          </div>
          <Input
            label={v.type === 'entrada' ? 'Origem (opcional)' : v.type === 'saida' ? 'Destino / obra (opcional)' : 'Motivo (opcional)'}
            value={v.reference}
            onChange={(e) => f.set('reference', e.target.value)}
            placeholder={v.type === 'entrada' ? 'Ex.: Compra — Fornecedor X, NF 1234' : v.type === 'saida' ? 'Ex.: Obra portão Maria, ORC-2026-0001' : 'Ex.: Contagem mensal'}
          />
          <Textarea label="Observação" value={v.note} onChange={(e) => f.set('note', e.target.value)} rows={2} />
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------ Histórico ------------------------------ */

const TYPE_LABEL = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' } as const;

function HistoryModal({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const h = useQuery({ queryKey: ['stock', 'movements', item?.id], queryFn: () => stockRepo.movements(item!.id), enabled: !!item });
  return (
    <Modal open={!!item} onClose={onClose} title={`Histórico — ${item?.name ?? ''}`} size="lg">
      {h.isLoading ? (
        <Spinner />
      ) : h.error ? (
        <ErrorBox error={h.error} onRetry={() => h.refetch()} />
      ) : !h.data?.length ? (
        <Empty title="Nenhuma movimentação ainda" />
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th className="text-right">Quantidade</th>
                <th className="text-right">Saldo</th>
                <th>Referência</th>
                <th>Usuário</th>
              </tr>
            </thead>
            <tbody>
              {h.data.map((m) => (
                <tr key={m.id}>
                  <td className="c-main whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                  <td className="c-side">
                    <Badge tone={m.type === 'entrada' ? 'green' : m.type === 'saida' ? 'red' : 'gray'}>{TYPE_LABEL[m.type]}</Badge>
                  </td>
                  <td className={cx('num text-right font-medium', m.type === 'saida' || m.qty < 0 ? 'text-red-700' : 'text-emerald-700')}>
                    {m.type === 'saida' ? '−' : m.qty < 0 ? '−' : '+'}
                    {qtyFmt(Math.abs(m.qty))} {item?.unit}
                  </td>
                  <td className="num text-right">{qtyFmt(m.balanceAfter)}</td>
                  <td className={cx('text-gray-600', !m.reference && !m.note && 'max-md:hidden')}>
                    <span>{[m.reference, m.note].filter(Boolean).join(' — ') || '—'}</span>
                  </td>
                  <td className="text-gray-500">{m.userName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
