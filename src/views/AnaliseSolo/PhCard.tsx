import {
  Card,
  Group,
  Text,
  NumberInput,
  Badge,
  Stack,
  Box,
} from '@mantine/core';
import { useMemo } from 'react';

type PhCardProps = {
  value: number;
  onChange: (v: number) => void;
  ideal: [number, number];
  barsHeight?: number;
};

const MIN_PH = 0;
const MAX_PH = 14;
// 15 barras (0..14)
const BAR_COUNT = 15;

// cores para cada barra inteira (0..14) — ajuste se quiser outra paleta
const PH_COLORS = [
  '#7a0b00',
  '#a31a00',
  '#c24200',
  '#dd6a00',
  '#f08a00',
  '#f3b000',
  '#cfe18b',
  '#9ee0ac',
  '#6dd8d4',
  '#45b8e6',
  '#2f8fe3',
  '#2768d0',
  '#234eb8',
  '#1d389c',
  '#142a80',
];

function pct(val: number, min = MIN_PH, max = MAX_PH) {
  const cl = Math.max(min, Math.min(max, val));
  return ((cl - min) / (max - min)) * 100;
}

/** Classificação agronômica baseada no quadro que você mandou */
function agronomicClass(ph: number) {
  if (ph < 4.5) return { slug: 'muito_baixo', label: 'Muito baixo' };
  if (ph >= 4.5 && ph <= 5.4) return { slug: 'baixo', label: 'Baixo' };
  if (ph >= 5.5 && ph <= 6.0) return { slug: 'bom', label: 'Bom' };
  if (ph >= 6.1 && ph <= 7.0) return { slug: 'alto', label: 'Alto' };
  return { slug: 'muito_alto', label: 'Muito alto' }; // > 7.0
}

function consequencesText(ph: number) {
  const cl = agronomicClass(ph).slug;
  switch (cl) {
    case 'muito_baixo':
      return 'Muito ácido — forte limitação de nutrientes (Ca, Mg). Calagem urgente e manejo de MO.';
    case 'baixo':
      return 'Ácido — redução de disponibilidade de nutrientes e potencial de produtividade. Considere calagem.';
    case 'bom':
      return 'Faixa adequada para muitas culturas — manter manejo e monitoramento.';
    case 'alto':
      return 'Levemente alcalino — possíveis limitações de micronutrientes. Avaliar necessidade de correções localizadas.';
    case 'muito_alto':
      return 'Alcalino — risco de deficiência de Fe/Mn/Zn. Intervenções específicas podem ser necessárias.';
    default:
      return '';
  }
}

