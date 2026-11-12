"""
Gera as predefinições de catálogo (materiais/insumos, serviços e modelos) a partir de lista.txt.

Saídas:
  src/data/presets.ts                       → usado no cadastro de novas empresas e no botão "Importar lista padrão"
  worker/migrations/0002_modelos_presets.sql (trecho final) → preenche as empresas já existentes

Regras:
  - NENHUM preço é inventado: materiais entram com preço 0 e serviços com valor 0 ("sem preço").
  - A unidade de compra só usa tamanho de embalagem quando ele está no próprio nome
    (ACM 1,22 x 5,00 m) ou é padrão de mercado (barra de tubo = 6 m). Nos demais casos,
    compra = unidade de uso (m², m, kg, l, un) — o usuário ajusta depois se quiser.
Uso: python scripts/presets/generate.py
"""
import json
import os
import re
import unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(os.path.dirname(__file__), 'lista.txt')

CATEGORY_NAMES = {
    'ACM': 'ACM',
    'TUBOS GALVANIZADOS': 'Tubos galvanizados',
    'CHAPAS GALVANIZADAS': 'Chapas galvanizadas',
    'CHAPAS E PERFIS DE ALUMÍNIO': 'Chapas e perfis de alumínio',
    'ACRÍLICOS E PLÁSTICOS': 'Acrílicos e plásticos',
    'ADESIVOS E PELÍCULAS': 'Adesivos e películas',
    'LONAS E TECIDOS': 'Lonas e tecidos',
    'TINTAS E MATERIAIS DE IMPRESSÃO': 'Tintas e materiais de impressão',
    'COLAS, PU E FITAS': 'Colas, PU e fitas',
    'PARAFUSOS E FIXADORES': 'Parafusos e fixadores',
    'SOLDA E CONSUMÍVEIS': 'Solda e consumíveis',
    'PINTURA E PROTEÇÃO': 'Pintura e proteção',
    'ILUMINAÇÃO E ELÉTRICA': 'Iluminação e elétrica',
    'ESTRUTURAS E FERRAGENS': 'Estruturas e ferragens',
    'SINALIZAÇÃO E ACABAMENTOS': 'Sinalização e acabamentos',
    'MATERIAIS PARA LETRAS CAIXA E FACHADAS': 'Letras caixa e fachadas',
    'CONSUMÍVEIS GERAIS': 'Consumíveis gerais',
}
SERVICE_SECTIONS = {
    'MÃO DE OBRA — SERRALHERIA': 'Serralheria',
    'MÃO DE OBRA — COMUNICAÇÃO VISUAL': 'Comunicação visual',
    'SERVIÇOS E MÃO DE OBRA COMPLEMENTAR': 'Serviços complementares',
}


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s).strip()


def per(unit_purchase, unit):
    """Compra pela própria unidade de uso."""
    return {'purchaseUnit': unit_purchase, 'packQty': 1, 'packUnit': unit, 'usageUnit': unit}


M2 = per('m²', 'm2')
M = per('metro', 'm')
UN = per('unidade', 'un')
KG = per('kg', 'kg')
L = per('litro', 'l')


def has(n, *keys):
    return any(re.search(r'(?<![a-z])' + re.escape(k) + r'(?![a-z])', n) for k in keys)


