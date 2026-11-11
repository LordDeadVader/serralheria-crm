import type { z } from 'zod';
import { HttpError, type Ctx } from './context';

/** Valida o corpo JSON no servidor (a validação do frontend é apenas conveniência). */
export async function body<S extends z.ZodType>(c: Ctx, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, 'JSON inválido.');
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const issue of r.error.issues) {
      const k = issue.path.join('.');
      if (!fields[k]) fields[k] = issue.message;
    }
    throw new HttpError(422, 'Dados inválidos.', { fields });
  }
  return r.data;
}
