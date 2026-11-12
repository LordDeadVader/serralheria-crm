# Serralheria CRM

Sistema Web de CRM, gestão de custos e geração de orçamentos profissionais para serralherias.

- **Aplicação:** https://lorddeadvader.github.io/serralheria-crm/
- **API:** https://serralheria-crm-api.davihenriqueded.workers.dev (`/health` para verificar)

O proprietário cadastra materiais e serviços, registra clientes, monta orçamentos com cálculo de custos em tempo real, define margem e gera uma proposta comercial em PDF — sem expor custos internos ao cliente.

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
| Projetos e modelos | **Não implementado** — a tela informa isso; use "Duplicar" como alternativa |

## Arquitetura

```
GitHub Pages (React + Vite, estático)  ──HTTPS + Bearer──▶  Cloudflare Worker (Hono)  ──▶  Cloudflare D1 (SQLite)
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

```bash
npm run worker:dev
```

Em outro terminal (com `.env.local` contendo `VITE_API_URL=http://localhost:8787`):

```bash
npm run dev
```

Crie um convite local para se cadastrar:

```bash
npm run invite:create -- --local
```

### Testes

```bash
npm test
```

```bash
npm run typecheck
```

Teste de ponta a ponta da API (cria duas empresas de teste a partir de dois convites):

```bash
npm run test:api -- http://localhost:8787 CONV-AAAA-... CONV-BBBB-...
```

## Publicação

### API (Cloudflare)

```bash
npx wrangler login
```

```bash
npm run db:migrate:remote
```

```bash
npm run worker:deploy
```

As origens autorizadas (CORS) ficam em `worker/wrangler.jsonc` → `ALLOWED_ORIGINS`.

### Frontend (GitHub Pages)

O workflow `.github/workflows/deploy.yml` roda a cada push em `main`: instala dependências, verifica tipos, executa os testes, gera o build e publica no Pages, conferindo se a URL responde.

Configuração necessária no repositório:

- **Settings → Pages → Source:** GitHub Actions.
- **Settings → Secrets and variables → Actions → Variables:** `VITE_API_URL` = URL pública da API (HTTPS). É uma variável pública; nenhum segredo vai para o frontend.

## Contas e acesso

O cadastro exige **código de convite** de uso único (não existe cadastro aberto nem credencial administrativa pública). Cada convite cria uma empresa isolada.

```bash
npm run invite:create -- --remote --note "Nome da serralheria" --days 7
```

O código aparece uma única vez; envie ao proprietário por canal privado. Ele acessa a aplicação, escolhe **Criar conta com convite** e define a própria senha.

**Esqueci a senha:** o sistema não envia e-mails. O administrador gera uma senha temporária (as sessões do usuário são encerradas):

```bash
npm run user:reset-password -- --remote --email pessoa@empresa.com
```

**Remover uma empresa (ex.: conta de teste):**

```bash
npm run company:delete -- --remote --email dono@empresa.com --confirm
```

## Segurança

- Nenhum segredo no repositório nem no frontend; `VITE_API_URL` é pública.
- Isolamento por empresa aplicado no servidor: o `company_id` vem sempre da sessão, nunca do cliente, e toda consulta filtra por ele (coberto pelo teste E2E).
- Validação de todas as entradas no servidor (Zod), percentuais limitados e totais recalculados pelo servidor.
- Versões de orçamentos enviados/aprovados são bloqueadas; alterações geram nova versão.
- O PDF do cliente nunca contém custo de compra, margem, lucro ou preços de fornecedores.
- Cabeçalhos de segurança e CORS restrito às origens configuradas.

## Dados de demonstração

Cada nova empresa recebe 8 materiais e 4 serviços marcados como **Exemplo**, com preços apenas ilustrativos (não são referência de mercado). Podem ser editados ou excluídos e não são compartilhados entre empresas.

## Lista padrão de insumos, serviços e modelos

A lista de materiais/insumos, mão de obra e os modelos/kits predefinidos ficam em
`scripts/presets/lista.txt` e `scripts/presets/generate.py`. Para alterar:

```bash
python scripts/presets/generate.py
```

Isso regenera `src/data/presets.ts` (usado no cadastro de novas empresas e no botão
**Importar lista padrão**) e `scripts/presets/presets.sql`. Os itens entram **sem preço**.
