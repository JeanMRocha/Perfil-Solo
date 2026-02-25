# Arquitetura do Projeto — Perfil Solo

> Referência rápida de camadas, pastas e regras de dependência.

---

## Stack Atual (em transição)

| Tecnologia               | Status                                                 |
| ------------------------ | ------------------------------------------------------ |
| React 19                 | ✅ Ativo                                               |
| Vite                     | ✅ Ativo                                               |
| TypeScript (strict)      | ✅ Ativo                                               |
| shadcn/ui + Tailwind CSS | ✅ **Usar para código novo**                           |
| Mantine 8                | ⚠️ **Legado — em migração, não usar para código novo** |
| Nanostores               | ✅ Estado global                                       |
| Supabase                 | ✅ Auth + DB (modo **local-first** em dev)             |
| Lucide React             | ✅ Ícones                                              |
| Framer Motion            | ✅ Animações                                           |
| Leaflet                  | ✅ Mapas                                               |
| Recharts                 | ✅ Gráficos                                            |

---

## Mapa de Camadas

| Camada             | Pasta(s)                                | Responsabilidade                                | Pode importar de         |
| ------------------ | --------------------------------------- | ----------------------------------------------- | ------------------------ |
| **Types / Domain** | `src/types/`, `src/modules/*/types.ts`  | Tipos puros, interfaces de domínio              | Nenhuma outra camada     |
| **Services**       | `src/services/`                         | Lógica de negócio, acesso a dados, orquestração | Types                    |
| **Modules**        | `src/modules/{feature}/`                | Feature modules auto-contidos                   | Types, Services          |
| **Hooks**          | `src/hooks/`, `src/modules/*/hooks/`    | Lógica reativa reutilizável                     | Types, Services, Modules |
| **Components**     | `src/components/`, `src/components/ui/` | Componentes reutilizáveis                       | Types, Hooks             |
| **Views**          | `src/views/`                            | Páginas, composição de UI                       | Tudo acima               |
| **Global State**   | `src/global-state/`                     | Nanostores                                      | Types                    |
| **Supabase**       | `src/supabase/`                         | Tipagem e config                                | Nenhuma                  |

---

## Regras de Dependência

1. **Types** não importam de nenhuma camada.
2. **Services** importam apenas de Types.
3. **Views** podem importar de tudo, mas **nunca** contêm lógica de domínio.
4. **Components** nunca acessam Services diretamente — usam props ou hooks.
5. **Hooks** fazem a ponte entre Services e Components/Views.

---

## Estrutura de um Módulo

```
src/modules/{feature}/
├── types.ts          # Tipos do módulo
├── constants.ts      # Constantes
├── index.ts          # Barrel exports
├── hooks/            # Hooks do módulo
│   └── use{Feature}.ts
├── utils/            # Funções utilitárias puras
│   └── {feature}Utils.ts
└── components/       # Componentes específicos do módulo
    ├── index.ts
    └── {Component}.tsx
```

---

## Módulos Existentes

| Módulo       | Pasta                             | Service associado                                       |
| ------------ | --------------------------------- | ------------------------------------------------------- |
| Talhão       | `src/modules/talhao/`             | `appStoreService.ts`                                    |
| Solo / SiBCS | `src/modules/soilClassification/` | `soilClassificationEngine.ts`, `soilProfilesService.ts` |
| Endereço     | `src/modules/address/`            | `cepService.ts`                                         |
| Contato      | `src/modules/contact/`            | —                                                       |
| Pessoas      | `src/modules/people/`             | `peopleService.ts`                                      |
| Usuário      | `src/modules/user/`               | `profileService.ts`                                     |
| Billing      | `src/modules/billing/`            | `billingPlanService.ts`                                 |
| Geo          | `src/modules/geo/`                | `locationService.ts`                                    |

---

## Path Aliases (tsconfig.json)

| Alias           | Resolve para         |
| --------------- | -------------------- |
| `@global/*`     | `src/global-state/*` |
| `@components/*` | `src/components/*`   |
| `@views/*`      | `src/views/*`        |
| `@services/*`   | `src/services/*`     |
| `@supabase/*`   | `src/supabase/*`     |
| `@sb/*`         | `src/supabase/*`     |

---

## Regras de UI (Migração)

1. **Código novo**: usar `shadcn/ui` + `Tailwind CSS` + `Lucide React`.
2. **Código existente Mantine**: coexiste durante transição. Ao converter, remover imports `@mantine/*` completamente.
3. **Antes de criar componente novo**: verificar se já existe em `src/components/ui/`.
4. **Estilos**: Tailwind-only. Não usar sistema Mantine (`Sx`, `styles`, `createStyles`).
5. **Theming**: variáveis CSS. Referência: `src/mantine/brand.ts` (será migrado).
