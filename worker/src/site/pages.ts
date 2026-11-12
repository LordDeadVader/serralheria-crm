/**
 * Páginas públicas do site. Composição editorial: cada seção tem um papel e um ritmo próprio
 * (claro/escuro, imagem grande/texto curto). Seções sem conteúdo cadastrado não aparecem.
 */
import { html, raw } from 'hono/html';
import { slugify, type SiteSettings } from '../../../src/schemas/site';
import {
  breadcrumbJsonLd,
  businessJsonLd,
  cityLabel,
  icon,
  img,
  layout,
  pad,
  pageHead,
  paras,
  sectionLabel,
  telLink,
  waLink,
  igLink,
  igHandle,
  type H,
  type SiteCtx,
} from './layout';
import { cover, type SiteProject, type SiteService, type SiteTestimonial } from './repo';

const brand = (s: SiteSettings) => s.company.name;
const inCity = (s: SiteSettings) => (s.company.city ? ` em ${s.company.city}` : '');
const catSlug = (c: string) => slugify(c);

/** Relaciona serviço ↔ categoria do portfólio pelo radical do nome (ex.: "Escadas metálicas" ↔ "Escadas"). */
const stem = (v: string) => slugify(v).split('-')[0].replace(/(oes|aos|s)$/, '');
export const relatedTo = (svc: SiteService, projects: SiteProject[]) => projects.filter((p) => p.category && stem(p.category) === stem(svc.title));

// ───────── blocos reutilizáveis ─────────
function projectCard(p: SiteProject, size: string, i: number, eager = false, hidden = false): H {
  return html`<article class="pcard pcard--${size}" data-cat="${catSlug(p.category)}" data-reveal ${hidden ? raw('hidden') : ''}>
    <a href="/projetos/${p.slug}" class="pcard__link">
      <div class="pcard__media">${img(cover(p), { sizes: size === 'xl' || size === 'l' ? '(min-width: 900px) 60vw, 100vw' : '(min-width: 900px) 34vw, 100vw', eager })}</div>
      <div class="pcard__cap">
        <span class="pcard__n">${pad(i + 1)}</span>
        <div>
          <p class="pcard__cat">${p.category}${p.isDemo ? html` · <em>demonstração</em>` : ''}</p>
          <h3 class="pcard__title">${p.title}</h3>
        </div>
        <span class="pcard__go" aria-hidden="true">${icon.arrowUpRight}</span>
      </div>
    </a>
  </article>`;
}

/** Ritmo do grid de projetos: alterna peças grandes e menores para uma leitura editorial. */
export const SIZES = ['xl', 's', 'm', 'm', 'm', 'l', 's'];
const sizeAt = (i: number) => SIZES[i % SIZES.length];

function ctaBlock(ctx: SiteCtx): H {
  const { s } = ctx;
  const wa = waLink(s, 'Olá! Vim pelo site e gostaria de conversar sobre um projeto.');
  return html`<section class="cta">
    <div class="cta__media">${img(s.cta.image, { sizes: '100vw' })}</div>
    <div class="wrap cta__in" data-reveal>
      <p class="eyebrow eyebrow--light"><span class="eyebrow__n">→</span>Orçamento</p>
      <h2 class="cta__title">${s.cta.title}</h2>
      ${s.cta.text ? html`<p class="cta__text">${s.cta.text}</p>` : ''}
      <div class="btns">
        <a class="btn btn--accent btn--lg" href="/orcamento">Solicitar orçamento ${icon.arrow}</a>
        ${wa ? html`<a class="btn btn--ghost-light btn--lg" href="${wa}" target="_blank" rel="noopener">${icon.wa} Conversar no WhatsApp</a>` : ''}
      </div>
    </div>
  </section>`;
}

function processBlock(ctx: SiteCtx, n: number): H {
  const p = ctx.s.process;
  if (!p.steps.length) return html``;
  return html`<section class="sec sec--graphite process">
    <div class="wrap">
      <div class="sec__head">
        ${sectionLabel(n, 'Processo', true)}
        <h2 class="h2 h2--light" data-reveal>${p.title}</h2>
      </div>
      <ol class="process__list" style="--steps:${p.steps.length}">
        ${p.steps.map(
          (st, i) => html`<li class="process__step" data-reveal style="--d:${i * 80}ms">
            <span class="process__n">${pad(i + 1)}</span>
            <h3 class="process__title">${st.title}</h3>
            ${st.text ? html`<p>${st.text}</p>` : ''}
          </li>`,
        )}
      </ol>
    </div>
  </section>`;
}

function statsBlock(ctx: SiteCtx): H {
  const st = ctx.s.stats.filter((x) => x.value && x.label);
  if (!st.length) return html``;
  return html`<div class="stats">
    ${st.map((x) => html`<div class="stats__item" data-reveal><strong>${x.value}</strong><span>${x.label}</span></div>`)}
  </div>`;
}

