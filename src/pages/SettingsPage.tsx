import { useEffect, useState } from 'react';
import { useAuth } from '../authentication/AuthContext';
import { NumInput } from '../components/NumInput';
import { useFeedback } from '../components/feedback';
import { Button, Input, PageHeader, Panel, Textarea } from '../components/ui';
import { authRepo, companyRepo } from '../repositories';
import { ApiError } from '../services/api';
import { companySchema, passwordSchema, type CompanyInput } from '../schemas/entities';
import { defaultCompanySettings } from '../schemas/settings';

/** Redimensiona o logotipo no navegador (máx. 480 px) para manter o PDF leve. */
async function resizeLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Imagem inválida.'));
      i.src = url;
    });
    const scale = Math.min(1, 480 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');
    return png.length < 400_000 ? png : canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SettingsPage() {
  const { company, refresh } = useAuth();
  const fb = useFeedback();
  const [f, setF] = useState<CompanyInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (company) {
      const { name, legalName, cnpj, address, phone, whatsapp, email, logo, settings } = company;
      setF({ name, legalName, cnpj, address, phone, whatsapp, email, logo, settings: settings ?? defaultCompanySettings() });
    }
  }, [company]);
  if (!f) return null;

  const set = <K extends keyof CompanyInput>(k: K, v: CompanyInput[K]) => setF({ ...f, [k]: v });
  const setFin = <K extends keyof CompanyInput['settings']['financial']>(k: K, v: number | null) =>
    setF({ ...f, settings: { ...f.settings, financial: { ...f.settings.financial, [k]: v ?? 0 } } });
  const setQ = <K extends keyof CompanyInput['settings']['quote']>(k: K, v: CompanyInput['settings']['quote'][K]) =>
    setF({ ...f, settings: { ...f.settings, quote: { ...f.settings.quote, [k]: v } } });

  async function save() {
    const r = companySchema.safeParse(f);
    if (!r.success) {
      const errs: Record<string, string> = {};
      for (const i of r.error.issues) errs[i.path.join('.')] ??= i.message;
      setErrors(errs);
      fb.error(Object.values(errs)[0]);
      return;
    }
    const variable = f!.settings.financial.taxPct + f!.settings.financial.feePct + f!.settings.financial.commissionPct + f!.settings.financial.marginPct;
    if (variable >= 100) {
      fb.error('A soma de impostos, taxas, comissão e margem padrão deve ser menor que 100%.');
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await companyRepo.save(r.data);
      await refresh();
      fb.ok('Configurações salvas.');
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fields);
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }

  const fin = f.settings.financial;
  const q = f.settings.quote;
  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Dados exibidos na proposta e parâmetros padrão para novos orçamentos."
        actions={
          <Button variant="primary" loading={busy} onClick={save}>
            Salvar configurações
          </Button>
        }
      />
      <div className="space-y-4">
        <Panel title="Dados da empresa">
          <div className="grid gap-4 lg:grid-cols-[160px_1fr]">
            <div>
              <p className="mb-1 text-[13px] font-medium text-gray-700">Logotipo</p>
              <div className="flex size-36 items-center justify-center overflow-hidden rounded-md border border-dashed border-gray-300 bg-gray-50">
                {f.logo ? <img src={f.logo} alt="Logotipo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-gray-400">Sem logotipo</span>}
              </div>
              <div className="mt-2 flex gap-2">
                <label className="cursor-pointer text-xs font-medium text-brand-700 hover:underline">
                  Enviar imagem
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        set('logo', await resizeLogo(file));
                      } catch (err) {
                        fb.error(err);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
                {f.logo && (
                  <button className="text-xs text-gray-500 hover:underline" onClick={() => set('logo', null)}>
                    Remover
                  </button>
                )}
              </div>
              {errors.logo && <p className="mt-1 text-xs text-red-600">{errors.logo}</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              <Input wrapClass="sm:col-span-3" label="Nome fantasia *" value={f.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
              <Input wrapClass="sm:col-span-3" label="Razão social" value={f.legalName} onChange={(e) => set('legalName', e.target.value)} />
              <Input wrapClass="sm:col-span-2" label="CNPJ" value={f.cnpj} onChange={(e) => set('cnpj', e.target.value)} error={errors.cnpj} />
              <Input wrapClass="sm:col-span-2" label="Telefone" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
              <Input wrapClass="sm:col-span-2" label="WhatsApp" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
              <Input wrapClass="sm:col-span-2" label="E-mail" value={f.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
              <Input wrapClass="sm:col-span-4" label="Endereço" value={f.address} onChange={(e) => set('address', e.target.value)} />
            </div>
          </div>
        </Panel>

        <Panel title="Financeiro — padrões para novos orçamentos">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <NumInput label="Margem" suffix="%" value={fin.marginPct} onChange={(n) => setFin('marginPct', n)} error={errors['settings.financial.marginPct']} />
            <NumInput label="Impostos" suffix="%" value={fin.taxPct} onChange={(n) => setFin('taxPct', n)} error={errors['settings.financial.taxPct']} />
            <NumInput label="Taxas" suffix="%" value={fin.feePct} onChange={(n) => setFin('feePct', n)} />
            <NumInput label="Comissão" suffix="%" value={fin.commissionPct} onChange={(n) => setFin('commissionPct', n)} />
            <NumInput label="Custos indiretos" suffix="%" value={fin.overheadPct} onChange={(n) => setFin('overheadPct', n)} hint="Despesas fixas" />
            <NumInput label="Custo/hora" suffix="R$" value={fin.hourlyCost} onChange={(n) => setFin('hourlyCost', n)} />
            <NumInput label="Desperdício" suffix="%" value={fin.wastePct} onChange={(n) => setFin('wastePct', n)} />
          </div>
        </Panel>

        <Panel title="Orçamentos — padrões da proposta">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <Input label="Prefixo da numeração" value={q.numberPrefix} onChange={(e) => setQ('numberPrefix', e.target.value.toUpperCase())} hint="Ex.: ORC-2026-0001" />
            <NumInput label="Validade" suffix="dias" value={q.validityDays} onChange={(n) => setQ('validityDays', Math.round(n ?? 0))} />
            <NumInput label="Fabricação" suffix="dias" value={q.fabricationDays} onChange={(n) => setQ('fabricationDays', Math.round(n ?? 0))} />
            <NumInput label="Instalação" suffix="dias" value={q.installationDays} onChange={(n) => setQ('installationDays', Math.round(n ?? 0))} />
            <NumInput label="Entrada" suffix="%" value={q.downPaymentPct} onChange={(n) => setQ('downPaymentPct', n ?? 0)} />
            <NumInput label="Parcelas" value={q.installments} onChange={(n) => setQ('installments', Math.round(n ?? 0))} />
            <Input wrapClass="col-span-2 sm:col-span-2" label="Responsável padrão" value={q.responsible} onChange={(e) => setQ('responsible', e.target.value)} />
            <Textarea wrapClass="col-span-2 sm:col-span-4" label="Condições de pagamento" value={q.paymentTerms} onChange={(e) => setQ('paymentTerms', e.target.value)} rows={2} />
            <Textarea wrapClass="col-span-2 sm:col-span-3" label="Garantia" value={q.warranty} onChange={(e) => setQ('warranty', e.target.value)} rows={2} />
            <Textarea wrapClass="col-span-2 sm:col-span-3" label="Observações padrão" value={q.notes} onChange={(e) => setQ('notes', e.target.value)} rows={2} />
          </div>
        </Panel>

        <PasswordPanel />
      </div>
    </>
  );
}

function PasswordPanel() {
  const fb = useFeedback();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function change() {
    const r = passwordSchema.safeParse(next);
    if (!r.success) return setErr(r.error.issues[0].message);
    setErr('');
    setBusy(true);
    try {
      await authRepo.changePassword(cur, next);
      setCur('');
      setNext('');
      fb.ok('Senha alterada. Outras sessões foram encerradas.');
    } catch (e) {
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Segurança — alterar senha">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Senha atual" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        <Input label="Nova senha" type="password" value={next} onChange={(e) => setNext(e.target.value)} error={err} autoComplete="new-password" hint="Mínimo de 10 caracteres, com letras e números." />
        <div className="sm:pt-6">
          <Button onClick={change} loading={busy} disabled={!cur || !next}>
            Alterar senha
          </Button>
        </div>
      </div>
    </Panel>
  );
}
