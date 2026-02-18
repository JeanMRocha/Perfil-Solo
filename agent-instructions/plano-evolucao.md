# Plano de Evolucao (Q1-Q2 2026)

## Objetivos
1. Consolidar estabilidade de producao.
2. Aumentar cobertura de confiabilidade.
3. Melhorar escalabilidade funcional do Perfil Solo.

## Fase 1 - Hardening (1-2 semanas)
1. Completar itens P1 do `todo-priorizado.md`.
2. Criar matriz de ambientes (`dev`, `staging`, `prod`) com variaveis segregadas.
3. Definir playbook de incidentes (rollback e comunicacao).

## Fase 2 - Qualidade e Observabilidade (2-4 semanas)
1. Cobertura de testes unitarios e integracao para dominios criticos.
2. Introduzir testes de contrato para servicos Supabase/Stripe.
3. Padronizar tratamento de erro e correlação de logs por request/usuario.

## Fase 3 - Performance e Produto (4-8 semanas)
1. Quebra de chunks para reduzir carga inicial.
2. Revisao de consultas e indices no Supabase conforme uso real.
3. Evolucao do dashboard com metrica de uso e saude operacional.

## Criterios de saida para producao plena
1. Pipeline CI verde por 7 dias consecutivos em branches ativas.
2. Sem vulnerabilidades altas/moderadas em dependencia de producao.
3. Cobertura minima acordada para modulos criticos.
4. Checklist de release executado e aprovado em staging.