def material_units(name, cat):
    n = norm(name)
    # Itens vendidos por peça, mesmo que o nome cite outro material (cola para acrílico, grampo para cabo…).
    if n.split(' ')[0] in ('cola', 'esticador', 'grampo', 'broca', 'serra', 'lamina', 'espacador', 'damper', 'filtro', 'mangueira', 'pino', 'gabarito'):
        return UN
    if n.startswith('ilhos'):
        return UN
    if n.startswith('verniz'):
        return L
    if n.startswith('fita') and not has(n, 'fita led', 'fita de borda para letra caixa'):
        return UN
    if n in ('papel para mascaramento', 'plastico para protecao', 'papel sulfite'):
        return UN
    # Tamanho no nome: "1,22 x 5,00 m" → chapa com área conhecida.
    m = re.search(r'(\d+,\d+)\s*x\s*(\d+,\d+)\s*m\b', name)
    if m:
        a = float(m.group(1).replace(',', '.')) * float(m.group(2).replace(',', '.'))
        return {'purchaseUnit': 'chapa', 'packQty': round(a, 4), 'packUnit': 'm2', 'usageUnit': 'm2'}
    if cat == 'Tubos galvanizados' or n.startswith('tubo '):
        return {'purchaseUnit': 'barra', 'packQty': 6, 'packUnit': 'm', 'usageUnit': 'm'}
    if has(n, 'perfil', 'barra', 'cantoneira de aluminio', 'fita led', 'neon led', 'cabo pp', 'cabo flexivel', 'cabo paralelo',
           'cabo de aco', 'corrente', 'corda', 'elastico', 'bainha', 'difusor para perfil', 'filme dtf', 'papel kraft', 'fita de borda para letra caixa'):
        return M
    if has(n, 'eletrodo', 'arame', 'po adesivo', 'graxa'):
        return KG
    if has(n, 'chapa', 'acrilico', 'policarbonato', 'pvc expandido', 'ps', 'placa', 'lona', 'tecido', 'tela mesh',
           'adesivo', 'pelicula', 'mascara de transferencia', 'papel fotografico', 'papel adesivo', 'papel couche',
           'papel sublimatico', 'papel protetor', 'retalho de acm', 'polionda'):
        return M2
    if n.startswith('tinta') and 'spray' not in n:
        return L
    if has(n, 'liquido', 'solucao', 'thinner', 'solvente', 'aguarras', 'fluido', 'oleo', 'alcool', 'desengraxante', 'desengripante',
           'removedor', 'catalisador', 'endurecedor', 'verniz', 'zarcao', 'fundo anticorrosivo', 'galvanizacao a frio', 'primer',
           'detergente', 'sabao desengraxante'):
        return L
    return UN


def service_info(name, area):
    n = norm(name)
    if n.startswith('diaria'):
        return {'mode': 'fixed', 'unit': 'dia', 'category': area}
    if n.startswith('hora de') or area in ('Serralheria', 'Comunicação visual'):
        return {'mode': 'hour', 'unit': 'h', 'category': area}
    return {'mode': 'fixed', 'unit': 'serviço', 'category': area}


def parse():
    materials, services = [], []
    seen_m, seen_s = set(), set()
    section = None
    with open(SRC, encoding='utf-8') as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith('LISTA DE INSUMOS'):
                continue
            if line in CATEGORY_NAMES or line in SERVICE_SECTIONS:
                section = line
                continue
            if section in CATEGORY_NAMES:
                cat = CATEGORY_NAMES[section]
                k = norm(line)
                if k in seen_m:
                    continue
                seen_m.add(k)
                materials.append({'name': line, 'category': cat, **material_units(line, cat)})
            elif section in SERVICE_SECTIONS:
                k = norm(line)
                if k in seen_s:
                    continue
                seen_s.add(k)
                services.append({'name': line, **service_info(line, SERVICE_SECTIONS[section])})
    return materials, services


# ------------------------- Modelos e kits (sem preço) -------------------------

def mat(name, unit, qty, waste=None):
    return {'materialId': None, 'name': name, 'unit': unit, 'qty': qty, 'wastePct': waste}


def lab(name, hours, workers=1):
    return {'serviceId': None, 'name': name, 'mode': 'hour', 'qty': hours, 'workers': workers, 'rate': 0}


