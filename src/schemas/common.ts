import { z } from 'zod';

export const str = (max = 200) => z.string().trim().max(max).default('');
export const pct = z.coerce.number().min(0, 'Não pode ser negativo').lt(100, 'Deve ser menor que 100%');
export const money = z.coerce.number().min(0, 'Não pode ser negativo').max(100_000_000);
export const qty = z.coerce.number().min(0, 'Não pode ser negativo').max(1_000_000);

export function onlyDigits(v: string) {
  return v.replace(/\D/g, '');
}

export function isValidCPF(v: string): boolean {
  const c = onlyDigits(v);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(c[i]) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

export function isValidCNPJ(v: string): boolean {
  const c = onlyDigits(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(c[i]) * w[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export const emailOpt = z
  .string()
  .trim()
  .max(200)
  .default('')
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'E-mail inválido');

export const cnpjOpt = z
  .string()
  .trim()
  .max(20)
  .default('')
  .refine((v) => v === '' || isValidCNPJ(v), 'CNPJ inválido');