function differentialsBlock(ctx: SiteCtx, n: number): H {
  const d = ctx.s.differentials;
  if (!d.items.length) return html``;
  return html`<section class="sec sec--mist diffs">
    <div class="wrap diffs__grid">
      <div class="diffs__head">
        ${sectionLabel(n, 'Diferenciais')}
        <h2 class="h2" data-reveal>${d.title}</h2>
      </div>
      <ol class="diffs__list">
        ${d.items.map(
          (it, i) => html`<li class="diffs__item" data-reveal style="--d:${(i % 2) * 90}ms">
            <span class="diffs__n">${pad(i + 1)}</span>
            <h3>${it.title}</h3>
            <p>${it.text}</p>
          </li>`,
        )}
      </ol>
    </div>
  </section>`;
}

function testimonialsBlock(list: SiteTestimonial[], n: number): H {
  if (!list.length) return html``;
  return html`<section class="sec testis">
    <div class="wrap">
      <div class="sec__head">${sectionLabel(n, 'Depoimentos')}<h2 class="h2" data-reveal>Quem já contratou</h2></div>
      <div class="testis__list">
        ${list.map(
          (t) => html`<figure class="testi" data-reveal>
            ${t.rating ? html`<p class="testi__rating" aria-label="Avaliação ${t.rating} de 5">${'★'.repeat(t.rating)}<span>${'★'.repeat(5 - t.rating)}</span></p>` : ''}
            <blockquote>“${t.text}”</blockquote>
            <figcaption><strong>${t.name}</strong>${t.role ? html`<span>${t.role}</span>` : ''}${t.source ? html`<span>via ${t.source}</span>` : ''}</figcaption>
          </figure>`,
        )}
      </div>
    </div>
  </section>`;
}

