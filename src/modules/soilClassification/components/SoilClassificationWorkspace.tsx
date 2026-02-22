import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import {
  classifySoilByContract,
  type SoilClassificationRequest,
  type SoilClassificationValidation,
  type SoilResultResponse,
} from '@services/soilClassificationContractService';
import { createDefaultSoilClassificationRequest } from '../defaults';
import type { SoilClassificationWorkspaceProps } from '../types';
import { FieldChecklist } from './FieldChecklist';
import { RuleEngineReport } from './RuleEngineReport';
import { SoilLabForm } from './SoilLabForm';

export function SoilClassificationWorkspace({
  initialRequest,
  onRequestChange,
  onResult,
}: SoilClassificationWorkspaceProps) {
  const [request, setRequest] = useState<SoilClassificationRequest>(
    initialRequest ?? createDefaultSoilClassificationRequest(),
  );
  const [response, setResponse] = useState<SoilResultResponse | null>(null);
  const [validation, setValidation] = useState<SoilClassificationValidation | null>(null);

  useEffect(() => {
    if (!initialRequest) return;
    setRequest(initialRequest);
  }, [initialRequest]);

  useEffect(() => {
    onRequestChange?.(request);
  }, [onRequestChange, request]);

  function runClassification() {
    const result = classifySoilByContract(request);
    setValidation(result.validation);
    setResponse(result.response);
    onResult?.(result.response);
  }

  const checklistAnswered = [
    request.field.histic_thickness_cm,
    request.field.contact_rock_cm,
    request.field.water_saturation,
    request.field.gley_matrix,
    request.field.mottles,
    request.field.plinthite_or_petroplinthite,
    request.field.petroplinthite_continuous,
    request.field.seasonal_cracks,
    request.field.slickensides,
    request.field.eluvial_E_horizon,
    request.field.dense_planic_layer_Bpl,
    request.field.fluvial_stratification,
    request.field.morph_diag.has_Bt,
    request.field.morph_diag.has_Bi,
    request.field.morph_diag.has_Bw,
    request.field.morph_diag.has_Bn,
    request.field.morph_diag.has_A_chernozemic,
  ].filter((value) => {
    if (typeof value === 'number') return true;
    if (value == null) return false;
    if (typeof value === 'string') {
      return value !== 'unknown' && value !== 'never';
    }
    return true;
  }).length;

  return (
    <Stack gap="sm">
      <Paper withBorder p="md" radius="md">
        <Stack gap={8}>
          <Group justify="space-between" align="center">
            <div>
              <Text fw={700}>Classificador SiBCS</Text>
              <Text size="sm" c="dimmed">
                Triagem tecnica por laboratorio + checklist de campo.
              </Text>
            </div>
            <Group gap={8}>
              <Badge variant="light">Camadas: {request.lab_layers.length}</Badge>
              <Badge variant="light" color="teal">
                Checklist: {checklistAnswered}/17
              </Badge>
            </Group>
          </Group>

          <Divider />

          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, md: 4 }}>
              <TextInput
                label="Laboratorio"
                placeholder="Nome do laboratorio"
                size="sm"
                value={request.meta.lab_name ?? ''}
                onChange={(event) =>
                  setRequest((prev) => ({
                    ...prev,
                    meta: { ...prev.meta, lab_name: event.currentTarget.value || null },
                  }))
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Select
                label="Metodo P"
                size="sm"
                value={request.meta.lab_method_p}
                data={[
                  { value: 'mehlich', label: 'Mehlich' },
                  { value: 'resina', label: 'Resina' },
                  { value: 'outro', label: 'Outro' },
                  { value: 'nao_informado', label: 'Não informado' },
                ]}
                onChange={(value) =>
                  setRequest((prev) => ({
                    ...prev,
                    meta: {
                      ...prev.meta,
                      lab_method_p:
                        (value as SoilClassificationRequest['meta']['lab_method_p']) ?? 'nao_informado',
                    },
                  }))
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Select
                label="Bioma (opcional)"
                size="sm"
                value={request.meta.location.biome_hint}
                clearable
                data={[
                  { value: 'amazonia', label: 'Amazonia' },
                  { value: 'cerrado', label: 'Cerrado' },
                  { value: 'caatinga', label: 'Caatinga' },
                  { value: 'mata_atlantica', label: 'Mata Atlantica' },
                  { value: 'pampa', label: 'Pampa' },
                  { value: 'pantanal', label: 'Pantanal' },
                ]}
                onChange={(value) =>
                  setRequest((prev) => ({
                    ...prev,
                    meta: {
                      ...prev.meta,
                      location: {
                        ...prev.meta.location,
                        biome_hint:
                          (value as SoilClassificationRequest['meta']['location']['biome_hint']) ?? null,
                      },
                    },
                  }))
                }
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end">
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                setRequest(createDefaultSoilClassificationRequest());
                setResponse(null);
                setValidation(null);
              }}
            >
              Limpar
            </Button>
            <Button size="sm" onClick={runClassification}>
              Classificar solo
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Grid gutter="md" align="start">
        <Grid.Col span={{ base: 12, xl: 8 }}>
          <Tabs defaultValue="lab" variant="outline" radius="md" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="lab">Laboratorio</Tabs.Tab>
              <Tabs.Tab value="campo">Checklist de campo</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="lab" pt="sm">
              <SoilLabForm
                layers={request.lab_layers}
                onChange={(layers) => setRequest((prev) => ({ ...prev, lab_layers: layers }))}
              />
            </Tabs.Panel>

            <Tabs.Panel value="campo" pt="sm">
              <FieldChecklist
                field={request.field}
                onChange={(field) => setRequest((prev) => ({ ...prev, field }))}
              />
            </Tabs.Panel>
          </Tabs>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xl: 4 }}>
          <div style={{ position: 'sticky', top: 8 }}>
            <RuleEngineReport response={response} validation={validation} />
          </div>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
