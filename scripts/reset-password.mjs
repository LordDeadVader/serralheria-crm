#!/usr/bin/env node
/**
 * Redefinição de senha pelo administrador (o sistema não envia e-mails).
 * Gera uma senha temporária forte, grava somente o hash PBKDF2 e encerra as sessões do usuário.
 * Uso: npm run user:reset-password -- --remote --email pessoa@empresa.com
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { parseArgs, query, d1, sqlStr } from './admin-d1.mjs';

const { remote, opt } = parseArgs();
const email = opt('email', '').trim().toLowerCase();
if (!email) {
  console.error('Informe --email');
  process.exit(1);
}
const users = query(`SELECT id, name FROM users WHERE email = ${sqlStr(email)}`, remote);
if (!users.length) {
  console.error('Usuário não encontrado.');
  process.exit(1);
}
const temp = `Tmp-${randomBytes(9).toString('base64url')}9`;
const salt = randomBytes(16);
const hash = pbkdf2Sync(temp, salt, 100_000, 32, 'sha256');
const stored = `pbkdf2$sha256$100000$${salt.toString('base64url')}$${hash.toString('base64url')}`;
d1(`UPDATE users SET password_hash = ${sqlStr(stored)} WHERE id = ${sqlStr(users[0].id)}; DELETE FROM sessions WHERE user_id = ${sqlStr(users[0].id)};`, remote);
console.log(`\nSenha temporária de ${users[0].name}: ${temp}`);
console.log('Envie por canal privado e peça para trocar em Configurações > Segurança após entrar.\n');