// ───────── Início ─────────
export function homePage(ctx: SiteCtx, d: { projects: SiteProject[]; testimonials: SiteTestimonial[] }) {
  const { s, services } = ctx;
  const featured = (d.projects.filter((p) => p.featured).length ? d.projects.filter((p) => p.featured) : d.projects).slice(0, 7);
  const titleWords = s.hero.title.split(' ');
  let sec = 0;
  const main = html`
    <section class="hero" data-hero>
      <div class="hero__media">
        ${s.hero.videoUrl
          ? html`<video class="hero__video" autoplay muted loop playsinline preload="none" poster="${s.hero.image?.src ?? ''}" data-hero-video>
              <source src="${s.hero.videoUrl}" />
            </video>`
          : ''}
        ${img(s.hero.image, { eager: true, sizes: '100vw', cls: 'hero__img' })}
      </div>
      <div class="hero__in wrap">
        <p class="eyebrow eyebrow--light hero__eyebrow">${s.hero.eyebrow}${s.company.city ? html` · ${cityLabel(s)}` : ''}</p>
        <h1 class="hero__title">
          ${titleWords.map((w, i) => html`<span class="hero__w" style="--i:${i}"><span>${w}</span></span> `)}
        </h1>
        <div class="hero__foot">
          ${s.hero.subtitle ? html`<p class="hero__sub">${s.hero.subtitle}</p>` : ''}
          <div class="btns">
            <a class="btn btn--accent btn--lg" href="/orcamento">Solicitar orçamento ${icon.arrow}</a>
            <a class="btn btn--ghost-light btn--lg" href="/projetos">Conhecer projetos</a>
          </div>
        </div>
      </div>
      <a class="hero__scroll" href="#atuacao" aria-label="Rolar para o conteúdo"><span></span></a>
    </section>

    <section class="sec intro" id="atuacao">
      <div class="wrap intro__grid">
        ${sectionLabel(++sec, 'Atuação')}
        <h2 class="intro__title" data-reveal>${s.intro.title}</h2>
        <div class="intro__body" data-reveal>
          ${paras(s.intro.text)}
          <a class="link" href="/sobre">Conheça a empresa ${icon.arrow}</a>
        </div>
      </div>
      <div class="wrap">${statsBlock(ctx)}</div>
    </section>

    <section class="sec sec--ink svcs" aria-labelledby="svcs-t">
      <div class="wrap">
        <div class="sec__head sec__head--split">
          <div>${sectionLabel(++sec, 'Serviços', true)}<h2 class="h2 h2--light" id="svcs-t" data-reveal>O que fabricamos e instalamos</h2></div>
          <a class="link link--light" href="/servicos">Todos os serviços ${icon.arrow}</a>
        </div>
        <div class="svcs__grid" data-svcs>
          <div class="svcs__stage" aria-hidden="true">
            ${services.map(
              (sv, i) => html`<div class="svcs__frame ${i === 0 ? 'is-on' : ''}" data-svc-frame="${i}">${img(sv.image, { sizes: '40vw', label: true })}</div>`,
            )}
          </div>
          <ol class="svcs__list">
            ${services.map(
              (sv, i) => html`<li class="svc ${i === 0 ? 'is-on' : ''}" data-svc="${i}">
                <a href="/servicos/${sv.slug}" class="svc__link">
                  <span class="svc__n">${pad(i + 1)}</span>
                  <span class="svc__media">${img(sv.image, { sizes: '100vw' })}</span>
                  <span class="svc__body">
                    <span class="svc__title">${sv.title}</span>
                    <span class="svc__sum">${sv.summary}</span>
                  </span>
                  <span class="svc__go" aria-hidden="true">${icon.arrowUpRight}</span>
                </a>
              </li>`,
            )}
          </ol>
        </div>
      </div>
    </section>

    ${featured.length
      ? html`<section class="sec works">
          <div class="wrap">
            <div class="sec__head sec__head--split">
              <div>${sectionLabel(++sec, 'Projetos')}<h2 class="h2" data-reveal>Trabalhos em destaque</h2></div>
              <a class="link" href="/projetos">Ver portfólio completo ${icon.arrow}</a>
            </div>
            <div class="pgrid pgrid--home">${featured.map((p, i) => projectCard(p, sizeAt(i), i))}</div>
          </div>
        </section>`
      : ''}
    ${differentialsBlock(ctx, ++sec)}

    <section class="sec about-t">
      <div class="wrap about-t__grid">
        <div class="about-t__media" data-reveal>
          <div class="about-t__a">${img(s.about.image, { sizes: '(min-width: 900px) 45vw, 100vw' })}</div>
          ${s.about.image2 ? html`<div class="about-t__b">${img(s.about.image2, { sizes: '(min-width: 900px) 25vw, 60vw' })}</div>` : ''}
        </div>
        <div class="about-t__body">
          ${sectionLabel(++sec, 'Sobre nós')}
          <h2 class="h2" data-reveal>${s.about.title}</h2>
          <div data-reveal>${paras(s.about.text.split(/\n{2,}/).slice(0, 2).join('\n\n'))}</div>
          <a class="link" href="/sobre">Nossa história ${icon.arrow}</a>
        </div>
      </div>
    </section>

    ${processBlock(ctx, ++sec)} ${testimonialsBlock(d.testimonials, ++sec)} ${ctaBlock(ctx)}
  `;
  const title = s.seo.title || `${brand(s)} — Serralheria e estruturas metálicas${inCity(s)}`;
  const description =
    s.seo.description ||
    `${brand(s)}: portões, estruturas metálicas, coberturas, escadas, corrimãos e guarda-corpos sob medida${inCity(s)}. Solicite um orçamento.`;
  return layout(ctx, { title, description, overHero: true, image: s.hero.image, jsonLd: [businessJsonLd(ctx)] }, main);
}

// ───────── Serviços ─────────
export function servicesPage(ctx: SiteCtx) {
  const { s, services } = ctx;
  const main = html`
    ${pageHead({
      eyebrow: 'Serviços',
      title: 'Serralheria sob medida, do projeto à instalação.',
      text: `Fabricação própria e instalação pela mesma equipe${inCity(s)}${s.company.region ? ` e ${s.company.region}` : ''}.`,
      crumbs: [{ name: 'Início', href: '/' }],
    })}
    <section class="sec svl">
      <div class="wrap">
        ${services.map(
          (sv, i) => html`<article class="svl__item ${i % 2 ? 'svl__item--rev' : ''}" id="${sv.slug}">
            <a class="svl__media" href="/servicos/${sv.slug}" data-reveal tabindex="-1" aria-hidden="true"
              >${img(sv.image, { sizes: '(min-width: 900px) 55vw, 100vw' })}</a
            >
            <div class="svl__body" data-reveal>
              <span class="svl__n">${pad(i + 1)}</span>
              <h2 class="h3"><a href="/servicos/${sv.slug}">${sv.title}</a></h2>
              <p class="lead">${sv.summary}</p>
              ${sv.features.length ? html`<ul class="ticks">${sv.features.slice(0, 4).map((f) => html`<li>${f}</li>`)}</ul>` : ''}
              <div class="btns">
                <a class="btn btn--dark" href="/servicos/${sv.slug}">Ver detalhes</a>
                <a class="link" href="/orcamento?servico=${sv.slug}">Solicitar orçamento ${icon.arrow}</a>
              </div>
            </div>
          </article>`,
        )}
      </div>
    </section>
    ${processBlock(ctx, 1)} ${ctaBlock(ctx)}
  `;
  return layout(
    ctx,
    {
      title: `Serviços de serralheria${inCity(s)} | ${brand(s)}`,
      description: `Portões, grades, estruturas metálicas, coberturas, mezaninos, escadas, corrimãos e guarda-corpos${inCity(s)}. Fabricação e instalação.`,
      jsonLd: [businessJsonLd(ctx), breadcrumbJsonLd(ctx, [{ name: 'Início', path: '/' }, { name: 'Serviços', path: '/servicos' }])],
    },
    main,
  );
}

