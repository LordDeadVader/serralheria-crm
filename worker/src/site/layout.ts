/**
 * Estrutura comum das páginas públicas (HTML gerado no servidor: rápido e indexável).
 * Todo texto da empresa vem de SiteSettings (painel do site) — nada fixo aqui além de rótulos de interface.
 */
import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { SiteImage, SiteSettings } from '../../../src/schemas/site';
import type { SiteService } from './repo';

export type H = HtmlEscapedString | Promise<HtmlEscapedString>;

/** Versão dos arquivos estáticos do site (aumente ao alterar site.css / site.js). */
export const ASSET_V = '1';

export interface SiteCtx {
  s: SiteSettings;
  services: SiteService[];
  origin: string;
  path: string;
  hasDemoImages?: boolean;
}

export interface PageMeta {
  title: string;
  description: string;
  image?: SiteImage | null;
  /** Cabeçalho transparente sobre a imagem de abertura. */
  overHero?: boolean;
  jsonLd?: unknown[];
  noindex?: boolean;
  /** Esconde a barra fixa de contato no celular (ex.: na própria página de orçamento). */
  hideMobileBar?: boolean;
}

// ───────── utilidades ─────────
export const digits = (v: string) => v.replace(/\D/g, '');
export function waNumber(v: string) {
  const d = digits(v);
  if (!d) return '';
  return d.length <= 11 ? `55${d}` : d;
}
export const waLink = (s: SiteSettings, text = '') => {
  const n = waNumber(s.company.whatsapp);
  return n ? `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}` : '';
};
export const telLink = (v: string) => `tel:+${waNumber(v)}`;
export const igLink = (v: string) => (v.startsWith('http') ? v : `https://instagram.com/${v.replace(/^@/, '')}`);
export const igHandle = (v: string) => (v.startsWith('http') ? `@${v.replace(/\/$/, '').split('/').pop()}` : `@${v.replace(/^@/, '')}`);
export const pad = (n: number) => String(n).padStart(2, '0');
export const cityLabel = (s: SiteSettings) => [s.company.city, s.company.state].filter(Boolean).join(' – ');

/** Parágrafos a partir de texto com linhas em branco. */
export const paras = (text: string, cls = '') =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => html`<p class="${cls}">${p}</p>`);

const isUnsplash = (src: string) => src.includes('images.unsplash.com');
const withW = (src: string, w: number) => src.replace(/([?&])w=\d+/, `$1w=${w}`);

/** Imagem responsiva com srcset, lazy loading e marcação de "imagem ilustrativa". */
export function img(
  i: SiteImage | null | undefined,
  o: { sizes?: string; cls?: string; eager?: boolean; label?: boolean; ratio?: string } = {},
): H {
  if (!i?.src) return html`<div class="ph ${o.cls ?? ''}" style="${o.ratio ? `aspect-ratio:${o.ratio}` : ''}" aria-hidden="true"></div>`;
  let srcset = '';
  if (isUnsplash(i.src)) srcset = [640, 1000, 1500, 2200].map((w) => `${withW(i.src, w)} ${w}w`).join(', ');
  else if (i.srcSm) srcset = `${i.srcSm} 900w, ${i.src} 2000w`;
  const src = isUnsplash(i.src) ? withW(i.src, 1500) : i.src;
  return html`<img
      class="${o.cls ?? ''}"
      src="${src}"
      ${srcset ? raw(`srcset="${srcset}" sizes="${o.sizes ?? '100vw'}"`) : ''}
      alt="${i.alt}"
      ${o.eager ? raw('fetchpriority="high"') : raw('loading="lazy"')}
      decoding="async"
    />${o.label !== false && i.demo ? html`<span class="demo-tag">Imagem ilustrativa</span>` : ''}`;
}

// ───────── ícones (poucos, só onde ajudam) ─────────
export const icon = {
  arrow: raw(
    '<svg class="i i-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  ),
  arrowUpRight: raw(
    '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  ),
  wa: raw(
    '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"/></svg>',
  ),
};

// ───────── marca ─────────
const logo = (s: SiteSettings, variant: 'white' | 'color' = 'white') =>
  html`<picture
    ><source srcset="/s/logo-${variant === 'white' ? 'white-' : ''}96.webp 1x, /s/logo-${variant === 'white' ? 'white-' : ''}192.webp 2x" type="image/webp" /><img
      src="/s/logo-${variant === 'white' ? 'white-' : ''}96.png"
      alt="${s.company.name}"
      width="105"
      height="96"
  /></picture>`;

const NAV = [
  { href: '/', label: 'Início' },
  { href: '/servicos', label: 'Serviços' },
  { href: '/projetos', label: 'Projetos' },
  { href: '/sobre', label: 'Sobre nós' },
  { href: '/contato', label: 'Contato' },
];

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));

