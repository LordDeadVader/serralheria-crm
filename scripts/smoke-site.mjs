#!/usr/bin/env node
/**
 * Teste de ponta a ponta do site + painel do site.
 * Uso: node scripts/smoke-site.mjs <url-base> <email> <arquivo-com-senha> [--keep]
 *  - Páginas públicas, SEO (sitemap, robots, JSON-LD), CRM em /crm/ e manifest do app
 *  - Login, painel (overview, conteúdo, envio de imagem, projeto), formulário público com anexo,
 *    leitura do anexo, cadastro do solicitante como cliente, limpeza dos dados de teste.
 *  - Bloqueios: cadastro público desligado, painel sem login, anexos sem login.
 * A senha é lida de um arquivo para não aparecer na linha de comando.
 */
import { readFileSync } from 'node:fs';

const [BASE, EMAIL, PWFILE] = process.argv.slice(2);
if (!BASE || !EMAIL || !PWFILE) {
  console.error('Uso: node scripts/smoke-site.mjs <url-base> <email> <arquivo-com-senha>');
  process.exit(1);
}
const PASSWORD = readFileSync(PWFILE, 'utf8').trim();
let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '✔' : '✘'} ${msg}`);
};
let token = '';
const api = async (method, path, body, raw) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !raw ? { 'Content-Type': 'application/json' } : {}),
      ...(raw ? { 'Content-Type': raw } : {}),
    },
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
};
const page = async (path) => {
  const res = await fetch(BASE + path, { redirect: 'manual' });
  return { status: res.status, text: await res.text(), headers: res.headers };
};

// ── Páginas públicas
const home = await page('/');
ok(home.status === 200 && home.text.includes('<h1 class="hero__title">'), 'Início responde com o título principal');
ok(home.text.includes('application/ld+json') && home.text.includes('LocalBusiness'), 'Início tem dados estruturados de empresa local');
ok(home.text.includes('og:image') && home.text.includes('rel="canonical"'), 'Início tem Open Graph e canonical');
for (const p of ['/servicos', '/servicos/escadas-metalicas', '/projetos', '/projetos?categoria=escadas', '/sobre', '/contato', '/orcamento']) {
  const r = await page(p);
  ok(r.status === 200, `${p} responde 200`);
}
ok((await page('/projetos/nao-existe')).status === 404, 'Projeto inexistente responde 404');
ok((await page('/servicos/')).status === 301, 'Barra final redireciona (URL única)');
const sm = await page('/sitemap.xml');
ok(sm.status === 200 && sm.text.includes('/projetos/') && sm.text.includes('/servicos/'), 'sitemap.xml lista serviços e projetos');
const rb = await page('/robots.txt');
ok(rb.text.includes('Disallow: /crm/') && rb.text.includes('Sitemap:'), 'robots.txt bloqueia /crm/ e aponta o sitemap');
const crm = await page('/crm/');
ok(crm.status === 200 && crm.text.includes('manifest.webmanifest'), 'CRM servido em /crm/ com manifest do app');
ok((await page('/crm/manifest.webmanifest')).status === 200 && (await page('/crm/sw.js')).status === 200, 'Manifest e service worker do app disponíveis');
ok(!(await page('/')).text.includes('manifest.webmanifest'), 'Site público não é instalável (só o CRM)');
ok((await page('/s/site.css')).status === 200 && (await page('/s/site.js')).status === 200, 'CSS e JS do site disponíveis');

// ── Bloqueios
ok((await api('POST', '/auth/signup', { inviteCode: 'X', companyName: 'X', name: 'X', email: 'x@x.com', password: 'abcdefghij1' })).status === 403 || process.env.ALLOW_SIGNUP_LOCAL, 'Cadastro público desligado');
ok((await api('GET', '/site/overview')).status === 401, 'Painel do site exige login');
ok((await api('GET', '/clients')).status === 401, 'CRM exige login');

// ── Login e painel
const login = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
ok(login.status === 200 && login.data?.token, 'Login no CRM');
token = login.data?.token ?? '';
const ov = await api('GET', '/site/overview');
ok(ov.status === 200 && Array.isArray(ov.data?.pending), 'Painel: visão geral com pendências');
const st = await api('GET', '/site/settings');
ok(st.status === 200 && st.data?.company?.name, 'Painel: lê textos e contato');
const original = st.data;
const saved = await api('PUT', '/site/settings', { ...original, company: { ...original.company, city: 'Cidade Teste', whatsapp: '(41) 99999-0000' } });
ok(saved.status === 200, 'Painel: salva contato');
const home2 = await page('/');
ok(home2.text.includes('Cidade Teste') && home2.text.includes('wa.me/5541999990000'), 'Site reflete cidade e WhatsApp na hora');

// Imagem (PNG 1x1)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const up = await api('POST', '/site/media?variant=lg', png, 'image/png');
ok(up.status === 201 && up.data?.src?.startsWith('/media/img/'), 'Painel: envio de imagem');
const img = await fetch(BASE + up.data.src);
ok(img.status === 200 && img.headers.get('content-type') === 'image/png', 'Imagem enviada é servida publicamente');
ok((await api('POST', '/site/media', Buffer.from('oi'), 'text/plain')).status === 422, 'Envio de arquivo que não é imagem é recusado');

const proj = await api('POST', '/site/projects', {
  title: 'Projeto de teste automatizado',
  category: 'Escadas',
  summary: 'Resumo de teste',
  description: 'Descrição',
  features: ['Item 1'],
  images: [{ src: up.data.src, srcSm: '', alt: 'Foto teste', demo: false, credit: '' }],
  coverIndex: 0,
  featured: false,
  published: true,
});
ok(proj.status === 201 && proj.data?.slug === 'projeto-de-teste-automatizado' && proj.data?.isDemo === false, 'Painel: cria projeto com foto real');
const pp = await page(`/projetos/${proj.data?.slug}`);
ok(pp.status === 200 && pp.text.includes('Projeto de teste automatizado') && !pp.text.includes('Projeto de demonstração:'), 'Página do projeto publicada sem aviso de demonstração');
const dup = await api('POST', '/site/projects', { title: 'Projeto de teste automatizado', images: [] });
ok(dup.data?.slug === 'projeto-de-teste-automatizado-2', 'Endereço duplicado recebe sufixo');

// ── Formulário público
const fd = new FormData();
fd.set('name', 'Cliente Teste Site');
fd.set('phone', '(41) 98888-7777');
fd.set('city', 'Curitiba');
fd.set('service', 'Escadas metálicas');
fd.set('material', 'Aço carbono (pintado)');
fd.set('description', 'Preciso de uma escada em L para mezanino.');
fd.set('measures', '3 m de altura');
fd.set('_t', String(Date.now() - 10_000));
fd.append('files', new Blob([png], { type: 'image/png' }), 'foto.png');
const lead = await fetch(`${BASE}/api/public/leads`, { method: 'POST', body: fd });
const leadData = await lead.json();
ok(lead.status === 201 && leadData.id, 'Formulário público grava solicitação com anexo');
const bad = new FormData();
bad.set('name', 'A');
bad.set('_t', String(Date.now() - 10_000));
const badRes = await fetch(`${BASE}/api/public/leads`, { method: 'POST', body: bad });
const badData = await badRes.json();
ok(badRes.status === 422 && badData.details?.fields?.phone, 'Formulário valida campos no servidor');
const bot = new FormData();
bot.set('empresa_site', 'spam');
const botRes = await fetch(`${BASE}/api/public/leads`, { method: 'POST', body: bot });
ok(botRes.status === 200, 'Robô (campo oculto) é ignorado sem erro');
const leads = await api('GET', '/site/leads');
const mine = leads.data?.find((l) => l.id === leadData.id);
ok(mine && mine.status === 'novo' && mine.files.length === 1, 'Painel: solicitação aparece como nova, com o anexo');
const t0 = token;
token = '';
ok((await api('GET', `/site/leads/${leadData.id}/files/0`)).status === 401, 'Anexo não é público');
token = t0;
const file = await fetch(`${BASE}/api/site/leads/${leadData.id}/files/0`, { headers: { Authorization: `Bearer ${token}` } });
ok(file.status === 200 && (await file.arrayBuffer()).byteLength === png.length, 'Painel: abre o anexo');
const cli = await api('POST', `/site/leads/${leadData.id}/client`);
ok(cli.status === 201 && cli.data?.clientId, 'Solicitante cadastrado como cliente no CRM');
const cli2 = await api('POST', `/site/leads/${leadData.id}/client`);
ok(cli2.data?.created === false, 'Não duplica cliente');

// ── Limpeza
await api('DELETE', `/clients/${cli.data.clientId}`);
await api('DELETE', `/site/leads/${leadData.id}`);
await api('DELETE', `/site/projects/${proj.data.id}`);
await api('DELETE', `/site/projects/${dup.data.id}`);
await api('PUT', '/site/settings', original);
ok((await page(`/projetos/${proj.data?.slug}`)).status === 404, 'Limpeza: projeto de teste removido');
await api('POST', '/auth/logout');

console.log(`\n${pass} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