export function serviceDetailPage(ctx: SiteCtx, sv: SiteService, related: SiteProject[]) {
  const { s, services } = ctx;
  const idx = services.findIndex((x) => x.id === sv.id);
  const others = services.filter((x) => x.id !== sv.id);
  const main = html`
    ${pageHead({
      eyebrow: `Serviço ${pad(idx + 1)}`,
      title: sv.title,
      text: sv.summary,
      crumbs: [
        { name: 'Início', href: '/' },
        { name: 'Serviços', href: '/servicos' },
      ],
      aside: html`<div class="btns"><a class="btn btn--accent" href="/orcamento?servico=${sv.slug}">Solicitar orçamento ${icon.arrow}</a></div>`,
    })}
    <div class="wrap"><div class="feature-img" data-reveal>${img(sv.image, { sizes: '100vw', eager: true })}</div></div>
    <section class="sec sdet">
      <div class="wrap sdet__grid">
        <div class="sdet__body prose" data-reveal>${paras(sv.body || sv.summary)}</div>
        <aside class="sdet__aside" data-reveal>
          ${sv.features.length
            ? html`<h2 class="label">O que inclui</h2>
                <ul class="ticks ticks--lines">
                  ${sv.features.map((f) => html`<li>${f}</li>`)}
                </ul>`
            : ''}
          <div class="sdet__cta">
            <p>Envie medidas aproximadas e fotos do local para receber uma proposta.</p>
            <a class="btn btn--accent btn--block" href="/orcamento?servico=${sv.slug}">Solicitar orçamento</a>
            ${waLink(s) ? html`<a class="btn btn--line btn--block" href="${waLink(s, `Olá! Gostaria de um orçamento de ${sv.title}.`)}" target="_blank" rel="noopener">${icon.wa} WhatsApp</a>` : ''}
          </div>
        </aside>
      </div>
    </section>
    ${related.length
      ? html`<section class="sec sec--mist">
          <div class="wrap">
            <div class="sec__head sec__head--split">
              <div>${sectionLabel('—', 'Projetos relacionados')}<h2 class="h2">${sv.title} executados</h2></div>
              <a class="link" href="/projetos?categoria=${catSlug(related[0].category)}">Ver todos ${icon.arrow}</a>
            </div>
            <div class="pgrid pgrid--row">${related.slice(0, 3).map((p, i) => projectCard(p, 'm', i))}</div>
          </div>
        </section>`
      : ''}
    <section class="sec others">
      <div class="wrap">
        ${sectionLabel('—', 'Outros serviços')}
        <ul class="others__list">
          ${others.map((o) => html`<li><a href="/servicos/${o.slug}"><span>${o.title}</span>${icon.arrowUpRight}</a></li>`)}
        </ul>
      </div>
    </section>
    ${ctaBlock(ctx)}
  `;
  return layout(
    ctx,
    {
      title: `${sv.title}${inCity(s)} | ${brand(s)}`,
      description: sv.summary || `${sv.title} sob medida${inCity(s)}.`,
      image: sv.image,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: sv.title,
          description: sv.summary,
          provider: { '@id': `${ctx.origin}/#empresa` },
          ...(s.company.region || s.company.city ? { areaServed: s.company.region || s.company.city } : {}),
        },
        businessJsonLd(ctx),
        breadcrumbJsonLd(ctx, [
          { name: 'Início', path: '/' },
          { name: 'Serviços', path: '/servicos' },
          { name: sv.title, path: `/servicos/${sv.slug}` },
        ]),
      ],
    },
    main,
  );
}

