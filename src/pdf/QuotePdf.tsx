/**
 * Proposta comercial em PDF (@react-pdf/renderer).
 * REGRA: este documento é destinado ao cliente. Não inclui custo de compra, margem, lucro,
 * preços de fornecedores nem qualquer informação financeira interna — apenas valores de venda.
 */
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { paymentPlan, type CalcResult } from '../calculations/engine';
import { formatBRL, formatNumber } from '../calculations/money';
import type { QuoteDocument } from '../schemas/quote';
import type { Client, Company } from '../types/domain';
import { allocateClientLines } from './allocate';

const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#d1d5db';
const BRAND = '#0f4c5c';

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontSize: 9.5, color: INK, fontFamily: 'Helvetica', lineHeight: 1.35 },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: BRAND, paddingBottom: 12, marginBottom: 14 },
  brand: { flexDirection: 'row', gap: 10, maxWidth: 330 },
  logo: { width: 64, height: 64, objectFit: 'contain' },
  company: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  small: { fontSize: 8.5, color: MUTED },
  docBox: { alignItems: 'flex-end' },
  docTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: BRAND, letterSpacing: 1 },
  docNum: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  section: { marginBottom: 12 },
  h2: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: BRAND, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5, borderBottomWidth: 0.75, borderBottomColor: LINE, paddingBottom: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', marginBottom: 4, paddingRight: 8 },
  label: { fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 9.5 },
  para: { marginBottom: 4 },
  tHead: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 0.75, borderBottomColor: LINE, paddingVertical: 4, paddingHorizontal: 6 },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingVertical: 4, paddingHorizontal: 6 },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase' },
  cDesc: { flex: 1, paddingRight: 6 },
  cQty: { width: 80, textAlign: 'right' },
  cVal: { width: 90, textAlign: 'right' },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: BRAND, color: '#ffffff', paddingVertical: 8, paddingHorizontal: 10, marginTop: 8 },
  totalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totalValue: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  signRow: { flexDirection: 'row', gap: 30, marginTop: 34 },
  sign: { flex: 1, borderTopWidth: 0.75, borderTopColor: INK, paddingTop: 4, alignItems: 'center' },
  footerLeft: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 7.5, color: MUTED, borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 5 },
  footerRight: { position: 'absolute', bottom: 24, right: 40, width: 140, textAlign: 'right', fontSize: 7.5, color: MUTED, paddingTop: 5 },
});

export interface QuotePdfProps {
  company: Company;
  client: Client | null;
  code: string;
  version: number;
  issuedAt: string;
  doc: QuoteDocument;
  calc: CalcResult;
}

const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR');

