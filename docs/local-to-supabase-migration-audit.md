# Auditoria Local -> Supabase (planejamento)

Data: 2026-02-22  
Contexto: projeto rodando em modo local (`VITE_DATA_PROVIDER=local`), com persistencia mista em `localforage` (IndexedDB) + `localStorage/sessionStorage`.

## 1) Fontes de dados locais atuais

### 1.1 IndexedDB (localforage) - "tabelas" principais
Arquivo de referencia: `src/services/localDb.ts`

1. `properties`
2. `talhoes`
3. `analises_solo`

Relacoes ja aplicadas no codigo local:
1. `talhoes.property_id -> properties.id`
2. `analises_solo.property_id -> properties.id`
3. `analises_solo.talhao_id -> talhoes.id`
4. `analises_solo.user_id -> properties.user_id`

### 1.2 LocalStorage/SessionStorage - chaves estruturadas (por dominio)

Arquivos de referencia: `src/services/*.ts`, `src/global-state/user.ts`, `src/views/Main/Dashboard.tsx`.

1. Perfil e sessao local
1. `perfilsolo_profile_v1`
2. `perfilsolo_local_auth_email`
3. `perfilsolo_local_auth_session`
4. `perfilsolo_user_preferences_v1:{userId}`
5. `perfilsolo_system_config_v1`
6. `perfilsolo_brand_theme_overrides_v1`

2. Cadastros e dominio tecnico
1. `perfilsolo_people_v1`
2. `perfilsolo_clients_v1` (legado)
3. `perfilsolo_laboratories_v1`
4. `perfilsolo_property_area_categories_v1`
5. `perfilsolo_culture_profiles_v1`
6. `perfilsolo_cultivar_technical_profiles_v1`
7. `perfilsolo_companies_v1`
8. `perfilsolo_active_company_by_user_v1`

3. Billing, loja, creditos e compras internas
1. `perfilsolo_billing_catalog_v1`
2. `perfilsolo_billing_subscriptions_v1`
3. `perfilsolo_billing_ledger_v1`
4. `perfilsolo_store_quota_ledger_v1`
5. `perfilsolo_store_purchase_receipts_v1`
6. `perfilsolo_store_recurring_commitments_v1`
7. `perfilsolo_store_referral_profiles_v1`
8. `perfilsolo_store_referral_events_v1`
9. `perfilsolo_credit_wallets_v1`
10. `perfilsolo_credit_transactions_v1`
11. `perfilsolo_credit_initial_granted_v1`
12. `perfilsolo_credit_purchase_requests_v1`
13. `perfilsolo_credit_coupons_v1`
14. `perfilsolo_credit_coupon_redemptions_v1`
15. `perfilsolo_credit_ad_reward_config_v1`
16. `perfilsolo_credit_ad_reward_claims_v1`
17. `perfilsolo_credit_engagement_rules_v1`
18. `perfilsolo_credit_engagement_claims_v1`
19. `perfilsolo_in_app_purchase_receipts_v1`
20. `perfilsolo_avatar_inventory_v1`

4. Operacao e UX
1. `perfilsolo_notifications_v1:{userId}`
2. `perfilsolo_gamification_state_v1`
3. `perfilsolo_dashboard_onboarding_v1`
4. `perfilsolo_login_history_v1`
5. `perfilsolo_dashboard_selected_property_v1`
6. `perfilsolo_dashboard_selected_talhao_v1`

5. Governanca, logs e integracoes
1. `perfilsolo_users_registry_v1`
2. `perfilsolo_users_registry_config_v1`
3. `perfilsolo_local_audit_logs`
4. `perfilsolo_local_logs`
5. `perfilsolo_local_error_reports_v1`
6. `perfilsolo_cep_cache_v1`
7. `perfilsolo_locations_cache_v1`
8. `perfilsolo_identity_challenges_v1`
9. `perfilsolo_identity_verified_emails_v1` (session)
10. `perfilsolo_two_factor_settings_v1`

## 2) Cobertura atual nas migrations SQL (supabase/migrations)

### 2.1 Ja coberto no schema SQL

1. Nucleo:
1. `profiles`
2. `properties`
3. `talhoes`
4. `analises_solo`

2. Cadastro de apoio:
1. `pessoas`
2. `property_people_links`
3. `property_equipamentos`
4. `laboratorios`
5. `laboratorio_servicos`
6. `talhao_culturas_periodos`

3. Endereco/contato modular:
1. `addresses`
2. `profile_addresses`
3. `property_addresses`
4. `pessoa_addresses`
5. `laboratorio_addresses`
6. `contact_points`
7. `profile_contact_points`
8. `property_contact_points`
9. `pessoa_contact_points`
10. `laboratorio_contact_points`

4. Solo/referencias:
1. `soil_params`
2. `nutriente_referencias`
3. `solo_referencias`

5. RNC e perfis tecnicos:
1. `rnc_cultivars_cache`
2. `crop_species_profiles`
3. `crop_cultivar_profiles`

