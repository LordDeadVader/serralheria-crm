import { useEffect, useRef, useState, type ReactNode } from 'react';
import { parseNum } from '../lib/format';
import { Input } from './ui';

/** Campo numérico que aceita vírgula decimal e não "briga" com o usuário durante a digitação. */
export function NumInput({
  value,
  onChange,
  label,
  error,
  hint,
  suffix,
  wrapClass,
  className,
  nullable,
  placeholder,
  ariaLabel,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label?: string;
  error?: string;
  hint?: ReactNode;
  suffix?: string;
  wrapClass?: string;
  className?: string;
  nullable?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const fmt = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value]);
  return (
    <Input
      label={label}
      error={error}
      hint={hint}
      suffix={suffix}
      wrapClass={wrapClass}
      className={`num text-right ${className ?? ''}`}
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focused.current = false;
        setText(fmt(value));
      }}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d,.-]/g, '');
        setText(t);
        onChange(nullable && t.trim() === '' ? null : parseNum(t));
      }}
    />
  );
}
