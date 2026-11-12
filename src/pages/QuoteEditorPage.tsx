import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { useAuth } from '../authentication/AuthContext';
import { CostSummary } from '../components/CostSummary';
import { useFeedback } from '../components/feedback';
import { Button, ErrorBox, Panel, Spinner, cx } from '../components/ui';
import { calculateDocument } from '../calculations/quote';
import { formatBRL } from '../calculations/money';
import { ApiError } from '../services/api';
import { quotesRepo } from '../repositories';
import { quoteDocumentSchema, type QuoteDocument } from '../schemas/quote';
import { EDITABLE_STATUSES } from '../types/domain';
import { STEPS, emptyDocument, stepForPath } from './quote/defaults';
import { normalizeDocument } from '../lib/applyTemplate';
import { ClientStep, CommercialStep, ExtrasStep, LaborStep, MaterialsStep, PricingStep, ProjectStep, ReviewStep } from './quote/Steps';

const DRAFT_KEY = 'scrm.quote-draft.new';

/** Rascunho local de conveniência apenas para um orçamento NOVO ainda não salvo (o banco é a fonte da verdade). */
const localDraft = {
  read(): QuoteDocument | null {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as QuoteDocument) : null;
    } catch {
      return null;
    }
  },
  write(d: QuoteDocument) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  },
};

export function QuoteEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { company } = useAuth();
  const isNew = !id;
  const existing = useQuery({ queryKey: ['quotes', id], queryFn: () => quotesRepo.get(id!), enabled: !!id });

  if (!isNew && existing.isLoading) return <Spinner />;
  if (!isNew && (existing.error || !existing.data)) return <ErrorBox error={existing.error} onRetry={() => existing.refetch()} />;

  let initial: QuoteDocument;
  let restored = false;
  if (isNew) {
    const d = localDraft.read();
    const base = emptyDocument(company, params.get('cliente') ?? '');
    const parsed = d ? quoteDocumentSchema.safeParse(d) : null;
    if (d && (!params.get('cliente') || d.clientId === params.get('cliente'))) {
      initial = parsed?.success ? parsed.data : { ...base, ...d };
      restored = true;
    } else initial = base;
  } else initial = existing.data!.current.document;
  initial = normalizeDocument(initial);

  return <Editor key={id ?? 'new'} initial={initial} restored={restored} quote={existing.data ?? null} />;
}

