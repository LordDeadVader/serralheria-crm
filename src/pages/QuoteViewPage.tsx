import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, Download, FileText, GitBranch, MessageCircle, Pencil, Printer, Trash2 } from 'lucide-react';
import { useAuth } from '../authentication/AuthContext';
import { CostSummary } from '../components/CostSummary';
import { StatusBadge } from '../components/StatusBadge';
import { useFeedback } from '../components/feedback';
import { Button, ErrorBox, Input, Modal, Panel, Select, Spinner, Textarea, cx } from '../components/ui';
import { formatBRL, formatNumber, formatPct } from '../calculations/money';
import { unitShort } from '../calculations/units';
import { formatDate, formatDateTime } from '../lib/format';
import { generateQuotePdf, pdfFileName } from '../pdf/generate';
import { companyRepo, quotesRepo } from '../repositories';
import { onlyDigits } from '../schemas/common';
import { QUOTE_STATUSES, STATUS_LABEL, type QuoteDetail, type QuoteStatus } from '../types/domain';

export function QuoteViewPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const v = params.get('v') ? Number(params.get('v')) : undefined;
  const q = useQuery({ queryKey: ['quotes', id, v ?? 'current'], queryFn: () => quotesRepo.get(id, v) });
  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  return <View quote={q.data} viewingVersion={v} setVersion={(n) => setParams(n ? { v: String(n) } : {})} />;
}