6. Observabilidade:
1. `audit_logs`
2. `logs_sistema`
3. `module_usage`

### 2.2 Cobertura parcial (exige mapeamento de modelo)

1. `perfilsolo_profile_v1`
1. Parte em `profiles`
2. Parte deve ir para `contact_points` + `addresses`
3. Dados de empresa devem ir para modulo proprio (nao em profile bruto)

2. `perfilsolo_laboratories_v1`
1. `laboratorios` existe
2. `servicos` deve migrar para `laboratorio_servicos` (split em 2 tabelas)

3. `perfilsolo_people_v1`
1. Estrutura local usa `types[]`
2. SQL atual usa `tipo` + `metadata`; demanda mapeamento controlado

### 2.3 Nao coberto ainda (faltam migrations)

1. Billing/financeiro:
1. assinaturas operacionais (alem de colunas em `profiles`)
2. ledger financeiro completo

2. Creditos:
1. carteiras
2. transacoes
3. pedidos de compra
4. cupons e redencoes
5. rewards de anuncios/engajamento

3. Loja interna:
1. quota ledger
2. recibos de compra
3. compromissos recorrentes
4. referencia e rewards de indicacao
5. recibos de compra interna (`in_app_purchase_receipts`)

4. UX operacional:
1. notificacoes
2. estado de gamificacao
3. historico de login
4. estado onboarding

5. Config por usuario/sistema:
1. user preferences
2. system config / brand overrides
3. inventario de avatar
4. categorias de area de propriedade
5. registro local de usuarios (se for manter no produto)

## 3) Proposta de plano de migracao (fases)

## Fase A - Congelar modelo e reduzir ambiguidade
1. Definir tabela destino para cada chave local (matriz 1:1).
2. Decidir o que fica local-cache (ex.: preferencia visual) vs o que vira dado de negocio.
3. Padronizar IDs (UUID no backend; manter `legacy_id` durante transicao).

## Fase B - Completar schema SQL faltante (local)
1. Criar migrations para blocos nao cobertos:
1. billing
2. credits
3. app store
4. notifications/gamification/login history
5. user preferences/system config/avatars
2. Aplicar no ambiente local SQL primeiro (`supabase db reset`).

## Fase C - ETL local -> SQL (sem Supabase remoto)
1. Implementar exportador local (JSON) dentro do app para todas as chaves.
2. Criar scripts de import idempotente (upsert por chave natural/UUID).
3. Validar contagens por dominio:
1. total de registros
2. total por usuario
3. validacao de integridade relacional

## Fase D - Cutover por modulo
1. Migrar leitura/escrita de cada modulo para camada SQL.
2. Habilitar feature flag por modulo (fallback local apenas para rollback).
3. Desligar escrita local quando modulo estiver estavel.

## Fase E - Preparar remoto (Supabase cloud)
1. Subir mesmas migrations ja validadas localmente.
2. Rodar ETL novamente para ambiente remoto.
3. Habilitar `VITE_DATA_PROVIDER=supabase` por tenant/usuario piloto.

## 4) Recomendacoes de arquitetura para evitar retrabalho

1. Repositorio por dominio (`interface` unica):
1. `PropertyRepository`
2. `TalhaoRepository`
3. `BillingRepository`
4. `CreditsRepository`
5. etc

2. Validacao antes de persistir:
1. `zod`/schema para payload de entrada
2. bloquear insercao de dados invalidos em ambos providers

3. Auditoria de migracao:
1. tabela `migration_runs`
2. tabela `migration_rejections` (motivo + payload)
3. hash/checksum por lote

4. Idempotencia:
1. sempre usar `upsert`
2. chave natural para evitar duplicacao (ex.: `user_id + code`, `user_id + created_at + type`)

## 5) Decisoes de produto sugeridas (antes da execucao)

1. `users_registry`:
1. manter como controle de negocio interno
2. ou substituir por `auth.users + profiles` como fonte unica

2. `system_config`:
1. se for configuracao global do produto, mover para tabela admin unica
2. se for por usuario, mover para `user_preferences`

3. `companies`:
1. transformar em modulo proprio no SQL (ex.: `companies`, `company_members`)
2. evitar manter semantica misturada em `profile.producer`

## 6) Ordem pratica recomendada (baixo risco)

1. Nucleo (properties/talhoes/analises) + pessoas + laboratorios.
2. Enderecos/contatos (ja modelado).
3. RNC + perfis tecnicos (ja modelado).
4. Billing + creditos + loja.
5. Notificacoes + gamificacao + historicos.
6. Preferencias/tema/config.

---

## Resumo executivo
1. O projeto local esta bem adiantado em schema SQL para dominio agro (propriedade, talhao, analise, pessoas, laboratorios, enderecos, contatos, RNC e perfis tecnicos).
2. O maior gap para migracao completa esta em monetizacao (billing/creditos/loja) e estado de UX (notificacoes/gamificacao/preferencias).
3. A migracao deve ser faseada por dominio, com ETL idempotente e validacao de contagem/integridade antes de qualquer cutover para Supabase remoto.
