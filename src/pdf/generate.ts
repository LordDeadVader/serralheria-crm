import { createElement } from 'react';
import type { QuotePdfProps } from './QuotePdf';

/** Gera o PDF sob demanda (a biblioteca é carregada apenas quando necessária). */
export async function generateQuotePdf(props: QuotePdfProps): Promise<Blob> {
  const [{ pdf }, { QuotePdf }] = await Promise.all([import('@react-pdf/renderer'), import('./QuotePdf')]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return pdf(createElement(QuotePdf, props) as any).toBlob();
}

export function pdfFileName(code: string, version: number) {
  return `Proposta-${code}${version > 1 ? `-rev${version}` : ''}.pdf`;
}
