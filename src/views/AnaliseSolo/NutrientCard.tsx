import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import {
  Card,
  Group,
  Text,
  NumberInput,
  Badge,
  ActionIcon,
} from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { BarStrip } from './BarStrip';

type NutrientCardProps = {
  name?: string;
  unit?: string;
  value?: number;
  onChange?: (v: number) => void;

  min?: number;
  max?: number; // escala do nutriente
  ideal?: [number, number]; // faixa ideal em unidades do nutriente

  plantHeightAtIdealRatio?: number;
  plantHeightAtEdgesRatio?: number;
};

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

export default function NutrientCard({
  name = 'Nutriente',
  unit,
  value,
  onChange = () => {},
  min = 0,
  max = 100,
  ideal,
  plantHeightAtIdealRatio = 0.5,
  plantHeightAtEdgesRatio = 0.25,
}: NutrientCardProps) {
  const val = typeof value === 'number' ? value : min;

  // Faixa ideal default (25%–50% do range)
  const idealSafe: [number, number] = ideal ?? [
    min + (max - min) * 0.25,
    min + (max - min) * 0.5,
  ];

  // Mapeia a faixa ideal (em unidades) para porcentagem 0..1
  const idealPct: [number, number] = [
    (idealSafe[0] - min) / (max - min),
    (idealSafe[1] - min) / (max - min),
  ];

  // Status/mensagem
  const status =
    val < idealSafe[0] ? 'BAIXO' : val > idealSafe[1] ? 'ALTO' : 'IDEAL';
  const statusColor =
    val < idealSafe[0] ? 'red' : val > idealSafe[1] ? 'violet' : 'green';
  const message =
    status === 'IDEAL'
      ? `${name} adequado — manter manejo.`
      : status === 'BAIXO'
        ? `${name} abaixo — considerar adubação corretiva.`
        : `${name} acima — reduzir dose/ajustar fonte/aplicação.`;

  // % horizontal (0..100) no range total
  const pct = (v: number) => ((clamp(v, min, max) - min) / (max - min)) * 100;

  // Distância relativa ao ideal (0=centro; 1=longe)
  const distanceToIdeal = useMemo(() => {
    const [iMin, iMax] = idealSafe;
    if (val >= iMin && val <= iMax) return 0;
    const d = val < iMin ? iMin - val : val - iMax;
    return clamp(d / ((max - min) / 2), 0, 1);
  }, [val, idealSafe, min, max]);

  // Escala da planta
  const plantScale =
    plantHeightAtEdgesRatio +
    (plantHeightAtIdealRatio - plantHeightAtEdgesRatio) * (1 - distanceToIdeal);

  // Medição da altura das barras (para dimensionar a planta sem tocar nas barras)
  const barsRef = useRef<HTMLDivElement | null>(null);
  const [barH, setBarH] = useState(96);

  useLayoutEffect(() => {
    const el = barsRef.current;
    if (!el) return;
    const measure = () => {
      const firstBar = el.querySelector('div');
      const h = firstBar
        ? Number(getComputedStyle(firstBar).height.replace('px', ''))
        : 96;
      setBarH(h || 96);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plantBasePx = barH;
  const leftOffset = `calc(${pct(val)}% - ${plantBasePx / 2}px)`;

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      p="md"
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Cabeçalho */}
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <Text fw={700}>{name}</Text>
          {unit && (
            <Badge variant="light" color="gray">
              {unit}
            </Badge>
          )}
          <Badge variant="filled" color={statusColor}>
            {status}
          </Badge>
        </Group>

        <Group gap="xs">
          <NumberInput
            value={val}
            onChange={(v) => onChange(Number(v) || 0)}
            min={min}
            max={max}
            step={(max - min) / 100}
            decimalScale={2}
            clampBehavior="strict"
            size="sm"
            w={110}
          />
          <ActionIcon
            variant="light"
            color="gray"
            aria-label="Mais opções"
            title="Mais opções"
          >
            <IconChevronDown size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Barras — altura/gap FIXOS para todos os cartões */}
      <div style={{ position: 'relative', width: '100%' }}>
        <BarStrip
          ref={barsRef}
          barHeight={96}
          gap={8}
          columns={14}
          idealRangePct={idealPct}
        />

        {/* 🌱 Plantinha sobreposta (não altera barras) */}
        <img
          src="/icons/favicon.svg"
          alt={`${name} indicador`}
          title={`${name}: ${val}`}
          style={{
            position: 'absolute',
            left: leftOffset,
            bottom: 4,
            width: plantBasePx,
            height: plantBasePx,
            transformOrigin: 'bottom center',
            transform: `scale(${plantScale})`,
            transition: 'transform 260ms ease, left 180ms ease',
            filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.35))',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      </div>

      {/* Mensagens */}
      <Text
        mt="sm"
        size="sm"
        c={
          status === 'IDEAL'
            ? 'green.6'
            : status === 'BAIXO'
              ? 'red.6'
              : 'violet.6'
        }
      >
        {message}
      </Text>
      <Text mt={4} size="xs" c="dimmed">
        Faixa ideal configurada: {idealSafe[0]}–{idealSafe[1]} {unit}.
      </Text>
    </Card>
  );
}
