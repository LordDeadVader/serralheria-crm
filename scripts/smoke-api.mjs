#!/usr/bin/env node
/**
 * Teste de ponta a ponta da API (fluxo completo de orçamento + isolamento entre empresas).
 * Uso: node scripts/smoke-api.mjs <API_URL> <CONVITE_EMPRESA_A> <CONVITE_EMPRESA_B>
 * Cria duas empresas de teste (consome os dois convites).
 */
const [API, INV_A, INV_B] = process.argv.slice(2);
if (!API || !INV_A || !INV_B) {
  console.error('Uso: node scripts/smoke-api.mjs <API_URL> <CONVITE_A> <CONVITE_B>');
  process.exit(1);
}
const ORIGIN = process.env.SMOKE_ORIGIN ?? 'http://localhost:5173';
let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) {
    pass++;
    console.log(`  ✔ ${msg}`);
  } else {
    fail++;
    console.log(`  ✘ ${msg}`);
  }
};

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const stamp = Date.now().toString(36);
const pwd = `Teste${stamp}9x`;

console.log('1. Saúde e autenticação');
ok((await call('GET', '/health')).status === 200, 'API responde /health');
ok((await call('GET', '/clients')).status === 401, 'rota protegida sem token → 401');
const badInvite = await call('POST', '/auth/signup', null, { inviteCode: 'CONV-XXXX-XXXX-XXXX-XXXX', companyName: 'X', name: 'X', email: `x${stamp}@teste.local`, password: pwd });
ok(badInvite.status === 403 || badInvite.status === 422, 'convite inválido é recusado');

const sa = await call('POST', '/auth/signup', null, { inviteCode: INV_A, companyName: `Empresa Teste A ${stamp}`, name: 'Usuário A', email: `a${stamp}@teste.local`, password: pwd });
ok(sa.status === 201 && sa.data?.token, 'cadastro da empresa A com convite');
const reuse = await call('POST', '/auth/signup', null, { inviteCode: INV_A, companyName: 'Empresa Y', name: 'Usuário Y', email: `y${stamp}@teste.local`, password: pwd });
ok(reuse.status === 403, 'convite não pode ser reutilizado');
const sb = await call('POST', '/auth/signup', null, { inviteCode: INV_B, companyName: `Empresa Teste B ${stamp}`, name: 'Usuário B', email: `b${stamp}@teste.local`, password: pwd });
ok(sb.status === 201, 'cadastro da empresa B');
const badLogin = await call('POST', '/auth/login', null, { email: `a${stamp}@teste.local`, password: 'errada123456' });
ok(badLogin.status === 401, 'senha errada → 401');
const la = await call('POST', '/auth/login', null, { email: `a${stamp}@teste.local`, password: pwd });
ok(la.status === 200 && la.data?.token, 'login empresa A');
const A = la.data.token;
const B = sb.data.token;
const me = await call('GET', '/auth/me', A);
ok(me.data?.company?.name?.startsWith('Empresa Teste A'), 'sessão retorna a empresa correta');

console.log('2. Cadastros');
const demo = await call('GET', '/materials', A);
ok(demo.data.length >= 8 && demo.data.every((m) => m.isDemo), 'materiais de exemplo criados e identificados');
const badClient = await call('POST', '/clients', A, { name: 'Z', personType: 'PF', document: '123' });
ok(badClient.status === 422, 'validação no servidor (nome curto/CPF inválido)');
const client = await call('POST', '/clients', A, { name: 'Cliente Teste', personType: 'PF', document: '529.982.247-25', phone: '(11) 90000-0000', city: 'São Paulo', state: 'SP' });
ok(client.status === 201, 'cliente cadastrado');
const mats = [];
for (const m of [
  { name: 'Metalon 30x30 teste', purchaseUnit: 'barra', packQty: 6, packUnit: 'm', usageUnit: 'm', purchasePrice: 90 },
  { name: 'Chapa teste', purchaseUnit: 'chapa', packQty: 2, packUnit: 'm2', usageUnit: 'm2', purchasePrice: 300 },
  { name: 'Fechadura teste', purchaseUnit: 'unidade', packQty: 1, packUnit: 'un', usageUnit: 'un', purchasePrice: 80 },
]) {
  const r = await call('POST', '/materials', A, { ...m, supplierId: null, lengthMm: null, widthMm: null, thicknessMm: null, weightKg: null });
  mats.push(r.data);
  ok(r.status === 201, `material "${m.name}" cadastrado`);
}
const svc = await call('POST', '/services', A, { name: 'Soldagem teste', mode: 'hour', unit: 'h', hourlyCost: 35, category: 'Soldagem' });
ok(svc.status === 201, 'serviço cadastrado');

