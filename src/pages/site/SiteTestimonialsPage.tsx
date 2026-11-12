import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useFeedback } from '../../components/feedback';
import { Badge, Button, Checkbox, Empty, ErrorBox, Input, Modal, Select, Spinner, Textarea } from '../../components/ui';
import { siteRepo, type SiteTestimonial } from '../../repositories/site';
import { siteTestimonialSchema, type SiteTestimonialInput } from '../../schemas/site';

const EMPTY: SiteTestimonialInput = { name: '', role: '', text: '', rating: null, source: '', published: true, sort: 0 };

function Editor({ t, onClose }: { t: SiteTestimonial | null; onClose: () => void }) {
  const fb = useFeedback();
  const qc = useQueryClient();
  const [v, setV] = useState<SiteTestimonialInput>(() => (t ? (({ id: _i, ...r }) => r)(t) : EMPTY));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<SiteTestimonialInput>) => setV((x) => ({ ...x, ...p }));
  async function save() {
    const r = siteTestimonialSchema.safeParse(v);
    if (!r.success) {
      const e: Record<string, string> = {};
      for (const i of r.error.issues) e[i.path.join('.')] ??= i.message;
      return setErrors(e);
    }
    setBusy(true);
    try {
      await siteRepo.saveTestimonial(r.data, t?.id);
      await qc.invalidateQueries({ queryKey: ['site'] });
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
      title={t ? 'Editar depoimento' : 'Novo depoimento'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-gray-600">Publique apenas depoimentos reais, com autorização do cliente.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nome do cliente *" value={v.name} error={errors.name} onChange={(e) => set({ name: e.target.value })} />
          <Input label="Complemento" value={v.role} placeholder="Ex.: Residência em Curitiba" onChange={(e) => set({ role: e.target.value })} />
        </div>
        <Textarea label="Depoimento *" rows={4} value={v.text} error={errors.text} maxLength={800} onChange={(e) => set({ text: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Avaliação" value={v.rating ?? ''} onChange={(e) => set({ rating: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Sem nota</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} estrela{n > 1 ? 's' : ''}
              </option>
            ))}
          </Select>
          <Input label="Origem" value={v.source} placeholder="Google, Instagram…" onChange={(e) => set({ source: e.target.value })} />
          <div className="pt-6">
            <Checkbox label="Publicado" checked={v.published} onChange={(published) => set({ published })} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function SiteTestimonialsPage() {
  const fb = useFeedback();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ t: SiteTestimonial | null } | null>(null);
  const q = useQuery({ queryKey: ['site', 'testimonials'], queryFn: siteRepo.testimonials });
  async function remove(t: SiteTestimonial) {
    if (!(await fb.confirm({ title: 'Excluir depoimento', message: `Excluir o depoimento de ${t.name}?`, confirmLabel: 'Excluir', danger: true }))) return;
    try {
      await siteRepo.removeTestimonial(t.id);
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
        <p className="text-sm text-gray-600">Sem depoimentos publicados, a seção fica oculta no site.</p>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing({ t: null })}>
          Novo depoimento
        </Button>
      </div>
      {rows.length === 0 ? (
        <Empty title="Nenhum depoimento">Peça a clientes satisfeitos uma frase sobre o trabalho e cadastre aqui.</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((t) => (
            <li key={t.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-800">“{t.text}”</p>
              <div className="mt-3 flex items-center gap-2">
                <p className="flex-1 text-sm font-medium">
                  {t.name} {t.rating ? <span className="text-brand-700">{'★'.repeat(t.rating)}</span> : null} {!t.published && <Badge tone="gray">Oculto</Badge>}
                </p>
                <Button size="sm" icon={<Pencil className="size-4" />} onClick={() => setEditing({ t })}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" aria-label="Excluir" icon={<Trash2 className="size-4 text-red-600" />} onClick={() => void remove(t)} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <Editor t={editing.t} onClose={() => setEditing(null)} />}
    </div>
  );
}
