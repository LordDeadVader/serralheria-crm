import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useFeedback } from '../../components/feedback';
import { Badge, Button, Checkbox, Empty, ErrorBox, Input, Modal, Spinner, Textarea, cx } from '../../components/ui';
import { previewSrc } from '../../lib/siteImages';
import { siteRepo, type SiteService } from '../../repositories/site';
import { siteServiceSchema, slugify, type SiteServiceInput } from '../../schemas/site';
import { ImageField, LinesEditor } from './fields';

const EMPTY: SiteServiceInput = { slug: '', title: '', summary: '', body: '', features: [], image: null, sort: 0, active: true };

function ServiceEditor({ service, nextSort, onClose }: { service: SiteService | null; nextSort: number; onClose: () => void }) {
  const fb = useFeedback();
  const qc = useQueryClient();
  const [v, setV] = useState<SiteServiceInput>(() => {
    if (!service) return { ...EMPTY, sort: nextSort };
    const { id: _i, updatedAt: _u, ...rest } = service;
    return rest;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<SiteServiceInput>) => setV((x) => ({ ...x, ...patch }));

  async function save() {
    const r = siteServiceSchema.safeParse({ ...v, features: v.features.filter((f) => f.trim()) });
    if (!r.success) {
      const e: Record<string, string> = {};
      for (const i of r.error.issues) e[i.path.join('.')] ??= i.message;
      setErrors(e);
      return;
    }
    setBusy(true);
    try {
      await siteRepo.saveService(r.data, service?.id);
      const old = service?.image;
      if (old?.src.startsWith('/media/') && old.src !== r.data.image?.src) await siteRepo.deleteImages([old]).catch(() => {});
      await qc.invalidateQueries({ queryKey: ['site'] });
      fb.ok('Serviço salvo.');
      onClose();
    } catch (e) {
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={service ? 'Editar serviço' : 'Novo serviço'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Salvar serviço
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ImageField label="Foto do serviço" value={v.image} onChange={(image) => set({ image })} />
        <Input label="Nome *" value={v.title} error={errors.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
        <Textarea label="Descrição curta" rows={2} maxLength={240} value={v.summary} onChange={(e) => set({ summary: e.target.value })} hint="Aparece na lista de serviços e no Google." />
        <Textarea label="Texto completo" rows={6} maxLength={4000} value={v.body} onChange={(e) => set({ body: e.target.value })} hint="Página de detalhes. Linha em branco separa parágrafos." />
        <LinesEditor label="O que inclui" value={v.features} max={12} onChange={(features) => set({ features })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Endereço da página"
            value={v.slug}
            placeholder={slugify(v.title)}
            onChange={(e) => set({ slug: slugify(e.target.value) })}
            hint={`/servicos/${v.slug || slugify(v.title) || '…'}`}
            error={errors.slug}
          />
          <Input label="Ordem" type="number" value={String(v.sort)} onChange={(e) => set({ sort: Number(e.target.value) || 0 })} />
          <div className="pt-6">
            <Checkbox label="Ativo no site" checked={v.active} onChange={(active) => set({ active })} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function SiteServicesPage() {
  const fb = useFeedback();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ s: SiteService | null } | null>(null);
  const q = useQuery({ queryKey: ['site', 'services'], queryFn: siteRepo.services });

  async function remove(s: SiteService) {
    if (!(await fb.confirm({ title: 'Excluir serviço', message: `Excluir “${s.title}” do site? Para só esconder, desative-o.`, confirmLabel: 'Excluir', danger: true }))) return;
    try {
      await siteRepo.removeService(s.id);
      if (s.image?.src.startsWith('/media/')) await siteRepo.deleteImages([s.image]).catch(() => {});
      await qc.invalidateQueries({ queryKey: ['site'] });
    } catch (e) {
      fb.error(e);
    }
  }
  async function swap(a: SiteService, b: SiteService) {
    try {
      const strip = ({ id: _i, updatedAt: _u, ...r }: SiteService) => r;
      await siteRepo.saveService({ ...strip(a), sort: b.sort === a.sort ? a.sort + 1 : b.sort }, a.id);
      await siteRepo.saveService({ ...strip(b), sort: a.sort }, b.id);
      await qc.invalidateQueries({ queryKey: ['site'] });
    } catch (e) {
      fb.error(e);
    }
  }

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Serviços mostrados no site, na ordem abaixo. Também alimentam a lista do formulário de orçamento.</p>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing({ s: null })}>
          Novo serviço
        </Button>
      </div>
      {rows.length === 0 ? (
        <Empty title="Nenhum serviço">Cadastre os serviços que a empresa oferece.</Empty>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {rows.map((s, i) => (
            <li key={s.id} className={cx('flex items-center gap-3 p-3', i % 2 === 1 && 'bg-slate-50/60')}>
              <span className="w-6 text-xs font-semibold text-gray-400">{String(i + 1).padStart(2, '0')}</span>
              <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-gray-100">{s.image && <img src={previewSrc(s.image)} alt="" className="size-full object-cover" />}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">
                  {s.title} {!s.active && <Badge tone="gray">Inativo</Badge>} {s.image?.demo && <Badge tone="amber">Foto ilustrativa</Badge>}
                </p>
                <p className="truncate text-xs text-gray-500">{s.summary}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => void swap(s, rows[i - 1])}>
                  ↑
                </Button>
                <Button size="sm" variant="ghost" aria-label="Descer" disabled={i === rows.length - 1} onClick={() => void swap(s, rows[i + 1])}>
                  ↓
                </Button>
                <Button size="sm" icon={<Pencil className="size-4" />} onClick={() => setEditing({ s })}>
                  <span className="max-sm:hidden">Editar</span>
                </Button>
                <Button size="sm" variant="ghost" aria-label="Excluir" icon={<Trash2 className="size-4 text-red-600" />} onClick={() => void remove(s)} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <ServiceEditor service={editing.s} nextSort={(rows.at(-1)?.sort ?? 0) + 1} onClose={() => setEditing(null)} />}
    </div>
  );
}