console.log('3. Orçamento');
const doc = {
  clientId: client.data.id,
  project: { name: 'Portão de correr', serviceType: 'Portão', description: 'Portão em metalon', width: 3, height: 2, depth: null, dimensionUnit: 'm', quantity: 1, installLocation: 'Residência', finish: 'Pintura esmalte', specifications: '', notes: '' },
  materials: [
    { key: 'm1', materialId: mats[0].id, code: '', name: mats[0].name, unit: 'm', qty: 8, unitCost: 15, wastePct: 10 },
    { key: 'm2', materialId: mats[1].id, code: '', name: mats[1].name, unit: 'm2', qty: 1, unitCost: 150, wastePct: 5 },
    { key: 'm3', materialId: mats[2].id, code: '', name: mats[2].name, unit: 'un', qty: 1, unitCost: 80, wastePct: 0 },
  ],
  labor: [{ key: 'l1', serviceId: svc.data.id, name: 'Soldagem', mode: 'hour', qty: 4, rate: 35 }],
  extras: [{ key: 'e1', description: 'Frete', kind: 'transporte', amount: 50 }],
  pricing: { overheadPct: 10, taxPct: 6, feePct: 2, commissionPct: 0, marginPct: 25, manualPrice: null },
  commercial: { validityDays: 15, paymentTerms: '50% entrada', downPaymentPct: 50, installments: 2, fabricationDays: 10, installationDays: 1, warranty: '12 meses', notes: '', responsible: 'Usuário A', showItemized: true },
};
// materiais 120 + 150 + 80 = 350; desperdício 12 + 7,5 = 19,5; mão de obra 140 → direto 509,5
// indiretos 10% = 50,95; transporte 50 → custo total 610,45; preço = 610,45 / 0,67 = 911,12
const created = await call('POST', '/quotes', A, { document: doc });
ok(created.status === 201, 'orçamento criado');
const t = created.data.current.totals;
ok(t.materialsCost === 350 && t.wasteCost === 19.5 && t.laborCost === 140, 'custos de materiais/desperdício/mão de obra corretos');
ok(t.totalCost === 610.45, `custo total 610,45 (obtido ${t.totalCost})`);
ok(t.finalPrice === 911.12, `preço final 911,12 (obtido ${t.finalPrice})`);
ok(/^ORC-\d{4}-0001$/.test(created.data.code), `numeração automática (${created.data.code})`);
const qid = created.data.id;

const badPct = await call('PUT', `/quotes/${qid}`, A, { document: { ...doc, pricing: { ...doc.pricing, marginPct: 95 } } });
ok(badPct.status === 422, 'percentuais somando ≥ 100% são recusados pelo servidor');

const saved = await call('PUT', `/quotes/${qid}`, A, { document: { ...doc, pricing: { ...doc.pricing, marginPct: 30 } } });
ok(saved.status === 200, 'rascunho salvo');
const reopened = await call('GET', `/quotes/${qid}`, A);
ok(reopened.data.current.document.pricing.marginPct === 30, 'reaberto com dados persistidos');

const sent = await call('POST', `/quotes/${qid}/status`, A, { status: 'enviado' });
ok(sent.data.status === 'enviado' && sent.data.current.locked, 'enviado → versão bloqueada');
const overwrite = await call('PUT', `/quotes/${qid}`, A, { document: doc });
ok(overwrite.status === 409, 'versão enviada não é sobrescrita silenciosamente');
const v2 = await call('POST', `/quotes/${qid}/versions`, A, {});
ok(v2.status === 201 && v2.data.currentVersion === 2 && v2.data.status === 'em_negociacao', 'nova versão (v2) criada e status em negociação');
const v1 = await call('GET', `/quotes/${qid}?version=1`, A);
ok(v1.data.current.version === 1 && v1.data.current.document.pricing.marginPct === 30, 'versão 1 preservada');
ok(v2.data.events.length >= 4, `histórico registrado (${v2.data.events.length} eventos)`);
const dup = await call('POST', `/quotes/${qid}/duplicate`, A);
ok(dup.status === 201 && dup.data.code.endsWith('0002'), 'duplicar orçamento');

console.log('4. Isolamento entre empresas');
ok((await call('GET', `/quotes/${qid}`, B)).status === 404, 'empresa B não lê orçamento de A');
ok((await call('GET', `/clients/${client.data.id}`, B)).status === 404, 'empresa B não lê cliente de A');
ok((await call('PUT', `/clients/${client.data.id}`, B, { name: 'Invasão' })).status === 404, 'empresa B não altera cliente de A');
ok((await call('POST', '/quotes', B, { document: doc })).status === 422, 'empresa B não cria orçamento com cliente de A');
ok((await call('DELETE', `/materials/${mats[0].id}`, B)).status === 404, 'empresa B não exclui material de A');
const listB = await call('GET', '/quotes', B);
ok(Array.isArray(listB.data) && listB.data.length === 0, 'lista de orçamentos de B vazia');

console.log('5. Encerramento');
ok((await call('DELETE', `/clients/${client.data.id}`, A)).status === 409, 'cliente com orçamentos não é excluído (arquivar)');
ok((await call('POST', '/auth/logout', A)).status === 200, 'logout');
ok((await call('GET', '/auth/me', A)).status === 401, 'token invalidado após logout');

console.log(`\nResultado: ${pass} ok, ${fail} falha(s).`);
process.exit(fail ? 1 : 0);
