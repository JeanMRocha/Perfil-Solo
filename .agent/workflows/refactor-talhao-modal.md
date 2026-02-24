---
description: Refatoração do TalhaoDetailModal - plano completo e progresso
---

# Refatoração do TalhaoDetailModal

## Objetivo

Refatorar o componente monolítico `TalhaoDetailModal.tsx` (~2.781 linhas originais) em peças menores, organizadas e manuteníveis, seguindo as boas práticas do projeto.

## Status Geral

| Fase       | Descrição                                          | Status      |
| ---------- | -------------------------------------------------- | ----------- |
| **Fase 1** | Extração de lógica pura (tipos, constantes, utils) | ✅ Completa |
| **Fase 2** | Extração de hooks (estado + lógica React)          | ✅ Completa |
| **Fase 3** | Extração de componentes UI                         | 🔲 Pendente |
| **Fase 4** | Recomposição final (orquestrador fino)             | 🔲 Pendente |

## Redução de Linhas

| Momento             | Linhas em TalhaoDetailModal.tsx |
| ------------------- | ------------------------------- |
| Original            | ~2.781                          |
| Após Fase 1         | ~2.660                          |
| Após Fase 2         | **~1.722**                      |
| Meta final (Fase 4) | ~500-700                        |

---

## Fase 1 — Extração de Lógica Pura ✅

Tipos, constantes e funções utilitárias puras (sem React) foram movidos para `src/modules/talhao/`.

### Arquivos Criados

| Arquivo                                  | Conteúdo                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/talhao/types.ts`            | `DrawMode`, `CultureModalMode`, `SelectedVertex`, `CultureEntry`                                                                                      |
| `src/modules/talhao/constants.ts`        | `UNCLASSIFIED_SOIL_VALUE`, `SOIL_COLOR_BY_ORDER`, `DEFAULT_SOIL_LINKED_COLOR`                                                                         |
| `src/modules/talhao/utils/geometry.ts`   | `flattenPoints`, `polygonBounds`, `isPointInsidePolygon`, `isSegmentInsidePolygon`, `isPolygonInsidePolygon`, `midpoint`, `geoPointToCanvasPoint`     |
| `src/modules/talhao/utils/formatters.ts` | `normalizeMonthYear`, `monthYearOrder`, `formatMonthYear`, `normalizeKey`, `isUnclassifiedSoilValue`, `resolveSoilLinkedColor`, `normalizeGeoLayerId` |
| `src/modules/talhao/index.ts`            | Barrel export de tudo acima + hooks                                                                                                                   |

---

## Fase 2 — Extração de Hooks ✅

Estado React e lógica associada foram extraídos em 3 hooks composáveis.

### Hooks Criados

| Hook                     | Arquivo                                              | Linhas | Responsabilidades                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useTalhaoDrawing`       | `src/modules/talhao/hooks/useTalhaoDrawing.ts`       | ~662   | Estado de desenho (drawMode, mainPoints, zones, currentPoints, mousePos), seleção (selectedVertex, selectedZoneIndex, selectedMainPolygon), funções de draw (start, finish, cancel, handleStageClick, handleMouseMove), funções de edição (move anchors, insert points, remove vertex/zone/polygon), status label, resetFromGeometry |
| `useTalhaoCultures`      | `src/modules/talhao/hooks/useTalhaoCultures.ts`      | ~265   | Lista de culturas, cultura atual, draft, modais (edição/link), CRUD de culturas, integração RNC, duplicação de perfil técnico, resetFromTalhao                                                                                                                                                                                       |
| `useTalhaoMapBackground` | `src/modules/talhao/hooks/useTalhaoMapBackground.ts` | ~201   | Busca CEP/coordenadas, projeção geo→canvas, gerenciamento de layers, mapCenter/mapZoom/mapLayerId, addPointFromCoordinates, resetFromGeometry                                                                                                                                                                                        |

### Como o TalhaoDetailModal.tsx Funciona Agora

