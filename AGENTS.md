# Perfil Solo — Instruções para Agentes de IA

> **OBRIGATÓRIO:** Antes de escrever ou modificar qualquer código neste projeto, leia os arquivos abaixo **nesta ordem**:

1. **`.agent/rules/ONBOARDING.md`** — Lista de leitura obrigatória
2. **`.agent/rules/PROMPT_CONSTITUCIONAL_ENGINEERING_v1.md`** — Regras constitucionais (SOLID, DRY, KISS, camadas, segurança, etc.)
3. **`.agent/rules/ARCHITECTURE.md`** — Mapa de camadas e pastas do projeto
4. **`.agent/rules/PROMPT_VINCULACAO.md`** — Prompt de vinculação (como aplicar as regras)
5. **`.agent/rules/PROMPT_OPERACIONAL_TEMPLATE.md`** — Template para tarefas específicas

## Referência rápida

- **Stack**: React 19 + shadcn/ui + Tailwind CSS + Supabase (local-first)
- **Migração ativa**: Mantine → shadcn/ui (PRIORIDADE MÁXIMA). Não usar Mantine para código novo.
- **Modo de dados**: Local-first. Não sincronizar com Supabase sem autorização.
- **Docs de módulos**: Ver `docs/` para planos de implementação por módulo.

## Se não leu as regras, não coda.