export function QuotePdf({ company, client, code, version, issuedAt, doc, calc }: QuotePdfProps) {
  const issued = new Date(issuedAt);
  const valid = new Date(issued);
  valid.setDate(valid.getDate() + doc.commercial.validityDays);
  const p = doc.project;
  const c = doc.commercial;
  const plan = paymentPlan(calc.finalPrice, c.downPaymentPct, c.installments);
  const dims = [p.width, p.height, p.depth].filter((x) => x != null).map((x) => formatNumber(x as number, 3));
  const address = client ? [[client.street, client.number].filter(Boolean).join(', '), client.complement, client.district, [client.city, client.state].filter(Boolean).join('/'), client.cep && `CEP ${client.cep}`].filter(Boolean).join(' - ') : '';
  const lines = c.showItemized ? allocateClientLines(doc, calc) : [];

  const Info = ({ label, value, full }: { label: string; value?: string | null; full?: boolean }) =>
    value ? (
      <View style={[s.cell, full ? { width: '100%' } : {}]}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.value}>{value}</Text>
      </View>
    ) : null;

  return (
    <Document title={`Proposta ${code}`} author={company.name} subject={p.name} creator="Serralheria CRM" producer="Serralheria CRM">
      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
          <View style={s.brand}>
            {company.logo ? <Image src={company.logo} style={s.logo} /> : null}
            <View>
              <Text style={s.company}>{company.name}</Text>
              {company.legalName ? <Text style={s.small}>{company.legalName}</Text> : null}
              {company.cnpj ? <Text style={s.small}>CNPJ {company.cnpj}</Text> : null}
              {company.address ? <Text style={s.small}>{company.address}</Text> : null}
              <Text style={s.small}>{[company.phone, company.whatsapp && `WhatsApp ${company.whatsapp}`, company.email].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          <View style={s.docBox}>
            <Text style={s.docTitle}>PROPOSTA COMERCIAL</Text>
            <Text style={s.docNum}>
              Nº {code}
              {version > 1 ? ` · Rev. ${version}` : ''}
            </Text>
            <Text style={s.small}>Data: {fmtDate(issued)}</Text>
            <Text style={s.small}>Válida até: {fmtDate(valid)}</Text>
          </View>
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.h2}>Cliente</Text>
          <View style={s.grid}>
            <Info label="Nome" value={client?.name} />
            <Info label={client?.personType === 'PJ' ? 'CNPJ' : 'CPF'} value={client?.document} />
            <Info label="Telefone" value={client?.whatsapp || client?.phone} />
            <Info label="E-mail" value={client?.email} />
            <Info label="Endereço da obra" value={p.installLocation || address} full />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Projeto</Text>
          <Text style={[s.value, { fontFamily: 'Helvetica-Bold', marginBottom: 3 }]}>{p.name}</Text>
          {p.description ? <Text style={s.para}>{p.description}</Text> : null}
          <View style={s.grid}>
            <Info label="Tipo" value={p.serviceType} />
            <Info label="Dimensões" value={dims.length ? `${dims.join(' × ')} ${p.dimensionUnit}` : null} />
            <Info label="Quantidade" value={`${formatNumber(p.quantity)} unidade(s)`} />
            <Info label="Acabamento" value={p.finish} />
          </View>
          {p.specifications ? (
            <View style={{ marginTop: 2 }}>
              <Text style={s.label}>Especificações</Text>
              <Text style={s.para}>{p.specifications}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Investimento</Text>
          {c.showItemized ? (
            <View>
              <View style={s.tHead} fixed>
                <Text style={[s.th, s.cDesc]}>Descrição</Text>
                <Text style={[s.th, s.cQty]}>Quantidade</Text>
                <Text style={[s.th, s.cVal]}>Valor</Text>
              </View>
              {lines.map((l, i) => (
                <View key={i} style={s.tRow} wrap={false}>
                  <Text style={s.cDesc}>{l.description}</Text>
                  <Text style={s.cQty}>{l.qty}</Text>
                  <Text style={s.cVal}>{formatBRL(l.value)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={s.tRow}>
              <Text style={s.cDesc}>
                {p.name} — fornecimento de materiais, fabricação{c.installationDays > 0 ? ' e instalação' : ''}, conforme especificações.
              </Text>
              <Text style={s.cQty}>{formatNumber(p.quantity)} un</Text>
              <Text style={s.cVal}>{formatBRL(calc.finalPrice)}</Text>
            </View>
          )}
          <View style={s.totalBox} wrap={false}>
            <Text style={s.totalLabel}>VALOR TOTAL</Text>
            <Text style={s.totalValue}>{formatBRL(calc.finalPrice)}</Text>
          </View>
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.h2}>Condições de pagamento</Text>
          {plan.downPayment > 0 ? (
            <View style={s.payRow}>
              <Text>Entrada ({formatNumber(c.downPaymentPct)}%)</Text>
              <Text>{formatBRL(plan.downPayment)}</Text>
            </View>
          ) : null}
          {plan.installments > 0 && plan.remaining > 0 ? (
            <View style={s.payRow}>
              <Text>
                Saldo em {plan.installments} parcela(s){plan.lastInstallmentValue !== plan.installmentValue ? ` (última de ${formatBRL(plan.lastInstallmentValue)})` : ''}
              </Text>
              <Text>
                {plan.installments}× {formatBRL(plan.installmentValue)}
              </Text>
            </View>
          ) : null}
          {c.paymentTerms ? <Text style={[s.para, { marginTop: 3 }]}>{c.paymentTerms}</Text> : null}
        </View>

        <View style={s.section} minPresenceAhead={60}>
          <Text style={s.h2}>Prazos e garantia</Text>
          <View style={s.grid}>
            <Info label="Prazo de fabricação" value={`${c.fabricationDays} dia(s) após aprovação`} />
            <Info label="Prazo de instalação" value={c.installationDays ? `${c.installationDays} dia(s)` : 'Não incluso'} />
            <Info label="Garantia" value={c.warranty} full />
          </View>
        </View>

        {c.notes ? (
          <View style={s.section}>
            <Text style={s.h2}>Observações</Text>
            <Text style={s.para}>{c.notes}</Text>
          </View>
        ) : null}

        <View wrap={false} style={{ marginTop: 6 }}>
          <Text style={s.h2}>Aceite da proposta</Text>
          <Text style={s.small}>Declaro estar de acordo com os termos, valores e condições desta proposta.</Text>
          <View style={s.signRow}>
            <View style={s.sign}>
              <Text>{c.responsible || company.name}</Text>
              <Text style={s.small}>{company.name}</Text>
            </View>
            <View style={s.sign}>
              <Text>{client?.name ?? 'Cliente'}</Text>
              <Text style={s.small}>Data: ____/____/________</Text>
            </View>
          </View>
        </View>

        <Text style={s.footerLeft} fixed>
          {company.name} · Proposta {code}
          {version > 1 ? ` rev. ${version}` : ''}
        </Text>
        <Text style={s.footerRight} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  );
}
