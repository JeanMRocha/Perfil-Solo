# Plano de Implementacao - Modulo de Enderecos

Status geral: `em andamento`  
Ultima atualizacao: `2026-02-20`

## Objetivo
Padronizar endereco como modulo reutilizavel no PerfilSolo, com impacto previsivel e baixo acoplamento entre entidades.

## Decisoes de arquitetura (confirmadas)
1. Tabela canonica `public.addresses` para dados de endereco.
2. Opcao 2 para vinculos: tabelas separadas por entidade.
3. Integridade por FK real + trigger de consistencia de `user_id`.
4. RLS por `user_id` em todas as tabelas do modulo.
5. Compatibilidade progressiva: campos legados continuam ativos ate concluir migracao completa.

## Entidades cobertas nesta fase
1. `profiles` (empresa/conta do usuario) via `profile_addresses`.
2. `properties` (propriedades) via `property_addresses`.
3. `pessoas` (clientes/fornecedores/parceiros) via `pessoa_addresses`.
4. `laboratorios` via `laboratorio_addresses`.

## Modelo alvo
### `addresses`
- `id` UUID PK
- `user_id` UUID FK -> `profiles(id)`
- `label` TEXT
- `cep` TEXT
- `state` TEXT
- `city` TEXT
- `neighborhood` TEXT
- `street` TEXT
- `number` TEXT
- `complement` TEXT
- `ibge_code` TEXT
- `metadata` JSONB
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

### Vinculos por entidade
- `profile_addresses`
- `property_addresses`
- `pessoa_addresses`
- `laboratorio_addresses`

Campos padrao dos vinculos:
- `id` UUID PK
- `user_id` UUID FK -> `profiles(id)`
- `<entity_id>` UUID FK -> entidade correspondente
- `address_id` UUID FK -> `addresses(id)`
- `is_primary` BOOLEAN
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

## Diretrizes de evolucao
1. Toda nova entidade com endereco deve receber sua propria tabela de vinculo.
2. Nao duplicar campos de endereco nas tabelas de dominio.
3. Toda alteracao no contrato de endereco deve atualizar:
   - migration
   - modulo frontend (`src/modules/address/*`)
   - documentacao deste plano
4. Evolucao deve preservar compatibilidade com dados legados durante transicao.

## Fases de entrega
## Fase 1 - Base estrutural (este pacote)
- [x] Documentacao de arquitetura e backlog.
- [x] Migration com tabela canonica e vinculos por entidade.
- [x] RLS + indices + triggers de integridade.
- [x] Modulo frontend reutilizavel (`src/modules/address`).
- [x] Refatoracao inicial dos pontos prioritarios de CEP e normalizacao.

## Fase 2 - Migracao funcional por modulo de tela
- [ ] Propriedades: persistir endereco principal em `property_addresses`.
- [ ] Perfil/Empresa: persistir endereco em `profile_addresses`.
- [ ] Clientes e fornecedores (`pessoas`): mover para `pessoa_addresses`.
- [ ] Laboratorios: mover `endereco` legado para `laboratorio_addresses`.
- [ ] Tela unica de endereco reutilizavel para formularios.

## Fase 3 - Desativacao de legado
- [x] Congelar escrita em campos legados de endereco (cutover sem backfill).
- [ ] Backfill final e validacao de consistencia.
- [ ] Remover leituras de legado no frontend.
- [ ] Planejar remocao de colunas legadas em migration dedicada.

## Cutover sem backfill (ambiente sem dados)
Aplicado em `supabase/migrations/20260220_phase7_modular_cutover_no_backfill.sql`:
1. Remocao de `properties.contato` e `properties.contato_detalhes`.
2. Remocao de `pessoas.email` e `pessoas.telefone`.
3. Remocao de `laboratorios.email`, `laboratorios.telefone` e `laboratorios.endereco`.
4. Endurecimento do modulo de contato para impedir `value` vazio.

## TODO tecnico (execucao e manutencao)
1. Criar servicos Supabase para CRUD de enderecos por entidade.
2. Adicionar testes unitarios para normalizacao e mapeamentos.
3. Adicionar testes de integridade de banco (trigger e RLS).
4. Adicionar telemetria de falhas de vinculacao.
5. Documentar script de backfill por entidade.
6. Padronizar validacao de CEP/UF/IBGE em um unico ponto.

## Mapa de impacto para futuras mudancas
Quando alterar regra de endereco, revisar obrigatoriamente:
1. `supabase/migrations/*address*`
2. `src/modules/address/types.ts`
3. `src/modules/address/normalization.ts`
4. `src/modules/address/mappers.ts`
5. Telas que editam contato/endereco (`Profile`, `PropertyFullModal`, `ContactInfoModal`, cadastros futuros)
6. Servicos de persistencia (quando migrados para Supabase)

## Rotina de manutencao periodica
1. Mensal: revisar erros de CEP/autopreenchimento.
2. A cada release: validar se novas telas estao reutilizando o modulo.
3. Trimestral: revisar indices e custo de consulta das tabelas de vinculo.
4. Semestral: revisar necessidade de novos campos no endereco canonico.

## Criterios de pronto desta etapa
1. Migration criada com entidades de vinculo separadas (opcao 2).
2. Modulo de endereco criado e reutilizado no frontend inicial.
3. Documento de planejamento e manutencao disponivel no projeto.
4. Build do frontend valida sem erro de tipagem causado pela refatoracao.
