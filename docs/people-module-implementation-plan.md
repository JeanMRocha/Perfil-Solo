# Modulo Pessoas - Plano de Implementacao

## Objetivo
Centralizar cadastro de pessoas em um unico modulo reutilizavel por:
- clientes
- fornecedores
- administradores
- perfil do usuario logado
- futuras entidades (parceiros, colaboradores, outros)

## Decisoes de arquitetura
- Tabela/camada canonica: `peopleService` com armazenamento em `perfilsolo_people_v1`.
- Identificadores por tipo: `PersonTypeIdentifier` com suporte multiplo por pessoa.
- Compatibilidade retroativa:
  - `clientsService` continua existindo, mas como fachada para `peopleService`.
  - dados antigos de `perfilsolo_clients_v1` sao migrados automaticamente na leitura.

## Estrutura criada
- `src/modules/people/types.ts`
- `src/modules/people/normalization.ts`
- `src/modules/people/index.ts`
- `src/services/peopleService.ts`

## Regras principais
- Nome obrigatorio com minimo de 3 caracteres.
- Uma pessoa pode ter varios tipos ao mesmo tempo.
- Exclusao por tipo:
  - remove apenas o tipo quando usado por submodulo especifico.
  - remove a pessoa inteira somente se nao restarem tipos.
- Contatos normalizados pelo modulo de contato canonico.

## Integracoes aplicadas
- Tela de pessoas (`src/views/Clientes/Clientes.tsx`) transformada em hub modular:
  - cadastro
  - filtro por tipo
  - badges por identificador
- `PessoasBusca` e `PessoasCadastro` usam o hub de pessoas.
- `Profile` sincroniza uma pessoa do tipo `user_profile` ao salvar.
- `clientsService` segue atendendo componentes legados (ex.: propriedades).

## To-do recomendado (proxima fase)
1. Criar tela dedicada de fornecedores com `fixedType='supplier'`.
2. Criar tela dedicada de administradores com `fixedType='administrator'`.
3. Adicionar campo de status (ativo/inativo) no cadastro de pessoas.
4. Adicionar auditoria de alteracoes por pessoa.
5. Quando migrar para banco remoto, manter a mesma API do `peopleService`.
