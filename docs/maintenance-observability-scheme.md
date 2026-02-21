# Esquema de Manutencao e Inspecao (Observabilidade)

## Estado atual
- Coleta de observabilidade em modo **desligado** por padrao:
  - `VITE_OBSERVABILITY_MODE=off`
- Estrutura tecnica ja preparada para ativar depois sem refatoracao grande.

## Objetivo do esquema
- Facilitar manutencao continua.
- Padronizar captura de erros/eventos/auditoria.
- Permitir inspecao rapida de problemas por modulo.

## Modos de operacao
- `off`: nao coleta dados de observabilidade.
- `local`: coleta somente local (buffer em storage).
- `remote`: coleta local + envio remoto (quando Supabase ativo).

## Arquivos principais
- Configuracao central:
  - `src/services/observabilityConfig.ts`
- Logs de eventos:
  - `src/services/loggerService.ts`
- Logs de auditoria:
  - `src/services/AuditService.ts`
- Logs de erro locais:
  - `src/services/loggerLocal.ts`
- Captura de erros globais:
  - `src/global-state/errorCatcher.ts`
  - `src/components/errors/ErrorBoundary.tsx`
  - `src/router/lazyWithBoundary.ts`

## Taxonomia recomendada (quando ativar)
- Evento (`event`):
  - `module`: ex. `people`, `profile`, `property`, `auth`
  - `action`: ex. `create`, `update`, `delete`, `sync`
  - `result`: `success` | `warning` | `error`
- Erro (`error`):
  - `origin`: rota/arquivo
  - `message`
  - `stack` resumida
  - `context`: payload minimo relevante
- Auditoria (`audit`):
  - `actor_id`
  - `entity`
  - `action`
  - `before` / `after`

## Rotina de manutencao periodica
- Semanal:
  - revisar erros por modulo e reincidencias
  - revisar falhas de operacao critica (auth, profile, people)
- Quinzenal:
  - revisar eventos com maior taxa de warning/error
  - revisar cobertura de logs em fluxos novos
- Mensal:
  - revisar schema de logs (campos faltando/excesso)
  - revisar estrategia de retencao e privacidade

## Checklist de inspecao tecnica
1. O erro e reproduzivel?
2. O log contem `module`, `action`, `origin` e contexto minimo?
3. Existe correlacao com deploy/alteracao recente?
4. Existe fallback seguro para o fluxo afetado?
5. Foi aberto item de prevencao (teste, validacao, alerta)?

## Facilitadores de manutencao ja previstos
- Controle de ativacao por ambiente via `.env`.
- Buffer local com limite de registros.
- Camada de logger separada por tipo (evento, auditoria, erro).
- Captura em tres niveis:
  - global (`window.onerror`)
  - React (`ErrorBoundary`)
  - carregamento lazy de rotas/componentes

## Regras de recompensa (fase atual)
- Motor de regras em `src/services/creditsService.ts`:
  - `signup`: +10 (limite 1)
  - `email_confirmation`: +20 (limite 1)
  - `profile_address`: +10 (limite 1)
  - `property_created`: +10 (limite 5)
  - `talhao_created`: +2 (limite 100)
- Recompensa por propaganda:
  - padrao atual: `5` creditos por visualizacao
  - limite diario: `3`
  - cooldown configuravel
- Tela de governanca do superusuario:
  - `Super > Gestao de Usuarios e Creditos > Regras`
  - permite alterar creditos, limites e ativacao por regra
  - mostra desempenho por usuario (total e por regra)

## Inspecao periodica de recompensas
- Semanal:
  - revisar top usuarios por `total_credits` de conquista
  - revisar regras com alta incidencia para evitar abuso
- Quinzenal:
  - recalibrar limites por regra (ex.: propriedade/talhao)
  - revisar distribuicao de ganhos por propaganda
- Mensal:
  - revisar se regras refletem os modulos ativos do produto
  - desativar regras de modulos ainda nao liberados

## Plano de ativacao futura (recomendado)
1. Ativar `local` em desenvolvimento:
   - `VITE_OBSERVABILITY_MODE=local`
2. Validar padrao de campos por modulo.
3. Ativar `remote` somente apos estabilizar modulos.
4. Criar dashboard operacional (erros por modulo + top falhas).

## Regras de seguranca e privacidade
- Nao registrar segredo/token/chave.
- Evitar payload completo de formularios.
- Mascarar dados sensiveis quando necessario.
- Limitar retencao local/remota por politica definida.
