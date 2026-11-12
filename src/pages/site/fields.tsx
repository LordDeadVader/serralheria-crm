/** Campos do painel do site: fotos (uma ou várias) e listas editáveis. */
import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Star, Trash2, Upload } from 'lucide-react';
import { useFeedback } from '../../components/feedback';
import { Button, Input, Textarea, cx } from '../../components/ui';
import { previewSrc, uploadSiteImage } from '../../lib/siteImages';
import type { SiteImage } from '../../schemas/site';

function DemoBadge() {
  return <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">Ilustrativa</span>;
}

/** Uma foto (com texto alternativo). */
export function ImageField({
  label,
  value,
  onChange,
  hint,
  ratio = 'aspect-[16/10]',
}: {
  label: string;
  value: SiteImage | null;
  onChange: (v: SiteImage | null) => void;
  hint?: string;
  ratio?: string;
}) {
  const fb = useFeedback();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      onChange(await uploadSiteImage(f, value?.alt ?? ''));
    } catch (e) {
      fb.error(e);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <div>
      <p className="mb-1 text-[13px] font-medium text-gray-700">{label}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className={cx('relative w-full shrink-0 overflow-hidden rounded-md border border-slate-300 bg-gray-100 sm:w-56', ratio)}>
          {value?.src ? <img src={previewSrc(value)} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-xs text-gray-400">Sem foto</div>}
          {value?.demo && <DemoBadge />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Upload className="size-4" />} loading={busy} onClick={() => input.current?.click()}>
              {value?.src ? 'Trocar foto' : 'Enviar foto'}
            </Button>
            {value?.src && (
              <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
                Remover
              </Button>
            )}
          </div>
          {value?.src && (
            <Input label="Descrição da imagem" value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} hint="Descreva o que aparece na foto (acessibilidade e Google)." />
          )}
          {value?.demo && <p className="text-xs text-amber-700">Imagem ilustrativa provisória — substitua por uma foto real da empresa.</p>}
          {hint && <p className="text-xs text-gray-500">{hint}</p>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files)} />
    </div>
  );
}

/** Galeria: várias fotos, escolha da principal, ordem e descrição. */
export function ImagesField({
  value,
  cover,
  onChange,
}: {
  value: SiteImage[];
  cover: number;
  onChange: (images: SiteImage[], cover: number) => void;
}) {
  const fb = useFeedback();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string>('');
  async function add(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const out: SiteImage[] = [];
    for (const [i, f] of list.entries()) {
      setBusy(`Otimizando e enviando ${i + 1} de ${list.length}…`);
      try {
        out.push(await uploadSiteImage(f));
      } catch (e) {
        fb.error(e);
      }
    }
    setBusy('');
    if (input.current) input.current.value = '';
    // Fotos reais substituem a principal ilustrativa automaticamente.
    const next = [...value, ...out];
    const coverIsDemo = value[cover]?.demo;
    onChange(next, coverIsDemo && out.length ? value.length : cover);
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next, cover === i ? j : cover === j ? i : cover);
  };
  const remove = (i: number) => {
    const next = value.filter((_, k) => k !== i);
    onChange(next, cover === i ? 0 : cover > i ? cover - 1 : cover);
  };
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-gray-700">Fotos ({value.length})</p>
        <Button size="sm" variant="primary" icon={<ImagePlus className="size-4" />} loading={!!busy} onClick={() => input.current?.click()}>
          Adicionar fotos
        </Button>
      </div>
      {busy && <p className="mb-2 text-xs text-gray-600">{busy}</p>}
      {value.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="grid w-full place-items-center rounded-md border border-dashed border-slate-400 py-10 text-sm text-gray-500 hover:border-brand-500"
        >
          Envie fotos de diferentes ângulos. Elas são otimizadas automaticamente.
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((img, i) => (
            <li key={img.src + i} className={cx('overflow-hidden rounded-md border bg-white', i === cover ? 'border-brand-600 ring-2 ring-brand-100' : 'border-slate-300')}>
              <div className="relative aspect-[4/3] bg-gray-100">
                <img src={previewSrc(img)} alt="" className="size-full object-cover" />
                {img.demo && <DemoBadge />}
                {i === cover && <span className="absolute right-1.5 bottom-1.5 rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">PRINCIPAL</span>}
              </div>
              <div className="space-y-1.5 p-1.5">
                <input
                  className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
                  placeholder="Descrição da foto"
                  value={img.alt}
                  onChange={(e) => onChange(value.map((x, k) => (k === i ? { ...x, alt: e.target.value } : x)), cover)}
                  aria-label={`Descrição da foto ${i + 1}`}
                />
                <div className="flex items-center gap-0.5">
                  <button type="button" title="Definir como principal" className="rounded p-1.5 text-gray-600 hover:bg-gray-100" onClick={() => onChange(value, i)}>
                    <Star className={cx('size-4', i === cover && 'fill-brand-600 text-brand-700')} />
                  </button>
                  <button type="button" title="Mover para trás" className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="size-4 -rotate-90" />
                  </button>
                  <button type="button" title="Mover para frente" className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="size-4 -rotate-90" />
                  </button>
                  <button type="button" title="Remover" className="ml-auto rounded p-1.5 text-red-600 hover:bg-red-50" onClick={() => remove(i)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void add(e.target.files)} />
    </div>
  );
}

/** Lista de itens com título e texto (diferenciais, etapas, destaques). */
export function ItemsEditor({
  items,
  onChange,
  max,
  addLabel,
  titleLabel = 'Título',
  textLabel = 'Texto',
}: {
  items: { title: string; text: string }[];
  onChange: (v: { title: string; text: string }[]) => void;
  max: number;
  addLabel: string;
  titleLabel?: string;
  textLabel?: string;
}) {
  const set = (i: number, patch: Partial<{ title: string; text: string }>) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className={cx('grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]', i % 2 === 1 && 'bg-slate-50/70')}>
          <span className="pt-1 text-xs font-semibold text-gray-400">{String(i + 1).padStart(2, '0')}</span>
          <div className="grid gap-2">
            <Input label={titleLabel} value={it.title} maxLength={80} onChange={(e) => set(i, { title: e.target.value })} />
            <Textarea label={textLabel} rows={2} value={it.text} maxLength={400} onChange={(e) => set(i, { text: e.target.value })} />
          </div>
          <div className="flex gap-1 sm:flex-col">
            <Button size="sm" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} icon={<ArrowUp className="size-4" />} />
            <Button size="sm" variant="ghost" aria-label="Descer" disabled={i === items.length - 1} onClick={() => move(i, 1)} icon={<ArrowDown className="size-4" />} />
            <Button size="sm" variant="ghost" aria-label="Remover" onClick={() => onChange(items.filter((_, k) => k !== i))} icon={<Trash2 className="size-4 text-red-600" />} />
          </div>
        </div>
      ))}
      {items.length < max && (
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => onChange([...items, { title: '', text: '' }])}>
          {addLabel}
        </Button>
      )}
    </div>
  );
}

/** Lista simples de linhas de texto (características, categorias). */
export function LinesEditor({ value, onChange, label, hint, max = 16 }: { value: string[]; onChange: (v: string[]) => void; label: string; hint?: string; max?: number }) {
  return (
    <Textarea
      label={label}
      rows={Math.min(8, Math.max(3, value.length + 1))}
      value={value.join('\n')}
      onChange={(e) =>
        onChange(
          e.target.value
            .split('\n')
            .slice(0, max)
            .map((l) => l.replace(/^\s+/, '')),
        )
      }
      hint={hint ?? 'Uma por linha.'}
    />
  );
}
