import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { useFeedback } from '../../components/feedback';
import { Badge, Button, Checkbox, Empty, ErrorBox, Input, Modal, Select, Spinner, Textarea } from '../../components/ui';
import { previewSrc } from '../../lib/siteImages';
import { siteRepo, type SiteProject } from '../../repositories/site';
import { siteProjectSchema, slugify, type SiteProjectInput } from '../../schemas/site';
import { ImagesField, LinesEditor } from './fields';

const EMPTY: SiteProjectInput = {
  slug: '',
  title: '',
  category: '',
  summary: '',
  description: '',
  features: [],
  materials: '',
  location: '',
  year: '',
  images: [],
  coverIndex: 0,
  featured: false,
  published: true,
  sort: 0,
};

const toInput = (p: SiteProject): SiteProjectInput => {
  const { id: _id, isDemo: _d, createdAt: _c, updatedAt: _u, ...rest } = p;
  return rest;
};

function ProjectEditor({ project, categories, onClose }: { project: SiteProject | null; categories: string[]; onClose: () => void }) {
  const fb = useFeedback();
  const qc = useQueryClient();
  const [v, setV] = useState<SiteProjectInput>(project ? toInput(project) : { ...EMPTY, category: categories[0] ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<SiteProjectInput>) => setV((x) => ({ ...x, ...patch }));
  const original = project?.images ?? [];

  async function save() {
    const r = siteProjectSchema.safeParse({ ...v, features: v.features.filter((f) => f.trim()) });
    if (!r.success) {
      const e: Record<string, string> = {};
      for (const i of r.error.issues) e[i.path.join('.')] ??= i.message;
      setErrors(e);
      return;
    }
    setBusy(true);
    try {
      await siteRepo.saveProject(r.data, project?.id);
      // Fotos enviadas e depois removidas do projeto são apagadas do armazenamento.
      const removed = original.filter((o) => !r.data.images.some((n) => n.src === o.src) && o.src.startsWith('/media/'));
      if (removed.length) await siteRepo.deleteImages(removed).catch(() => {});
      await qc.invalidateQueries({ queryKey: ['site'] });
      fb.ok('Projeto salvo. O site já mostra a nova versão.');
      onClose();
    } catch (e) {
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }

  const cats = Array.from(new Set([...categories, v.category].filter(Boolean)));
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={project ? 'Editar projeto' : 'Novo projeto'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Salvar projeto
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {project?.isDemo && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Este é um projeto de demonstração com imagens ilustrativas. Envie fotos reais e ajuste os textos — ou exclua o projeto.
          </p>
        )}
        <ImagesField value={v.images} cover={v.coverIndex} onChange={(images, coverIndex) => set({ images, coverIndex })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Título *" value={v.title} error={errors.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
          <Select label="Categoria" value={v.category} onChange={(e) => set({ category: e.target.value })} hint="As categorias são editadas em “Textos e contato”.">
            <option value="">Sem categoria</option>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Input label="Local (cidade/bairro)" value={v.location} maxLength={120} onChange={(e) => set({ location: e.target.value })} />
          <Input label="Ano" value={v.year} maxLength={4} inputMode="numeric" onChange={(e) => set({ year: e.target.value.replace(/\D/g, '') })} />
        </div>
        <Textarea label="Resumo" rows={2} maxLength={240} value={v.summary} onChange={(e) => set({ summary: e.target.value })} hint="Uma frase que aparece no topo da página do projeto e no Google." />
        <Textarea label="Descrição" rows={6} maxLength={5000} value={v.description} onChange={(e) => set({ description: e.target.value })} hint="Deixe uma linha em branco para separar parágrafos." />
        <div className="grid gap-3 sm:grid-cols-2">
          <LinesEditor label="Características do trabalho" value={v.features} onChange={(features) => set({ features })} />
          <Textarea label="Materiais utilizados" rows={3} maxLength={300} value={v.materials} onChange={(e) => set({ materials: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Endereço da página"
            value={v.slug}
            placeholder={slugify(v.title) || 'gerado pelo título'}
            onChange={(e) => set({ slug: slugify(e.target.value) })}
            hint={`/projetos/${v.slug || slugify(v.title) || '…'}`}
            error={errors.slug}
          />
          <Input label="Ordem" type="number" value={String(v.sort)} onChange={(e) => set({ sort: Number(e.target.value) || 0 })} hint="Menor aparece primeiro." />
          <div className="space-y-2 pt-5">
            <Checkbox label="Publicado no site" checked={v.published} onChange={(published) => set({ published })} />
            <Checkbox label="Destaque na página inicial" checked={v.featured} onChange={(featured) => set({ featured })} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function SiteProjectsPage() {
  const fb = useFeedback();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ p: SiteProject | null } | null>(null);
  const q = useQuery({ queryKey: ['site', 'projects'], queryFn: siteRepo.projects });
  const settings = useQuery({ queryKey: ['site', 'settings'], queryFn: siteRepo.settings });

  async function remove(p: SiteProject) {
    if (!(await fb.confirm({ title: 'Excluir projeto', message: `Excluir “${p.title}” e suas fotos? Ele sai do site imediatamente.`, confirmLabel: 'Excluir', danger: true }))) return;
    try {
      await siteRepo.removeProject(p.id);
      await qc.invalidateQueries({ queryKey: ['site'] });
      fb.ok('Projeto excluído.');
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
        <p className="text-sm text-gray-600">Portfólio do site. Projetos em destaque aparecem na página inicial.</p>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing({ p: null })}>
          Novo projeto
        </Button>
      </div>
      {rows.length === 0 ? (
        <Empty title="Nenhum projeto cadastrado">Cadastre trabalhos realizados com fotos de diferentes ângulos.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const cover = p.images[p.coverIndex] ?? p.images[0];
            return (
              <li key={p.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <button type="button" className="relative block aspect-[16/10] w-full bg-gray-100" onClick={() => setEditing({ p })} aria-label={`Editar ${p.title}`}>
                  {cover && <img src={previewSrc(cover)} alt="" className="size-full object-cover" loading="lazy" />}
                  <span className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {!p.published && <Badge tone="gray">Rascunho</Badge>}
                    {p.featured && <Badge tone="brand">Destaque</Badge>}
                    {p.isDemo && <Badge tone="amber">Demonstração</Badge>}
                  </span>
                </button>
                <div className="p-3">
                  <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">{p.category || 'Sem categoria'}</p>
                  <p className="mt-0.5 truncate font-medium text-gray-900">{p.title}</p>
                  <p className="text-xs text-gray-500">{p.images.length} foto(s)</p>
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" icon={<Pencil className="size-4" />} onClick={() => setEditing({ p })}>
                      Editar
                    </Button>
                    {p.published && (
                      <a href={`/projetos/${p.slug}`} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-[13px] text-brand-800 hover:bg-brand-50 md:h-8">
                        Ver <ExternalLink className="size-3.5" />
                      </a>
                    )}
                    <Button size="sm" variant="ghost" className="ml-auto" aria-label="Excluir" icon={<Trash2 className="size-4 text-red-600" />} onClick={() => void remove(p)} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <ProjectEditor project={editing.p} categories={settings.data?.projectCategories ?? []} onClose={() => setEditing(null)} />}
    </div>
  );
}
