import type { Unit } from '../calculations/units';
import { formatNumber } from '../calculations/money';
import { NumInput } from './NumInput';
import { Select } from './ui';

/**
 * "Como você compra este material?" — uma pergunta só, em vez de 4 campos de unidade.
 * Cada forma de compra já define a unidade usada no orçamento:
 *   barra de 6 m → orçamento em metros; chapa 1,22 × 5,00 → m²; galão 3,6 l → litros…
 */
export interface FormatValues {
  purchaseUnit: string;
  packQty: number;
  packUnit: Unit;
  usageUnit: Unit;
  widthMm: number | null;
  lengthMm: number | null;
}

type FormatKey = 'barra' | 'chapa' | 'rolo_m2' | 'rolo_m' | 'unidade' | 'caixa' | 'lata' | 'kg' | 'metro' | 'm2' | 'litro';

const FORMATS: Record<FormatKey, { label: string; purchaseUnit: string; packUnit: Unit; usage: Unit; ask?: string; askUnit?: string; area?: boolean }> = {
  barra: { label: 'Barra / tubo / perfil', purchaseUnit: 'barra', packUnit: 'm', usage: 'm', ask: 'Comprimento da barra', askUnit: 'm' },
  chapa: { label: 'Chapa', purchaseUnit: 'chapa', packUnit: 'm2', usage: 'm2', area: true },
  rolo_m2: { label: 'Rolo (adesivo, lona, película) — usar em m²', purchaseUnit: 'rolo', packUnit: 'm2', usage: 'm2', area: true },
  rolo_m: { label: 'Rolo / bobina (cabo, fita) — usar em metros', purchaseUnit: 'rolo', packUnit: 'm', usage: 'm', ask: 'Metros no rolo', askUnit: 'm' },
  unidade: { label: 'Unidade / peça', purchaseUnit: 'unidade', packUnit: 'un', usage: 'un' },
  caixa: { label: 'Caixa / pacote', purchaseUnit: 'caixa', packUnit: 'un', usage: 'un', ask: 'Unidades na caixa', askUnit: 'un' },
  lata: { label: 'Lata / galão / balde', purchaseUnit: 'lata', packUnit: 'l', usage: 'l', ask: 'Litros na embalagem', askUnit: 'l' },
  kg: { label: 'Por quilo (kg)', purchaseUnit: 'kg', packUnit: 'kg', usage: 'kg' },
  metro: { label: 'Por metro', purchaseUnit: 'metro', packUnit: 'm', usage: 'm' },
  m2: { label: 'Por metro quadrado (m²)', purchaseUnit: 'm²', packUnit: 'm2', usage: 'm2' },
  litro: { label: 'Por litro', purchaseUnit: 'litro', packUnit: 'l', usage: 'l' },
};

/** Descobre a forma de compra de um material já cadastrado; null = combinação avançada. */
export function detectFormat(v: FormatValues): FormatKey | null {
  if (v.packUnit !== v.usageUnit) return null;
  const pu = v.purchaseUnit.toLowerCase();
  if (pu === 'barra' && v.packUnit === 'm') return 'barra';
  if (pu === 'chapa' && v.packUnit === 'm2') return 'chapa';
  if (pu === 'rolo' && v.packUnit === 'm2') return 'rolo_m2';
  if (pu === 'rolo' && v.packUnit === 'm') return 'rolo_m';
  if ((pu === 'caixa' || pu === 'pacote') && v.packUnit === 'un') return 'caixa';
  if ((pu === 'lata' || pu === 'galão' || pu === 'balde') && v.packUnit === 'l') return 'lata';
  if (v.packQty === 1) {
    if (v.packUnit === 'un') return 'unidade';
    if (v.packUnit === 'kg') return 'kg';
    if (v.packUnit === 'm') return 'metro';
    if (v.packUnit === 'm2') return 'm2';
    if (v.packUnit === 'l') return 'litro';
  }
  return null;
}

export function PurchaseFormat({ v, set }: { v: FormatValues; set: (patch: Partial<FormatValues>) => void }) {
  const key = detectFormat(v);
  const f = key ? FORMATS[key] : null;
  const w = v.widthMm != null ? v.widthMm / 1000 : null;
  const l = v.lengthMm != null ? v.lengthMm / 1000 : null;

  function choose(k: FormatKey) {
    const d = FORMATS[k];
    const qty = k === 'barra' ? 6 : d.ask || d.area ? v.packQty || 1 : 1;
    set({ purchaseUnit: d.purchaseUnit, packUnit: d.packUnit, usageUnit: d.usage, packQty: qty });
  }

  function setDims(nw: number | null, nl: number | null) {
    const patch: Partial<FormatValues> = { widthMm: nw != null ? Math.round(nw * 1000) : null, lengthMm: nl != null ? Math.round(nl * 1000) : null };
    if (nw && nl) patch.packQty = Math.round(nw * nl * 10_000) / 10_000;
    set(patch);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Select wrapClass="col-span-2" label="Como você compra? *" value={key ?? ''} onChange={(e) => e.target.value && choose(e.target.value as FormatKey)}>
        {!key && <option value="">Personalizado (veja opções avançadas)</option>}
        {(Object.keys(FORMATS) as FormatKey[]).map((k) => (
          <option key={k} value={k}>
            {FORMATS[k].label}
          </option>
        ))}
      </Select>
      {f?.ask && <NumInput label={f.ask} suffix={f.askUnit} value={v.packQty} onChange={(n) => set({ packQty: n ?? 0 })} />}
      {f?.area && (
        <>
          <NumInput label="Largura" suffix="m" nullable value={w} onChange={(n) => setDims(n, l)} hint={key === 'chapa' ? 'Ex.: 1,22' : 'Largura do rolo'} />
          <NumInput label="Comprimento" suffix="m" nullable value={l} onChange={(n) => setDims(w, n)} hint={`Área: ${formatNumber(v.packQty, 3)} m²`} />
        </>
      )}
    </div>
  );
}
