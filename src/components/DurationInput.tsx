import { useId } from 'react';
import { splitHours } from '../lib/format';
import { Field } from './ui';
import { NumInput } from './NumInput';

/**
 * Tempo em horas + minutos. O valor continua sendo guardado em horas decimais
 * (1 h 30 min = 1,5 h), que é o que o cálculo usa. Minutos acima de 59 são
 * convertidos em horas automaticamente ao sair do campo.
 */
export function DurationInput({
  value,
  onChange,
  label,
  hint,
  error,
  wrapClass,
  ariaLabel,
}: {
  value: number;
  onChange: (hours: number) => void;
  label?: string;
  hint?: string;
  error?: string;
  wrapClass?: string;
  ariaLabel?: string;
}) {
  const id = useId();
  const { h, m } = splitHours(value);
  const set = (hh: number, mm: number) => onChange(Math.max(0, hh) + Math.max(0, mm) / 60);
  const fields = (
    <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={ariaLabel ?? label ?? 'Tempo'} id={id}>
      <NumInput ariaLabel={`${ariaLabel ?? label ?? 'Tempo'} — horas`} suffix="h" value={h} onChange={(n) => set(n ?? 0, m)} />
      <NumInput ariaLabel={`${ariaLabel ?? label ?? 'Tempo'} — minutos`} suffix="min" value={m} onChange={(n) => set(h, Math.round(n ?? 0))} />
    </div>
  );
  if (!label && !hint && !error) return fields;
  return (
    <Field label={label} hint={hint} error={error} className={wrapClass} htmlFor={id}>
      {fields}
    </Field>
  );
}
