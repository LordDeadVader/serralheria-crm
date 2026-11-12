import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ListPlus } from 'lucide-react';
import { presetsRepo } from '../repositories';
import { useFeedback } from './feedback';
import { Button } from './ui';

/** Importa a lista padrão de materiais/insumos, serviços e modelos (só o que falta; sem preços). */
export function ImportPresetsButton() {
  const fb = useFeedback();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function run() {
    const ok = await fb.confirm({
      title: 'Importar lista padrão',
      message:
        'Adiciona a lista padrão de comunicação visual e serralheria: materiais e insumos, mão de obra e serviços, e modelos/kits. Itens que você já tem (mesmo nome) não são duplicados. Os itens entram SEM preço para você preencher.',
      confirmLabel: 'Importar',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await presetsRepo.importAll();
      await Promise.all(['materials', 'services', 'templates'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      fb.ok(r.materials + r.services + r.templates ? `Importados: ${r.materials} materiais, ${r.services} serviços e ${r.templates} modelos.` : 'Nada a importar: você já tem todos os itens da lista.');
    } catch (e) {
      fb.error(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button icon={<ListPlus className="size-4" />} loading={busy} onClick={run}>
      Importar lista padrão
    </Button>
  );
}
