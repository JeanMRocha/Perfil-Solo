# Plano de Refatoração — `TalhaoDetailModal` e Módulo `Propriedades`

## Resumo do Problema

O arquivo `TalhaoDetailModal.tsx` atingiu **~2900 linhas** e **~107 KB**, com múltiplas responsabilidades misturadas num único componente:

| Responsabilidade                                           | Linhas Aprox. | Tipo        |
| ---------------------------------------------------------- | ------------- | ----------- |
| Tipos e constantes (DrawMode, CultureEntry, cores...)      | ~130          | Tipo/Dado   |
| Funções de geometria pura (polygon check, midpoint...)     | ~120          | Lógica pura |
| Funções de format/normalize                                | ~80           | Utilitário  |
| Estado do talhão (nome, area, solo, culturas)              | ~200          | Estado      |
| Estado de desenho (mainPoints, zones, drawMode...)         | ~150          | Estado      |
| Lógica de desenho (start, finish, cancel, move anchors...) | ~500          | Lógica      |
| Lógica de culturas (CRUD, modais)                          | ~250          | Lógica      |
| Lógica de classificação de solo                            | ~80           | Lógica      |
| Lógica de mapa de fundo (busca CEP, camadas)               | ~120          | Lógica      |
| Lógica de persistência (save, persistDrawingOnly)          | ~100          | Lógica      |
| Renderização do formulário (nome, area, solo, culturas)    | ~300          | UI          |
| Renderização do canvas de desenho (Stage, Layer, Circles)  | ~400          | UI          |
| Modais auxiliares (cultura, classificação, guard)          | ~200          | UI          |
| **Total**                                                  | **~2630+**    |             |

Padrão já estabelecido no projeto:

- `src/hooks/` → hooks reutilizáveis (ex: `useCulture.ts`)
- `src/modules/` → módulos de domínio com componentes + lógica (ex: `geo/`, `soilClassification/`)
- `src/services/` → serviços de dados puros (ex: `propertyMapService.ts`)
- `src/types/` → interfaces de domínio

---

## Estrutura Proposta

```
src/
├── components/Propriedades/
│   ├── TalhaoDetailModal.tsx          # ~200 linhas (orquestrador)
│   ├── PropertyDeleteGuardModal.tsx   # (já existe)
│   └── PropertyFullModal.tsx          # (já existe)
│
├── modules/talhao/                    # NOVO módulo de domínio
│   ├── index.ts                       # Barrel exports
│   ├── types.ts                       # DrawMode, SelectedVertex, CultureEntry etc.
│   ├── constants.ts                   # Cores de solo, labels, defaults
│   │
│   ├── hooks/
│   │   ├── useTalhaoForm.ts           # Estado e lógica do formulário (nome, area, solo)
│   │   ├── useTalhaoDrawing.ts        # Estado e lógica de desenho (canvas)
│   │   ├── useTalhaoCultures.ts       # Estado e lógica de culturas
│   │   ├── useTalhaoMapBackground.ts  # Estado e lógica do fundo de mapa
│   │   └── useTalhaoPersistence.ts    # Persistência (save, persistDrawingOnly)
│   │
│   ├── components/
│   │   ├── TalhaoFormCard.tsx          # Card de informações gerais
│   │   ├── TalhaoCulturesCard.tsx     # Card de histórico de culturas
│   │   ├── TalhaoMapPreviewCard.tsx   # Card de preview do mapa (sidebar)
│   │   ├── TalhaoDrawingEditor.tsx    # Editor de desenho (canvas + toolbar)
│   │   ├── TalhaoExclusionZoneList.tsx # Lista de zonas de exclusão
│   │   ├── TalhaoDrawingToolbar.tsx   # Barra de ferramentas do desenho
│   │   ├── TalhaoCanvasStage.tsx      # Wrapper do Stage do Konva
│   │   └── CultureModals.tsx         # Modais de cultura (edit + link)
│   │
│   └── utils/
│       ├── geometry.ts                # flattenPoints, polygon checks, midpoint etc.
│       └── formatters.ts             # normalizeMonthYear, formatMonthYear, normalizeKey
│
├── services/
│   └── propertyMapService.ts          # (já existe, tipos ExclusionZone etc.)
│
└── types/
    └── property.ts                    # (já existe)
```

---

## Etapas de Execução

### Fase 1 — Extrair o que NÃO depende de React (lógica pura)

**1.1 `modules/talhao/types.ts`**
Mover: `DrawMode`, `CultureModalMode`, `SelectedVertex`, `CultureEntry`

**1.2 `modules/talhao/constants.ts`**
Mover: `UNCLASSIFIED_SOIL_VALUE`, `UNCLASSIFIED_SOIL_LABEL`, `DEFAULT_SOIL_LINKED_COLOR`, `SOIL_COLOR_BY_ORDER`

**1.3 `modules/talhao/utils/geometry.ts`**
Mover: `flattenPoints`, `polygonBounds`, `isPointOnSegment`, `isPointInsidePolygon`, `signedArea2`, `isProperSegmentIntersection`, `isSegmentInsidePolygon`, `isPolygonInsidePolygon`, `midpoint`, `geoPointToCanvasPoint`

**1.4 `modules/talhao/utils/formatters.ts`**
Mover: `normalizeMonthYear`, `monthYearOrder`, `formatMonthYear`, `normalizeKey`, `isUnclassifiedSoilValue`, `resolveSoilLinkedColor`, `normalizeGeoLayerId`

### Fase 2 — Extrair hooks de estado + lógica

**2.1 `modules/talhao/hooks/useTalhaoForm.ts`**