function Editor({ initial, restored, quote }: { initial: QuoteDocument; restored: boolean; quote: Awaited<ReturnType<typeof quotesRepo.get>> | null }) {
  const nav = useNavigate();
  const fb = useFeedback();
  const qc = useQueryClient();
  const { company } = useAuth();
  const [doc, setDoc] = useState<QuoteDocument>(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showRestored, setShowRestored] = useState(restored);
  const topRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLElement>(null);

  const locked = !!quote && (quote.current.locked || !EDITABLE_STATUSES.includes(quote.status));
  const calc = useMemo(() => calculateDocument(doc), [doc]);
  // Mantém a etapa atual visível na barra de etapas (que rola na horizontal no celular).
  useEffect(() => {
    const nav = stepsRef.current;
    const btn = nav?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (nav && btn) nav.scrollTo({ left: btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2, behavior: 'smooth' });
  }, [step]);

  const update = useCallback((fn: (d: QuoteDocument) => void) => {
    setDoc((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  }, []);

  // Rascunho local do orçamento novo (protege contra perda ao navegar/atualizar antes de salvar).
  useEffect(() => {
    if (!quote && dirty) localDraft.write(doc);
  }, [doc, dirty, quote]);

  // Aviso ao sair com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const goTo = (i: number) => {
    setStep(i);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  function validate(): QuoteDocument | null {
    const r = quoteDocumentSchema.safeParse(doc);
    if (!r.success) {
      const errs: Record<string, string> = {};
      for (const i of r.error.issues) {
        const k = i.path.join('.');
        if (!errs[k]) errs[k] = i.message;
      }
      setErrors(errs);
      const first = Object.keys(errs)[0];
      goTo(stepForPath(first));
      fb.error(`Corrija os campos destacados: ${errs[first]}`);
      return null;
    }
    if (!calc.valid) {
      goTo(5);
      fb.error(calc.errors[0]);
      return null;
    }
    setErrors({});
    return r.data;
  }

  async function save(status: 'rascunho' | 'em_elaboracao') {
    const data = validate();
    if (!data) return;
    setBusy(true);
    try {
      let result;
      if (!quote) {
        result = await quotesRepo.create(data, status);
        localDraft.clear();
      } else if (locked) {
        const ok = await fb.confirm({
          title: 'Gerar nova versão',
          message: `A versão ${quote.currentVersion} já foi enviada ao cliente e será preservada. As alterações serão salvas como versão ${quote.currentVersion + 1}.`,
          confirmLabel: 'Gerar nova versão',
        });
        if (!ok) return;
        result = await quotesRepo.newVersion(quote.id, data);
      } else {
        result = await quotesRepo.save(quote.id, data, status);
      }
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ['quotes'] });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.setQueryData(['quotes', result.id], result);
      fb.ok(`Orçamento ${result.code} salvo (versão ${result.currentVersion}).`);
      nav(`/orcamentos/${result.id}`);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) {
        setErrors(e.fields);
        goTo(stepForPath(Object.keys(e.fields)[0]));
      }
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }

  const props = { doc, update, errors, calc, company };
  const Body = [ClientStep, ProjectStep, MaterialsStep, LaborStep, ExtrasStep, PricingStep, CommercialStep][step];

  return (
    <div ref={topRef} className="scroll-mt-4">
      <Link to={quote ? `/orcamentos/${quote.id}` : '/orcamentos'} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="size-4" /> {quote ? quote.code : 'Orçamentos'}
      </Link>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{quote ? `Editar ${quote.code}` : 'Novo orçamento'}</h1>
          <p className="text-sm text-gray-500">
            {quote ? `Versão ${quote.currentVersion}` : 'Preencha as etapas; os cálculos são atualizados em tempo real.'}
            {dirty && <span className="ml-2 text-amber-700">· Alterações não salvas</span>}
          </p>
        </div>
        <Button variant="secondary" icon={<Save className="size-4" />} loading={busy} onClick={() => save('rascunho')} disabled={locked}>
          Salvar rascunho
        </Button>
      </div>

      {showRestored && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <span>Recuperamos um orçamento que estava sendo preenchido e ainda não foi salvo.</span>
          <Button
            size="sm"
            onClick={() => {
              localDraft.clear();
              setDoc(emptyDocument(company));
              setShowRestored(false);
              setDirty(false);
            }}
          >
            Descartar e começar do zero
          </Button>
        </div>
      )}
      {locked && quote && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          A versão {quote.currentVersion} já foi enviada ao cliente e não será sobrescrita. Ao salvar, será criada a <strong>versão {quote.currentVersion + 1}</strong>.
        </div>
      )}

      <nav ref={stepsRef} className="relative -mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Etapas">
        <ol className="flex min-w-max gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <button
                onClick={() => goTo(i)}
                className={cx(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium',
                  i === step ? 'bg-brand-700 text-white' : 'text-gray-600 hover:bg-gray-100',
                )}
                aria-current={i === step ? 'step' : undefined}
                data-step={i}
              >
                <span className={cx('flex size-5 items-center justify-center rounded-full text-[11px]', i === step ? 'bg-white/20' : 'bg-gray-100 text-gray-600')}>{i + 1}</span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          {step === 7 ? <ReviewStep {...props} goTo={goTo} /> : <Body {...props} />}
          <div className="hidden items-center justify-between md:flex">
            <Button icon={<ChevronLeft className="size-4" />} onClick={() => goTo(step - 1)} disabled={step === 0}>
              Voltar
            </Button>
            {step < 7 ? (
              <Button variant="primary" onClick={() => goTo(step + 1)}>
                Próximo <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button variant="primary" icon={<Save className="size-4" />} loading={busy} onClick={() => save('em_elaboracao')}>
                {locked ? 'Salvar como nova versão' : 'Salvar orçamento'}
              </Button>
            )}
          </div>
        </div>
        <aside className="mb-20 md:mb-0 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Resumo financeiro (interno)">
            <CostSummary r={calc} quantity={doc.project.quantity} />
          </Panel>
          <p className="mt-2 px-1 text-[11px] text-gray-500">Custos, margem e lucro são internos e não aparecem na proposta do cliente. Total: {formatBRL(calc.finalPrice)}.</p>
        </aside>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 pt-2 md:hidden">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="text-gray-500">
            Etapa {step + 1} de {STEPS.length} · {STEPS[step].label}
          </span>
          <span className={cx('num font-semibold', calc.valid ? 'text-gray-900' : 'text-red-700')}>{calc.valid ? formatBRL(calc.finalPrice) : 'Preço inválido'}</span>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" icon={<ChevronLeft className="size-4" />} onClick={() => goTo(step - 1)} disabled={step === 0}>
            Voltar
          </Button>
          {step < 7 ? (
            <Button className="flex-1" variant="primary" onClick={() => goTo(step + 1)}>
              Próximo <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button className="flex-1" variant="primary" icon={<Save className="size-4" />} loading={busy} onClick={() => save('em_elaboracao')}>
              {locked ? 'Nova versão' : 'Salvar'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