function header(ctx: SiteCtx, meta: PageMeta) {
  const { s, path } = ctx;
  return html`<header class="hdr ${meta.overHero ? 'hdr--over' : 'is-solid'}" data-header>
    <div class="hdr__in wrap">
      <a class="hdr__logo" href="/" aria-label="${s.company.name} — página inicial">${logo(s)}</a>
      <nav class="hdr__nav" aria-label="Principal">
        ${NAV.map((n) => html`<a href="${n.href}" ${isActive(path, n.href) ? raw('aria-current="page"') : ''}>${n.label}</a>`)}
      </nav>
      <a class="btn btn--accent btn--sm hdr__cta" href="/orcamento">Solicitar orçamento</a>
      <button class="hdr__burger" type="button" aria-expanded="false" aria-controls="menu" data-menu-toggle>
        <span class="hdr__burger-lines" aria-hidden="true"></span><span class="hdr__burger-label">Menu</span>
      </button>
    </div>
  </header>
  <div class="menu" id="menu" hidden data-menu>
    <nav class="menu__nav wrap" aria-label="Menu">
      ${NAV.map(
        (n, i) =>
          html`<a href="${n.href}" ${isActive(path, n.href) ? raw('aria-current="page"') : ''}><span class="menu__n">${pad(i + 1)}</span>${n.label}</a>`,
      )}
    </nav>
    <div class="menu__foot wrap">
      <a class="btn btn--accent btn--block" href="/orcamento">Solicitar orçamento</a>
      ${waLink(s) ? html`<a class="btn btn--ghost-light btn--block" href="${waLink(s)}" target="_blank" rel="noopener">${icon.wa} WhatsApp</a>` : ''}
      ${s.company.phone ? html`<a class="menu__contact" href="${telLink(s.company.phone)}">${s.company.phone}</a>` : ''}
    </div>
  </div>`;
}

function footer(ctx: SiteCtx) {
  const { s } = ctx;
  const c = s.company;
  const year = new Date().getFullYear();
  const contact = [
    c.phone && html`<li><span>Telefone</span><a href="${telLink(c.phone)}">${c.phone}</a></li>`,
    c.whatsapp && html`<li><span>WhatsApp</span><a href="${waLink(s)}" target="_blank" rel="noopener">${c.whatsapp}</a></li>`,
    c.email && html`<li><span>E-mail</span><a href="mailto:${c.email}">${c.email}</a></li>`,
    c.instagram && html`<li><span>Instagram</span><a href="${igLink(c.instagram)}" target="_blank" rel="noopener">${igHandle(c.instagram)}</a></li>`,
  ].filter(Boolean);
  const place = [
    c.address && html`<li><span>Endereço</span>${c.mapsUrl ? html`<a href="${c.mapsUrl}" target="_blank" rel="noopener">${c.address}</a>` : c.address}</li>`,
    cityLabel(s) && html`<li><span>Cidade</span>${cityLabel(s)}</li>`,
    c.region && html`<li><span>Região atendida</span>${c.region}</li>`,
    c.hours && html`<li><span>Horário</span>${c.hours}</li>`,
  ].filter(Boolean);
  return html`<footer class="ftr">
    <div class="wrap">
      <div class="ftr__top">
        <div class="ftr__brand">
          <a href="/" class="ftr__logo" aria-label="${c.name}">${logo(s)}</a>
          ${c.description ? html`<p>${c.description}</p>` : ''}
          <a class="btn btn--accent" href="/orcamento">Solicitar orçamento</a>
        </div>
        <nav class="ftr__col" aria-label="Rodapé">
          <h2 class="ftr__h">Navegação</h2>
          <ul>
            ${NAV.map((n) => html`<li><a href="${n.href}">${n.label}</a></li>`)}
            <li><a href="/orcamento">Solicitar orçamento</a></li>
          </ul>
        </nav>
        <div class="ftr__col">
          <h2 class="ftr__h">Serviços</h2>
          <ul>
            ${ctx.services.slice(0, 8).map((sv) => html`<li><a href="/servicos/${sv.slug}">${sv.title}</a></li>`)}
          </ul>
        </div>
        ${contact.length || place.length
          ? html`<div class="ftr__col ftr__col--contact">
              <h2 class="ftr__h">Contato</h2>
              <ul class="ftr__dl">
                ${contact}${place}
              </ul>
            </div>`
          : ''}
      </div>
      <div class="ftr__bottom">
        <p>© ${year} ${c.legalName || c.name}${c.cnpj ? ` · CNPJ ${c.cnpj}` : ''}. Todos os direitos reservados.</p>
        ${ctx.hasDemoImages ? html`<p>Imagens marcadas como “ilustrativas” são provisórias (Unsplash) e não retratam trabalhos da empresa.</p>` : ''}
        <a class="ftr__restricted" href="/crm/" rel="nofollow">Área restrita</a>
      </div>
    </div>
  </footer>`;
}

function mobileBar(ctx: SiteCtx) {
  const wa = waLink(ctx.s, 'Olá! Vim pelo site e gostaria de um orçamento.');
  return html`<div class="mbar" data-mbar>
    ${wa ? html`<a class="mbar__wa" href="${wa}" target="_blank" rel="noopener">${icon.wa}<span>WhatsApp</span></a>` : ''}
    <a class="mbar__cta" href="/orcamento">Solicitar orçamento</a>
  </div>
  ${wa ? html`<a class="wa-float" href="${wa}" target="_blank" rel="noopener" aria-label="Conversar pelo WhatsApp" data-wa-float>${icon.wa}</a>` : ''}`;
}

