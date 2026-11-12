/**
 * Conteúdo inicial do site. Inserido uma única vez por empresa e depois editado pelo painel.
 *
 * Regras:
 *  - Nada de números, anos de experiência, certificações ou depoimentos inventados (ficam vazios).
 *  - Dados de contato vazios: o site oculta o que não estiver preenchido.
 *  - Fotografias provisórias vêm do Unsplash (licença livre) e são marcadas `demo: true`:
 *    o site exibe "Imagem ilustrativa" sobre elas até serem substituídas por fotos reais.
 */
import type { SiteImage, SiteProjectInput, SiteServiceInput, SiteSettings } from '../../../src/schemas/site';

const U = (path: string, alt: string): SiteImage => {
  const base = `https://images.unsplash.com/${path}`;
  return { src: `${base}?w=2000&q=70&auto=format&fit=crop`, srcSm: `${base}?w=900&q=70&auto=format&fit=crop`, alt, demo: true, credit: 'Unsplash' };
};

export const DEMO = {
  roof: U('uploads/14123892966835548e7bd/14369636', 'Estrutura metálica de cobertura vista de baixo'),
  gate: U('photo-1576169510450-fd0392650023', 'Portão de ripas metálicas pretas em parede branca'),
  gate2: U('photo-1520361580263-96c088e660a3', 'Portão e gradil metálico preto em fachada de tijolos'),
  structure: U('photo-1760169537635-ad543435470b', 'Galpão com estrutura metálica aparente'),
  mezzanine: U('photo-1505873242700-f289a29e1e0f', 'Ambiente industrial com mezanino e guarda-corpo metálico'),
  stairs: U('photo-1618446911412-e93bd7f24bf5', 'Escada metálica externa em lances alternados'),
  stairs2: U('photo-1485014492605-bbec076ce6e9', 'Escada metálica com degraus vazados'),
  stairs3: U('photo-1757573450070-9aa15c898997', 'Escada metálica em zigue-zague'),
  handrail: U('photo-1626200319898-ed2f597773e9', 'Escada de concreto com corrimão metálico'),
  handrail2: U('photo-1599654924906-9ccb27a46f4b', 'Escadaria com corrimãos de aço inox'),
  handrail3: U('photo-1629096672464-28b05af43d89', 'Escadaria com corrimão contínuo e iluminação'),
  guard: U('photo-1758445048994-d337f97acf4c', 'Guarda-corpo curvo com vidro e perfil metálico'),
  guard2: U('photo-1749467140630-1d8b1f3018eb', 'Passarela curva com guarda-corpo de vidro'),
  ornament: U('photo-1688673375476-2c2054b4626b', 'Detalhe de gradil metálico ornamental'),
  folding: U('photo-1620860335855-7541c19e1de6', 'Grade pantográfica metálica'),
  welding: U('photo-1455165814004-1126a7199f9b', 'Soldador trabalhando com faíscas'),
  grinding: U('photo-1747999461210-a56f72294428', 'Profissional usando esmerilhadeira em oficina'),
  welding2: U('photo-1738162837408-5fbf53f0b97a', 'Solda em chapa perfurada'),
};

export const PROJECT_CATEGORIES = ['Portões', 'Estruturas metálicas', 'Escadas', 'Coberturas', 'Mezaninos', 'Corrimãos', 'Projetos especiais'];

