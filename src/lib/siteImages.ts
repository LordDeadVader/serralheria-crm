/**
 * Otimiza fotos no navegador antes de enviar ao site: gera duas versões em WebP
 * (2000 px para telas grandes e 900 px para celular/miniaturas). Assim o site carrega rápido
 * e nenhuma foto original pesada vai para o servidor.
 */
import type { SiteImage } from '../schemas/site';
import { siteRepo } from '../repositories/site';

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* cai para <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(src: ImageBitmap | HTMLImageElement, max: number, quality: number): Promise<Blob> {
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const h = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const k = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => {
        if (!b) return reject(new Error('Não foi possível processar a imagem.'));
        // Navegadores sem WebP devolvem PNG: troca para JPEG.
        if (b.type !== 'image/webp') canvas.toBlob((j) => (j ? resolve(j) : reject(new Error('Falha ao converter.'))), 'image/jpeg', quality);
        else resolve(b);
      },
      'image/webp',
      quality,
    ),
  );
}

export async function uploadSiteImage(file: File, alt = ''): Promise<SiteImage> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name}: envie uma imagem.`);
  let bmp: ImageBitmap | HTMLImageElement;
  try {
    bmp = await decode(file);
  } catch {
    throw new Error(`${file.name}: formato não suportado pelo navegador (use JPG, PNG ou WEBP).`);
  }
  const [lg, sm] = await Promise.all([toBlob(bmp, 2000, 0.82), toBlob(bmp, 900, 0.8)]);
  const big = await siteRepo.uploadImage(lg, 'lg');
  const small = await siteRepo.uploadImage(sm, 'sm', big.id);
  return { src: big.src, srcSm: small.src, alt, demo: false, credit: '' };
}

/** URL utilizável no painel (imagens enviadas ficam no mesmo endereço do site). */
export function previewSrc(i: SiteImage | null | undefined) {
  if (!i?.src) return '';
  const src = i.srcSm || i.src;
  if (src.startsWith('/') && import.meta.env.DEV) return `http://localhost:8787${src}`;
  return src.replace(/([?&])w=\d+/, '$1w=600');
}