PINTURA_ESPEC = 'Fundo anticorrosivo + esmalte sintético'
TEMPLATES = [
    {
        'name': 'Testeira em ACM adesivada', 'kind': 'projeto', 'serviceType': 'Estrutura metálica',
        'description': 'Testeira em ACM adesivada para fachada',
        'specifications': '- Chapa ACM 3 mm\n- Estrutura interna em tubo metalon galvanizado\n- Adesivo aplicado sobre o ACM\n- Fixação com parafusos autobrocantes e rebites\n- Instalação inclusa',
        'finish': 'ACM branco com adesivo', 'notes': 'Quantidades para ~5 m² de testeira — ajuste pela área.',
        'materials': [
            mat('ACM 3 mm branco 1,22 x 5,00 m', 'm2', 5, 10),
            mat('Tubo metalon galvanizado 20 x 20 mm', 'm', 12),
            mat('Adesivo branco brilho', 'm2', 5, 10),
            mat('Perfil de acabamento ACM', 'm', 6, 5),
            mat('Parafuso autobrocante 4,2 x 19 mm', 'un', 40, 0),
            mat('Rebite de alumínio 4 mm', 'un', 30, 0),
            mat('PU 500 g', 'un', 1, 0),
            mat('Fita dupla face VHB', 'un', 1, 0),
            mat('Disco de corte 4.1/2"', 'un', 2, 0),
        ],
        'labor': [lab('Montador de ACM', 6, 2), lab('Instalador de comunicação visual', 4, 2)],
        'extras': [],
    },
    {
        'name': 'Fachada em ACM com estrutura', 'kind': 'projeto', 'serviceType': 'Estrutura metálica',
        'description': 'Revestimento de fachada em ACM sobre estrutura metálica',
        'specifications': '- Chapa ACM 3 mm\n- Estrutura em tubo metalon galvanizado\n- Perfis de união e arremate\n- Vedação com PU\n- Instalação inclusa',
        'finish': 'ACM conforme cor escolhida', 'notes': 'Quantidades por m² de fachada — use a quantidade do projeto em m².',
        'materials': [
            mat('ACM 3 mm branco 1,22 x 5,00 m', 'm2', 1, 12),
            mat('Tubo metalon galvanizado 30 x 30 mm', 'm', 2.5),
            mat('Perfil de união ACM', 'm', 0.8, 5),
            mat('Perfil de arremate ACM', 'm', 0.4, 5),
            mat('Parafuso autobrocante 4,2 x 19 mm', 'un', 10, 0),
            mat('Rebite de alumínio 4 mm', 'un', 8, 0),
            mat('PU 500 g', 'un', 0.2, 0),
        ],
        'labor': [lab('Montador de fachadas', 1, 2), lab('Instalador de comunicação visual', 0.5, 2)],
        'extras': [],
    },
    {
        'name': 'Letra caixa em ACM com LED', 'kind': 'projeto', 'serviceType': 'Outro',
        'description': 'Letra caixa em ACM com iluminação em LED',
        'specifications': '- Frente em acrílico leitoso\n- Laterais em ACM / chapa\n- Módulos LED e fonte\n- Fixação com espaçadores',
        'finish': 'Conforme arte aprovada', 'notes': 'Quantidades por letra média (~40 cm) — multiplique pela quantidade de letras.',
        'materials': [
            mat('Acrílico leitoso para letra caixa', 'm2', 0.15, 15),
            mat('Retalho de ACM', 'm2', 0.2, 15),
            mat('Fita de borda para letra caixa', 'm', 1.6, 5),
            mat('Módulo LED para letra caixa', 'un', 6, 0),
            mat('Fonte para letra caixa', 'un', 0.2, 0),
            mat('Cabo PP 2 x 1,5 mm', 'm', 1.5, 0),
            mat('Espaçador para letras', 'un', 3, 0),
            mat('Silicone para vedação', 'un', 0.2, 0),
        ],
        'labor': [lab('Montador de letras caixa', 1.5, 1), lab('Instalador de luminosos', 0.5, 2)],
        'extras': [],
    },
    {
        'name': 'Placa em ACM adesivada', 'kind': 'projeto', 'serviceType': 'Outro',
        'description': 'Placa em ACM com adesivo',
        'specifications': '- Chapa ACM 3 mm\n- Adesivo aplicado\n- Fixação conforme local',
        'finish': '', 'notes': 'Quantidades por m² de placa.',
        'materials': [
            mat('ACM 3 mm branco 1,22 x 5,00 m', 'm2', 1, 10),
            mat('Adesivo branco brilho', 'm2', 1, 10),
            mat('Fita dupla face VHB', 'un', 0.2, 0),
            mat('Parafuso com bucha', 'un', 4, 0),
        ],
        'labor': [lab('Instalador de adesivos', 0.5, 1), lab('Instalador de placas', 0.5, 1)],
        'extras': [],
    },
    {
        'name': 'Portão de correr em metalon', 'kind': 'projeto', 'serviceType': 'Portão de correr',
        'description': 'Portão de correr em metalon com fechamento em chapa',
        'specifications': '- Quadro em tubo metalon galvanizado 40 x 40 mm\n- Travessas em 30 x 30 mm\n- Fechamento em chapa galvanizada\n- Roldanas e trilho\n- ' + PINTURA_ESPEC,
        'finish': PINTURA_ESPEC, 'notes': 'Base para portão de ~3,00 x 2,00 m.',
        'materials': [
            mat('Tubo metalon galvanizado 40 x 40 mm', 'm', 14),
            mat('Tubo metalon galvanizado 30 x 30 mm', 'm', 18),
            mat('Chapa galvanizada 0,95 mm', 'm2', 6),
            mat('Rodízio industrial', 'un', 4, 0),
            mat('Fechadura', 'un', 1, 0),
            mat('Fundo anticorrosivo', 'l', 1, 0),
            mat('Tinta esmalte sintético preto', 'l', 1.5, 0),
            mat('Arame MIG 0,8 mm', 'kg', 1, 0),
            mat('Disco de corte 7"', 'un', 3, 0),
            mat('Disco de desbaste 7"', 'un', 1, 0),
        ],
        'labor': [lab('Serralheiro', 10, 2), lab('Pintor de estruturas metálicas', 3, 1), lab('Instalador de estruturas metálicas', 4, 2)],
        'extras': [],
    },
    {
        'name': 'Grade de proteção para janela', 'kind': 'projeto', 'serviceType': 'Grade',
        'description': 'Grade de proteção para janela em metalon',
        'specifications': '- Quadro e barras em tubo metalon galvanizado 20 x 20 mm\n- Fixação na alvenaria\n- ' + PINTURA_ESPEC,
        'finish': PINTURA_ESPEC, 'notes': 'Base para janela de ~1,20 x 1,00 m.',
        'materials': [
            mat('Tubo metalon galvanizado 20 x 20 mm', 'm', 12),
            mat('Parafuso com bucha', 'un', 8, 0),
            mat('Fundo anticorrosivo', 'l', 0.3, 0),
            mat('Tinta esmalte sintético preto', 'l', 0.3, 0),
            mat('Eletrodo 6013 2,5 mm', 'kg', 0.3, 0),
            mat('Disco de corte 7"', 'un', 1, 0),
        ],
        'labor': [lab('Serralheiro', 3, 1), lab('Pintor de estruturas metálicas', 1, 1), lab('Instalador de estruturas metálicas', 1.5, 2)],
        'extras': [],
    },
    {
        'name': 'Guarda-corpo em metalon (por metro)', 'kind': 'projeto', 'serviceType': 'Guarda-corpo',
        'description': 'Guarda-corpo em metalon',
        'specifications': '- Corrimão e montantes em tubo metalon galvanizado 40 x 40 mm\n- Travessas em 20 x 20 mm\n- Fixação com chumbadores\n- ' + PINTURA_ESPEC,
        'finish': PINTURA_ESPEC, 'notes': 'Quantidades por metro linear — use a quantidade do projeto em metros.',
        'materials': [
            mat('Tubo metalon galvanizado 40 x 40 mm', 'm', 2),
            mat('Tubo metalon galvanizado 20 x 20 mm', 'm', 4),
            mat('Chumbador parabolt', 'un', 2, 0),
            mat('Tinta esmalte sintético preto', 'l', 0.15, 0),
            mat('Arame MIG 0,8 mm', 'kg', 0.15, 0),
        ],
        'labor': [lab('Serralheiro', 1.5, 1), lab('Instalador de estruturas metálicas', 0.5, 2)],
        'extras': [],
    },
    # ------------------------------- Kits -------------------------------
    {
        'name': 'Holofote LED 50 W instalado', 'kind': 'kit', 'serviceType': '',
        'description': 'Holofote LED 50 W com braço em tubo, pintura e fiação', 'specifications': '', 'finish': '',
        'notes': 'Por holofote: braço em tubo 15 x 15, pintura preta e fio.',
        'materials': [
            mat('Refletor LED', 'un', 1, 0),
            mat('Tubo metalon galvanizado 15 x 15 mm', 'm', 1),
            mat('Tinta spray preto fosco', 'un', 0.25, 0),
            mat('Cabo PP 2 x 1,5 mm', 'm', 5, 0),
            mat('Conector Wago', 'un', 2, 0),
            mat('Parafuso autobrocante 4,2 x 19 mm', 'un', 4, 0),
        ],
        'labor': [lab('Serralheiro', 0.5, 1), lab('Eletricista instalador', 0.5, 1)],
        'extras': [],
    },
    {
        'name': 'Iluminação com fita LED (por metro)', 'kind': 'kit', 'serviceType': '',
        'description': 'Iluminação em fita LED com perfil e difusor', 'specifications': '', 'finish': '',
        'notes': 'Por metro de fita: perfil, difusor, cabo e parte da fonte.',
        'materials': [
            mat('Fita LED 12V', 'm', 1, 5),
            mat('Perfil de alumínio para LED', 'm', 1, 5),
            mat('Difusor para perfil LED', 'm', 1, 5),
            mat('Fonte chaveada 12V', 'un', 0.1, 0),
            mat('Cabo paralelo', 'm', 0.5, 0),
        ],
        'labor': [lab('Eletricista instalador', 0.3, 1)],
        'extras': [],
    },
    {
        'name': 'Pintura (fundo + esmalte) por m²', 'kind': 'kit', 'serviceType': '',
        'description': 'Pintura com fundo anticorrosivo e esmalte sintético', 'specifications': '', 'finish': '',
        'notes': 'Por m² pintado, duas demãos de esmalte.',
        'materials': [
            mat('Fundo anticorrosivo', 'l', 0.1, 0),
            mat('Tinta esmalte sintético preto', 'l', 0.15, 0),
            mat('Thinner', 'l', 0.05, 0),
            mat('Lixa ferro 120', 'un', 0.5, 0),
        ],
        'labor': [lab('Pintor de estruturas metálicas', 0.4, 1)],
        'extras': [],
    },
    {
        'name': 'Consumíveis de solda e corte (por dia)', 'kind': 'kit', 'serviceType': '',
        'description': 'Insumos de solda e corte', 'specifications': '', 'finish': '',
        'notes': 'Média de consumo por dia de oficina.',
        'materials': [
            mat('Arame MIG 0,8 mm', 'kg', 1, 0),
            mat('Disco de corte 7"', 'un', 3, 0),
            mat('Disco de desbaste 7"', 'un', 1, 0),
            mat('Disco flap 4.1/2"', 'un', 1, 0),
            mat('Spray antirrespingo', 'un', 0.2, 0),
        ],
        'labor': [],
        'extras': [],
    },
    {
        'name': 'Aplicação de adesivo (por m²)', 'kind': 'kit', 'serviceType': '',
        'description': 'Adesivo aplicado', 'specifications': '', 'finish': '',
        'notes': 'Por m² aplicado.',
        'materials': [
            mat('Adesivo branco brilho', 'm2', 1, 10),
            mat('Película laminadora brilho', 'm2', 1, 10),
            mat('Máscara de transferência transparente', 'm2', 1, 10),
            mat('Álcool isopropílico', 'l', 0.05, 0),
        ],
        'labor': [lab('Instalador de adesivos', 0.3, 1)],
        'extras': [],
    },
]


