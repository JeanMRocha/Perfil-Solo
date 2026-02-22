import {
  Box,
  Button,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconEdit,
  IconFileExport,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import type { Talhao } from '../../../types/property';

export type TalhaoSelectionRow = Talhao & {
  analysesCount: number;
};

type TalhaoSelectorModalProps = {
  opened: boolean;
  onClose: () => void;
  propertyName: string;
  tema: string;
  loading: boolean;
  loadError: string | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  rows: TalhaoSelectionRow[];
  selectedTalhaoId: string | null;
  onSelectTalhao: (talhaoId: string) => void;
  onExport: () => void;
  onCreateTalhao: () => void;
  onEditTalhao: (talhaoId: string) => void;
  onDeleteTalhao: (row: TalhaoSelectionRow) => void;
  onRetryLoad: () => void;
};

function formatAreaHa(value: number | null | undefined): string {
  const safeValue = Number(value ?? 0);
  if (!Number.isFinite(safeValue) || safeValue <= 0) return '0,00';
  return safeValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isPositiveNumber(value: unknown): boolean {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0;
}

function normalizeKey(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isUnclassifiedSoil(value?: string | null): boolean {
  const normalized = normalizeKey(value);
  return (
    normalized === 'nao classificado' || normalized === '__nao_classificado__'
  );
}

export default function TalhaoSelectorModal({
  opened,
  onClose,
  propertyName,
  tema,
  loading,
  loadError,
  searchValue,
  onSearchChange,
  rows,
  selectedTalhaoId,
  onSelectTalhao,
  onExport,
  onCreateTalhao,
  onEditTalhao,
  onDeleteTalhao,
  onRetryLoad,
}: TalhaoSelectorModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="clamp(320px, 92vw, 760px)"
      radius="md"
      withCloseButton
      title={`Talhões de ${propertyName}`}
    >
      <Stack gap="xs">
        <Group align="center" wrap="wrap" gap="xs">
          <TextInput
            leftSection={<IconSearch size={14} />}
            placeholder="Buscar talhão por nome"
            value={searchValue}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
            disabled={loading}
          />
          <Button
            variant="light"
            color="blue"
            leftSection={<IconFileExport size={14} />}
            onClick={onExport}
            radius="md"
            disabled={loading}
            title="Exportar propriedades/talhões/análises em PDF"
          >
            Exportar
          </Button>
          <Button
            leftSection={<IconPlus size={14} />}
            onClick={onCreateTalhao}
            radius="md"
            disabled={loading}
          >
            Cadastrar
          </Button>
        </Group>

        {loading ? (
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Carregando talhões...
            </Text>
          </Group>
        ) : loadError ? (
          <Stack gap={6}>
            <Text size="sm" c="red">
              {loadError}
            </Text>
            <Button variant="light" size="xs" onClick={onRetryLoad}>
              Tentar novamente
            </Button>
          </Stack>
        ) : rows.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nenhum talhão encontrado para esta propriedade.
          </Text>
        ) : (
          <ScrollArea.Autosize mah="52vh" type="always">
            <Stack gap={6} pr={2}>
              {rows.map((row) => {
                const selected = row.id === selectedTalhaoId;
                const tipoSoloRaw = String(row.tipo_solo ?? '').trim();
                const tipoSolo =
                  tipoSoloRaw && !isUnclassifiedSoil(tipoSoloRaw) ? tipoSoloRaw : '';
                const rowMetaParts: string[] = [];
                if (isPositiveNumber(row.area_ha)) {
                  rowMetaParts.push(`Área: ${formatAreaHa(row.area_ha)} ha`);
                }
                if (tipoSolo) {
                  rowMetaParts.push(`Solo: ${tipoSolo}`);
                }
                if (row.analysesCount > 0) {
                  rowMetaParts.push(`Análises: ${row.analysesCount}`);
                }
                return (
                  <Box
                    key={row.id}
                    style={{
                      borderRadius: 10,
                      border:
                        tema === 'dark'
                          ? '1px solid rgba(100, 116, 139, 0.35)'
                          : '1px solid rgba(148, 163, 184, 0.45)',
                      background:
                        selected
                          ? tema === 'dark'
                            ? 'rgba(14, 165, 233, 0.16)'
                            : 'rgba(14, 165, 233, 0.1)'
                          : tema === 'dark'
                            ? 'rgba(15, 23, 42, 0.34)'
                            : 'rgba(248, 250, 252, 0.9)',
                      padding: '7px 8px',
                    }}
                  >
                    <Group justify="space-between" wrap="wrap" gap={6}>
                      <Text
                        fw={selected ? 700 : 600}
                        size="sm"
                        c={selected ? 'cyan' : undefined}
                        style={{
                          minWidth: 140,
                          maxWidth: 240,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {row.nome}
                      </Text>
                      {rowMetaParts.length > 0 ? (
                        <Text size="xs" c="dimmed">
                          {rowMetaParts.join(' | ')}
                        </Text>
                      ) : null}
                      <Group gap={6} wrap="wrap">
                        <Button
                          size="xs"
                          variant={selected ? 'filled' : 'light'}
                          color={selected ? 'cyan' : 'gray'}
                          onClick={() => onSelectTalhao(row.id)}
                        >
                          {selected ? 'Ativo' : 'Selecionar'}
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="indigo"
                          leftSection={<IconEdit size={14} />}
                          onClick={() => onEditTalhao(row.id)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => onDeleteTalhao(row)}
                        >
                          Excluir
                        </Button>
                      </Group>
                    </Group>
                  </Box>
                );
              })}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Stack>
    </Modal>
  );
}