function View({ quote, viewingVersion, setVersion }: { quote: QuoteDetail; viewingVersion?: number; setVersion: (n?: number) => void }) {
  const nav = useNavigate();
  const fb = useFeedback();
  const qc = useQueryClient();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [lossOpen, setLossOpen] = useState<QuoteStatus | null>(null);
  const [lossReason, setLossReason] = useState('');
  const cur = quote.current;
  const doc = cur.document;
  const t = cur.totals;
  const isOld = viewingVersion != null && viewingVersion !== quote.currentVersion;
  const frozen = ['em_producao', 'concluido'].includes(quote.status);

  async function refresh(next?: QuoteDetail) {
    if (next) qc.setQueryData(['quotes', quote.id, 'current'], next);
    await qc.invalidateQueries({ queryKey: ['quotes'] });
    await qc.invalidateQueries({ queryKey: ['dashboard'] });
    await qc.invalidateQueries({ queryKey: ['clients'] });
  }

  async function run<T>(fn: () => Promise<T>, msg: string) {
    try {
      const r = await fn();
      fb.ok(msg);
      return r;
    } catch (e) {
      fb.error(e);
      return null;
    }
  }

  async function changeStatus(s: QuoteStatus, reason?: string) {
    if ((s === 'reprovado' || s === 'cancelado') && reason === undefined) {
      setLossReason(quote.lossReason);
      setLossOpen(s);
      return;
    }
    const r = await run(() => quotesRepo.setStatus(quote.id, s, reason), `Status alterado para ${STATUS_LABEL[s]}.`);
    if (r) await refresh(r);
  }

  async function newVersion() {
    const ok = await fb.confirm({
      title: 'Gerar nova versão',
      message: `A versão ${quote.currentVersion} será preservada e bloqueada. Uma cópia editável será criada como versão ${quote.currentVersion + 1}.`,
      confirmLabel: 'Gerar versão',
    });
    if (!ok) return;
    const r = await run(() => quotesRepo.newVersion(quote.id), 'Nova versão criada.');
    if (r) {
      await refresh(r);
      setVersion(undefined);
      nav(`/orcamentos/${r.id}/editar`);
    }
  }

  async function duplicate() {
    const r = await run(() => quotesRepo.duplicate(quote.id), 'Orçamento duplicado.');
    if (r) {
      await refresh();
      nav(`/orcamentos/${r.id}`);
    }
  }

  async function remove() {
    const ok = await fb.confirm({ title: 'Excluir orçamento', message: `Excluir ${quote.code} e todas as suas versões? Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    const r = await run(() => quotesRepo.remove(quote.id), 'Orçamento excluído.');
    if (r) {
      await refresh();
      nav('/orcamentos');
    }
  }

  return (
    <>
      <Link to="/orcamentos" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="size-4" /> Orçamentos
      </Link>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{quote.code}</h1>
            <StatusBadge status={quote.status} />
            <span className="text-sm text-gray-500">versão {cur.version}</span>
          </div>
          <p className="mt-0.5 text-sm text-gray-600">
            {doc.project.name} ·{' '}
            <Link className="text-brand-700 hover:underline" to={`/clientes/${quote.clientId}`}>
              {quote.clientName}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<FileText className="size-4" />} onClick={() => setPdfOpen(true)}>
            Proposta PDF
          </Button>
          {!isOld && !frozen && (
            <Button icon={<Pencil className="size-4" />} onClick={() => nav(`/orcamentos/${quote.id}/editar`)}>
              Editar
            </Button>
          )}
          {!frozen && (
            <Button icon={<GitBranch className="size-4" />} onClick={newVersion}>
              Nova versão
            </Button>
          )}
          <Button icon={<Copy className="size-4" />} onClick={duplicate}>
            Duplicar
          </Button>
          {['rascunho', 'em_elaboracao', 'cancelado'].includes(quote.status) && <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={remove} title="Excluir" />}
        </div>
      </div>

      {isOld && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>
            Você está vendo a versão {viewingVersion} (histórica, somente leitura). A versão atual é a {quote.currentVersion}.
          </span>
          <Button size="sm" onClick={() => setVersion(undefined)}>
            Ver versão atual
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Panel title="Projeto">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Info k="Tipo" v={doc.project.serviceType} />
              <Info k="Dimensões" v={[doc.project.width, doc.project.height, doc.project.depth].filter((x) => x != null).map((x) => formatNumber(x as number, 3)).join(' × ') + (doc.project.width || doc.project.height ? ` ${doc.project.dimensionUnit}` : '')} />
              <Info k="Quantidade" v={formatNumber(doc.project.quantity)} />
              <Info k="Acabamento" v={doc.project.finish} />
              <Info k="Local" v={doc.project.installLocation} wide />
              <Info k="Descrição" v={doc.project.description} wide />
              <Info k="Especificações" v={doc.project.specifications} wide />
              <Info k="Observações internas" v={doc.project.notes} wide />
            </dl>
          </Panel>
          <Panel title="Composição de custos (interno)" bodyClass="p-0">
            <div className="overflow-x-auto">
              <table className="tbl min-w-[560px]">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Qtde./un.</th>
                    <th className="text-right">Custo unit.</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.materials.map((m, i) => (
                    <tr key={m.key}>
                      <td>
                        {m.name}
                        {m.wastePct > 0 && <span className="ml-1 text-xs text-gray-500">(+{formatPct(m.wastePct, 0)} desp.)</span>}
                      </td>
                      <td className="num text-right">
                        {formatNumber(m.qty, 3)} {unitShort(m.unit)}
                      </td>
                      <td className="num text-right">{formatBRL(m.unitCost)}</td>
                      <td className="num text-right">{formatBRL(t.materialLines[i]?.total)}</td>
                    </tr>
                  ))}
                  {doc.labor.map((l, i) => (
                    <tr key={l.key}>
                      <td>{l.name}</td>
                      <td className="num text-right">{l.mode === 'hour' ? `${formatNumber(l.qty)} h` : formatNumber(l.qty)}</td>
                      <td className="num text-right">{formatBRL(l.rate)}</td>
                      <td className="num text-right">{formatBRL(t.laborLines[i])}</td>
                    </tr>
                  ))}
                  {doc.extras.map((x) => (
                    <tr key={x.key}>
                      <td>
                        {x.description} <span className="text-xs text-gray-500">({x.kind})</span>
                      </td>
                      <td />
                      <td />
                      <td className="num text-right">{formatBRL(x.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200 p-4 sm:max-w-sm sm:ml-auto">
              <CostSummary r={t} quantity={doc.project.quantity} />
            </div>
          </Panel>
          <Panel title="Histórico de alterações" bodyClass="p-0">
            <ol className="divide-y divide-gray-100">
              {quote.events.map((e) => (
                <li key={e.id} className="flex flex-col gap-0.5 px-4 py-2.5 text-sm sm:flex-row sm:justify-between sm:gap-4">
                  <span className="text-gray-800">{e.message}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {formatDateTime(e.createdAt)} · {e.userName ?? 'Sistema'}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="min-w-0 space-y-4">
          <Panel title="Status">
            <Select value={quote.status} onChange={(e) => changeStatus(e.target.value as QuoteStatus)} aria-label="Alterar status" disabled={isOld}>
              {QUOTE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-xs text-gray-500">Ao marcar como Enviado (ou posterior), a versão atual é bloqueada; alterações geram nova versão.</p>
            {quote.lossReason && ['reprovado', 'cancelado'].includes(quote.status) && <p className="mt-2 text-sm text-red-700">Motivo: {quote.lossReason}</p>}
          </Panel>
          <CrmPanel quote={quote} onSaved={refresh} />
          <Panel title="Versões" bodyClass="p-0">
            <ul className="divide-y divide-gray-100">
              {[...quote.versions].reverse().map((ver) => (
                <li key={ver.id}>
                  <button
                    onClick={() => setVersion(ver.version === quote.currentVersion ? undefined : ver.version)}
                    className={cx('flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50', ver.version === cur.version && 'bg-brand-50')}
                  >
                    <span>
                      <span className="font-medium">v{ver.version}</span>
                      {ver.version === quote.currentVersion && <span className="ml-1 text-xs text-brand-700">atual</span>}
                      {ver.locked && <span className="ml-1 text-xs text-gray-500">bloqueada</span>}
                      <span className="block text-xs text-gray-500">{formatDateTime(ver.createdAt)}</span>
                    </span>
                    <span className="num">{formatBRL(ver.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>

      <PdfModal open={pdfOpen} onClose={() => setPdfOpen(false)} quote={quote} />
      <Modal
        open={!!lossOpen}
        onClose={() => setLossOpen(null)}
        title={lossOpen === 'reprovado' ? 'Marcar como reprovado' : 'Cancelar orçamento'}
        size="sm"
        footer={
          <>
            <Button onClick={() => setLossOpen(null)}>Voltar</Button>
            <Button
              variant="primary"
              onClick={() => {
                const s = lossOpen!;
                setLossOpen(null);
                void changeStatus(s, lossReason);
              }}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <Textarea label="Motivo da perda" value={lossReason} onChange={(e) => setLossReason(e.target.value)} placeholder="Ex.: preço acima do orçado pelo cliente, prazo, concorrente…" />
      </Modal>
    </>
  );
}

function Info({ k, v, wide }: { k: string; v?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 sm:col-span-4' : ''}>
      <dt className="text-xs text-gray-500">{k}</dt>
      <dd className="whitespace-pre-line text-gray-900">{v?.trim() ? v : '—'}</dd>
    </div>
  );
}

function CrmPanel({ quote, onSaved }: { quote: QuoteDetail; onSaved: (q: QuoteDetail) => Promise<void> }) {
  const fb = useFeedback();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ responsible: '', lastContactAt: '', nextFollowupAt: '', crmNotes: '', lossReason: '' });
  useEffect(() => {
    setF({
      responsible: quote.responsible,
      lastContactAt: quote.lastContactAt ?? '',
      nextFollowupAt: quote.nextFollowupAt ?? '',
      crmNotes: quote.crmNotes,
      lossReason: quote.lossReason,
    });
  }, [quote]);
  async function save() {
    setBusy(true);
    try {
      const r = await quotesRepo.saveCrm(quote.id, { ...f, lastContactAt: f.lastContactAt || null, nextFollowupAt: f.nextFollowupAt || null });
      await onSaved(r);
      fb.ok('Acompanhamento salvo.');
    } catch (e) {
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Acompanhamento">
      <div className="space-y-3">
        <Input label="Responsável" value={f.responsible} onChange={(e) => setF({ ...f, responsible: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Último contato" type="date" value={f.lastContactAt} onChange={(e) => setF({ ...f, lastContactAt: e.target.value })} />
          <Input label="Próximo retorno" type="date" value={f.nextFollowupAt} onChange={(e) => setF({ ...f, nextFollowupAt: e.target.value })} />
        </div>
        <Textarea label="Observações" value={f.crmNotes} onChange={(e) => setF({ ...f, crmNotes: e.target.value })} rows={3} />
        {['reprovado', 'cancelado'].includes(quote.status) && <Input label="Motivo da perda" value={f.lossReason} onChange={(e) => setF({ ...f, lossReason: e.target.value })} />}
        <Button className="w-full" loading={busy} onClick={save}>
          Salvar acompanhamento
        </Button>
        {quote.nextFollowupAt && <p className="text-xs text-gray-500">Retorno agendado para {formatDate(quote.nextFollowupAt)}.</p>}
      </div>
    </Panel>
  );
}

function PdfModal({ open, onClose, quote }: { open: boolean; onClose: () => void; quote: QuoteDetail }) {
  const fb = useFeedback();
  const { company: authCompany } = useAuth();
  const company = useQuery({ queryKey: ['company'], queryFn: companyRepo.get, enabled: open, initialData: authCompany ?? undefined });
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const fileName = pdfFileName(quote.code, quote.current.version);

  useEffect(() => {
    if (!open || !company.data) return;
    let revoked = false;
    let objectUrl: string | null = null;
    setBusy(true);
    generateQuotePdf({
      company: company.data,
      client: quote.client,
      code: quote.code,
      version: quote.current.version,
      issuedAt: quote.current.createdAt,
      doc: quote.current.document,
      calc: quote.current.totals,
    })
      .then((b) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch((e) => fb.error(e))
      .finally(() => setBusy(false));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
      setBlob(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, company.data, quote.id, quote.current.version]);

  function download() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  }

  function print() {
    if (!url) return;
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.src = url;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(url, '_blank');
      }
      setTimeout(() => frame.remove(), 60_000);
    };
    document.body.appendChild(frame);
  }

  async function whatsapp() {
    if (!blob) return;
    const text = `Olá${quote.client?.name ? `, ${quote.client.name.split(' ')[0]}` : ''}! Segue a proposta ${quote.code} — ${quote.current.document.project.name}, no valor de ${formatBRL(quote.current.totals.finalPrice)}.`;
    const file = new File([blob], fileName, { type: 'application/pdf' });
    // Em celulares, o compartilhamento nativo permite anexar o PDF direto no WhatsApp.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text, title: fileName });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    download();
    const phone = onlyDigits(quote.client?.whatsapp || quote.client?.phone || '');
    const full = phone && phone.length <= 11 ? `55${phone}` : phone;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(text + ' (PDF em anexo)')}`, '_blank', 'noopener');
    fb.ok('PDF baixado. Anexe o arquivo na conversa do WhatsApp que foi aberta.');
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Proposta ${quote.code} — versão ${quote.current.version}`}
      size="xl"
      footer={
        <>
          <Button icon={<MessageCircle className="size-4" />} onClick={whatsapp} disabled={!blob}>
            WhatsApp
          </Button>
          <Button icon={<Printer className="size-4" />} onClick={print} disabled={!url}>
            Imprimir
          </Button>
          <Button variant="primary" icon={<Download className="size-4" />} onClick={download} disabled={!url}>
            Baixar PDF
          </Button>
        </>
      }
    >
      <p className="mb-2 text-xs text-gray-500">
        Documento destinado ao cliente: não contém custos, margem, lucro nem preços de fornecedores. {quote.current.document.commercial.showItemized ? 'Itens detalhados com valores de venda.' : 'Exibe apenas o valor global.'}
      </p>
      {busy || !url ? (
        <Spinner label="Gerando PDF…" />
      ) : (
        <object data={url} type="application/pdf" className="h-[70vh] w-full rounded border border-gray-200" aria-label="Pré-visualização do PDF">
          <div className="p-6 text-center text-sm text-gray-600">
            Seu navegador não exibe PDFs embutidos.{' '}
            <button className="font-medium text-brand-700 underline" onClick={download}>
              Baixe o arquivo
            </button>{' '}
            para visualizar.
          </div>
        </object>
      )}
    </Modal>
  );
}
