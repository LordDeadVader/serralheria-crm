# WJR Serralheria — site e sistema de gestão

Site institucional da WJR Serralheria e o sistema interno de gestão (CRM, orçamentos, estoque), de **uso exclusivo da empresa**.

- **Site:** https://wj-serralheria.davihenriqueded.workers.dev/
- **CRM (área restrita, instalável como aplicativo):** https://wj-serralheria.davihenriqueded.workers.dev/crm/
- **API:** `/api` no mesmo endereço (`/api/health` para verificar)
- O endereço antigo (`lorddeadvader.github.io/serralheria-crm`) apenas redireciona para o novo.

| Endereço | O que é |
| --- | --- |
| `/`, `/servicos`, `/projetos`, `/sobre`, `/contato`, `/orcamento` | Site público (HTML gerado no servidor, indexável) |
| `/crm/` | CRM e **painel do site** (login obrigatório). App instalável (PWA) |
| `/api/*` | API do CRM, do painel do site e do formulário público |
| `/media/*` | Fotos enviadas pelo painel do site |

Como gerenciar o site (projetos, serviços, textos, solicitações) e a integração futura com outros sistemas: **[docs/SITE.md](docs/SITE.md)**.

## Funcionalidades

| Módulo | Situação |
| --- | --- |
| Dashboard (funil, retornos, conversão, aprovados no mês) | Implementado |
| Clientes (CRUD, PF/PJ com validação de CPF/CNPJ, busca de CEP, arquivar, histórico e valores negociados) | Implementado |
| Materiais (conversão de unidades, custo por unidade de uso, histórico de preços, fornecedor) | Implementado |
| Serviços e mão de obra (por hora ou preço fixo) | Implementado |
| Fornecedores | Implementado |
| Orçamentos (8 etapas, cálculo em tempo real, rascunho, duplicar, versões, status, tabela e Kanban, CRM) | Implementado |
| Proposta em PDF (pré-visualização, download, impressão, WhatsApp, itens detalhados ou valor global, paginação, logotipo) | Implementado |
| Produção (Kanban de aprovados → em produção → concluídos) | Básico |
| Relatórios (desempenho mensal, conversão, margem bruta) | Básico |
| Configurações (empresa, logotipo, padrões financeiros e da proposta, troca de senha) | Implementado |
| Modelos e kits, Estoque | Implementado |
| Painel do site (projetos, serviços, textos, depoimentos, solicitações recebidas) | Implementado |
| App instalável (PWA, somente o CRM) | Implementado |

## Arquitetura

```
                     ┌─ /            site (HTML do servidor) ─┐
Navegador ──HTTPS──▶ │  /crm/        CRM (React, estático)     │ Cloudflare Worker (Hono) ──▶ D1 (SQLite)
                     └─ /api, /media API e fotos ──────────────┘                          └─▶ KV (fotos e anexos)
```

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, React Router (HashRouter), lucide-react.
- **Backend:** Cloudflare Workers + Hono, validação com Zod no servidor, Drizzle ORM.
- **Banco:** Cloudflare D1 (SQLite gerenciado, com réplicas e backups point-in-time de 30 dias).
- **Autenticação:** própria, no Worker — senha com PBKDF2-SHA256 (100 mil iterações, sal aleatório), tokens de sessão opacos de 256 bits armazenados apenas como hash SHA-256, expiração em 30 dias, limitação de tentativas de login.
- **PDF:** @react-pdf/renderer, gerado no navegador e carregado sob demanda.

Por que Cloudflare e não Supabase: veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md#decisão-de-backend).

### Estrutura

```
src/
  calculations/   motor financeiro e conversão de unidades (puro, testado, usado também pela API)
  schemas/        validação Zod compartilhada entre frontend e API
  types/          tipos de domínio
  services/       cliente HTTP
  repositories/   acesso à API por entidade
  authentication/ contexto de sessão
  components/     UI reutilizável
  layouts/ pages/ telas
  pdf/            proposta comercial
  hooks/ lib/
worker/
  src/database/   esquema Drizzle e dados de demonstração
  src/authentication/ hash de senha, sessões, limitação de tentativas
  src/repositories/   consultas sempre filtradas por company_id
  src/routes/     endpoints HTTP
  migrations/     SQL versionado
scripts/          convites, redefinição de senha, remoção de empresa, teste E2E da API
tests/            testes automatizados (Vitest)
```

