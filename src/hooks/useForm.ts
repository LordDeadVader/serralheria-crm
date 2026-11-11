import { useCallback, useState } from 'react';
import type { z } from 'zod';
import { ApiError } from '../services/api';

/** Estado de formulário simples com validação zod (cliente) e erros de campo vindos da API (servidor). */
export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = useCallback(<K extends keyof T>(k: K, v: T[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => {
      if (!e[k as string]) return e;
      const n = { ...e };
      delete n[k as string];
      return n;
    });
  }, []);

  const validate = useCallback(
    <S extends z.ZodType>(schema: S): z.infer<S> | null => {
      const r = schema.safeParse(values);
      if (r.success) {
        setErrors({});
        return r.data;
      }
      const errs: Record<string, string> = {};
      for (const i of r.error.issues) {
        const k = i.path.join('.');
        if (!errs[k]) errs[k] = i.message;
      }
      setErrors(errs);
      return null;
    },
    [values],
  );

  const applyApiError = useCallback((e: unknown) => {
    if (e instanceof ApiError && Object.keys(e.fields).length) setErrors(e.fields);
  }, []);

  return { values, setValues, set, errors, setErrors, validate, applyApiError, reset: () => setValues(initial) };
}