// ───────── Projetos ─────────
export function projectsPage(ctx: SiteCtx, projects: SiteProject[], active: string) {
  const { s } = ctx;
  const cats = s.projectCategories.filter((c) => projects.some((p) => p.category === c));
  const extra = [...new Set(projects.map((p) => p.category).filter((c) => c && !cats.includes(c)))];
  const all = [...cats, ...extra];
  const visible = active ? projects.filter((p) => catSlug(p.category) === active) : projects;
  const activeName = all.find((c) => catSlug(c) === active);
  const main = html`
    ${pageHead({
      eyebrow: 'Portfólio',
      title: activeName ? activeName : 'Projetos executados',
      text: 'Uma seleção de trabalhos. Clique em um projeto para ver as fotos, os materiais e os detalhes.',
      crumbs: [{ name: 'Início', href: '/' }],
    })}
    <section class="sec sec--tight works">
      <div class="wrap">
        <nav class="filters" aria-label="Filtrar por categoria" data-filters>
          <a href="/projetos" data-filter="" ${!active ? raw('aria-current="true"') : ''}>Todos <sup>${projects.length}</sup></a>
          ${all.map(
            (c) =>
              html`<a href="/projetos?categoria=${catSlug(c)}" data-filter="${catSlug(c)}" ${active === catSlug(c) ? raw('aria-current="true"') : ''}
                >${c} <sup>${projects.filter((p) => p.category === c).length}</sup></a
              >`,
          )}
        </nav>
        <div class="pgrid" data-pgrid>
          ${projects.map((p, i) => {
            const vi = visible.indexOf(p);
            return projectCard(p, sizeAt(vi < 0 ? i : vi), vi < 0 ? i : vi, vi >= 0 && vi < 2, vi < 0);
          })}
        </div>
        <p class="empty" ${visible.length ? raw('hidden') : ''} data-empty>Nenhum projeto nesta categoria ainda.</p>
      </div>
    </section>
    ${ctaBlock(ctx)}
  `;
  return layout(
    ctx,
    {
      title: `${activeName ? `${activeName} — ` : ''}Projetos de serralheria${inCity(s)} | ${brand(s)}`,
      description: `Portfólio de ${brand(s)}: portões, estruturas metálicas, escadas, coberturas, mezaninos e corrimãos${inCity(s)}.`,
      jsonLd: [breadcrumbJsonLd(ctx, [{ name: 'Início', path: '/' }, { name: 'Projetos', path: '/projetos' }])],
    },
    main,
  );
}

export function projectDetailPage(ctx: SiteCtx, p: SiteProject, all: SiteProject[]) {
  const { s } = ctx;
  const i = all.findIndex((x) => x.id === p.id);
  const prev = all[(i - 1 + all.length) % all.length];
  const next = all[(i + 1) % all.length];
  const cov = cover(p);
  const gallery = p.images.filter((_, k) => k !== p.coverIndex);
  const sheet = [
    ['Categoria', p.category],
    ['Local', p.location],
    ['Ano', p.year],
    ['Materiais', p.materials],
  ].filter(([, v]) => v);
  const main = html`
    <article class="pdet">
      <header class="phead phead--project">
        <div class="wrap">
          <nav class="crumbs" aria-label="Você está em">
            <a href="/">Início</a><span aria-hidden="true">/</span><a href="/projetos">Projetos</a><span aria-hidden="true">/</span>
            ${p.category ? html`<a href="/projetos?categoria=${catSlug(p.category)}">${p.category}</a>` : ''}
          </nav>
          <div class="phead__grid">
            <div>
              <p class="eyebrow eyebrow--light">${p.category || 'Projeto'}</p>
              <h1 class="phead__title" data-split>${p.title}</h1>
            </div>
            <dl class="sheet">
              ${sheet.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}
            </dl>
          </div>
        </div>
      </header>
      ${p.isDemo
        ? html`<div class="wrap"><p class="notice">Projeto de demonstração: as fotografias são ilustrativas e não retratam um trabalho da empresa.</p></div>`
        : ''}
      <div class="wrap">
        <button class="pdet__cover" type="button" data-lb-item="0" aria-label="Ampliar imagem principal">
          ${img(cov, { eager: true, sizes: '100vw' })}
        </button>
      </div>
      <section class="sec sec--tight">
        <div class="wrap sdet__grid">
          <div class="prose" data-reveal>
            ${p.summary ? html`<p class="lead">${p.summary}</p>` : ''} ${paras(p.description)}
          </div>
          <aside class="sdet__aside" data-reveal>
            ${p.features.length
              ? html`<h2 class="label">Características</h2>
                  <ul class="ticks ticks--lines">
                    ${p.features.map((f) => html`<li>${f}</li>`)}
                  </ul>`
              : ''}
            <div class="sdet__cta">
              <p>Quer algo parecido? Envie as medidas e fotos do seu local.</p>
              <a class="btn btn--accent btn--block" href="/orcamento?ref=${p.slug}&categoria=${catSlug(p.category)}">Solicitar projeto semelhante</a>
            </div>
          </aside>
        </div>
      </section>
      ${gallery.length
        ? html`<section class="sec sec--tight gallery" aria-label="Galeria de fotos">
            <div class="wrap">
              <div class="gallery__grid">
                ${gallery.map(
                  (g, k) => html`<button class="gallery__item gallery__item--${k % 3}" type="button" data-lb-item="${k + 1}" data-reveal aria-label="Ampliar foto ${k + 2}">
                    ${img(g, { sizes: '(min-width: 900px) 50vw, 100vw' })}
                  </button>`,
                )}
              </div>
            </div>
          </section>`
        : ''}
      <script type="application/json" data-lb-data>
        ${raw(JSON.stringify([cov, ...gallery].map((g) => ({ src: g?.src ?? '', alt: g?.alt ?? '', demo: !!g?.demo }))).replace(/</g, '\\u003c'))}
      </script>
      ${all.length > 1
        ? html`<nav class="pnav wrap" aria-label="Outros projetos">
            <a href="/projetos/${prev.slug}" class="pnav__a"><span class="label">Anterior</span><span class="pnav__t">${prev.title}</span></a>
            <a href="/projetos/${next.slug}" class="pnav__a pnav__a--next"><span class="label">Próximo</span><span class="pnav__t">${next.title}</span></a>
          </nav>`
        : ''}
    </article>
    ${ctaBlock(ctx)}
  `;
  return layout(
    ctx,
    {
      title: `${p.title}${p.location ? ` — ${p.location}` : ''} | ${brand(s)}`,
      description: p.summary || `${p.category}: ${p.title}.`,
      image: cov,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: p.title,
          description: p.summary,
          genre: p.category,
          creator: { '@id': `${ctx.origin}/#empresa` },
          image: p.images.map((g) => (g.src.startsWith('/') ? `${ctx.origin}${g.src}` : g.src)),
        },
        breadcrumbJsonLd(ctx, [
          { name: 'Início', path: '/' },
          { name: 'Projetos', path: '/projetos' },
          { name: p.title, path: `/projetos/${p.slug}` },
        ]),
      ],
    },
    main,
  );
}