export function defaultSiteSettings(companyName: string): SiteSettings {
  return {
    company: {
      name: companyName,
      legalName: '',
      cnpj: '',
      tagline: 'Serralheria e estruturas metálicas',
      description: 'Portões, estruturas, coberturas, escadas e guarda-corpos sob medida — da medição na obra à instalação.',
      phone: '',
      whatsapp: '',
      email: '',
      address: '',
      city: '',
      state: '',
      region: '',
      hours: '',
      instagram: '',
      facebook: '',
      mapsUrl: '',
    },
    hero: {
      eyebrow: 'Serralheria e estruturas metálicas',
      title: 'Aço projetado, fabricado e instalado com precisão.',
      subtitle: 'Portões, estruturas, coberturas, escadas e guarda-corpos sob medida, do levantamento na obra à instalação final.',
      image: DEMO.roof,
      videoUrl: '',
    },
    intro: {
      title: 'Cada peça começa na medida certa.',
      text: 'Trabalhamos com projetos sob medida para residências, comércios e indústrias. Medimos no local, detalhamos a solução, fabricamos na oficina e instalamos com a mesma equipe — para que o resultado final corresponda ao que foi combinado.',
    },
    differentials: {
      title: 'O que orienta o nosso trabalho',
      items: [
        { title: 'Projeto sob medida', text: 'Cada solução é desenhada a partir das medidas reais do local e do uso previsto.' },
        { title: 'Precisão na fabricação', text: 'Cortes, esquadros e soldas conferidos na oficina antes de seguir para a obra.' },
        { title: 'Materiais especificados', text: 'Perfis, chapas e acabamentos definidos na proposta, sem substituições sem aviso.' },
        { title: 'Acabamento profissional', text: 'Preparação de superfície, fundo anticorrosivo e pintura conforme o ambiente.' },
        { title: 'Prazos combinados', text: 'Cronograma informado na proposta e acompanhamento até a entrega.' },
        { title: 'Instalação especializada', text: 'Montagem feita pela equipe que conhece o projeto, com o local limpo ao final.' },
      ],
    },
    stats: [],
    about: {
      title: 'Serralheria com foco em execução',
      text: 'Escreva aqui a história da empresa: quando começou, quem conduz o trabalho, a estrutura da oficina, os equipamentos e a forma de atender. Este texto é editado no painel do site.',
      image: DEMO.welding,
      image2: DEMO.grinding,
      highlights: [],
    },
    process: {
      title: 'Como funciona o atendimento',
      steps: [
        { title: 'Entendimento da necessidade', text: 'Conversamos sobre o uso, o estilo e as condições do local.' },
        { title: 'Levantamento de medidas', text: 'Visita técnica para medir, fotografar e verificar fixações.' },
        { title: 'Desenvolvimento da proposta', text: 'Solução, materiais, acabamento, prazo e valor por escrito.' },
        { title: 'Fabricação', text: 'Corte, solda, tratamento e pintura na oficina.' },
        { title: 'Instalação e entrega', text: 'Montagem no local, ajustes finais e conferência com o cliente.' },
      ],
    },
    cta: {
      title: 'Tem um projeto em mente?',
      text: 'Envie as medidas aproximadas e algumas fotos do local. Retornamos com as próximas etapas.',
      image: DEMO.welding2,
    },
    seo: { title: '', description: '' },
    projectCategories: PROJECT_CATEGORIES,
  };
}

