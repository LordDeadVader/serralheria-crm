import {
  forwardRef,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Loader2, X } from 'lucide-react';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

/* ------------------------------- Botões ------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 border border-brand-700',
  secondary: 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50',
  ghost: 'text-gray-700 hover:bg-gray-100 border border-transparent',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...p }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...p}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ----------------------------- Formulários ---------------------------- */

const inputCls =
  'block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-500';

export function Field({ label, error, hint, children, className, htmlFor }: { label?: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium text-gray-700">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: ReactNode; wrapClass?: string; suffix?: string }>(
  function Input({ label, error, hint, wrapClass, className, id, suffix, ...p }, ref) {
    const auto = useId();
    const iid = id ?? auto;
    const el = (
      <div className="relative">
        <input ref={ref} id={iid} className={cx(inputCls, error && 'border-red-400', suffix && 'pr-9', className)} aria-invalid={!!error} {...p} />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-gray-500">{suffix}</span>}
      </div>
    );
    if (!label && !error && !hint) return el;
    return (
      <Field label={label} error={error} hint={hint} className={wrapClass} htmlFor={iid}>
        {el}
      </Field>
    );
  },
);

export function Select({ label, error, hint, wrapClass, className, children, id, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; hint?: ReactNode; wrapClass?: string }) {
  const auto = useId();
  const iid = id ?? auto;
  const el = (
    <select id={iid} className={cx(inputCls, 'pr-8', error && 'border-red-400', className)} {...p}>
      {children}
    </select>
  );
  if (!label && !error) return el;
  return (
    <Field label={label} error={error} hint={hint} className={wrapClass} htmlFor={iid}>
      {el}
    </Field>
  );
}

export function Textarea({ label, error, wrapClass, className, id, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; wrapClass?: string }) {
  const auto = useId();
  const iid = id ?? auto;
  return (
    <Field label={label} error={error} className={wrapClass} htmlFor={iid}>
      <textarea id={iid} rows={3} className={cx(inputCls, 'resize-y', error && 'border-red-400', className)} {...p} />
    </Field>
  );
}

export function Checkbox({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
      <input type="checkbox" className="mt-0.5 size-4 rounded border-gray-300 accent-brand-700" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  );
}

/* ------------------------------- Layout ------------------------------- */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx('min-w-0 rounded-lg border border-gray-200 bg-white', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {actions}
        </header>
      )}
      <div className={bodyClass ?? 'p-4'}>{children}</div>
    </section>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">{children}</div>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-gray-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Erro inesperado.';
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{msg}</span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'brand' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700 ring-gray-200',
    blue: 'bg-sky-50 text-sky-800 ring-sky-200',
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    violet: 'bg-violet-50 text-violet-800 ring-violet-200',
    brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  } as const;
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', tones[tone])}>{children}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'neg' | 'pos' }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={cx('num mt-0.5 truncate text-lg font-semibold', tone === 'neg' ? 'text-red-700' : tone === 'pos' ? 'text-emerald-700' : 'text-gray-900')}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

/* -------------------------------- Modal ------------------------------- */

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className={cx('flex min-h-full w-full flex-col bg-white sm:min-h-0 sm:rounded-lg sm:border sm:border-gray-200', w)}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3 sm:rounded-t-lg">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button className="rounded p-1 text-gray-500 hover:bg-gray-100" onClick={onClose} aria-label="Fechar">
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 px-5 py-4">{children}</div>
        {footer && <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 sm:rounded-b-lg">{footer}</footer>}
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Pesquisar…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cx(inputCls, 'w-full sm:w-72')} aria-label={placeholder} />;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: ReactNode }>; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx('inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[13px] font-medium', value === o.value ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