```tsx
// 1. Instancia os 3 hooks
const drawing = useTalhaoDrawing();
const culturesHook = useTalhaoCultures();
const mapBg = useTalhaoMapBackground();

// 2. Desestrutura aliases para compatibilidade com GridLayout props
const { drawMode, mainPoints, zones, ... } = drawing;
const { cultures, currentCulture, ... } = culturesHook;
const { mapSearchValue, mapCenter, ... } = mapBg;

// 3. Mantém estado de formulário (nome, área, solo, classificação)
const [nome, setNome] = useState('');
const [areaHa, setAreaHa] = useState<number | ''>('');
const [tipoSolo, setTipoSolo] = useState('');
// ... soil classification state

// 4. Init effect delega para cada hook
useEffect(() => {
  drawing.resetFromGeometry(geometry.points, geometry.exclusionZones);
  culturesHook.resetFromTalhao(parsedCultures, persistedCurrentCulture);
  mapBg.resetFromGeometry(geometry.mapReference ?? null);
}, [opened, talhao]);

// 5. Passa tudo para GridLayout como props
<GridLayout nome={nome} drawMode={drawMode} cultures={cultures} ... />
```

### O que Permanece no TalhaoDetailModal.tsx (~1.722 linhas)

- **Imports** (~110 linhas)
- **Hook wiring + form state + derivados** (~320 linhas)
- **Save/close/delete logic** (~100 linhas)
- **JSX principal** (Dialog, ScrollArea, layout) (~50 linhas)
- **GridLayout component** (~1.100 linhas) ← próximo alvo de extração

---

## Fase 3 — Extração de Componentes UI (PRÓXIMO PASSO)

O `GridLayout` (~1.100 linhas, definido dentro de `TalhaoDetailModal.tsx`) deve ser quebrado em componentes menores.

### Componentes Sugeridos

| Componente                 | Responsabilidade                                            | Linhas estimadas |
| -------------------------- | ----------------------------------------------------------- | ---------------- |
| `TalhaoFormCard.tsx`       | Campos nome, área, tipo de solo, classificação              | ~150             |
| `TalhaoCultureHistory.tsx` | Lista de culturas, botões de edição, modal de cultura       | ~250             |
| `TalhaoDrawingToolbar.tsx` | Botões de desenho (main, zone, cancelar, finalizar)         | ~80              |
| `TalhaoCanvasStage.tsx`    | Canvas Konva (Stage, Layer, Line, Circle, anchors)          | ~400             |
| `TalhaoMapControls.tsx`    | Controles do mapa de fundo (busca CEP, layers, coordenadas) | ~150             |
| `TalhaoZoneList.tsx`       | Lista de zonas de exclusão com seleção/remoção              | ~100             |

### Como Executar

1. Criar cada componente em `src/modules/talhao/components/`
2. Mover o JSX relevante do `GridLayout` para o novo componente
3. Passar os props necessários (vindos dos hooks)
4. Substituir o JSX no `GridLayout` por `<TalhaoFormCard ... />`
5. Eventualmente eliminar `GridLayout` e compor diretamente no modal

---

## Fase 4 — Recomposição Final

Após a Fase 3, `TalhaoDetailModal.tsx` deve ficar com ~500-700 linhas:

- Imports
- Hook instantiation + form state
- Save/close/delete
- JSX: Dialog → ScrollArea → composição dos novos componentes

---

## Verificação de Integridade

```bash
# Compilação TypeScript (deve dar 0 erros)
npx tsc --noEmit

# Verificar que os módulos exportam corretamente
# Todos os imports em TalhaoDetailModal.tsx usam paths relativos de ../../modules/talhao/
```

**Última verificação:** 2026-02-24 — `tsc --noEmit` passa com 0 erros.

---

## Estrutura de Arquivos do Módulo Talhão

```
src/modules/talhao/
├── index.ts                          # Barrel exports
├── types.ts                          # DrawMode, SelectedVertex, CultureEntry, etc.
├── constants.ts                      # UNCLASSIFIED_SOIL_VALUE, SOIL_COLOR_BY_ORDER
├── utils/
│   ├── geometry.ts                   # flattenPoints, polygonBounds, isPointInsidePolygon, etc.
│   └── formatters.ts                 # normalizeMonthYear, formatMonthYear, normalizeKey, etc.
├── hooks/
│   ├── useTalhaoDrawing.ts           # Estado de desenho + seleção + edição
│   ├── useTalhaoCultures.ts          # Estado de culturas + CRUD + modais
│   └── useTalhaoMapBackground.ts     # Estado de mapa de fundo + busca CEP
└── components/                       # (Fase 3 - a ser criado)
    ├── TalhaoFormCard.tsx
    ├── TalhaoCultureHistory.tsx
    ├── TalhaoDrawingToolbar.tsx
    ├── TalhaoCanvasStage.tsx
    ├── TalhaoMapControls.tsx
    └── TalhaoZoneList.tsx
```
