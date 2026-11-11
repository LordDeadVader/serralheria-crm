/** Utilitário compartilhado: executa SQL no D1 chamando o Wrangler diretamente (sem shell, sem problemas de aspas). */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WRANGLER = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));

export function parseArgs() {
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(`--${n}`);
  const opt = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : d;
  };
  if (!flag('remote') && !flag('local')) {
    console.error('Informe --remote (produção) ou --local (desenvolvimento).');
    process.exit(1);
  }
  return { remote: flag('remote'), flag, opt };
}

export const sqlStr = (v) => `'${String(v).replace(/'/g, "''")}'`;

export function d1(sql, remote, json = false) {
  const out = execFileSync(
    process.execPath,
    [WRANGLER, 'd1', 'execute', 'serralheria-crm-db', remote ? '--remote' : '--local', '--config', 'worker/wrangler.jsonc', '--command', sql, ...(json ? ['--json'] : [])],
    { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1' } },
  ).toString();
  if (!json) return out;
  return JSON.parse(out.slice(out.indexOf('[')));
}

export function query(sql, remote) {
  const res = d1(sql, remote, true);
  return res?.[0]?.results ?? [];
}
