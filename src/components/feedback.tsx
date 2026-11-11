import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Button, Modal, cx } from './ui';

type Toast = { id: number; kind: 'ok' | 'error'; text: string };
type ConfirmOpts = { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean };

interface FeedbackApi {
  ok: (text: string) => void;
  error: (e: unknown) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirm] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);

  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);

  const api: FeedbackApi = {
    ok: (t) => push('ok', t),
    error: (e) => push('error', e instanceof Error ? e.message : String(e)),
    confirm: (o) => new Promise((resolve) => setConfirm({ ...o, resolve })),
  };

  const close = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirm(null);
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-md border bg-white px-3 py-2.5 text-sm shadow-sm',
              t.kind === 'ok' ? 'border-emerald-200' : 'border-red-200',
            )}
          >
            {t.kind === 'ok' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />}
            <span className="flex-1 text-gray-800">{t.text}</span>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Fechar" className="text-gray-400 hover:text-gray-600">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <Modal
        open={!!confirmState}
        onClose={() => close(false)}
        title={confirmState?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button onClick={() => close(false)}>Cancelar</Button>
            <Button variant={confirmState?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {confirmState?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-gray-700">{confirmState?.message}</div>
      </Modal>
    </Ctx.Provider>
  );
}

export function useFeedback() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFeedback fora do provider');
  return v;
}
