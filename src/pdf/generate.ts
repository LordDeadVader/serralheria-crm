import { createElement } from 'react';
import type { QuotePdfProps } from './QuotePdf';

/** Gera o PDF sob demanda (a biblioteca é carregada apenas quando necessária). */
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
  return pdf(createElement(QuotePdf, props) as any).toBlob();
}

export function pdfFileName(code: string, version: number) {
  return `Proposta-${code}${version > 1 ? `-rev${version}` : ''}.pdf`;
}