// ───────── Sobre ─────────
export function aboutPage(ctx: SiteCtx, testimonials: SiteTestimonial[]) {
  const { s } = ctx;
  const a = s.about;
  const main = html`
    ${pageHead({ eyebrow: 'Sobre nós', title: a.title, crumbs: [{ name: 'Início', href: '/' }] })}
    <section class="sec sec--tight about">
      <div class="wrap about__grid">
        <div class="about__text prose" data-reveal>${paras(a.text)}</div>
        <div class="about__media">
          <div data-reveal>${img(a.image, { sizes: '(min-width: 900px) 45vw, 100vw' })}</div>
          ${a.image2 ? html`<div data-reveal>${img(a.image2, { sizes: '(min-width: 900px) 30vw, 100vw' })}</div>` : ''}
        </div>
      </div>
      <div class="wrap">${statsBlock(ctx)}</div>
    </section>
    ${a.highlights.length
      ? html`<section class="sec sec--mist">
          <div class="wrap">
            ${sectionLabel('—', 'Estrutura')}
            <div class="hl">
              ${a.highlights.map((h, i) => html`<div class="hl__item" data-reveal><span class="diffs__n">${pad(i + 1)}</span><h3>${h.title}</h3><p>${h.text}</p></div>`)}
            </div>
          </div>
        </section>`
      : ''}
    ${differentialsBlock(ctx, 1)} ${processBlock(ctx, 2)} ${testimonialsBlock(testimonials, 3)} ${ctaBlock(ctx)}
  `;
  return layout(
    ctx,
    {
      title: `Sobre a ${brand(s)}${inCity(s)}`,
      description: s.company.description || `Conheça a ${brand(s)}.`,
      image: a.image,
      jsonLd: [businessJsonLd(ctx)],
    },
    main,
  );
}

