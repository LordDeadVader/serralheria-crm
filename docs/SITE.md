# Site institucional — guia de uso e manutenção

## Como está montado

| Parte | Onde está | Observações |
| --- | --- | --- |
| Páginas públicas | `worker/src/site/` (`pages.ts`, `layout.ts`, `routes.ts`) | HTML gerado no servidor a cada visita (cache de 60 s): rápido, indexável e sempre com o conteúdo do painel. |
| Visual | `worker/public/s/site.css` e `site.js` | CSS e JS próprios, sem dependências. Ao alterar, aumente `ASSET_V` em `layout.ts`. |
| Conteúdo inicial | `worker/src/site/defaults.ts` | Usado uma única vez, na primeira visita. Depois, tudo vem do banco. |
| Dados | D1: `site_settings`, `site_services`, `site_projects`, `site_testimonials`, `site_leads` | Migração `worker/migrations/0003_site.sql`. |
| Fotos e anexos | Workers KV (`MEDIA`) | Fotos do painel: `/media/img/…` (públicas, cache de 1 ano). Anexos das solicitações: privados, só abrem com login. |
| Painel do site | CRM → **Site e solicitações** (`src/pages/site/`) | Mesmo login do CRM; só a empresa dona do site (`SITE_COMPANY_ID`) tem acesso. |

### Identidade visual

- **Conceito:** industrial premium com arquitetura contemporânea. Usa linhas retas, réguas de 1 px, numeração técnica (01, 02…) e a fotografia como protagonista.
- **Paleta:** grafite `#17191B`, preto `#101112`, cinza `#777C80`, cinza claro `#E8E9E8` e branco. O índigo da logo (`#2C14C4`) aparece só em botões de ação, foco e marcadores.
- **Tipografia:** Archivo para títulos (largura variável, levemente condensada) e Manrope para texto.
- **Ritmo:** seções claras e escuras se alternam. Cada seção tem um papel; as que estiverem sem conteúdo (números, depoimentos, destaques) não aparecem.
- **Animações:**
  - entrada do título;
  - revelação discreta ao rolar;
  - zoom leve nas fotos;
  - filtro do portfólio com transição;
  - transição entre páginas (View Transitions).

  Tudo é desligado quando o sistema pede movimento reduzido.

## Como adicionar um projeto

1. Entre em `/crm/` e abra **Site e solicitações → Projetos → Novo projeto**.
2. Em **Adicionar fotos**, envie várias fotos, de ângulos diferentes. Cada foto é otimizada no navegador: são geradas duas versões em WebP, uma de 2000 px e outra de 900 px.
3. Clique na estrela da foto que deve ser a **principal**. Use as setas para mudar a ordem e escreva uma descrição curta para cada foto.
4. Preencha título, categoria, resumo, descrição, características e materiais. Local e ano são opcionais.
5. Marque **Destaque na página inicial** se quiser o projeto na home (aparecem até 7), e **Publicado** para que ele vá ao ar.

O endereço da página é criado a partir do título, por exemplo `/projetos/portao-de-correr-residencial`.

**Projetos de demonstração:** os projetos que vieram de exemplo têm a etiqueta “Demonstração” e fotos ilustrativas. Exclua cada um ou troque as fotos pelas reais. Ao enviar fotos reais, o aviso de demonstração some sozinho.

## Como atualizar os serviços

Use **Site e solicitações → Serviços**:

- **Conteúdo:** edite nome, descrição curta, texto completo, “O que inclui” e a foto.
- **Ordem:** use as setas ↑ ↓. Essa ordem vale no site e na lista do formulário de orçamento.
- **Visibilidade:** **Ativo no site** esconde o serviço sem excluí-lo.

Os projetos relacionados a cada serviço aparecem quando a categoria do projeto corresponde ao nome do serviço. Por exemplo, a categoria “Escadas” corresponde ao serviço “Escadas metálicas”.

## Textos, contato e SEO

Use **Site e solicitações → Textos e contato**, que cobre:

- empresa e contato;
- abertura da página inicial: foto, título e vídeo opcional;
- números da empresa: só valores reais; sem números, a faixa fica oculta;
- diferenciais;
- texto “Sobre”;
- processo de trabalho;
- chamada final;
- categorias do portfólio;
- título e descrição para o Google.

Pontos importantes:

