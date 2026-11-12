import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useFeedback } from '../../components/feedback';
import { Button, ErrorBox, Input, Panel, Spinner, Textarea } from '../../components/ui';
import { siteRepo } from '../../repositories/site';
import { siteSettingsSchema, type SiteSettings } from '../../schemas/site';
import { ImageField, ItemsEditor, LinesEditor } from './fields';

export function SiteContentPage() {
  const fb = useFeedback();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['site', 'settings'], queryFn: siteRepo.settings });
  const [v, setV] = useState<SiteSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.data && !dirty) setV(q.data);
  }, [q.data, dirty]);

  if (q.isLoading || (!v && !q.error)) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const s = v!;

  function patch<K extends keyof SiteSettings>(k: K, p: Partial<SiteSettings[K]> | SiteSettings[K]) {
    setDirty(true);
    setV((x) => (x ? { ...x, [k]: Array.isArray(p) ? p : { ...(x[k] as object), ...(p as object) } } : x));
  }
  const co = (field: keyof SiteSettings['company'], label: string, hint?: string, extra?: Record<string, unknown>) => (
    <Input label={label} value={s.company[field]} hint={hint} onChange={(e) => patch('company', { [field]: e.target.value })} {...extra} />
  );

  async function save() {
    const r = siteSettingsSchema.safeParse({
      ...s,
      stats: s.stats.filter((x) => x.value.trim() && x.label.trim()),
      projectCategories: s.projectCategories.map((c) => c.trim()).filter(Boolean),
      differentials: { ...s.differentials, items: s.differentials.items.filter((i) => i.title.trim()) },
      process: { ...s.process, steps: s.process.steps.filter((i) => i.title.trim()) },
      about: { ...s.about, highlights: s.about.highlights.filter((i) => i.title.trim()) },
    });
    if (!r.success) {
      fb.error(new Error(`Confira os campos: ${r.error.issues.map((i) => i.path.join('.')).join(', ')}`));
      return;
    }
    setBusy(true);
    try {
      await siteRepo.saveSettings(r.data);
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ['site'] });
      fb.ok('Conteúdo salvo. O site já está atualizado.');
    } catch (e) {
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 pb-20">
      <Panel title="Empresa e contato">
        <p className="mb-4 text-sm text-gray-600">Campos vazios não aparecem no site. Preencha apenas informações verdadeiras.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {co('name', 'Nome da empresa *')}
          {co('legalName', 'Razão social', 'Aparece no rodapé.')}
          {co('cnpj', 'CNPJ')}
          {co('whatsapp', 'WhatsApp', 'Com DDD. Ativa os botões de WhatsApp do site.', { inputMode: 'tel' })}
          {co('phone', 'Telefone', undefined, { inputMode: 'tel' })}
          {co('email', 'E-mail', undefined, { type: 'email' })}
          {co('address', 'Endereço')}
          {co('city', 'Cidade', 'Usada no Google: “serralheria em [cidade]”.')}
          {co('state', 'UF', undefined, { maxLength: 2 })}
          {co('region', 'Região atendida', 'Ex.: Curitiba e região metropolitana')}
          {co('hours', 'Horário de funcionamento', 'Ex.: Seg. a sex., 8h às 18h · Sáb., 8h às 12h')}
          {co('instagram', 'Instagram', '@usuario ou link')}
          {co('facebook', 'Facebook (link)')}
          {co('mapsUrl', 'Link do Google Maps')}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Textarea label="Descrição curta da empresa" rows={2} maxLength={400} value={s.company.description} onChange={(e) => patch('company', { description: e.target.value })} hint="Rodapé e resultados do Google." />
          {co('tagline', 'Atividade principal', 'Ex.: Serralheria e estruturas metálicas')}
        </div>
      </Panel>

      <Panel title="Abertura da página inicial">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Input label="Linha de apoio" value={s.hero.eyebrow} maxLength={80} onChange={(e) => patch('hero', { eyebrow: e.target.value })} />
            <Textarea label="Título principal" rows={2} maxLength={120} value={s.hero.title} onChange={(e) => patch('hero', { title: e.target.value })} hint="Curto e direto. Até 8 palavras funciona melhor." />
            <Textarea label="Texto de apresentação" rows={3} maxLength={300} value={s.hero.subtitle} onChange={(e) => patch('hero', { subtitle: e.target.value })} />
            <Input label="Vídeo de fundo (opcional)" value={s.hero.videoUrl} placeholder="https://…/video.mp4" onChange={(e) => patch('hero', { videoUrl: e.target.value })} hint="Link direto para um MP4 curto e leve (até ~8 MB). Só toca em computadores." />
          </div>
          <ImageField label="Foto de abertura" value={s.hero.image} onChange={(image) => patch('hero', { image })} hint="Horizontal, de boa qualidade: um portão, escada ou estrutura em destaque." />
        </div>
        <div className="mt-5 grid gap-3 border-t border-gray-100 pt-5 lg:grid-cols-2">
          <Textarea label="Frase de apresentação (seção “Atuação”)" rows={2} maxLength={200} value={s.intro.title} onChange={(e) => patch('intro', { title: e.target.value })} />
          <Textarea label="Texto de apresentação" rows={4} maxLength={800} value={s.intro.text} onChange={(e) => patch('intro', { text: e.target.value })} />
        </div>
      </Panel>

      <Panel title="Números da empresa">
        <p className="mb-3 text-sm text-gray-600">
          Opcional. Use somente números reais e verificáveis (ex.: anos de atuação, projetos entregues). Sem números, a faixa não aparece.
        </p>
        <div className="space-y-2">
          {s.stats.map((st, i) => (
            <div key={i} className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-end gap-2">
              <Input label="Número" value={st.value} maxLength={12} onChange={(e) => patch('stats', s.stats.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} />
              <Input label="Descrição" value={st.label} maxLength={60} onChange={(e) => patch('stats', s.stats.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
              <Button variant="ghost" aria-label="Remover" icon={<Trash2 className="size-4 text-red-600" />} onClick={() => patch('stats', s.stats.filter((_, k) => k !== i))} />
            </div>
          ))}
          {s.stats.length < 4 && (
            <Button size="sm" icon={<Plus className="size-4" />} onClick={() => patch('stats', [...s.stats, { value: '', label: '' }])}>
              Adicionar número
            </Button>
          )}
        </div>
      </Panel>

      <Panel title="Diferenciais">
        <Input label="Título da seção" value={s.differentials.title} onChange={(e) => patch('differentials', { title: e.target.value })} wrapClass="mb-3 max-w-lg" />
        <ItemsEditor items={s.differentials.items} max={8} addLabel="Adicionar diferencial" onChange={(items) => patch('differentials', { items })} />
      </Panel>

      <Panel title="Sobre a empresa">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Input label="Título" value={s.about.title} maxLength={120} onChange={(e) => patch('about', { title: e.target.value })} />
            <Textarea
              label="História da empresa"
              rows={10}
              maxLength={3000}
              value={s.about.text}
              onChange={(e) => patch('about', { text: e.target.value })}
              hint="Quando começou, quem conduz, estrutura, equipamentos, como atende. Linha em branco separa parágrafos."
            />
          </div>
          <div className="space-y-4">
            <ImageField label="Foto principal (oficina, equipe)" value={s.about.image} onChange={(image) => patch('about', { image })} />
            <ImageField label="Foto secundária" value={s.about.image2} onChange={(image2) => patch('about', { image2 })} />
          </div>
        </div>
        <div className="mt-5 border-t border-gray-100 pt-5">
          <p className="mb-2 text-sm font-medium text-gray-800">Estrutura, equipe e equipamentos (opcional)</p>
          <ItemsEditor items={s.about.highlights} max={6} addLabel="Adicionar destaque" onChange={(highlights) => patch('about', { highlights })} />
        </div>
      </Panel>

      <Panel title="Processo de trabalho">
        <Input label="Título da seção" value={s.process.title} onChange={(e) => patch('process', { title: e.target.value })} wrapClass="mb-3 max-w-lg" />
        <ItemsEditor items={s.process.steps} max={8} addLabel="Adicionar etapa" titleLabel="Etapa" textLabel="Explicação" onChange={(steps) => patch('process', { steps })} />
      </Panel>

      <Panel title="Chamada final (antes do rodapé)">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Input label="Título" value={s.cta.title} maxLength={120} onChange={(e) => patch('cta', { title: e.target.value })} />
            <Textarea label="Texto" rows={3} maxLength={300} value={s.cta.text} onChange={(e) => patch('cta', { text: e.target.value })} />
          </div>
          <ImageField label="Foto de fundo" value={s.cta.image} onChange={(image) => patch('cta', { image })} />
        </div>
      </Panel>

      <Panel title="Portfólio e Google">
        <div className="grid gap-4 lg:grid-cols-2">
          <LinesEditor label="Categorias do portfólio (filtros)" value={s.projectCategories} onChange={(projectCategories) => patch('projectCategories', projectCategories)} />
          <div className="space-y-3">
            <Input label="Título no Google (opcional)" value={s.seo.title} maxLength={70} onChange={(e) => patch('seo', { title: e.target.value })} hint="Vazio = gerado com o nome e a cidade." />
            <Textarea label="Descrição no Google (opcional)" rows={3} maxLength={170} value={s.seo.description} onChange={(e) => patch('seo', { description: e.target.value })} />
          </div>
        </div>
      </Panel>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
          <p className="text-sm text-gray-600">{dirty ? 'Há alterações não salvas.' : 'Tudo salvo.'}</p>
          <Button variant="primary" icon={<Save className="size-4" />} loading={busy} disabled={!dirty} onClick={() => void save()}>
            Salvar conteúdo
          </Button>
        </div>
      </div>
    </div>
  );
}