// ───────── Contato ─────────
export function contactPage(ctx: SiteCtx) {
  const { s } = ctx;
  const c = s.company;
  const items = [
    c.whatsapp && { k: 'WhatsApp', v: c.whatsapp, href: waLink(s, 'Olá! Vim pelo site.'), ext: true },
    c.phone && { k: 'Telefone', v: c.phone, href: telLink(c.phone) },
    c.email && { k: 'E-mail', v: c.email, href: `mailto:${c.email}` },
    c.instagram && { k: 'Instagram', v: igHandle(c.instagram), href: igLink(c.instagram), ext: true },
  ].filter(Boolean) as { k: string; v: string; href: string; ext?: boolean }[];
  const place = [
    c.address && { k: 'Endereço', v: c.address },
    cityLabel(s) && { k: 'Cidade', v: cityLabel(s) },
    c.region && { k: 'Região atendida', v: c.region },
    c.hours && { k: 'Horário de funcionamento', v: c.hours },
  ].filter(Boolean) as { k: string; v: string }[];
  const main = html`
    ${pageHead({
      eyebrow: 'Contato',
      title: 'Fale com a gente.',
      text: 'Para orçamentos, o formulário permite enviar fotos e medidas — assim a primeira resposta já é mais precisa.',
      crumbs: [{ name: 'Início', href: '/' }],
      aside: html`<div class="btns"><a class="btn btn--accent" href="/orcamento">Solicitar orçamento ${icon.arrow}</a></div>`,
    })}
    <section class="sec sec--tight contact">
      <div class="wrap contact__grid">
        <ul class="contact__list">
          ${items.map(
            (it) => html`<li data-reveal>
              <span class="label">${it.k}</span>
              <a class="contact__big" href="${it.href}" ${it.ext ? raw('target="_blank" rel="noopener"') : ''}>${it.v}${icon.arrowUpRight}</a>
            </li>`,
          )}
          ${!items.length ? html`<li><p class="muted">Os canais de contato serão publicados em breve. Use o formulário de orçamento.</p></li>` : ''}
        </ul>
        <dl class="contact__place">
          ${place.map((p) => html`<div data-reveal><dt class="label">${p.k}</dt><dd>${p.v}</dd></div>`)}
          ${c.mapsUrl ? html`<div><a class="btn btn--line" href="${c.mapsUrl}" target="_blank" rel="noopener">Abrir no mapa ${icon.arrowUpRight}</a></div>` : ''}
        </dl>
      </div>
    </section>
    ${ctaBlock(ctx)}
  `;
  return layout(
    ctx,
    {
      title: `Contato | ${brand(s)}${inCity(s)}`,
      description: `Telefone, WhatsApp, e-mail e endereço da ${brand(s)}. Solicite um orçamento de serralheria${inCity(s)}.`,
      jsonLd: [businessJsonLd(ctx)],
    },
    main,
  );
}

// ───────── Orçamento ─────────
export const MATERIALS = ['Aço carbono (pintado)', 'Aço galvanizado', 'Aço inox', 'Alumínio', 'Metalon / tubos', 'Metal com vidro', 'Ainda não sei — quero uma indicação'];

