import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, MessageCircle, Phone, Trash2, UserPlus } from 'lucide-react';
import { useFeedback } from '../../components/feedback';
import { Badge, Button, Empty, ErrorBox, Segmented, Select, Spinner } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import { siteRepo, type SiteLead } from '../../repositories/site';
import { LEAD_STATUS, type LeadStatus } from '../../schemas/site';

const STATUS_LABEL: Record<LeadStatus, string> = { novo: 'Nova', visto: 'Vista', respondido: 'Respondida', arquivado: 'Arquivada' };
const STATUS_TONE: Record<LeadStatus, 'brand' | 'gray' | 'green' | 'amber'> = { novo: 'brand', visto: 'gray', respondido: 'green', arquivado: 'amber' };

const wa = (phone: string, name: string) => {
  const d = phone.replace(/\D/g, '');
  const n = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${n}?text=${encodeURIComponent(`Olá, ${name.split(' ')[0]}! Aqui é da WJR Serralheria, recebemos sua solicitação pelo site.`)}`;
};

function Files({ lead }: { lead: SiteLead }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    void Promise.all(
      lead.files.map((_, i) =>
        siteRepo
          .leadFile(lead.id, i)
          .then((b) => {
            const u = URL.createObjectURL(b);
            made.push(u);
            return u;
          })
          .catch(() => ''),
      ),
    ).then((u) => alive && setUrls(u));
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [lead]);
  if (!lead.files.length) return null;
  return (
    <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
      {lead.files.map((f, i) => (
        <li key={f.key}>
          <a href={urls[i] || undefined} target="_blank" rel="noopener" className="block overflow-hidden rounded border border-slate-300 bg-gray-50" title={f.name}>
            {f.type.startsWith('image/') && urls[i] ? (
              <img src={urls[i]} alt={f.name} className="aspect-square w-full object-cover" />
            ) : (
              <span className="grid aspect-square place-items-center text-gray-500">
                <FileText className="size-6" />
              </span>
            )}
            <span className="block truncate px-1.5 py-1 text-[11px] text-gray-600">{f.name}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function SiteLeadsPage() {
  const fb = useFeedback();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'abertas' | 'todas' | 'arquivado'>('abertas');
  const q = useQuery({ queryKey: ['site', 'leads'], queryFn: siteRepo.leads });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['site'] }), qc.invalidateQueries({ queryKey: ['clients'] })]);

  async function setStatus(l: SiteLead, s: LeadStatus) {
    try {
      await siteRepo.setLeadStatus(l.id, s);
      await refresh();
    } catch (e) {
      fb.error(e);
    }
  }
  async function toClient(l: SiteLead) {
    try {
      const r = await siteRepo.leadToClient(l.id);
      await refresh();
      fb.ok(r.created ? 'Cliente cadastrado no CRM.' : 'Já estava cadastrado.');
    } catch (e) {
      fb.error(e);
    }
  }
  async function remove(l: SiteLead) {
    if (!(await fb.confirm({ title: 'Excluir solicitação', message: `Excluir a solicitação de ${l.name} e os arquivos enviados? Não há como desfazer.`, confirmLabel: 'Excluir', danger: true }))) return;
    try {
      await siteRepo.removeLead(l.id);
      await refresh();
    } catch (e) {
      fb.error(e);
    }
  }

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const rows = (q.data ?? []).filter((l) => (filter === 'todas' ? true : filter === 'arquivado' ? l.status === 'arquivado' : l.status !== 'arquivado'));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'abertas', label: 'Em aberto' },
            { value: 'arquivado', label: 'Arquivadas' },
            { value: 'todas', label: 'Todas' },
          ]}
        />
        <p className="text-xs text-gray-500">Pedidos enviados pelo formulário “Solicitar orçamento” do site.</p>
      </div>
      {rows.length === 0 ? (
        <Empty title="Nenhuma solicitação aqui">Quando alguém pedir um orçamento pelo site, o pedido aparece nesta lista.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((l, i) => (
            <li key={l.id} className={`rounded-lg border p-4 ${l.status === 'novo' ? 'border-brand-300 bg-brand-50/30' : i % 2 ? 'border-gray-200 bg-slate-50/60' : 'border-gray-200 bg-white'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">{l.name}</h3>
                    <Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                    {l.clientId && <Badge tone="green">No CRM</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">
                    {l.phone} · {l.city} · {formatDateTime(l.createdAt)}
                  </p>
                </div>
                <Select aria-label="Situação" value={l.status} onChange={(e) => void setStatus(l, e.target.value as LeadStatus)} wrapClass="w-36">
                  {LEAD_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                {[
                  ['Serviço', l.service],
                  ['Material', l.material],
                  ['Medidas', l.measures],
                  ['Referência', l.reference],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-gray-500">{k}</dt>
                      <dd className="text-gray-900">{v}</dd>
                    </div>
                  ))}
              </dl>
              <p className="mt-3 text-sm whitespace-pre-line text-gray-800">{l.description}</p>
              <Files lead={l} />
              {l.forwardStatus && <p className="mt-2 text-xs text-gray-500">Integração externa: {l.forwardStatus}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={wa(l.phone, l.name)} target="_blank" rel="noopener" onClick={() => l.status === 'novo' && void setStatus(l, 'respondido')}>
                  <Button size="sm" variant="primary" icon={<MessageCircle className="size-4" />}>
                    Responder no WhatsApp
                  </Button>
                </a>
                <a href={`tel:${l.phone.replace(/\D/g, '')}`}>
                  <Button size="sm" icon={<Phone className="size-4" />}>
                    Ligar
                  </Button>
                </a>
                {l.clientId ? (
                  <Link to={`/clientes/${l.clientId}`}>
                    <Button size="sm" icon={<UserPlus className="size-4" />}>
                      Abrir cliente no CRM
                    </Button>
                  </Link>
                ) : (
                  <Button size="sm" icon={<UserPlus className="size-4" />} onClick={() => void toClient(l)}>
                    Cadastrar como cliente no CRM
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={<Trash2 className="size-4 text-red-600" />} onClick={() => void remove(l)}>
                  Excluir
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
