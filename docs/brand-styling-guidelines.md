# Brand Styling Guidelines

## Objetivo
Centralizar a identidade visual para:
- manter contraste consistente (light/dark),
- reduzir cores hardcoded espalhadas,
- facilitar personalizacao futura por marca.

## Fonte unica de verdade
Arquivo: `src/mantine/brand.ts`

Esse arquivo concentra:
- escalas de cor da marca (`BRAND_COLORS`, `BRAND_ACCENT_COLORS`),
- paleta semantica por modo (`getBrandPalette`),
- cores especificas de header/footer/creditos.

Persistencia de personalizacao:
- `src/services/brandThemeService.ts` (overrides por modo + eventos)

## Uso recomendado
1. Para cores do sistema:
`const palette = getBrandPalette(tema);`

2. Usar tokens semanticos:
- `palette.header.background`
- `palette.header.border`
- `palette.credits.textPurchased`
- `palette.credits.ringPromotional`

3. Evitar:
- `green.4`, `blue.4`, hex direto em componentes de layout global.

## Onde ja foi aplicado
- `src/mantine/theme.ts`
- `src/views/Main/AppLayout.tsx`
- `src/views/Main/components/HeaderBar.tsx`
- `src/components/layout/HeaderCreditsSummary.tsx`
- `src/components/PageHeader.tsx`

## Tela de personalizacao
- Rota: `/config/aparencia`
- Acesso: menu hamburguer > `Aparencia`
- Escopo atual: header, menu, footer, tipografia, botoes principais e creditos.
- Restricao: identidade da marca bloqueada (nome, logotipo e tokens proprietarios da marca).

## Como personalizar a marca depois
1. Ajustar as escalas em `BRAND_COLORS` e `BRAND_ACCENT_COLORS`.
2. Ajustar contraste nos objetos `LIGHT_PALETTE` e `DARK_PALETTE`.
3. Validar visualmente no header e tooltip de creditos.
4. Rodar `npm run build`.
