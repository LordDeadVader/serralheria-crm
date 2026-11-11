# Documentação técnica

## Decisão de backend

A especificação indicava Supabase como primeira opção. No ambiente de desenvolvimento não havia CLI, token nem conta Supabase disponíveis; criar um projeto exigiria ação manual do proprietário (inclusive definição de senha do banco), o que impediria publicar e validar o sistema de ponta a ponta.

A conta Cloudflare estava autenticada com permissão de Workers e D1. Por isso a escolha foi **Cloudflare Workers + D1**:

| Requisito | Como é atendido |
| --- | --- |
| Persistência real | D1 (SQLite gerenciado, backups point-in-time de 30 dias) |
| API por HTTPS | Worker em `*.workers.dev` |
| Autenticação segura | PBKDF2-SHA256 + sessões opacas com hash, no servidor |
| Isolamento entre empresas | `company_id` derivado da sessão e aplicado em todas as consultas (camada `worker/src/repositories`) |
| Validação no servidor | Zod, mesmos esquemas do frontend |
| Sem segredos no frontend | O frontend só conhece a URL pública da API |

Diferença em relação ao pedido: o banco é **SQLite (D1)**, não PostgreSQL, e o isolamento é aplicado na camada de repositórios em vez de Row Level Security. O acesso ao banco nunca é feito pelo navegador — somente o Worker tem a credencial (binding) do D1 — então não há caminho para contornar o filtro. O esquema usa Drizzle ORM, o que facilita uma migração futura para PostgreSQL (Supabase, Neon) trocando o dialeto e a camada de conexão.

## Motor financeiro (`src/calculations`)

Puro, sem dependência de interface ou banco, usado no navegador (tempo real) e no Worker (valores gravados). Usa `decimal.js-light` para evitar erros de ponto flutuante; valores monetários são arredondados em centavos (meio para cima), custos unitários em 4 casas.

```
Materiais        = Σ qtde × custo unitário × quantidade do projeto
Desperdício      = Σ materiais da linha × % desperdício da linha
Mão de obra      = Σ horas × custo/hora (ou qtde × preço fixo) × quantidade do projeto
Custo direto     = materiais + desperdício + mão de obra
Custos indiretos = custo direto × % rateio + despesas indiretas lançadas
Custo total      = custo direto + indiretos + transporte + outras despesas
Preço de venda   = custo total ÷ (1 − impostos − taxas − comissão − margem)
Lucro            = preço − custo total − impostos − taxas − comissão
Margem efetiva   = lucro ÷ preço
```

- Custos indiretos entram apenas no custo, nunca no divisor (sem dupla contagem).
- Cada percentual deve estar entre 0 e 99,99%; a soma dos variáveis deve ser < 100%.
- Preço manual substitui o sugerido e recalcula margem efetiva e lucro.
- Exemplo validado em teste: custo R$ 2.000, 6% + 2% + 0% + 25% → R$ 2.985,07.

### Conversão de unidades

Cada material tem: unidade de compra (barra, chapa…), quantidade contida (ex.: 6) na medida (m), preço, e unidade de utilização. Custo por unidade de uso = preço ÷ quantidade convertida. Conversões apenas dentro da mesma dimensão (comprimento, massa, volume, área, contagem). Uso em massa a partir de outra dimensão só com o peso da unidade de compra informado; qualquer outra combinação é recusada.

### Preservação de custos

O orçamento grava um **instantâneo** completo (itens, custos unitários da época, percentuais e totais) em `quote_versions`. Mudar o preço de um material gera registro em `material_price_history`, mas não altera orçamentos existentes.

## Versões e histórico

- Status: rascunho, em elaboração, enviado, em negociação, aprovado, reprovado, cancelado, em produção, concluído.
- Ao passar para enviado (ou posterior), a versão atual é bloqueada; o servidor responde 409 a qualquer tentativa de sobrescrever.
- "Nova versão" bloqueia a atual e cria `v+1` editável; se o orçamento estava enviado/aprovado, volta para "em negociação".
- Em produção/concluído não aceitam novas versões.
- Todas as ações geram eventos em `quote_events` (histórico exibido na tela).
- Numeração por empresa, atômica (`UPDATE … RETURNING`), formato `PREFIXO-ANO-0001`.

## PDF

`src/pdf/QuotePdf.tsx` recebe somente o documento e os totais e exibe valores de venda. No modo "itens detalhados", o preço final é distribuído entre materiais, serviços e despesas da obra proporcionalmente ao custo (a última linha absorve os centavos), de modo que a soma bate com o total; despesas indiretas não aparecem. Observações internas do projeto não são exibidas.

## Limitações conhecidas

- Sem envio de e-mail: recuperação de senha é feita pelo administrador (`npm run user:reset-password`).
- Um usuário por empresa (o esquema já suporta vários; falta a tela de convite de membros).
- Projetos e modelos: não implementado.
- Produção e relatórios são básicos.
- O deploy da API é feito pelo Wrangler (local). Para automatizar no GitHub Actions, crie um token de API da Cloudflare com permissão Workers Scripts:Edit e D1:Edit, salve como segredo `CLOUDFLARE_API_TOKEN` e adicione um job com `npx wrangler deploy --config worker/wrangler.jsonc`.