- Estado: `nome`, `areaHa`, `tipoSolo`, `currentCulture`
- Derivados: `soilOptions`, `selectedSoil`, `resolvedTalhaoColor`, `lastClassificationSummary`
- Inits dos efeitos de carregamento do talhão
- Retorno tipado para o componente consumir

**2.2 `modules/talhao/hooks/useTalhaoDrawing.ts`**

- Estado: `drawMode`, `mainPoints`, `zones`, `currentPoints`, `mousePos`, `selectedVertex`, `selectedZoneIndex`, `selectedMainPolygon`
- Funções: `startMainDrawing`, `startZoneDrawing`, `cancelDrawing`, `finishDrawing`, `handleStageClick`, `handleMouseMove`, `handleCloseWithRightClick`, `removeSelectedZone`, `removeMainPolygon`, `clearSelectedVertex`, `toggleMainPolygonSelection`, `toggleZoneSelection`, `selectMainVertex`, `selectZoneVertex`, `removeSelectedVertex`, `removeCurrentSelection`, `moveMainAnchor`, `moveZoneAnchor`, `moveCurrentAnchor`, `insertMainPointAfter`, `insertZonePointAfter`, `updateZoneName`

**2.3 `modules/talhao/hooks/useTalhaoCultures.ts`**

- Estado: `cultures`, `cultureDraft`, `cultureModalOpened`, `cultureModalMode`, `cultureLinkModalOpened`, `editingCultureIdx`
- Funções: todas as de CRUD de cultura (open, close, save, remove, duplicate, handleLinkFromRnc)

**2.4 `modules/talhao/hooks/useTalhaoMapBackground.ts`**

- Estado: `mapSearchValue`, `mapSearchLoading`, `mapCenter`, `mapZoom`, `mapLayerId`, `mapInteractive`, `pointSearchValue`
- Funções: `applyRealMapBackground`, `clearRealMapBackground`, `handleRealMapViewChange`, `addPointFromCoordinates`

**2.5 `modules/talhao/hooks/useTalhaoPersistence.ts`**

- Estado: `saving`, `emptyAreaGuardOpened`, `emptyAreaGuardReason`, `deletingEmptyTalhao`
- Funções: `save`, `persistDrawingOnly`, `handleRequestClose`, `deleteEmptyTalhao`

### Fase 3 — Extrair componentes de UI

**3.1 `modules/talhao/components/TalhaoFormCard.tsx`**
Card de informações gerais: nome, área, classe de solo

**3.2 `modules/talhao/components/TalhaoCulturesCard.tsx`**
Card com tabela de culturas + botões

**3.3 `modules/talhao/components/TalhaoMapPreviewCard.tsx`**
Card lateral com miniatura do mapa e botão "Editar Croqui"

**3.4 `modules/talhao/components/TalhaoDrawingEditor.tsx`**
Componente completo do editor de desenho (toolbar + canvas + lista de zonas)

**3.5 `modules/talhao/components/TalhaoExclusionZoneList.tsx`**
Lista de zonas de exclusão com rename e delete

**3.6 `modules/talhao/components/TalhaoDrawingToolbar.tsx`**
Barra de ferramentas do editor (busca, camadas, ferramentas de desenho)

**3.7 `modules/talhao/components/TalhaoCanvasStage.tsx`**
Wrapper do react-konva Stage com toda a renderização de shapes

**3.8 `modules/talhao/components/CultureModals.tsx`**
Modais de edição e vinculação de cultura

### Fase 4 — Recompor o `TalhaoDetailModal.tsx`

O componente principal vira um **orquestrador fino** (~200 linhas):

```tsx
export function TalhaoDetailModal({
  opened,
  talhao,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const form = useTalhaoForm(talhao);
  const drawing = useTalhaoDrawing(talhao);
  const cultures = useTalhaoCultures(talhao);
  const mapBg = useTalhaoMapBackground();
  const persistence = useTalhaoPersistence({
    form,
    drawing,
    cultures,
    mapBg,
    talhao,
    onSaved,
    onDeleted,
    onClose,
  });

  const [showMapEditor, setShowMapEditor] = useState(false);

  return (
    <Dialog open={opened}>
      <DialogContent>
        <DialogHeader>...</DialogHeader>
        <ScrollArea>
          {!showMapEditor ? (
            <TalhaoFormView
              form={form}
              cultures={cultures}
              drawing={drawing}
              onOpenMapEditor={() => setShowMapEditor(true)}
            />
          ) : (
            <TalhaoDrawingEditor
              drawing={drawing}
              mapBg={mapBg}
              onBack={() => setShowMapEditor(false)}
            />
          )}
        </ScrollArea>
        <DialogFooter>...</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Princípios Seguidos

1. **Single Responsibility** — cada hook/componente tem uma responsabilidade clara
2. **Colocação** — tudo do domínio "talhão" fica em `modules/talhao/`
3. **Consistência** — segue o padrão já existente em `modules/geo/`, `modules/soilClassification/`
4. **Testabilidade** — lógica pura separada em `utils/` é trivialmente testável
5. **Hooks composáveis** — cada hook retorna uma interface tipada que o componente consome
6. **Componentes focados** — cada card/seção é um componente independente e reutilizável

---

## Ordem de Execução Recomendada

1. **Fase 1** primeiro (zero risco, apenas mover funções)
2. **Fase 2** em seguida (extrair hooks um a um, testar entre cada)
3. **Fase 3** depois (extrair UI, usando os hooks da Fase 2)
4. **Fase 4** por último (recompor o orquestrador)

Cada fase pode ser feita incrementalmente — o projeto compila entre cada passo.