- **WhatsApp:** os botões de WhatsApp do site e o envio do formulário pelo WhatsApp só aparecem depois que o número é preenchido.
- **Cidade:** entra nos títulos das páginas para o SEO local, por exemplo “Escadas metálicas em [cidade]”.
- **Itens pendentes:** a **Visão geral** do painel lista o que ainda falta preencher.

O que o site gera sozinho para buscadores: `sitemap.xml` (com as imagens), `robots.txt` (que bloqueia `/crm/` e `/api/`), canonical, Open Graph, dados estruturados (`LocalBusiness`, `Service`, `BreadcrumbList`) e endereços amigáveis.

## Solicitações de orçamento

O formulário de `/orcamento` recebe nome, telefone, cidade, serviço, material, descrição, medidas e até 5 fotos ou PDFs. Antes do envio, as fotos são reduzidas no navegador.

O visitante tem duas formas de enviar:

- **Enviar solicitação:** grava o pedido e mostra um número de protocolo.
- **Enviar pelo WhatsApp:** grava o pedido e abre o WhatsApp com uma mensagem já organizada.

Em **Site e solicitações → Solicitações** você vê os anexos, muda a situação (nova / vista / respondida / arquivada), responde pelo WhatsApp e pode **cadastrar o solicitante como cliente no CRM**. Esse cadastro não cria duplicatas.

O formulário tem três proteções contra robôs: um campo invisível, um tempo mínimo de preenchimento e um limite de 8 envios a cada 15 minutos por IP. Se houver spam, o próximo passo é o Cloudflare Turnstile.

## Variáveis de ambiente

Ficam em `worker/wrangler.jsonc` → `vars`. Os segredos vão com `npx wrangler secret put NOME --config worker/wrangler.jsonc` e nunca no repositório.

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `SITE_COMPANY_ID` | sim | Empresa dona do site e do painel. |
| `PUBLIC_URL` | não | Domínio próprio (ex.: `https://www.wjrserralheria.com.br`) para canonical e sitemap. Vazio = endereço da visita. |
| `ALLOWED_ORIGINS` | não | Origens extras para a API (só para desenvolvimento local). |
| `ALLOW_SIGNUP` | não | `true` reabre o cadastro por convite. Desligado em produção. |
| `CRM_WEBHOOK_URL` | não | Integração: envia cada solicitação para um sistema externo. |
| `CRM_WEBHOOK_TOKEN` | não (segredo) | Enviado como `Authorization: Bearer …` para o webhook. |

Para o desenvolvimento local, use `worker/.dev.vars`, que não é versionado.

### Domínio próprio

Para ligar um domínio próprio:

1. Adicione o domínio na Cloudflare.
2. Em **Workers → wj-serralheria → Domínios**, conecte o domínio.
3. Preencha `PUBLIC_URL` e publique de novo.

## Integração com outros sistemas (CRM)

O site é independente: ele só **capta e encaminha** pedidos. Hoje, dois pontos de integração estão prontos:

1. **No próprio CRM:** use o botão “Cadastrar como cliente no CRM” em cada solicitação (`POST /api/site/leads/:id/client`).
2. **Webhook:** com `CRM_WEBHOOK_URL` definido, cada solicitação nova também é enviada em segundo plano. O resultado fica registrado e aparece no painel como “Integração externa: enviado / erro”.

Exemplo do envio do webhook:

```http
POST <CRM_WEBHOOK_URL>
Content-Type: application/json
Authorization: Bearer <CRM_WEBHOOK_TOKEN>

{
  "type": "site.lead.created",
  "lead": {
    "id": "…", "name": "…", "phone": "…", "city": "…", "service": "…", "material": "…",
    "description": "…", "measures": "…", "reference": "…", "status": "novo", "createdAt": "…",
    "files": [{ "name": "foto.jpg", "type": "image/jpeg", "size": 123456 }]
  }
}
```

Os anexos não seguem no webhook, que leva só os metadados. Eles são acessados pelo painel.

Para aceitar pedidos de outra origem, como uma landing page ou um formulário externo, use o mesmo `POST /api/public/leads` com `multipart/form-data` e os campos `name`, `phone`, `city`, `service`, `material`, `description`, `measures`, `reference` e `files`.

## App do CRM (instalação)

Só o CRM é instalável; o site público não oferece instalação.

- **Computador e Android:** botão **Instalar aplicativo**, na tela de login ou no menu lateral.
- **iPhone:** Compartilhar → **Adicionar à Tela de Início**.

O service worker (`public/sw.js`) guarda apenas os arquivos do app. Dados e fotos sempre vêm da rede.
