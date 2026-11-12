import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { renderToBuffer } from '@react-pdf/renderer';
import { calculateDocument } from '../src/calculations/quote';
import { allocateClientLines } from '../src/pdf/allocate';
import { QuotePdf } from '../src/pdf/QuotePdf';
import { pdfPageCount } from '../src/pdf/generate';
import { defaultCompanySettings } from '../src/schemas/settings';
import { emptyTravel, type QuoteDocument } from '../src/schemas/quote';
import type { Client, Company } from '../src/types/domain';

const doc: QuoteDocument = {
  clientId: 'c1',
  project: {
    name: 'Portão de correr 3,00 x 2,00 m',
    serviceType: 'Portão de correr',
    description: 'Portão de correr em metalon com fechamento em chapa lisa, trilho e roldanas.',
    width: 3,
    height: 2,
    depth: null,
    dimensionUnit: 'm',
    quantity: 1,
    installLocation: 'Rua das Flores, 100 - Centro - São Paulo/SP',
    finish: 'Fundo anticorrosivo + esmalte sintético preto',
    specifications: 'Quadro em metalon 40x40, travessas em 30x30, chapa 18.',
    notes: 'NOTA INTERNA NÃO DEVE APARECER',
  },
  materials: [
    { key: 'a', materialId: null, code: '', name: 'Metalon 40x40', unit: 'm', qty: 14, unitCost: 15, wastePct: 10 },
    { key: 'b', materialId: null, code: '', name: 'Chapa de aço', unit: 'm2', qty: 6, unitCost: 140, wastePct: 5 },
    { key: 'c', materialId: null, code: '', name: 'Roldana', unit: 'un', qty: 4, unitCost: 25, wastePct: 0 },
  ],
  labor: [
    { key: 'l', serviceId: null, name: 'Soldagem', mode: 'hour', qty: 8, workers: 1, rate: 35 },
    { key: 'm', serviceId: null, name: 'Instalação', mode: 'hour', qty: 4, workers: 1, rate: 40 },
  ],
  extras: [
    { key: 'e', description: 'Frete', kind: 'transporte', amount: 80 },
    { key: 'f', description: 'Rateio aluguel', kind: 'indireto', amount: 30 },
  ],
  travel: emptyTravel(),
  pricing: { overheadPct: 10, taxPct: 6, feePct: 2, commissionPct: 0, marginPct: 25, manualPrice: null },
  commercial: {
    validityDays: 15,
    paymentTerms: '50% na aprovação e saldo na instalação.',
    downPaymentPct: 50,
    installments: 2,
    fabricationDays: 12,
    installationDays: 1,
    warranty: '12 meses contra defeitos de fabricação.',
    notes: 'Valores para pagamento via PIX.',
    responsible: 'Responsável Teste',
    showItemized: true,
  },
};

const company: Company = {
  id: 'x',
  name: 'Serralheria Exemplo',
  legalName: 'Serralheria Exemplo LTDA',
  cnpj: '11.222.333/0001-81',
  address: 'Av. Industrial, 500 - São Paulo/SP',
  phone: '(11) 3333-4444',
  whatsapp: '(11) 99999-0000',
  email: 'contato@exemplo.com',
  logo: null,
  settings: defaultCompanySettings(),
};

const client = { name: 'José da Silva', personType: 'PF', document: '529.982.247-25', whatsapp: '(11) 98888-7777', phone: '', email: '' } as Client;

describe('PDF da proposta', () => {
  const calc = calculateDocument(doc);

  it('itens alocados somam exatamente o valor de venda e excluem despesas indiretas', () => {
    const lines = allocateClientLines(doc, calc);
    const sum = Math.round(lines.reduce((s, l) => s + l.value, 0) * 100) / 100;
    expect(sum).toBe(calc.finalPrice);
    expect(lines.some((l) => l.description === 'Rateio aluguel')).toBe(false);
  });

  it('gera um PDF válido (itens detalhados e valor global)', async () => {
    for (const showItemized of [true, false]) {
      const d = { ...doc, commercial: { ...doc.commercial, showItemized } };
      const buf = await renderToBuffer(<QuotePdf company={company} client={client} code="ORC-2026-0001" version={2} issuedAt="2026-11-11T12:00:00Z" doc={d} calc={calc} />);
      expect(buf.subarray(0, 4).toString()).toBe('%PDF');
      expect(buf.length).toBeGreaterThan(2000);
      if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/proposta-${showItemized ? 'itens' : 'global'}.pdf`, buf);
    }
  }, 30_000);

  it('proposta típica cabe em uma folha A4; proposta longa usa o modo compacto', async () => {
    for (const showItemized of [true, false]) {
      const d = { ...doc, commercial: { ...doc.commercial, showItemized } };
      const buf = await renderToBuffer(<QuotePdf company={company} client={client} code="ORC-2026-0002" version={2} issuedAt="2026-11-11T12:00:00Z" doc={d} calc={calc} />);
      if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/uma-folha-${showItemized ? 'itens' : 'global'}.pdf`, buf);
      expect(pdfPageCount(buf)).toBe(1);
    }
    // 12 itens + textos longos: não cabe no normal, cabe no compacto.
    const many = Array.from({ length: 12 }, (_, i) => ({ key: `m${i}`, materialId: null, code: '', name: `Material ${i + 1} com descrição um pouco mais longa`, unit: 'un' as const, qty: 2, unitCost: 50, wastePct: 0 }));
    const long = {
      ...doc,
      materials: many,
      project: { ...doc.project, specifications: ['Quadro em metalon 40x40, travessas em 30x30, chapa 18.', 'Fixação com chumbadores.', 'Pintura eletrostática.', 'Instalação inclusa.'].join(String.fromCharCode(10)) },
      commercial: { ...doc.commercial, notes: 'Valores para pagamento via PIX. Frete incluso para a região metropolitana. Medidas sujeitas a conferência no local.' },
    };
    const lcalc = calculateDocument(long);
    const normal = await renderToBuffer(<QuotePdf company={company} client={client} code="ORC-2026-0003" version={1} issuedAt="2026-11-11T12:00:00Z" doc={long} calc={lcalc} />);
    const compact = await renderToBuffer(<QuotePdf company={company} client={client} code="ORC-2026-0003" version={1} issuedAt="2026-11-11T12:00:00Z" doc={long} calc={lcalc} density="compact" />);
    if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/longa-compacta.pdf`, compact);
    expect(pdfPageCount(normal)).toBeGreaterThanOrEqual(1);
    expect(pdfPageCount(compact)).toBe(1);
  }, 60_000);
});
