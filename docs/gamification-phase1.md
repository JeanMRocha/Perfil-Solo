# Gamification Phase 1 (Duolingo-style base)

## Objetivo
Criar uma base modular para engajamento com:
- streak diario;
- XP e niveis;
- missoes diarias com bonus de conclusao.

## Modulos envolvidos
- `src/services/gamificationService.ts`
- `src/views/User/GamificationPanel.tsx`
- `src/views/User/UserCenter.tsx` (aba `Jornada`)
- Integracoes de evento:
  - `src/views/Main/AppLayout.tsx`
  - `src/views/User/Profile.tsx`
  - `src/services/peopleService.ts`

## Eventos rastreados na fase 1
- `app_open`
- `visit_dashboard`
- `visit_user_center`
- `profile_saved`
- `person_created`

## Eventos reais conectados a creditos (cadastro/base)
- `signup` -> +10 (limite 1)
- `email_confirmation` -> +20 (limite 1)
- `profile_address` -> +10 (limite 1)
- `property_created` -> +10 (limite 5)
- `talhao_created` -> +2 (limite 100)
- `ad_reward` -> +5 por propaganda (max 3/dia, configuravel)

Eventos reservados para fase seguinte:
- `analysis_created`
- `report_generated`

## Regras atuais
1. O dia usa chave local `YYYY-MM-DD`.
2. Missoes diarias sao rotativas (3 por dia) e reiniciadas automaticamente.
3. Ao completar todas as missoes do dia: bonus fixo `+25 XP`.
4. Streak sobe no primeiro `app_open` do dia.
5. Bonus de streak:
- dia 1: sem bonus extra;
- dia 2 em diante: `min(20, 5 + streak)`.
6. Marcos de streak geram notificacao: `3, 7, 14, 30, 60, 100`.

## Persistencia
- LocalStorage: `perfilsolo_gamification_state_v1`
- Evento de atualizacao: `perfilsolo:gamification-updated`

## To-do (fase 2)
- Adicionar ranking semanal por XP.
- Adicionar conquistas permanentes (achievements).
- Adicionar "vidas/energia" opcional por fluxo.
- Integrar `analysis_created` e `report_generated` com pontos reais.
- Dashboard admin para balanceamento de XP/recompensas sem deploy.