export function quotePage(ctx: SiteCtx, q: { service?: string; ref?: SiteProject | null; category?: string }) {
  const { s, services } = ctx;
  const preset = services.find((x) => x.slug === q.service)?.title ?? '';
  const fromCat = q.category ? services.find((x) => stem(x.title) === stem(q.category!))?.title ?? '' : '';
  const selected = preset || fromCat;
  const c = s.company;
  const field = (name: string, label: string, input: H, hint = '', req = false) =>
    html`<div class="f" data-field="${name}">
      <label for="f-${name}">${label}${req ? html`<span class="f__req" aria-hidden="true">*</span>` : html`<span class="f__opt">opcional</span>`}</label>
      ${input} ${hint ? html`<p class="f__hint" id="h-${name}">${hint}</p>` : ''}
      <p class="f__err" id="e-${name}" aria-live="polite"></p>
    </div>`;
  const main = html`
    ${pageHead({
      eyebrow: 'Orçamento',
      title: 'Conte o que você precisa.',
      text: 'Quanto mais informação — medidas, fotos do local, referências —, mais precisa a proposta.',
      crumbs: [{ name: 'Início', href: '/' }],
    })}
    <section class="sec sec--tight quote">
      <div class="wrap quote__grid">
        <form class="qform" method="post" action="/api/public/leads" enctype="multipart/form-data" novalidate data-qform data-wa="${waLink(s)}">
          <div class="qform__summary" role="alert" tabindex="-1" hidden data-summary></div>
          ${q.ref ? html`<p class="qform__ref">Referência: <a href="/projetos/${q.ref.slug}">${q.ref.title}</a></p><input type="hidden" name="reference" value="${q.ref.title}" />` : ''}
          <fieldset>
            <legend class="label">01 — Seus dados</legend>
            <div class="qform__row">
              ${field('name', 'Nome', html`<input id="f-name" name="name" autocomplete="name" required maxlength="80" />`, '', true)}
              ${field(
                'phone',
                'Telefone / WhatsApp',
                html`<input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="20" placeholder="(00) 00000-0000" data-phone />`,
                '',
                true,
              )}
            </div>
            ${field('city', 'Cidade', html`<input id="f-city" name="city" autocomplete="address-level2" required maxlength="80" />`, '', true)}
          </fieldset>
          <fieldset>
            <legend class="label">02 — O projeto</legend>
            <div class="qform__row">
              ${field(
                'service',
                'Serviço desejado',
                html`<select id="f-service" name="service">
                  <option value="">Selecione</option>
                  ${services.map((sv) => html`<option ${sv.title === selected ? raw('selected') : ''}>${sv.title}</option>`)}
                  <option>Outro</option>
                </select>`,
              )}
              ${field(
                'material',
                'Material desejado',
                html`<select id="f-material" name="material">
                  <option value="">Selecione</option>
                  ${MATERIALS.map((m) => html`<option>${m}</option>`)}
                </select>`,
              )}
            </div>
            ${field(
              'description',
              'Descrição do projeto',
              html`<textarea id="f-description" name="description" rows="5" required maxlength="3000" aria-describedby="h-description"></textarea>`,
              'Onde será instalado, uso, estilo, cor, se já existe algo no local…',
              true,
            )}
            ${field(
              'measures',
              'Medidas aproximadas',
              html`<input id="f-measures" name="measures" maxlength="300" placeholder="Ex.: vão de 3,20 m × 2,10 m de altura" />`,
            )}
          </fieldset>
          <fieldset>
            <legend class="label">03 — Fotos e referências</legend>
            <div class="drop" data-drop>
              <input id="f-files" name="files" type="file" multiple accept="image/*,application/pdf" class="drop__input" data-files />
              <label for="f-files" class="drop__label">
                <strong>Adicionar fotos ou arquivos</strong>
                <span>Fotos do local, referências ou desenhos · até 5 arquivos (JPG, PNG, WEBP ou PDF)</span>
              </label>
              <ul class="drop__list" data-file-list></ul>
            </div>
            <p class="f__err" id="e-files" aria-live="polite"></p>
          </fieldset>
          <div class="hp" aria-hidden="true"><label>Não preencha<input name="empresa_site" tabindex="-1" autocomplete="off" /></label></div>
          <input type="hidden" name="_t" value="" data-started />
          <div class="qform__actions">
            <button class="btn btn--accent btn--lg" type="submit" data-submit="site">Enviar solicitação ${icon.arrow}</button>
            ${waLink(s) ? html`<button class="btn btn--line btn--lg" type="submit" data-submit="wa">${icon.wa} Enviar pelo WhatsApp</button>` : ''}
          </div>
          <p class="qform__legal">Usamos seus dados apenas para responder a esta solicitação.</p>
        </form>
        <div class="qdone" hidden tabindex="-1" data-done>
          <p class="eyebrow">Solicitação recebida</p>
          <h2 class="h2">Obrigado! Já recebemos o seu pedido.</h2>
          <p class="lead">Vamos analisar as informações e retornar pelo telefone informado. Protocolo: <strong data-protocol></strong></p>
          <div class="btns">
            <a class="btn btn--dark" href="/projetos">Ver projetos</a>
            <button class="btn btn--line" type="button" data-again>Enviar outra solicitação</button>
          </div>
        </div>
        <aside class="quote__aside">
          ${c.whatsapp || c.phone || c.email || c.hours || c.region ? html`<h2 class="label">Atendimento direto</h2>` : ''}
          <ul class="ftr__dl ftr__dl--dark">
            ${c.whatsapp ? html`<li><span>WhatsApp</span><a href="${waLink(s)}" target="_blank" rel="noopener">${c.whatsapp}</a></li>` : ''}
            ${c.phone ? html`<li><span>Telefone</span><a href="${telLink(c.phone)}">${c.phone}</a></li>` : ''}
            ${c.email ? html`<li><span>E-mail</span><a href="mailto:${c.email}">${c.email}</a></li>` : ''}
            ${c.hours ? html`<li><span>Horário</span>${c.hours}</li>` : ''}
            ${c.region ? html`<li><span>Região atendida</span>${c.region}</li>` : ''}
          </ul>
          <ol class="quote__steps">
            <li><span>01</span>Você envia a solicitação.</li>
            <li><span>02</span>Analisamos e entramos em contato.</li>
            <li><span>03</span>Agendamos a medição, se necessário.</li>
            <li><span>04</span>Você recebe a proposta por escrito.</li>
          </ol>
        </aside>
      </div>
    </section>
  `;
  return layout(
    ctx,
    {
      title: `Solicitar orçamento | ${brand(s)}`,
      description: `Peça um orçamento de serralheria${inCity(s)}: envie medidas, fotos e a descrição do projeto.`,
      hideMobileBar: true,
    },
    main,
  );
}

export function notFoundPage(ctx: SiteCtx) {
  return layout(
    ctx,
    { title: `Página não encontrada | ${brand(ctx.s)}`, description: 'A página procurada não existe.', noindex: true },
    html`${pageHead({
        eyebrow: 'Erro 404',
        title: 'Esta página não existe.',
        text: 'O endereço pode ter mudado. Use o menu ou volte ao início.',
        aside: html`<div class="btns"><a class="btn btn--accent" href="/">Ir para o início</a><a class="btn btn--ghost-light" href="/projetos">Ver projetos</a></div>`,
      })}`,
  );
}
