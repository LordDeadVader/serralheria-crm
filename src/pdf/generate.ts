import { createElement } from 'react';
import type { PdfDensity, QuotePdfProps } from './QuotePdf';

/** Número de páginas lido da árvore de páginas do PDF (objeto não comprimido "/Count n"). */
export function pdfPageCount(bytes: Uint8Array): number {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const counts = [...text.matchAll(/\/Count (\d+)/g)].map((m) => Number(m[1]));
  return counts.length ? Math.max(...counts) : 1;
}

/**
 * Gera o PDF sob demanda (a biblioteca é carregada apenas quando necessária).
 * Tenta caber em 1 folha: gera no layout normal e, se passar de 1 página,
 * gera de novo no layout compacto. Só fica com 2+ folhas quando é inevitável.
 */
export async function generateQuotePdf(props: QuotePdfProps): Promise<Blob> {
  let mods;
  try {
    mods = await Promise.all([import('@react-pdf/renderer'), import('./QuotePdf')]);
  } catch (e) {
    // Sistema atualizado enquanto a página estava aberta: os arquivos antigos não existem mais.
    if (/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(String((e as Error)?.message))) {
      throw new Error('O sistema foi atualizado. Recarregue a página (F5) e gere o PDF novamente.');
    }
    throw e;
  }
  const [{ pdf }, { QuotePdf }] = mods;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const render = (density: PdfDensity) => pdf(createElement(QuotePdf, { ...props, density }) as any).toBlob();

  const normal = await render('normal');
  if (pdfPageCount(new Uint8Array(await normal.arrayBuffer())) <= 1) return normal;
  const compact = await render('compact');
  const compactPages = pdfPageCount(new Uint8Array(await compact.arrayBuffer()));
  // Se nem o compacto cabe em 1 folha, mantém o normal (mais legível) — a 2ª folha é inevitável.
  return compactPages <= 1 ? compact : normal;
}

export function pdfFileName(code: string, version: number) {
  return `Proposta-${code}${version > 1 ? `-rev${version}` : ''}.pdf`;
}