export function businessJsonLd(ctx: SiteCtx) {
  const c = ctx.s.company;
  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
    '@id': `${ctx.origin}/#empresa`,
    name: c.name,
    ...(c.legalName ? { legalName: c.legalName } : {}),
    url: `${ctx.origin}/`,
    logo: `${ctx.origin}/s/logo-192.png`,
    image: `${ctx.origin}/s/og.jpg`,
    description: c.description,
    ...(c.phone || c.whatsapp ? { telephone: c.phone || c.whatsapp } : {}),
    ...(c.email ? { email: c.email } : {}),
    ...(c.address || c.city
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(c.address ? { streetAddress: c.address } : {}),
            ...(c.city ? { addressLocality: c.city } : {}),
            ...(c.state ? { addressRegion: c.state } : {}),
            addressCountry: 'BR',
          },
        }
      : {}),
    ...(c.region || c.city ? { areaServed: c.region || c.city } : {}),
    ...(c.instagram || c.facebook ? { sameAs: [c.instagram && igLink(c.instagram), c.facebook].filter(Boolean) } : {}),
    ...(c.hours ? { openingHours: c.hours } : {}),
  };
}

export function breadcrumbJsonLd(ctx: SiteCtx, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${ctx.origin}${it.path}` })),
  };
}

const json = (v: unknown) => raw(JSON.stringify(v).replace(/</g, '\\u003c'));

export function layout(ctx: SiteCtx, meta: PageMeta, main: H) {
  const { s } = ctx;
  const title = meta.title;
  const ogImg = meta.image?.src ? (meta.image.src.startsWith('/') ? `${ctx.origin}${meta.image.src}` : withW(meta.image.src, 1200)) : `${ctx.origin}/s/og.jpg`;
  const canonical = `${ctx.origin}${ctx.path === '/' ? '/' : ctx.path}`;
  return html`<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>${title}</title>
        <meta name="description" content="${meta.description}" />
        ${meta.noindex ? raw('<meta name="robots" content="noindex" />') : ''}
        <link rel="canonical" href="${canonical}" />
        <meta name="theme-color" content="#101112" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:site_name" content="${s.company.name}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${meta.description}" />
        <meta property="og:url" content="${canonical}" />
        <meta property="og:image" content="${ogImg}" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/s/favicon-64.png" />
        <link rel="apple-touch-icon" href="/s/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        ${raw(`<link rel="preconnect" href="https://images.unsplash.com" />`)}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..800&family=Manrope:wght@400..700&display=swap"
        />
        <link rel="stylesheet" href="/s/site.css?v=${ASSET_V}" />
        <script>
          document.documentElement.classList.add('js');
        </script>
        <script src="/s/site.js?v=${ASSET_V}" defer></script>
        ${(meta.jsonLd ?? []).map((j) => html`<script type="application/ld+json">${json(j)}</script>`)}
      </head>
      <body class="${meta.overHero ? 'has-hero' : ''}">
        <a class="skip" href="#conteudo">Pular para o conteúdo</a>
        ${header(ctx, meta)}
        <main id="conteudo">${main}</main>
        ${footer(ctx)} ${meta.hideMobileBar ? '' : mobileBar(ctx)}
        <div class="lb" hidden data-lightbox role="dialog" aria-modal="true" aria-label="Visualização ampliada">
          <button class="lb__close" type="button" data-lb-close>Fechar</button>
          <button class="lb__nav lb__prev" type="button" data-lb-prev aria-label="Imagem anterior">${icon.arrow}</button>
          <figure class="lb__fig"><img alt="" data-lb-img /><figcaption data-lb-cap></figcaption></figure>
          <button class="lb__nav lb__next" type="button" data-lb-next aria-label="Próxima imagem">${icon.arrow}</button>
          <p class="lb__count" data-lb-count></p>
        </div>
      </body>
    </html>`;
}

/** Cabeçalho de páginas internas (sem foto de abertura). */
export function pageHead(o: { eyebrow: string; title: string; text?: string; crumbs?: { name: string; href: string }[]; aside?: H }) {
  return html`<section class="phead">
    <div class="wrap">
      ${o.crumbs?.length
        ? html`<nav class="crumbs" aria-label="Você está em">
            ${o.crumbs.map((c) => html`<a href="${c.href}">${c.name}</a><span aria-hidden="true">/</span>`)}
          </nav>`
        : ''}
      <div class="phead__grid">
        <div>
          <p class="eyebrow eyebrow--light">${o.eyebrow}</p>
          <h1 class="phead__title" data-split>${o.title}</h1>
        </div>
        ${o.text || o.aside ? html`<div class="phead__aside">${o.text ? html`<p>${o.text}</p>` : ''}${o.aside ?? ''}</div>` : ''}
      </div>
    </div>
  </section>`;
}

export const sectionLabel = (n: number | string, label: string, light = false) =>
  html`<p class="eyebrow ${light ? 'eyebrow--light' : ''}"><span class="eyebrow__n">${typeof n === 'number' ? pad(n) : n}</span>${label}</p>`;
