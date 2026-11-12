import { z } from 'zod';
import { UNITS } from '../calculations/units';
import { money, pct, qty, str } from './common';

/**
 * Modelos de orçamento:
 *  - "projeto": serviço predefinido (ex.: Testeira em ACM adesivada). Preenche a descrição
 *    e já puxa materiais, insumos e mão de obra; o orçamentista ajusta o resto.
 *  - "kit": conjunto que se adiciona a qualquer orçamento (ex.: Holofote 50 W com braço em
 *    tubo 15x15, pintura e fio), multiplicado pela quantidade.
 * Linhas de material podem estar vinculadas ao cadastro de materiais: o custo vem SEMPRE do
 * cadastro no momento do uso (preço atual). Sem vínculo, o custo fica em branco para preencher.
 */
export const templateMaterialSchema = z.object({
  materialId: z.string().max(64).nullable().default(null),
  name: z.string().trim().min(1, 'Informe o material').max(160),
  unit: z.enum(UNITS).default('un'),
  qty: qty.default(1),
  /** null = usa o desperdício padrão da empresa. */
  wastePct: pct.nullable().default(null),
});

export const templateLaborSchema = z.object({
  serviceId: z.string().max(64).nullable().default(null),
  name: z.string().trim().min(1, 'Informe o serviço').max(160),
  mode: z.enum(['hour', 'fixed']).default('hour'),
  /** Horas por funcionário (modo por hora). */
  qty: qty.default(1),
  workers: z.coerce.number().int().min(1).max(100).default(1),
  /** 0 = usa o valor do cadastro de serviços ou o custo/hora padrão da empresa. */
  rate: money.default(0),
});

export const templateExtraSchema = z.object({
  description: z.string().trim().min(1, 'Descreva a despesa').max(160),
  kind: z.enum(['indireto', 'transporte', 'outro']).default('outro'),
  amount: money.default(0),
});

export const TEMPLATE_KINDS = ['projeto', 'kit'] as const;

export const templateSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(160),
  kind: z.enum(TEMPLATE_KINDS).default('projeto'),
  serviceType: str(80),
  description: str(3000),
  specifications: str(3000),
  finish: str(300),
  notes: str(1000),
  materials: z.array(templateMaterialSchema).max(100).default([]),
  labor: z.array(templateLaborSchema).max(50).default([]),
  extras: z.array(templateExtraSchema).max(50).default([]),
});
export type TemplateInput = z.infer<typeof templateSchema>;
export type TemplateMaterial = z.infer<typeof templateMaterialSchema>;
export type TemplateLabor = z.infer<typeof templateLaborSchema>;

/* As predefinições (modelos e kits iniciais) ficam em src/data/presets.ts, gerado por scripts/presets/generate.py. */
