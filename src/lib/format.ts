export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Converte entrada numérica do usuário (aceita vírgula) em número. */
export function parseNum(v: string): number {
  if (v.trim() === '') return 0;
  // "1.234,56" → 1234.56 ; "12.5" → 12.5 ; "12,5" → 12.5
  const n = Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v);
  return Number.isFinite(n) ? n : 0;
}

export function newKey() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Divide horas decimais em horas e minutos inteiros (1,5 → 1 h 30 min). */
export function splitHours(hours: number): { h: number; m: number } {
  const total = Math.round((Number.isFinite(hours) ? Math.max(0, hours) : 0) * 60);
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** Tempo legível: "2 h", "45 min", "1 h 30 min". */
export function formatDuration(hours: number | null | undefined): string {
  const { h, m } = splitHours(hours ?? 0);
  if (!h && !m) return '0 h';
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}
