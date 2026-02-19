# Plano de Implementacao - Modulo Feedback (retomada)

Status geral: `planejado`  
Ultima atualizacao: `2026-02-19`

## Objetivo
Criar um modulo de `Feedback` (nao comunidade aberta), focado em coleta estruturada de sugestoes, bugs e opinioes sobre sistema e aulas, com fluxo seguro e moderavel por super usuario.

## Diretriz principal (MVP seguro)
1. Criar menu `Feedback` no menu principal.
2. Fluxo sem interacao livre entre usuarios:
   1. Usuario abre sugestao/bug/opiniao.
   2. Super usuario analisa, responde e muda status.
   3. Usuario acompanha status da propria solicitacao.
3. Opcional futuro: mural publico apenas com itens aprovados, sem comentarios.

## Escopo MVP (Fase 1)
### Tipos de feedback
- `Bug`
- `Melhoria`
- `Aulas`
- `Usabilidade`
- `Outro`

### Campos do formulario
- `titulo` (obrigatorio)
- `descricao` (obrigatorio)
- `modulo_afetado` (opcional, lista pre-definida)
- `prioridade_percebida` (baixa/media/alta)
- `anexo` (opcional)

### Status do fluxo
- `Novo`
- `Em analise`
- `Planejado`
- `Concluido`
- `Recusado`

### Regras de UX no MVP
- Sem comentarios entre usuarios.
- Sem chat publico.
- Usuario ve apenas os proprios feedbacks.
- Super usuario ve tudo com filtros.

## Moderacao e seguranca
1. Apenas usuario autenticado pode postar.
2. Cadastro exige e-mail valido (alinhado ao fluxo atual de identidade/2FA).
3. Validacao de conteudo minima:
   - rate limit por usuario (exemplo inicial: `5 envios/dia`)
   - filtro de palavras proibidas
   - bloqueio de links suspeitos
4. Exclusao logica (nao fisica) para rastreabilidade.
5. `Denunciar conteudo` previsto para quando mural publico for habilitado.

## Operacao do Super Usuario
### Tela de triagem
- Filtros por tipo/status/periodo/modulo.
- Busca por texto.
- Ordenacao por data e prioridade.

### Acoes de moderacao
- Alterar status.
- Responder feedback.
- Ocultar.
- Excluir logico.
- Marcar como duplicado.

### Auditoria
- Registro de quem alterou, quando alterou e o que mudou.

## Modelo de dados (base inicial)
1. `feedback_posts`
2. `feedback_reports`
3. `feedback_actions_log`
4. `feedback_categories` (opcional no banco; pode iniciar fixo no codigo)

## Proposta de esquema (referencia)
### feedback_posts
- `id` (pk)
- `user_id`
- `type` (`bug|melhoria|aulas|usabilidade|outro`)
- `title`
- `description`
- `module`
- `perceived_priority` (`low|medium|high`)
- `status` (`novo|em_analise|planejado|concluido|recusado`)
- `admin_response` (nullable)
- `is_hidden` (bool)
- `is_deleted` (bool)
- `duplicate_of` (nullable)
- `created_at`
- `updated_at`

### feedback_reports
- `id` (pk)
- `post_id`
- `reported_by`
- `reason`
- `created_at`

### feedback_actions_log
- `id` (pk)
- `post_id`
- `actor_user_id`
- `action_type` (status_change, response, hide, delete_soft, duplicate_mark)
- `old_value` (json/text)
- `new_value` (json/text)
- `created_at`

## Fases de entrega
## Fase 1 - MVP funcional e seguro
- [ ] Menu `Feedback` (usuario comum)
- [ ] Formulario de envio
- [ ] Lista "Meus feedbacks"
- [ ] Painel super usuario com filtros e alteracao de status
- [ ] Resposta do super usuario visivel para o autor
- [ ] Rate limit simples
- [ ] Filtro de palavras e links suspeitos
- [ ] Auditoria basica de acoes

## Fase 2 - Valor publico controlado
- [ ] Mural publico apenas com posts aprovados
- [ ] Votos (ex.: "isso tambem me afeta")
- [ ] Filtros de mural por categoria/modulo
- [ ] Botao denunciar conteudo

## Fase 3 - Escala e automacao
- [ ] Comentarios moderados
- [ ] Regras de moderacao automatica
- [ ] Notificacoes mais avancadas (mudanca de status/resposta)
- [ ] Dashboard de indicadores de feedback

## Checklist de retomada (quando voltar a implementar)
1. Confirmar o nome final do menu: `Feedback`.
2. Definir se MVP vai em `localStorage` primeiro ou direto `Supabase`.
3. Criar paginas:
   - `src/views/Feedback/FeedbackUser.tsx`
   - `src/views/Super/FeedbackModeration.tsx`
4. Adicionar rotas e links de menu.
5. Implementar servico:
   - `src/services/feedbackService.ts`
6. Implementar modulo de moderacao:
   - `src/services/feedbackModerationService.ts` (opcional separado)
7. Adicionar testes minimos (fluxo criar -> moderar -> acompanhar status).

## Criterios de pronto (Definition of Done)
1. Usuario autenticado consegue criar feedback com validacoes.
2. Super usuario consegue filtrar, responder e mudar status.
3. Autor visualiza status e resposta atualizados.
4. Todas as acoes criticas ficam auditadas.
5. Nao existe interacao direta entre usuarios no MVP.
6. Build/lint/test passam sem erros.

