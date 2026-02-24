# Decisão Arquitetural: Desenvolvimento Local e Amostragem RNC

**Data:** 24 de Fevereiro de 2026  
**Status:** ATIVO  
**Decidido por:** Usuário e Antigravity

## Contexto

O projeto está na fase de importação e processamento dos dados do **Registro Nacional de Cultivares (RNC)**, que contém mais de 37.000 registros. A infraestrutura de back-end utiliza Supabase, mas o projeto possui uma camada de abstração sólida para um "Data Provider Local" (LocalStorage/JSON).

## Decisão Principal

**ESTRATÉGIA "LOCAL-FIRST" COM AMOSTRAGEM REPRESENTATIVA:**

1.  **Prioridade Local:** Todo o desenvolvimento de fluxos, estruturação de tabelas, lógica de interpolação técnica e layouts de UI deve ser realizado utilizando o modo `VITE_DATA_PROVIDER=local`.
2.  **Suspensão de Nuvem:** Não realizar tentativas de migração ou sincronização pesada para o Supabase (Edge Functions ou DB remoto) durante a fase de prototipagem e refinamento de regras de negócio. Isso visa economizar recursos (tokens, rede e processamento) e acelerar o ciclo de feedback.
3.  **Amostra de Referência (Sample):** Utilizaremos uma amostra representativa de **até 10 registros** (atualmente 8), contendo uma espécie/cultivar de cada grupo principal do RNC (_Frutíferas, Grandes Culturas, Olerícolas, etc_).
4.  **Migração Tardia:** A migração completa e ativação do Supabase ocorrerá apenas no final do desenvolvimento, quando os fluxos locais estiverem validados e estáveis.

## Impacto para Agentes (Orientações)

- **Não sugira comandos de sync com Supabase:** Ao menos que seja explicitamente solicitado após esta data.
- **Foquem em `LOCAL_SAMPLE`:** Se precisar de novos dados, edite os arquivos de mock ou o script de seed local.
- **Estruturação de Dados Técnica:** Use a amostra de 8 culturas para definir os parâmetros de adubação e calagem (pH ideal, teores de nutrientes).
- **Consistência:** Verifique sempre `isLocalDataMode` no `dataProvider.ts` antes de sugerir ou realizar alterações em serviços de persistência.

## Recursos Atualizados

- **Arquivo de Dados:** `src/data/rnc_seed_sample.json`
- **Mock Service:** `src/services/rncCultivarService.ts` (variável `LOCAL_SAMPLE`)
- **Script de Apoio:** `scripts/seed_local_rnc.ts` (gera código para console do browser)
