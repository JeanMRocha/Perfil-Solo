# Relatorio de Prontidao para Producao (2026-02-18)

## Resumo Executivo
- Status inicial: **nao pronto para producao**.
- Status apos correcoes deste ciclo: **apto para homologacao**, com pendencias para producao plena.

## Achados Iniciais
1. Build quebrava por erro de tipagem em `@tabler/icons-react`.
2. `npm ci` falhava por conflito de dependencias React.
3. `.env` estava versionado com credenciais preenchidas.
4. Dependencias com vulnerabilidades altas/moderadas (React Router).
5. Ausencia de pipeline de CI.

## Correcoes Aplicadas
1. Seguranca de segredos:
- `.env` removido do controle de versao (`git rm --cached .env`).
- `.gitignore` atualizado para ignorar `.env` e variantes.
- Criado `.env.example` com placeholders.
2. Dependencias e build:
- Atualizado React/React DOM para `19.2.4`.
- Atualizado `react-router-dom` para `7.13.0`.
- Atualizado `@tabler/icons-react` para `3.36.1`.
- Adicionados `overrides` para dependencias transitivas (`use-composed-ref`, `use-latest`, `use-isomorphic-layout-effect`) com suporte explicito a React 19.
- Build (`npm run build`) voltou a passar.
3. Governanca e CI:
- Adicionado script `test:ci`.
- Definido `engines.node` para `^22 || >=24`.
- Padronizado `packageManager` para `npm@11.6.2`.
- Removido `yarn.lock` para manter um unico gerenciador de pacotes.
- Criado workflow em `.github/workflows/ci.yml`.
- Adicionado `.nvmrc` com Node `22`.

## Validacao Executada
1. `npm ci`: **passou**.
2. `npm run lint`: **passou**.
3. `npm run test:ci`: **passou** (2 arquivos, 9 testes).
4. `npm run build`: **passou**.
5. `npm audit --omit=dev`: **0 vulnerabilidades**.

## Avanco de Cobertura (ciclo atual)
1. Adicionado `src/tests/auth-supabase.test.ts` cobrindo:
- login local (`signInLocal`) com normalizacao de email
- logout local (`signOut`) com limpeza de sessao
- comportamento offline do `supabaseClient.auth.signInWithPassword`
- comportamento de query stub via `supabaseClient.from(...).select(...)`
2. Adicionado `src/tests/plan-service.test.ts` cobrindo:
- limites por plano (`free`, `pro`, `enterprise`)
- fallback para plano invalido
- regra de limite de importacao PDF por uso do plano
- uso de `subscription.plan_id` quando `plan_id` principal nao existe
- gating de modulos (`calagem`, `gessagem`, `adubacao`)
3. Extraida logica de webhook Stripe para `supabase/functions/_shared/billingLogic.ts` e coberta com `src/tests/stripe-billing-logic.test.ts`:
- resolucao de plano por `priceId`
- montagem de payload de atualizacao de assinatura no perfil

## Riscos Remanescentes
1. Alertas de peer dependency ligados a React 19 em dependencias transitivas.
2. Cobertura de testes ainda baixa (apenas um arquivo de testes).
3. Bundle principal ainda grande (aviso de chunk > 500kB).
