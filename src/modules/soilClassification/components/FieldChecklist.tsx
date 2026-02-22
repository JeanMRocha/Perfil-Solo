import {
  Accordion,
  Badge,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { useMemo } from 'react';
import type {
  SoilRequestField,
  SoilTriState,
} from '@services/soilClassificationContractService';
import { listSoilChecklistQuestions } from '@services/soilFieldChecklistService';

type FieldChecklistProps = {
  field: SoilRequestField;
  onChange: (next: SoilRequestField) => void;
  disabled?: boolean;
};

function parseNumberInput(value: string | number): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getFieldValue(field: SoilRequestField, fieldKey: string): string | number | null {
  if (fieldKey.startsWith('morph_diag.')) {
    const nested = fieldKey.replace('morph_diag.', '') as keyof SoilRequestField['morph_diag'];
    return field.morph_diag[nested];
  }
  return (field as unknown as Record<string, unknown>)[fieldKey] as string | number | null;
}

function setFieldValue(
  field: SoilRequestField,
  fieldKey: string,
  value: string | number | null,
): SoilRequestField {
  if (fieldKey.startsWith('morph_diag.')) {
    const nested = fieldKey.replace('morph_diag.', '') as keyof SoilRequestField['morph_diag'];
    return {
      ...field,
      morph_diag: {
        ...field.morph_diag,
        [nested]: value as SoilTriState,
      },
    };
  }
  return {
    ...field,
    [fieldKey]: value,
  };
}

function buildSegmentData(values: Array<{ value: string; label: string }>) {
  return values.map((item) => ({ value: item.value, label: item.label }));
}

export function FieldChecklist({
  field,
  onChange,
  disabled = false,
}: FieldChecklistProps) {
  const questions = useMemo(() => listSoilChecklistQuestions(), []);
  const sectionGroups = useMemo(() => {
    const groupMap = new Map<string, typeof questions>();
    for (const question of questions) {
      if (!groupMap.has(question.section)) {
        groupMap.set(question.section, []);
      }
      groupMap.get(question.section)?.push(question);
    }
    return Array.from(groupMap.entries());
  }, [questions]);

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <div>
          <Text fw={700}>Checklist de campo</Text>
          <Text size="sm" c="dimmed">
            Responda por secao para reduzir ambiguidades na classificacao.
          </Text>
        </div>

        <Accordion
          variant="contained"
          radius="md"
          defaultValue={sectionGroups[0]?.[0] ?? null}
          chevronPosition="right"
        >
          {sectionGroups.map(([section, sectionQuestions]) => (
            <Accordion.Item key={section} value={section}>
              <Accordion.Control>
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Text fw={600} size="sm">
                    {section}
                  </Text>
                  <Badge size="xs" variant="light">
                    {sectionQuestions.length} perguntas
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  {sectionQuestions.map((question) => {
                    const currentValue = getFieldValue(field, question.field_key);
                    return (
                      <Paper key={question.id} withBorder p="sm" radius="md">
                        <Stack gap={6}>
                          <div>
                            <Text fw={600} size="sm">
                              {question.question}
                            </Text>
                            <Text size="xs" c="dimmed">
                              Como observar: {question.how_to_observe}
                            </Text>
                          </div>

                          {question.answer_type === 'number_cm' && (
                            <NumberInput
                              size="sm"
                              min={0}
                              value={typeof currentValue === 'number' ? currentValue : undefined}
                              onChange={(value) =>
                                onChange(setFieldValue(field, question.field_key, parseNumberInput(value)))
                              }
                              disabled={disabled}
                              w={190}
                              suffix=" cm"
                            />
                          )}

                          {question.answer_type === 'yes_no' && (
                            <SegmentedControl
                              value={String(currentValue ?? 'no')}
                              data={buildSegmentData([
                                { value: 'yes', label: 'Sim' },
                                { value: 'no', label: 'Não' },
                              ])}
                              onChange={(value) => onChange(setFieldValue(field, question.field_key, value))}
                              disabled={disabled}
                              w={220}
                            />
                          )}

                          {question.answer_type === 'yes_no_unknown' && (
                            <SegmentedControl
                              value={String(currentValue ?? 'unknown')}
                              data={buildSegmentData([
                                { value: 'yes', label: 'Sim' },
                                { value: 'no', label: 'Não' },
                                { value: 'unknown', label: 'Não sei' },
                              ])}
                              onChange={(value) => onChange(setFieldValue(field, question.field_key, value))}
                              disabled={disabled}
                              w={300}
                            />
                          )}

                          {question.answer_type === 'saturation' && (
                            <SegmentedControl
                              value={String(currentValue ?? 'never')}
                              data={buildSegmentData([
                                { value: 'never', label: 'Nunca' },
                                { value: 'sometimes', label: 'Às vezes' },
                                { value: 'permanent', label: 'Permanente' },
                              ])}
                              onChange={(value) => onChange(setFieldValue(field, question.field_key, value))}
                              disabled={disabled}
                              w={360}
                            />
                          )}

                          <Group gap={6}>
                            {question.favors_orders.map((order) => (
                              <Badge key={`${question.id}-fav-${order}`} color="green" variant="light" size="xs">
                                + {order}
                              </Badge>
                            ))}
                            {question.penalizes_orders.map((order) => (
                              <Badge key={`${question.id}-pen-${order}`} color="red" variant="light" size="xs">
                                - {order}
                              </Badge>
                            ))}
                          </Group>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Stack>
    </Paper>
  );
}