export const DEFAULT_SERVICES: SiteServiceInput[] = [
  {
    slug: 'portoes-e-grades',
    title: 'Portões e grades',
    summary: 'Portões de correr, basculantes e de abrir, grades de proteção e gradis, com automação quando necessário.',
    body: 'Fabricamos portões e grades sob medida para fachadas residenciais, comerciais e industriais. O projeto considera o vão, o tipo de abertura, o peso da folha, a fixação disponível e a eventual automação.\n\nTrabalhamos com tubos, perfis, chapas e ripados, em acabamentos de pintura eletrostática ou esmalte sobre fundo anticorrosivo.',
    features: ['Portões de correr, basculantes e de abrir', 'Grades de janela e gradis de fachada', 'Preparação para automação', 'Fechaduras e ferragens especificadas'],
    image: DEMO.gate,
    sort: 1,
    active: true,
  },
  {
    slug: 'estruturas-metalicas',
    title: 'Estruturas metálicas',
    summary: 'Estruturas em aço para galpões, ampliações, suportes e bases de equipamentos.',
    body: 'Executamos estruturas metálicas a partir de projeto próprio ou do projeto estrutural do cliente: pilares, vigas, treliças, suportes e bases.\n\nA fabricação é feita na oficina, com montagem e fixação no local.',
    features: ['Pilares, vigas e treliças', 'Suportes e bases para equipamentos', 'Ampliações e reforços', 'Montagem no local'],
    image: DEMO.structure,
    sort: 2,
    active: true,
  },
  {
    slug: 'coberturas-metalicas',
    title: 'Coberturas metálicas',
    summary: 'Coberturas para garagens, áreas externas e galpões, com telha metálica, policarbonato ou vidro.',
    body: 'Projetamos e instalamos coberturas com estrutura em aço e fechamento em telha metálica, termoacústica, policarbonato ou vidro, incluindo calhas e rufos quando necessário.',
    features: ['Garagens, varandas e áreas gourmet', 'Galpões e áreas de carga', 'Calhas, rufos e condutores', 'Telha metálica, termoacústica ou policarbonato'],
    image: DEMO.roof,
    sort: 3,
    active: true,
  },
  {
    slug: 'mezaninos',
    title: 'Mezaninos',
    summary: 'Mezaninos metálicos para lojas, depósitos e escritórios, com escada e guarda-corpo.',
    body: 'Mezaninos em estrutura metálica para ganhar área útil sem obra civil pesada. O piso pode ser em chapa, painel wall ou madeira, com escada de acesso e guarda-corpo integrados.',
    features: ['Estrutura dimensionada para a carga de uso', 'Piso em chapa, painel ou madeira', 'Escada e guarda-corpo integrados'],
    image: DEMO.mezzanine,
    sort: 4,
    active: true,
  },
  {
    slug: 'escadas-metalicas',
    title: 'Escadas metálicas',
    summary: 'Escadas retas, em L, em U, caracol e de viga central, internas ou externas.',
    body: 'Escadas metálicas sob medida, com degraus em chapa, madeira, granito ou grade de piso. Cada escada é desenhada de acordo com o vão, a altura e o espaço disponível.',
    features: ['Retas, em L, em U e caracol', 'Viga central ou longarinas laterais', 'Degraus em chapa, madeira ou pedra', 'Uso interno e externo'],
    image: DEMO.stairs,
    sort: 5,
    active: true,
  },
  {
    slug: 'corrimaos',
    title: 'Corrimãos',
    summary: 'Corrimãos em aço carbono, inox ou alumínio, para escadas, rampas e acessos.',
    body: 'Corrimãos para escadas, rampas e circulações, com fixação em piso, parede ou lateral de laje, em aço carbono pintado, aço inox ou alumínio.',
    features: ['Aço carbono, inox ou alumínio', 'Fixação em piso, parede ou lateral', 'Escadas, rampas e acessos'],
    image: DEMO.handrail,
    sort: 6,
    active: true,
  },
  {
    slug: 'guarda-corpos',
    title: 'Guarda-corpos',
    summary: 'Guarda-corpos para sacadas, mezaninos e escadas, com vidro, tubos ou chapa.',
    body: 'Guarda-corpos com montantes metálicos e fechamento em vidro, tubos, cabos ou chapa perfurada, para sacadas, escadas, mezaninos e terraços.',
    features: ['Vidro, tubos, cabos ou chapa perfurada', 'Sacadas, terraços e mezaninos', 'Fixação de topo ou lateral'],
    image: DEMO.guard,
    sort: 7,
    active: true,
  },
  {
    slug: 'projetos-personalizados',
    title: 'Projetos personalizados',
    summary: 'Peças especiais, mobiliário metálico, painéis e soluções fora do padrão.',
    body: 'Desenvolvemos peças fora do padrão: painéis decorativos, mobiliário metálico, suportes especiais, brises e elementos de fachada. Envie uma referência, um desenho ou uma foto do local.',
    features: ['Painéis e brises decorativos', 'Mobiliário e peças sob medida', 'Elementos de fachada'],
    image: DEMO.ornament,
    sort: 8,
    active: true,
  },
];

const DEMO_NOTE =
  'Projeto de demonstração: as imagens são ilustrativas (Unsplash) e não retratam trabalhos realizados pela empresa. Substitua ou exclua pelo painel do site.';

const P = (p: Omit<SiteProjectInput, 'description' | 'coverIndex' | 'published' | 'location' | 'year'> & { text: string }): SiteProjectInput => {
  const { text, ...rest } = p;
  return { ...rest, description: `${text}\n\n${DEMO_NOTE}`, coverIndex: 0, published: true, location: '', year: '' };
};

