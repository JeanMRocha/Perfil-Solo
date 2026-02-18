# TODO Priorizado

## P0 - Obrigatorio antes de producao
- [x] Remover `.env` do versionamento.
- [x] Criar `.env.example`.
- [x] Restaurar build de producao.
- [x] Corrigir conflito de instalacao (`npm ci`).
- [x] Corrigir vulnerabilidades altas/moderadas conhecidas.
- [x] Criar CI para `lint`, `test`, `build`.
- [x] Padronizar gerenciador de pacotes em `npm`.

## P1 - Alta prioridade
- [ ] Definir politica de rotacao de chaves e revisar credenciais expostas historicamente.
- [x] Revisar warnings de peer dependency com React 19.
- [x] Cobertura de autenticacao (modo local).
- [x] Cobertura de integracao Supabase (stub offline).
- [x] Cobertura de regras de plano/faturamento no frontend (`PlanService`).
- [ ] Cobertura de funcoes edge Stripe (`create-checkout-session`, `stripe-webhook`) - parcial na logica compartilhada.

## P2 - Media prioridade
- [ ] Reduzir tamanho do bundle com code splitting/manual chunks.
- [ ] Criar health checklist de release (build, migracoes, rollback, monitoramento).
- [ ] Padronizar observabilidade (logs de erro + trilha de auditoria + alertas).

## P3 - Backlog
- [ ] Melhorar tipagem para reduzir uso de `any`.
- [ ] Criar suite E2E para caminhos de negocio principais.