export default function PhCard({
  value,
  onChange,
  ideal,
  barsHeight = 150,
}: PhCardProps) {
  const [idealMin, idealMax] = ideal;

  const status = useMemo<'baixo' | 'ideal' | 'alto'>(() => {
    if (value < idealMin) return 'baixo';
    if (value > idealMax) return 'alto';
    return 'ideal';
  }, [value, idealMin, idealMax]);

  const statusColor =
    status === 'ideal' ? 'green' : status === 'baixo' ? 'red' : 'blue';
  const statusLabel =
    status === 'ideal' ? 'IDEAL' : status === 'baixo' ? 'ÁCIDO' : 'ALCALINO';

  // labels inteiros 0..14
  const integerLabels = useMemo(
    () => Array.from({ length: BAR_COUNT }, (_, i) => MIN_PH + i),
    [],
  );

  const agrClass = agronomicClass(value);
  const consequence = consequencesText(value);

  return (
    <Card withBorder radius="md" p="md">
      <Group position="apart" mb="xs">
        <Group>
          <Text fw={700}>pH</Text>
          <Badge variant="light">UNID.</Badge>
          <Badge color={statusColor}>{statusLabel}</Badge>
        </Group>

        <NumberInput
          value={value}
          onChange={(v) => onChange(Number(v || 0))}
          step={0.1}
          precision={1}
          min={MIN_PH}
          max={MAX_PH}
          maw={120}
        />
      </Group>

      {/* escala / barras */}
      <div
        style={{
          position: 'relative',
          height: barsHeight,
          marginTop: 6,
          marginBottom: 8, // espaço menor aqui — labels estarão fora em fluxo normal
        }}
      >
        {/* grade de barras — gap 0 para ficarem coladas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${BAR_COUNT}, 1fr)`,
            height: '100%',
            gap: 0,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {PH_COLORS.slice(0, BAR_COUNT).map((c, i) => {
            // borda arredondada só nas extremidades para suavizar
            const style: React.CSSProperties = {
              background: c,
              height: '100%',
              display: 'block',
            };
            if (i === 0) style.borderTopLeftRadius = 8;
            if (i === BAR_COUNT - 1) style.borderTopRightRadius = 8;
            return <div key={i} style={style} />;
          })}
        </div>

        {/* overlay faixa ideal */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${pct(idealMin)}%`,
            width: `${pct(idealMax) - pct(idealMin)}%`,
            background: 'rgba(16,185,129,0.09)',
            border: '1px solid rgba(16,185,129,0.18)',
            pointerEvents: 'none',
            borderRadius: 6,
          }}
        />

        {/* marcas inteiras (linha leve) - alinhadas ao centro de cada barra */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
          {integerLabels.map((n, i) => {
            // centro da barra i: (i + 0.5) / BAR_COUNT
            const leftPct = (i / BAR_COUNT) * 108;
            return (
              <div
                key={`mark-${i}`}
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  top: 8,
                  bottom: 36,
                  width: 3,
                  transform: 'translateX(-50%)',
                  background: 'rgba(255,255,255,0.85)',
                }}
              />
            );
          })}
        </div>

        {/* plantinha — central verticalmente, horizontal conforme valor */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${pct(value)}%)`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            transition: 'left 220ms ease',
            zIndex: 6,
          }}
        >
          {/* Plant SVG */}
          <svg
            width="36"
            height="36"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g>
              <path
                d="M32 6c6 6 12 10 20 10-4 6-10 10-20 18-10-8-16-12-20-18 8 0 14-4 20-10z"
                fill="#fff"
                opacity="0.9"
              />
              <path
                d="M32 6c6 6 12 10 20 10-4 6-10 10-20 18-10-8-16-12-20-18 8 0 14-4 20-10z"
                fill={
                  status === 'ideal'
                    ? '#10B981'
                    : status === 'baixo'
                      ? '#ef4444'
                      : '#2563eb'
                }
                opacity="1"
                stroke="#123"
                strokeWidth="0.6"
              />
              <rect
                x="29.5"
                y="26"
                width="5"
                height="14"
                rx="2"
                fill="#3b3b3b"
                opacity="0.9"
              />
            </g>
          </svg>

          {/* etiqueta pequena com o valor — abaixo da plantinha */}
          <div
            style={{
              marginTop: 2,
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              fontSize: 16,
              padding: '3px 6px',
              borderRadius: 10,
              transform: 'translateY(0)',
            }}
          >
            {value.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Labels inteiros em grid alinhado às barras (sem overlap) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${BAR_COUNT}, 1fr)`,
          gap: 0,
          padding: '0 0px',
          marginBottom: 8,
          pointerEvents: 'none',
        }}
      >
        {integerLabels.map((n, i) => (
          <div
            key={`lbl-${i}`}
            style={{
              fontSize: 11,
              color: 'rgba(0,0,0,0.75)',
              textAlign: 'center',
            }}
          >
            {n}
          </div>
        ))}
      </div>

      {/* Três linhas informativas abaixo da escala */}
      <Stack spacing={2}>
        {/* 1) Faixa ideal */}
        <Text size="sm" style={{ color: '#059669', fontWeight: 600 }}>
          Faixa ideal: {idealMin} – {idealMax}
        </Text>

        {/* 2) Classificação agronômica */}
        <Text size="sm" style={{ fontWeight: 600 }}>
          Classificação agronômica: {agrClass.label}
        </Text>

        {/* 3) Consequências / recomendações curtas */}
        <Text size="sm" color="dimmed">
          {consequence}
        </Text>
      </Stack>
    </Card>
  );
}
