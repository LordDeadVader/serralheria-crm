#!/usr/bin/env node
/**
 * Gera um código de convite de uso único para criar uma nova empresa no sistema.
 * Apenas o hash SHA-256 do código é gravado no banco; o código é exibido uma única vez.
 *
 * Uso:
 *   npm run invite:create -- --remote --note "Serralheria do João" --days 7
 *   npm run invite:create -- --local
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { d1, parseArgs, sqlStr } from './admin-d1.mjs';

const { remote, opt } = parseArgs();
const note = opt('note', '').slice(0, 120);
const days = Math.min(Math.max(Number(opt('days', '7')) || 7, 1), 60);

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let raw = '';
for (const b of randomBytes(16)) raw += alphabet[b % alphabet.length];
const code = `CONV-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
const hash = createHash('sha256').update(code).digest('base64url');
const expires = new Date(Date.now() + days * 86400_000).toISOString();

d1(`INSERT INTO invites (id, code_hash, note, expires_at) VALUES (${sqlStr(randomUUID())}, ${sqlStr(hash)}, ${sqlStr(note)}, ${sqlStr(expires)});`, remote);

console.log('\nConvite criado com sucesso.');
console.log(`Código:  ${code}`);
console.log(`Validade: ${days} dia(s) (até ${expires})`);
console.log('Uso único. Envie ao responsável pela empresa por um canal privado.\n');