export const DEMO_PROJECTS: SiteProjectInput[] = [
  P({
    slug: 'escada-externa-em-lances',
    title: 'Escada externa em lances alternados',
    category: 'Escadas',
    summary: 'Escada metálica externa com patamares, degraus vazados e guarda-corpo contínuo.',
    text: 'Exemplo de escada externa em lances alternados, com longarinas em perfil, degraus em grade de piso para drenagem e guarda-corpo integrado.',
    features: ['Degraus em grade de piso', 'Patamares intermediários', 'Guarda-corpo integrado'],
    materials: 'Perfis em aço carbono, grade de piso, pintura sobre fundo anticorrosivo',
    images: [DEMO.stairs, DEMO.stairs2, DEMO.stairs3],
    featured: true,
    sort: 1,
  }),
  P({
    slug: 'portao-de-ripas',
    title: 'Portão de ripas metálicas',
    category: 'Portões',
    summary: 'Portão de abrir com ripas verticais e acabamento preto fosco.',
    text: 'Exemplo de portão com ripas verticais em tubo retangular, quadro reforçado e acabamento preto fosco.',
    features: ['Ripas verticais em tubo retangular', 'Quadro reforçado', 'Acabamento preto fosco'],
    materials: 'Tubo retangular de aço carbono, dobradiças reforçadas',
    images: [DEMO.gate, DEMO.gate2],
    featured: true,
    sort: 2,
  }),
  P({
    slug: 'cobertura-estrutura-aparente',
    title: 'Cobertura com estrutura aparente',
    category: 'Coberturas',
    summary: 'Estrutura de cobertura em perfis metálicos com vigas e terças aparentes.',
    text: 'Exemplo de cobertura em estrutura metálica aparente, com vigas principais, terças e fechamento translúcido.',
    features: ['Vigas e terças aparentes', 'Fechamento translúcido', 'Calhas integradas'],
    materials: 'Perfis laminados e dobrados, telha translúcida',
    images: [DEMO.roof],
    featured: true,
    sort: 3,
  }),
  P({
    slug: 'mezanino-loja',
    title: 'Mezanino com guarda-corpo',
    category: 'Mezaninos',
    summary: 'Mezanino metálico com guarda-corpo e acesso por escada.',
    text: 'Exemplo de mezanino em estrutura metálica para ganho de área útil, com guarda-corpo e escada de acesso.',
    features: ['Estrutura metálica independente', 'Guarda-corpo em tubos', 'Escada de acesso'],
    materials: 'Vigas em perfil I, piso em painel, guarda-corpo tubular',
    images: [DEMO.mezzanine],
    featured: true,
    sort: 4,
  }),
  P({
    slug: 'galpao-estrutura-metalica',
    title: 'Galpão em estrutura metálica',
    category: 'Estruturas metálicas',
    summary: 'Estrutura principal com pilares e treliças em aço.',
    text: 'Exemplo de galpão com pilares, treliças e contraventamentos em aço.',
    features: ['Pilares e treliças em aço', 'Contraventamentos', 'Montagem no local'],
    materials: 'Perfis laminados, chapas de ligação, parafusos estruturais',
    images: [DEMO.structure],
    featured: true,
    sort: 5,
  }),
  P({
    slug: 'corrimao-continuo',
    title: 'Corrimão contínuo em inox',
    category: 'Corrimãos',
    summary: 'Corrimãos contínuos em escadaria de uso coletivo.',
    text: 'Exemplo de corrimão contínuo em aço inox para escadaria de uso coletivo.',
    features: ['Corrimão contínuo', 'Fixação lateral', 'Aço inox escovado'],
    materials: 'Tubo de aço inox, suportes de fixação',
    images: [DEMO.handrail2, DEMO.handrail3, DEMO.handrail],
    featured: false,
    sort: 6,
  }),
  P({
    slug: 'guarda-corpo-curvo-vidro',
    title: 'Guarda-corpo curvo com vidro',
    category: 'Projetos especiais',
    summary: 'Guarda-corpo em curva com perfil metálico e fechamento em vidro.',
    text: 'Exemplo de guarda-corpo em curva com perfil metálico calandrado e fechamento em vidro.',
    features: ['Perfil calandrado', 'Fechamento em vidro', 'Fixação de topo'],
    materials: 'Perfil de aço calandrado, vidro laminado',
    images: [DEMO.guard, DEMO.guard2],
    featured: true,
    sort: 7,
  }),
  P({
    slug: 'gradil-ornamental',
    title: 'Gradil ornamental',
    category: 'Projetos especiais',
    summary: 'Gradil com desenho ornamental em barra chata.',
    text: 'Exemplo de gradil com desenho ornamental em barra chata calandrada.',
    features: ['Desenho ornamental', 'Barra chata calandrada', 'Acabamento grafite'],
    materials: 'Barra chata de aço carbono',
    images: [DEMO.ornament, DEMO.folding],
    featured: false,
    sort: 8,
  }),
];
