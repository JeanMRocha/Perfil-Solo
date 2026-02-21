# Plano de Implementacao - Modulo de Usuario

Status geral: `em andamento`  
Ultima atualizacao: `2026-02-20`

## Objetivo
Consolidar toda a gestao do usuario logado em uma unica interface e disponibilizar um modulo reaproveitavel para navegacao e composicao de funcionalidades de conta.

## Diretriz adotada
1. Interface unica em `/user` (Central do Usuario).
2. Abas internas para separar contexto sem espalhar em telas distintas.
3. Reuso dos componentes existentes (perfil, faturamento, creditos) em modo embutido.
4. Rotas legadas (`/config`, `/creditos`, `/cupons`) redirecionam para a central.

## Estrutura do modulo
### `src/modules/user/types.ts`
- Tipos de abas da central (`UserCenterTab`).

### `src/modules/user/navigation.ts`
- Resolver aba ativa via query string.
- Gerar URL canonica da central (`/user?tab=...`).

### `src/modules/user/index.ts`
- Barrel para exportar o modulo.

## Interface consolidada
### `src/views/User/UserCenter.tsx`
Abas implementadas:
1. `perfil`
2. `plano`
3. `creditos`
4. `cupons`

## Adaptacoes para modo embutido
1. `src/views/User/Profile.tsx`
   - Suporte `embedded` para uso dentro da central sem header/container duplicado.
2. `src/views/Credits/CreditsCenter.tsx`
   - Suporte `embedded`.
   - Suporte `view` (`creditos|cupons`) para controlar aba.

## Roteamento consolidado
1. `/user` -> central unificada.
2. `/config` -> redireciona para `/user?tab=plano`.
3. `/creditos` -> redireciona para `/user?tab=creditos`.
4. `/cupons` -> redireciona para `/user?tab=cupons`.

## TODO de evolucao
1. Extrair resumo de usuario (perfil + plano + saldo) para hook unico de modulo.
2. Adicionar testes de roteamento das abas da central.
3. Adicionar permissao/feature flags por aba.
4. Permitir composicao de abas via configuracao para reuso em outros projetos.
