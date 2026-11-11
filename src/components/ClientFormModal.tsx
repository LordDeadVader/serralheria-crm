import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clientsRepo } from '../repositories';
import { clientSchema, onlyDigits, type ClientInput } from '../schemas';
import type { Client } from '../types/domain';
import { useForm } from '../hooks/useForm';
import { useFeedback } from './feedback';
import { Button, Input, Modal, Select, Textarea } from './ui';

const EMPTY: ClientInput = {
  name: '',
  personType: 'PF',
  document: '',
  phone: '',
  whatsapp: '',
  email: '',
  cep: '',
  street: '',
  number: '',
  district: '',
  city: '',
  state: '',
  complement: '',
  notes: '',
};

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export function ClientFormModal({ open, onClose, client, onSaved }: { open: boolean; onClose: () => void; client?: Client | null; onSaved?: (c: Client) => void }) {
  const fb = useFeedback();
  const qc = useQueryClient();
  const f = useForm<ClientInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    f.setErrors({});
    f.setValues(client ? { ...EMPTY, ...pick(client) } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client]);

  async function lookupCep() {
    const cep = onlyDigits(f.values.cep);
    if (cep.length !== 8) return;
    setCepBusy(true);
    try {
      // Consulta pública de CEP (ViaCEP). Somente o CEP é enviado.
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (!d.erro) {
        f.setValues((s) => ({
          ...s,
          street: d.logradouro || s.street,
          district: d.bairro || s.district,
          city: d.localidade || s.city,
          state: d.uf || s.state,
        }));
      }
    } catch {
      /* preenchimento manual */
    } finally {
      setCepBusy(false);
    }
  }

  async function save() {
    const data = f.validate(clientSchema);
    if (!data) return;
    setBusy(true);
    try {
      const saved = client ? await clientsRepo.update(client.id, data) : await clientsRepo.create(data);
      await qc.invalidateQueries({ queryKey: ['clients'] });
      fb.ok(client ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      f.applyApiError(e);
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }

  const v = f.values;
  const e = f.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Editar cliente' : 'Novo cliente'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            Salvar cliente
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <Input wrapClass="sm:col-span-4" label="Nome / Razão social *" value={v.name} onChange={(x) => f.set('name', x.target.value)} error={e.name} autoFocus />
        <Select wrapClass="sm:col-span-2" label="Tipo" value={v.personType} onChange={(x) => f.set('personType', x.target.value as 'PF' | 'PJ')}>
          <option value="PF">Pessoa física</option>
          <option value="PJ">Pessoa jurídica</option>
        </Select>
        <Input wrapClass="sm:col-span-2" label={v.personType === 'PF' ? 'CPF' : 'CNPJ'} value={v.document} onChange={(x) => f.set('document', x.target.value)} error={e.document} inputMode="numeric" />
        <Input wrapClass="sm:col-span-2" label="Telefone" value={v.phone} onChange={(x) => f.set('phone', x.target.value)} inputMode="tel" />
        <Input wrapClass="sm:col-span-2" label="WhatsApp" value={v.whatsapp} onChange={(x) => f.set('whatsapp', x.target.value)} inputMode="tel" />
        <Input wrapClass="sm:col-span-3" label="E-mail" type="email" value={v.email} onChange={(x) => f.set('email', x.target.value)} error={e.email} />
        <Input
          wrapClass="sm:col-span-3"
          label="CEP"
          value={v.cep}
          onChange={(x) => f.set('cep', x.target.value)}
          onBlur={lookupCep}
          error={e.cep}
          inputMode="numeric"
          hint={cepBusy ? 'Buscando endereço…' : 'Preenche o endereço automaticamente.'}
        />
        <Input wrapClass="sm:col-span-4" label="Endereço" value={v.street} onChange={(x) => f.set('street', x.target.value)} />
        <Input wrapClass="sm:col-span-2" label="Número" value={v.number} onChange={(x) => f.set('number', x.target.value)} />
        <Input wrapClass="sm:col-span-2" label="Bairro" value={v.district} onChange={(x) => f.set('district', x.target.value)} />
        <Input wrapClass="sm:col-span-3" label="Cidade" value={v.city} onChange={(x) => f.set('city', x.target.value)} />
        <Select wrapClass="sm:col-span-1" label="UF" value={v.state} onChange={(x) => f.set('state', x.target.value)}>
          <option value="">—</option>
          {UFS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </Select>
        <Input wrapClass="sm:col-span-6" label="Complemento" value={v.complement} onChange={(x) => f.set('complement', x.target.value)} />
        <Textarea wrapClass="sm:col-span-6" label="Observações" value={v.notes} onChange={(x) => f.set('notes', x.target.value)} />
      </div>
    </Modal>
  );
}

function pick(c: Client): ClientInput {
  const { name, personType, document, phone, whatsapp, email, cep, street, number, district, city, state, complement, notes } = c;
  return { name, personType, document, phone, whatsapp, email, cep, street, number, district, city, state, complement, notes };
}

export function formatAddress(c: Pick<Client, 'street' | 'number' | 'district' | 'city' | 'state' | 'complement' | 'cep'> | null | undefined) {
  if (!c) return '';
  const l1 = [c.street, c.number].filter(Boolean).join(', ');
  const l2 = [c.complement, c.district].filter(Boolean).join(' - ');
  const l3 = [c.city, c.state].filter(Boolean).join('/');
  return [l1, l2, l3, c.cep ? `CEP ${c.cep}` : ''].filter(Boolean).join(' · ');
}
