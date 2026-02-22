# Modulo de Planos e Monetizacao

Status geral: `implementado (base local)`  
Ultima atualizacao: `2026-02-21`

## Objetivo
Centralizar configuracao de planos, limites, adicionais por uso e conversao de dinheiro para creditos.

## Planos ativos
1. `Free`:
   - mensalidade base: `R$ 0,00`
   - propriedades inclusas: `1`
   - talhoes inclusos: `5`
   - analises inclusas: `50`
2. `Premium`:
   - mensalidade base: `R$ 29,90`
   - propriedades inclusas: `5`
   - talhoes inclusos: `50`
   - analises inclusas: `500`

## Adicionais por uso
1. Propriedade extra: `R$ 10,00` por unidade.
2. Talhao extra: `R$ 2,00` por unidade.
3. Analise extra: `R$ 0,50` por unidade.

## Conversao financeira para creditos
Regra fixa:
1. `R$ 1,00 = 2 creditos`
2. Conversao permitida somente em um sentido: `dinheiro -> creditos`.
3. Conversao `creditos -> dinheiro` e proibida por regra de negocio.

Escopo de moedas:
1. Dinheiro (`BRL`) paga funcionalidades:
   - plano base,
   - adicionais por uso (propriedades, talhoes, analises).
2. Creditos pagam apenas itens cosmeticos no app (ex.: loja interna/avatar).

Implementacao:
1. Conversao em `src/modules/billing/config.ts`.
2. Registro financeiro em `src/services/billingPlanService.ts`.
3. Creditos aplicados no `creditsService`.

## Arquivos principais
1. Configuracao de planos e modulos:
   - `src/modules/billing/config.ts`
2. Servico financeiro (assinatura, ledger, estorno, estatisticas):
   - `src/services/billingPlanService.ts`
3. Tela do usuario (planos + estimativa mensal + recarga):
   - `src/views/Config/BillingSettings.tsx`
4. Painel do super usuario (monetizacao):
   - `src/views/Super/UserManagement.tsx`
   - `src/views/Super/UserManagementTabs/MonetizationTab.tsx`

## Painel do super usuario (Monetizacao)
Recursos implementados:
1. Resumo com bruto, estornado, liquido e creditos emitidos.
2. Aplicacao de plano por usuario.
3. Geracao de fechamento mensal por usuario.
4. Conversao de dinheiro em creditos por usuario.
5. Historico detalhado com filtros (usuario, tipo, periodo).
6. Estorno de lancamentos com ajuste opcional de creditos (automatico para topup).

Regra de acesso:
1. O painel super e exclusivo do dono do sistema.
2. O e-mail permitido deve ser configurado em `VITE_OWNER_SUPER_EMAIL` (ou lista em `VITE_OWNER_SUPER_EMAILS`).
3. Usuarios comuns nao possuem alternancia para modo super e nao acessam rotas `/super/*`.

## Eventos e persistencia local
1. Evento de atualizacao:
   - `BILLING_UPDATED_EVENT = "perfilsolo-billing-updated"`
2. Chaves locais:
   - `perfilsolo_billing_subscriptions_v1`
   - `perfilsolo_billing_ledger_v1`

## Modulos gratuitos atuais
1. Culturas.
2. Fornecedores.
3. Cadastros gerais.
4. Jornada gamificada.

## Backlog recomendado
1. Cobrar modulos futuros de IA por assinatura adicional:
   - calculo de adubacao,
   - recomendacoes IA para analise de solo.
2. Adicionar integracao real com gateway (Stripe/Pix) para reconciliacao financeira.
3. Adicionar exportacao CSV do ledger de monetizacao para auditoria.
4. Adicionar fechamento automatico mensal por job.
