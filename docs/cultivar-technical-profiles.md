# Perfis técnicos de cultura (preparo)

## Objetivo
- Separar referências técnicas em dois níveis:
1. **Espécie**: base geral.
2. **Cultivar**: refinamento específico, com prioridade sobre a espécie.

## Regras de prioridade
1. Se existir perfil técnico de cultivar vinculado ao talhão, ele prevalece.
2. Se não existir, aplica-se o perfil técnico da espécie.
3. Se não existir nenhum perfil, o sistema permanece sem referência técnica.

## Fluxo implementado no talhão
- No histórico de culturas, cada vínculo mantém metadados de:
  - espécie (comum/científica),
  - grupo da espécie,
  - cultivar,
  - URL de detalhe RNC,
  - `technical_profile_id` (quando houver cópia custom).
- A ação **Duplicar cultivar para dados técnicos** cria uma cópia customizável.

## Serviço local (fase de preparo)
- Arquivo: `src/services/cultivarTechnicalProfilesService.ts`
- Recursos:
  - criação/garantia de espécie técnica;
  - duplicação de cultivar para perfil custom;
  - resolução de referência técnica final (espécie + cultivar).

## Banco (fase de preparo)
- Migração: `supabase/migrations/20260222_phase9_cultivar_technical_profiles.sql`
- Tabelas:
  - `crop_species_profiles`
  - `crop_cultivar_profiles`

## Próxima etapa sugerida
- Tela dedicada para edição dos campos técnicos de produção:
  - produtividade,
  - espaçamento,
  - ciclo,
  - e campos adicionais usados em adubação/calagem.
