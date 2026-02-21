# Plano de Implementacao - Modulo de Contatos

Status geral: `em andamento`  
Ultima atualizacao: `2026-02-20`

## Objetivo
Padronizar contatos (email, telefone, website e redes sociais) como modulo reutilizavel, com impacto previsivel e baixo acoplamento entre entidades.

## Decisoes de arquitetura (confirmadas)
1. Tabela canonica `public.contact_points` para pontos de contato.
2. Vinculos por entidade com opcao 2 (tabelas separadas).
3. Redes sociais no mesmo bloco de contatos, usando `kind='social'` + `network`.
4. Integridade por FK + trigger de consistencia de `user_id`.
5. RLS por `user_id` em todas as tabelas do modulo.
6. Compatibilidade progressiva com campos legados ate migracao total.

## Entidades cobertas nesta fase
1. `profiles` via `profile_contact_points`.
2. `properties` via `property_contact_points`.
3. `pessoas` via `pessoa_contact_points`.
4. `laboratorios` via `laboratorio_contact_points`.

## Modelo alvo
### `contact_points`
- `id` UUID PK
- `user_id` UUID FK -> `profiles(id)`
- `label` TEXT
- `kind` TEXT (`email|phone|website|social`)
- `network` TEXT (quando `kind='social'`)
- `value` TEXT
- `value_normalized` TEXT
- `is_primary` BOOLEAN
- `metadata` JSONB
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

### Vinculos por entidade
- `profile_contact_points`
- `property_contact_points`
- `pessoa_contact_points`
- `laboratorio_contact_points`

Campos padrao:
- `id` UUID PK
- `user_id` UUID FK -> `profiles(id)`
- `<entity_id>` UUID FK -> entidade correspondente
- `contact_point_id` UUID FK -> `contact_points(id)`
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

## Diretrizes de modelagem
1. Email, telefone e website sempre como `contact_points`.
2. Redes sociais no mesmo modulo:
   - `kind='social'`
   - `network='Instagram|Facebook|LinkedIn|...'`
   - `value` com `@usuario` ou URL
3. Apenas um contato primario por tipo e entidade (regra de aplicacao nesta fase).
4. `value_normalized` usado para busca/duplicidade (lowercase, sem espacos, telefone apenas digitos).

## Fases de entrega
## Fase 1 - Base estrutural (este pacote)
- [x] Documentacao de arquitetura e backlog.
- [x] Migration com tabela canonica e vinculos por entidade.
- [x] RLS, indices e triggers de integridade.
- [x] Modulo frontend reutilizavel (`src/modules/contact`).
- [x] Refatoracao inicial para centralizar normalizacao de contato.

## Fase 2 - Migracao funcional
- [ ] Persistir contatos de perfil no modelo canonico.
- [ ] Persistir contatos de propriedade no modelo canonico.
- [ ] Migrar clientes/fornecedores para `pessoas` + `pessoa_contact_points`.
- [ ] Migrar laboratorios para `laboratorio_contact_points`.
- [ ] Adicionar tela/recurso unico de edicao de contatos reutilizavel.

## Fase 3 - Desativacao de legado
- [x] Congelar escrita em campos legados (`email`, `telefone`, `contato`) em ambiente sem dados.
- [ ] Backfill final de dados.
- [ ] Remover leituras de legado no frontend.
- [ ] Planejar remocao de colunas legadas em migration dedicada.

## Cutover sem backfill (ambiente sem dados)
Aplicado em `supabase/migrations/20260220_phase7_modular_cutover_no_backfill.sql`:
1. Remocao de colunas legadas de contato em `properties`, `pessoas` e `laboratorios`.
2. Regra de banco para impedir `contact_points.value` em branco.

## TODO tecnico (execucao e manutencao)
1. Criar repositorio de CRUD por entidade para contatos canonicos.
2. Adicionar validacao forte de email/site/telefone por modulo.
3. Adicionar testes unitarios de normalizacao e mapeamento.
4. Adicionar testes de integridade no banco (trigger + RLS).
5. Criar script de backfill por entidade.
6. Padronizar mascaras/formato em componentes de UI.

## Mapa de impacto para futuras mudancas
Ao alterar regra de contatos, revisar:
1. `supabase/migrations/*contact*`
2. `src/modules/contact/types.ts`
3. `src/modules/contact/normalization.ts`
4. `src/modules/contact/mappers.ts`
5. `src/components/modals/ContactInfoModal.tsx`
6. `src/components/Propriedades/PropertyFullModal.tsx`
7. Servicos de persistencia de clientes/laboratorios/perfil/propriedades

## Rotina de manutencao periodica
1. Mensal: revisar erros de validacao de contato.
2. A cada release: garantir que novas telas usem modulo de contato.
3. Trimestral: revisar qualidade de `value_normalized`.
4. Semestral: revisar taxonomia de `network` para redes sociais.

## Criterios de pronto desta etapa
1. Migration criada com contatos canonicos + vinculos separados por entidade.
2. Mapeamento de social no mesmo bloco de contato definido e implementado.
3. Frontend com modulo reutilizavel de contatos aplicado nos pontos iniciais.
4. Build validada sem quebra de tipagem.