## Desenvolvimento local

Requisitos: Node 22+.

```bash
npm install
```

```bash
npm run db:migrate:local
```

Crie `worker/.dev.vars` com a empresa local dona do site (id da tabela `companies` do banco local) e, se quiser testar cadastros, `ALLOW_SIGNUP=true`:

```
SITE_COMPANY_ID=<id-da-empresa-local>
ALLOW_SIGNUP=true
```

Site + API em http://localhost:8787 (o CRM compilado fica em http://localhost:8787/crm/ depois de `npm run build`):

```bash
npm run worker:dev
```

CRM com recarga automática em http://localhost:5173 (com `.env.local` contendo `VITE_API_URL=http://localhost:8787/api`):

```bash
npm run dev
```

### Testes

```bash
npm test
```

```bash
npm run typecheck
```

Teste de ponta a ponta da API do CRM (com cadastro local ligado; cria duas empresas a partir de dois convites):

```bash
npm run test:api -- http://localhost:8787/api CONV-AAAA-... CONV-BBBB-...
```

Teste de ponta a ponta do site e do painel do site (páginas, SEO, formulário com anexo, envio de fotos, permissões). A senha é lida de um arquivo:

```bash
node scripts/smoke-site.mjs http://localhost:8787 usuario@local caminho/da/senha.txt
```

## Publicação

Tudo (site, CRM e API) é publicado no Cloudflare Worker `wj-serralheria`, a partir desta máquina:

```bash
npx wrangler login
```

```bash
npm run db:migrate:remote
```

```bash
npm run build
```

```bash
npm run worker:deploy
```

O GitHub Actions (`.github/workflows/deploy.yml`) verifica tipos, roda os testes e o build a cada push, e publica no GitHub Pages apenas o redirecionamento do endereço antigo.

Configuração do Worker em `worker/wrangler.jsonc`: `SITE_COMPANY_ID` (empresa dona do site e do CRM), `PUBLIC_URL` (domínio próprio, quando houver), banco D1 e o KV `MEDIA`. Detalhes em [docs/SITE.md](docs/SITE.md#variáveis-de-ambiente).

## Contas e acesso

O sistema é de uso exclusivo da WJR: **não existe cadastro público** (a rota de cadastro está desligada; `ALLOW_SIGNUP` não é definido em produção). O login fica em `/crm/`.

**Esqueci a senha:** o sistema não envia e-mails. O administrador gera uma senha temporária (as sessões do usuário são encerradas):

```bash
npm run user:reset-password -- --remote --email pessoa@empresa.com
```

**Remover uma empresa (ex.: conta de teste):**

```bash
npm run company:delete -- --remote --email dono@empresa.com --confirm
```

## Segurança

- Nenhum segredo no repositório nem no frontend.
- Painel do site restrito à empresa dona do site; anexos das solicitações só abrem com login.
- Formulário público com validação no servidor, campo-armadilha anti-robô, tempo mínimo de preenchimento e limite de envios por IP.
- Isolamento por empresa aplicado no servidor: o `company_id` vem sempre da sessão, nunca do cliente, e toda consulta filtra por ele (coberto pelo teste E2E).
- Validação de todas as entradas no servidor (Zod), percentuais limitados e totais recalculados pelo servidor.
- Versões de orçamentos enviados/aprovados são bloqueadas; alterações geram nova versão.
- O PDF do cliente nunca contém custo de compra, margem, lucro ou preços de fornecedores.
- Cabeçalhos de segurança; CRM e API no mesmo endereço (CORS só para o desenvolvimento local).

## Dados de demonstração

O site começa com textos de serviço objetivos e **projetos de demonstração** com fotos provisórias do Unsplash, todos marcados como “Imagem ilustrativa” / “Demonstração” no site. Nenhum número, depoimento, certificação ou dado de contato é inventado: o que estiver vazio não aparece. Substitua pelo painel do site.

## Lista padrão de insumos, serviços e modelos

A lista de materiais/insumos, mão de obra e os modelos/kits predefinidos ficam em
`scripts/presets/lista.txt` e `scripts/presets/generate.py`. Para alterar:

```bash
python scripts/presets/generate.py
```

Isso regenera `src/data/presets.ts` (usado no cadastro de novas empresas e no botão
**Importar lista padrão**) e `scripts/presets/presets.sql`. Os itens entram **sem preço**.
