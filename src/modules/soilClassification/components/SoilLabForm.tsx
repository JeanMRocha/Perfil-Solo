import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import type { SoilRequestLayer } from '@services/soilClassificationContractService';

type SoilLabFormProps = {
  layers: SoilRequestLayer[];
  onChange: (next: SoilRequestLayer[]) => void;
  disabled?: boolean;
};

function parseNumberInput(value: string | number): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createEmptyLayer(lastBottom?: number): SoilRequestLayer {
  const top = Number.isFinite(lastBottom) ? Number(lastBottom) : 0;
  return {
    top_cm: top,
    bottom_cm: top + 20,
    texture: {
      clay_pct: null,
      sand_pct: null,
      silt_pct: null,
    },
    chem: {
      ph_h2o: null,
      ph_kcl: null,
      ca: null,
      mg: null,
      k: null,
      na: null,
      al: null,
      h_al: null,
      p: null,
      om_pct: null,
      c_org_pct: null,
      ec_dS_m: null,
    },
  };
}

export function SoilLabForm({ layers, onChange, disabled = false }: SoilLabFormProps) {
  function updateLayer(
    index: number,
    patch: Partial<SoilRequestLayer>,
  ) {
    const next = layers.map((layer, idx) => {
      if (idx !== index) return layer;
      return {
        ...layer,
        ...patch,
      };
    });
    onChange(next);
  }

  function updateLayerTexture(
    index: number,
    key: keyof SoilRequestLayer['texture'],
    value: number | null,
  ) {
    const current = layers[index];
    if (!current) return;
    updateLayer(index, {
      texture: {
        ...current.texture,
        [key]: value,
      },
    });
  }

  function updateLayerChem(
    index: number,
    key: keyof SoilRequestLayer['chem'],
    value: number | null,
  ) {
    const current = layers[index];
    if (!current) return;
    updateLayer(index, {
      chem: {
        ...current.chem,
        [key]: value,
      },
    });
  }

  function addLayer() {
    const last = layers[layers.length - 1];
    onChange([...layers, createEmptyLayer(last?.bottom_cm)]);
  }

  function removeLayer(index: number) {
    if (layers.length <= 1) return;
    onChange(layers.filter((_, idx) => idx !== index));
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={700}>Laboratorio por camadas</Text>
            <Text size="sm" c="dimmed">
              Preencha textura e quimica por profundidade para elevar a confianca da classificacao.
            </Text>
          </div>
          <Button
            leftSection={<IconPlus size={16} />}
            size="xs"
            onClick={addLayer}
            disabled={disabled}
          >
            Adicionar camada
          </Button>
        </Group>

        <Table.ScrollContainer minWidth={1080}>
          <Table striped withTableBorder highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Camada (cm)</Table.Th>
                <Table.Th>Argila %</Table.Th>
                <Table.Th>Areia %</Table.Th>
                <Table.Th>Silte %</Table.Th>
                <Table.Th>pH H2O</Table.Th>
                <Table.Th>Ca</Table.Th>
                <Table.Th>Mg</Table.Th>
                <Table.Th>K</Table.Th>
                <Table.Th>Al</Table.Th>
                <Table.Th>H+Al</Table.Th>
                <Table.Th>P</Table.Th>
                <Table.Th>MO %</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {layers.map((layer, index) => (
                <Table.Tr key={`soil-layer-${index}`}>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <NumberInput
                        size="xs"
                        min={0}
                        value={layer.top_cm}
                        onChange={(v) => updateLayer(index, { top_cm: parseNumberInput(v) ?? 0 })}
                        w={64}
                        disabled={disabled}
                      />
                      <Text size="xs">-</Text>
                      <NumberInput
                        size="xs"
                        min={0}
                        value={layer.bottom_cm}
                        onChange={(v) => updateLayer(index, { bottom_cm: parseNumberInput(v) ?? 0 })}
                        w={64}
                        disabled={disabled}
                      />
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      value={layer.texture.clay_pct ?? undefined}
                      onChange={(v) => updateLayerTexture(index, 'clay_pct', parseNumberInput(v))}
                      disabled={disabled}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      value={layer.texture.sand_pct ?? undefined}
                      onChange={(v) => updateLayerTexture(index, 'sand_pct', parseNumberInput(v))}
                      disabled={disabled}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      value={layer.texture.silt_pct ?? undefined}
                      onChange={(v) => updateLayerTexture(index, 'silt_pct', parseNumberInput(v))}
                      disabled={disabled}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      decimalScale={2}
                      value={layer.chem.ph_h2o ?? undefined}
                      onChange={(v) => updateLayerChem(index, 'ph_h2o', parseNumberInput(v))}
                      disabled={disabled}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      decimalScale={2}
                      value={layer.chem.ca ?? undefined}
                      onChange={(v) => updateLayerChem(index, 'ca', parseNumberInput(v))}
                      disabled={disabled}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      decimalScale={2}
                      value={layer.chem.mg ?? undefined}
                      onChange={(v) => updateLayerChem(index, 'mg', parseNumberInput(v))}
                      disabled={disabled}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      decimalScale={2}
                      value={layer.chem.k ?? undefined}
                      onChange={(v) => updateLayerChem(index, 'k', parseNumberInput(v))}
                      disabled={disabled}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      decimalScale={2}
                      value={layer.chem.al ?? undefined}
                      onChange={(v) => updateLayerChem(index, 'al', parseNumberInput(v))}
                      disabled={disabled}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      decimalScale={2}
                      value={layer.chem.h_al ?? undefined}
                      onChange={(v) => updateLayerChem(index, 'h_al', parseNumberInput(v))}
                      disabled={disabled}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      decimalScale={2}
                      value={layer.chem.p ?? undefined}
                      onChange={(v) => updateLayerChem(index, 'p', parseNumberInput(v))}
                      disabled={disabled}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      decimalScale={2}
                      value={layer.chem.om_pct ?? undefined}
                      onChange={(v) => updateLayerChem(index, 'om_pct', parseNumberInput(v))}
                      disabled={disabled}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      color="red"
                      variant="light"
                      onClick={() => removeLayer(index)}
                      disabled={disabled || layers.length <= 1}
                      aria-label="Remover camada"
                    >
                      <IconTrash size={15} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </Paper>
  );
}
