# Plano de Migração: Mantine para shadcn/ui (AI-First Strategy)

**Data:** 24 de Fevereiro de 2026
**Status:** PRIORIDADE MÁXIMA
**Objetivo:** Reduzir custo de tokens, facilitar a manutenção por agentes de IA e aumentar a flexibilidade estética para um design "Premium".

## 1. Justificativa Estratégica

A migração para **shadcn/ui** (baseado em Tailwind CSS e Radix UI) é motivada por:

- **Eficiência de IA:** LLMs possuem conhecimento superior de Tailwind CSS, resultando em menor consumo de contexto e menos erros de codificação.
- **Portabilidade:** Ao contrário de bibliotecas externas, o código dos componentes reside no repositório, permitindo que a IA leia a implementação real antes de sugerir mudanças.
- **Manutenção Incremental:** O projeto ainda está em construção, permitindo uma transição orgânica arquivo por arquivo.

## 2. Ordem de Prioridade (Fluxo Gradual)

### Fase 1: Infraestrutura e Componentes Base (ATUAL)

- [ ] Configuração de Tailwind CSS e `lucide-react`.
- [ ] Implementação do sistema de cores e temas (Variáveis CSS).
- [ ] Componentes "Átomos" (Botões, Inputs, Cards, Badges).

### Fase 2: Componentes de Feedback e Navegação

- [ ] Modais (substituindo `@mantine/modals`).
- [ ] Notificações (substituindo `@mantine/notifications`).
- [ ] Drawers e Sidebars.

### Fase 3: Substituição de Telas (Views)

- [ ] Dashboards e Gráficos.
- [ ] Formulários de Cadastro (Análise de Solo).
- [ ] Tabelas e Listagens.

## 3. Diretrizes para Agentes de IA

1.  **Híbrido por enquanto:** Mantine e shadcn coexistirão durante a transição. Não quebre componentes Mantine antes de ter o equivalente em shadcn testado.
2.  **Referência Local:** Sempre verifique a implementação em `src/components/ui` antes de sugerir novos componentes.
3.  **Tailwind-Only:** A partir desta data, novos estilos e layouts devem ser escritos preferencialmente em **Tailwind CSS**, evitando o sistema de estilos da Mantine (`Sx`, `styles`).
4.  **Documentação de Troca:** Ao converter um arquivo, remova os imports da `@mantine/core` completamente se possível.

## 4. Log de Migração

- [2026-02-24] Planejamento e formalização da estratégia.
- [Próximo Passo] Instalação de Tailwind CSS e inicialização do shadcn/ui.
