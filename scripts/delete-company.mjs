#!/usr/bin/env node
/**
 * Remove DEFINITIVAMENTE uma empresa e todos os seus dados (uso administrativo, ex.: contas de teste).
 * Uso: npm run company:delete -- --remote --email dono@empresa.com --confirm
 */
import { parseArgs, query, d1, sqlStr } from './admin-d1.mjs';

const { remote, opt, flag } = parseArgs();
const email = opt('email', '').trim().toLowerCase();
const rows = query(`SELECT c.id, c.name FROM companies c JOIN users u ON u.company_id = c.id WHERE u.email = ${sqlStr(email)}`, remote);
if (!rows.length) {
  console.error('Empresa não encontrada para este e-mail.');
  process.exit(1);
}
const { id, name } = rows[0];
if (!flag('confirm')) {
  console.log(`Seria removida a empresa "${name}" (${id}) e TODOS os seus dados. Repita com --confirm para executar.`);
  process.exit(0);
}
const c = sqlStr(id);
d1(
  [
    `DELETE FROM templates WHERE company_id = ${c};`,
    `DELETE FROM stock_movements WHERE company_id = ${c};`,
    `DELETE FROM stock_items WHERE company_id = ${c};`,
    `DELETE FROM quote_events WHERE company_id = ${c};`,
    `DELETE FROM quote_versions WHERE company_id = ${c};`,
    `DELETE FROM quotes WHERE company_id = ${c};`,
    `DELETE FROM material_price_history WHERE company_id = ${c};`,
    `DELETE FROM materials WHERE company_id = ${c};`,
    `DELETE FROM services WHERE company_id = ${c};`,
    `DELETE FROM suppliers WHERE company_id = ${c};`,
    `DELETE FROM clients WHERE company_id = ${c};`,
    `DELETE FROM sessions WHERE company_id = ${c};`,
    `UPDATE invites SET used_by_user_id = NULL WHERE used_by_user_id IN (SELECT id FROM users WHERE company_id = ${c});`,
    `DELETE FROM users WHERE company_id = ${c};`,
    `DELETE FROM companies WHERE id = ${c};`,
  ].join('\n'),
  remote,
);
console.log(`Empresa "${name}" removida.`);