def sql_str(s):
    return "'" + str(s).replace("'", "''") + "'"


def main():
    materials, services = parse()
    names = {norm(m['name']) for m in materials}
    for t in TEMPLATES:
        for m in t['materials']:
            assert norm(m['name']) in names, f"Modelo {t['name']}: material fora da lista: {m['name']}"
            unit = next(x['usageUnit'] for x in materials if norm(x['name']) == norm(m['name']))
            assert unit == m['unit'], f"Modelo {t['name']}: unidade de {m['name']} deve ser {unit}"
        snames = {norm(s['name']) for s in services}
        for l in t['labor']:
            assert norm(l['name']) in snames, f"Modelo {t['name']}: serviço fora da lista: {l['name']}"

    ts = [
        '/* Arquivo GERADO por scripts/presets/generate.py a partir de scripts/presets/lista.txt — não edite à mão. */',
        "import type { TemplateInput } from '../schemas/templates';",
        '',
        'export interface MaterialPreset { name: string; category: string; purchaseUnit: string; packQty: number; packUnit: string; usageUnit: string }',
        "export interface ServicePreset { name: string; category: string; mode: 'hour' | 'fixed'; unit: string }",
        '',
        f'export const MATERIAL_PRESETS: MaterialPreset[] = {json.dumps(materials, ensure_ascii=False, indent=1)};',
        '',
        f'export const SERVICE_PRESETS: ServicePreset[] = {json.dumps(services, ensure_ascii=False, indent=1)};',
        '',
        f'export const TEMPLATE_PRESETS: TemplateInput[] = {json.dumps(TEMPLATES, ensure_ascii=False, indent=1)};',
        '',
    ]
    out = os.path.join(ROOT, 'src', 'data', 'presets.ts')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(ts).replace(': null', ': null'))

    # SQL para empresas existentes: insere apenas o que ainda não existe (por nome, sem diferenciar maiúsculas).
    uid = "lower(hex(randomblob(16)))"
    sql = ['', '-- Predefinições (gerado por scripts/presets/generate.py): materiais e serviços sem preço, modelos e kits.']
    for m in materials:
        sql.append(
            f"INSERT INTO materials (id, company_id, name, category, description, purchase_unit, pack_qty, pack_unit, usage_unit, purchase_price, status, is_demo) "
            f"SELECT {uid}, c.id, {sql_str(m['name'])}, {sql_str(m['category'])}, '', {sql_str(m['purchaseUnit'])}, {m['packQty']}, {sql_str(m['packUnit'])}, {sql_str(m['usageUnit'])}, 0, 'ativo', 0 "
            f"FROM companies c WHERE NOT EXISTS (SELECT 1 FROM materials x WHERE x.company_id = c.id AND lower(x.name) = lower({sql_str(m['name'])}));--> statement-breakpoint"
        )
    for s in services:
        sql.append(
            f"INSERT INTO services (id, company_id, name, description, category, mode, unit, hourly_cost, fixed_price, estimated_hours, status, is_demo) "
            f"SELECT {uid}, c.id, {sql_str(s['name'])}, '', {sql_str(s['category'])}, {sql_str(s['mode'])}, {sql_str(s['unit'])}, 0, 0, 0, 'ativo', 0 "
            f"FROM companies c WHERE NOT EXISTS (SELECT 1 FROM services x WHERE x.company_id = c.id AND lower(x.name) = lower({sql_str(s['name'])}));--> statement-breakpoint"
        )
    for t in TEMPLATES:
        data = {k: v for k, v in t.items() if k not in ('name', 'kind')}
        sql.append(
            f"INSERT INTO templates (id, company_id, name, kind, data, is_demo) "
            f"SELECT {uid}, c.id, {sql_str(t['name'])}, {sql_str(t['kind'])}, {sql_str(json.dumps(data, ensure_ascii=False))}, 1 "
            f"FROM companies c WHERE NOT EXISTS (SELECT 1 FROM templates x WHERE x.company_id = c.id AND lower(x.name) = lower({sql_str(t['name'])}));--> statement-breakpoint"
        )
    with open(os.path.join(os.path.dirname(__file__), 'presets.sql'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(sql) + '\n')
    print(f'{len(materials)} materiais, {len(services)} serviços, {len(TEMPLATES)} modelos/kits')


if __name__ == '__main__':
    main()
