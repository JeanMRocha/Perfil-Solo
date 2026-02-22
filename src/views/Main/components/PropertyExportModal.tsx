import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconFileExport,
  IconSquareCheck,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

export type PropertyExportAnalysisNode = {
  id: string;
  nodeId: string;
  label: string;
};

export type PropertyExportTalhaoNode = {
  id: string;
  nodeId: string;
  label: string;
  analyses: PropertyExportAnalysisNode[];
};

export type PropertyExportPropertyNode = {
  id: string;
  nodeId: string;
  label: string;
  talhoes: PropertyExportTalhaoNode[];
};

type PropertyExportModalProps = {
  opened: boolean;
  onClose: () => void;
  loading: boolean;
  exporting: boolean;
  tree: PropertyExportPropertyNode[];
  selectedNodeIds: string[];
  onSelectedNodeIdsChange: (next: string[]) => void;
  includeSoilClassification: boolean;
  onIncludeSoilClassificationChange: (next: boolean) => void;
  onExport: () => void;
};

function collectAllNodeIds(tree: PropertyExportPropertyNode[]): string[] {
  const ids: string[] = [];
  tree.forEach((property) => {
    ids.push(property.nodeId);
    property.talhoes.forEach((talhao) => {
      ids.push(talhao.nodeId);
      talhao.analyses.forEach((analysis) => ids.push(analysis.nodeId));
    });
  });
  return ids;
}

function normalizeSelection(
  tree: PropertyExportPropertyNode[],
  current: Set<string>,
): Set<string> {
  const next = new Set(current);

  tree.forEach((property) => {
    property.talhoes.forEach((talhao) => {
      if (talhao.analyses.length === 0) return;
      const allAnalysesSelected = talhao.analyses.every((analysis) =>
        next.has(analysis.nodeId),
      );
      if (allAnalysesSelected) {
        next.add(talhao.nodeId);
      } else {
        next.delete(talhao.nodeId);
      }
    });

    if (property.talhoes.length === 0) return;
    const allTalhoesSelected = property.talhoes.every((talhao) =>
      next.has(talhao.nodeId),
    );
    if (allTalhoesSelected) {
      next.add(property.nodeId);
    } else {
      next.delete(property.nodeId);
    }
  });

  return next;
}

export default function PropertyExportModal({
  opened,
  onClose,
  loading,
  exporting,
  tree,
  selectedNodeIds,
  onSelectedNodeIdsChange,
  includeSoilClassification,
  onIncludeSoilClassificationChange,
  onExport,
}: PropertyExportModalProps) {
  const [openPropertyIds, setOpenPropertyIds] = useState<Record<string, boolean>>({});
  const [openTalhaoIds, setOpenTalhaoIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!opened) return;
    const firstPropertyId = tree[0]?.id;
    setOpenPropertyIds(firstPropertyId ? { [firstPropertyId]: true } : {});
    setOpenTalhaoIds({});
  }, [opened, tree]);

  const selectedSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  const selectedPropertyCount = useMemo(
    () => tree.filter((property) => selectedSet.has(property.nodeId)).length,
    [tree, selectedSet],
  );
  const selectedTalhaoCount = useMemo(
    () =>
      tree.reduce(
        (acc, property) =>
          acc + property.talhoes.filter((talhao) => selectedSet.has(talhao.nodeId)).length,
        0,
      ),
    [tree, selectedSet],
  );
  const selectedAnalysisCount = useMemo(
    () =>
      tree.reduce(
        (acc, property) =>
          acc +
          property.talhoes.reduce(
            (talhaoAcc, talhao) =>
              talhaoAcc +
              talhao.analyses.filter((analysis) => selectedSet.has(analysis.nodeId)).length,
            0,
          ),
        0,
      ),
    [tree, selectedSet],
  );

  const canExport = selectedSet.size > 0;

  const updateSelection = (next: Set<string>) => {
    const normalized = normalizeSelection(tree, next);
    onSelectedNodeIdsChange(Array.from(normalized));
  };

  const toggleProperty = (property: PropertyExportPropertyNode, checked: boolean) => {
    const ids = [
      property.nodeId,
      ...property.talhoes.flatMap((talhao) => [
        talhao.nodeId,
        ...talhao.analyses.map((analysis) => analysis.nodeId),
      ]),
    ];
    const next = new Set(selectedSet);
    if (checked) {
      ids.forEach((id) => next.add(id));
    } else {
      ids.forEach((id) => next.delete(id));
    }
    updateSelection(next);
  };

  const toggleTalhao = (talhao: PropertyExportTalhaoNode, checked: boolean) => {
    const ids = [talhao.nodeId, ...talhao.analyses.map((analysis) => analysis.nodeId)];
    const next = new Set(selectedSet);
    if (checked) {
      ids.forEach((id) => next.add(id));
    } else {
      ids.forEach((id) => next.delete(id));
    }
    updateSelection(next);
  };

  const toggleAnalysis = (analysis: PropertyExportAnalysisNode, checked: boolean) => {
    const next = new Set(selectedSet);
    if (checked) {
      next.add(analysis.nodeId);
    } else {
      next.delete(analysis.nodeId);
    }
    updateSelection(next);
  };

  const markAll = () => {
    onSelectedNodeIdsChange(collectAllNodeIds(tree));
  };

  const clearAll = () => {
    onSelectedNodeIdsChange([]);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      title="Exportar dados em PDF"
      size="clamp(320px, 92vw, 840px)"
      padding="sm"
    >
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          Estrutura em arvore: selecionar propriedade marca toda a subarvore de talhoes e analises.
        </Text>
        <Checkbox
          size="xs"
          checked={includeSoilClassification}
          onChange={(event) =>
            onIncludeSoilClassificationChange(event.currentTarget.checked)
          }
          label="Incluir bloco Classificação SiBCS do talhão no PDF"
        />

        <Group justify="space-between" align="center" wrap="nowrap">
          <Text size="xs" fw={700} c="dimmed">
            Propriedades cadastradas
          </Text>
          <Group gap={6} wrap="nowrap">
            <Button
              size="compact-xs"
              variant="light"
              color="teal"
              leftSection={<IconSquareCheck size={12} />}
              onClick={markAll}
              disabled={tree.length === 0 || loading}
            >
              Marcar tudo
            </Button>
            <Button
              size="compact-xs"
              variant="light"
              color="gray"
              leftSection={<IconTrash size={12} />}
              onClick={clearAll}
              disabled={selectedSet.size === 0 || loading}
            >
              Limpar
            </Button>
          </Group>
        </Group>

        <ScrollArea.Autosize mah={320} type="always">
          <Stack gap={6} pr={4}>
            {loading ? (
              <Text size="sm" c="dimmed">
                Carregando talhoes e analises...
              </Text>
            ) : tree.length === 0 ? (
              <Text size="sm" c="dimmed">
                Nenhuma propriedade disponivel para exportacao.
              </Text>
            ) : (
              tree.map((property) => {
                const propertyChecked = selectedSet.has(property.nodeId);
                const propertyHasAnyChild = property.talhoes.some(
                  (talhao) =>
                    selectedSet.has(talhao.nodeId) ||
                    talhao.analyses.some((analysis) => selectedSet.has(analysis.nodeId)),
                );
                const propertyIndeterminate = !propertyChecked && propertyHasAnyChild;

                return (
                  <Box
                    key={property.id}
                    style={(theme) => ({
                      borderRadius: theme.radius.sm,
                      border: `1px solid ${theme.colors.gray[5]}`,
                      background: propertyChecked
                        ? 'rgba(20, 184, 166, 0.1)'
                        : 'rgba(15, 23, 42, 0.14)',
                      padding: 6,
                    })}
                  >
                    <Group gap={8} wrap="nowrap" align="center">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={() =>
                          setOpenPropertyIds((prev) => ({
                            ...prev,
                            [property.id]: !prev[property.id],
                          }))
                        }
                        aria-label={openPropertyIds[property.id] ? 'Recolher propriedade' : 'Expandir propriedade'}
                      >
                        {openPropertyIds[property.id] ? (
                          <IconChevronDown size={14} />
                        ) : (
                          <IconChevronRight size={14} />
                        )}
                      </ActionIcon>
                      <Checkbox
                        checked={propertyChecked}
                        indeterminate={propertyIndeterminate}
                        onChange={(event) =>
                          toggleProperty(property, event.currentTarget.checked)
                        }
                        label={`${property.label} (${property.talhoes.length} talhoes)`}
                        styles={{ label: { width: '100%' } }}
                        style={{ flex: 1 }}
                      />
                    </Group>

                    {openPropertyIds[property.id] && property.talhoes.length > 0 ? (
                      <Stack gap={6} mt={4}>
                        {property.talhoes.map((talhao) => {
                          const talhaoChecked = selectedSet.has(talhao.nodeId);
                          const talhaoHasAnyAnalysis = talhao.analyses.some((analysis) =>
                            selectedSet.has(analysis.nodeId),
                          );
                          const talhaoIndeterminate =
                            !talhaoChecked && talhaoHasAnyAnalysis;

                          return (
                            <Box
                              key={talhao.id}
                              style={(theme) => ({
                                marginLeft: 16,
                                borderRadius: theme.radius.sm,
                                border: `1px solid ${theme.colors.gray[6]}`,
                                background: talhaoChecked
                                  ? 'rgba(20, 184, 166, 0.08)'
                                  : 'rgba(2, 6, 23, 0.14)',
                                padding: 5,
                              })}
                            >
                              <Group gap={8} wrap="nowrap" align="center">
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  size="sm"
                                  onClick={() =>
                                    setOpenTalhaoIds((prev) => ({
                                      ...prev,
                                      [talhao.id]: !prev[talhao.id],
                                    }))
                                  }
                                  aria-label={openTalhaoIds[talhao.id] ? 'Recolher talhão' : 'Expandir talhão'}
                                >
                                  {openTalhaoIds[talhao.id] ? (
                                    <IconChevronDown size={14} />
                                  ) : (
                                    <IconChevronRight size={14} />
                                  )}
                                </ActionIcon>
                                <Checkbox
                                  checked={talhaoChecked}
                                  indeterminate={talhaoIndeterminate}
                                  onChange={(event) =>
                                    toggleTalhao(talhao, event.currentTarget.checked)
                                  }
                                  label={`${talhao.label} (${talhao.analyses.length} analises)`}
                                  styles={{ label: { width: '100%' } }}
                                  style={{ flex: 1 }}
                                />
                              </Group>

                              {openTalhaoIds[talhao.id] && talhao.analyses.length > 0 ? (
                                <Stack gap={4} mt={4}>
                                  {talhao.analyses.map((analysis) => (
                                    <Box
                                      key={analysis.id}
                                      style={(theme) => ({
                                        marginLeft: 18,
                                        borderRadius: theme.radius.sm,
                                        border: `1px solid ${theme.colors.gray[7]}`,
                                        padding: '4px 8px',
                                        background: selectedSet.has(analysis.nodeId)
                                          ? 'rgba(20, 184, 166, 0.08)'
                                          : 'rgba(2, 6, 23, 0.12)',
                                      })}
                                    >
                                      <Checkbox
                                        checked={selectedSet.has(analysis.nodeId)}
                                        onChange={(event) =>
                                          toggleAnalysis(
                                            analysis,
                                            event.currentTarget.checked,
                                          )
                                        }
                                        label={analysis.label}
                                        styles={{ label: { width: '100%' } }}
                                      />
                                    </Box>
                                  ))}
                                </Stack>
                              ) : null}
                            </Box>
                          );
                        })}
                      </Stack>
                    ) : null}
                  </Box>
                );
              })
            )}
          </Stack>
        </ScrollArea.Autosize>

        <Stack gap={4}>
          <Text size="xs" c="dimmed">
            Selecionados: {selectedPropertyCount} propriedades, {selectedTalhaoCount} talhoes e {selectedAnalysisCount} analises.
          </Text>
          {!canExport ? (
            <Text size="xs" c="orange">
              Marque ao menos um item da arvore para exportar.
            </Text>
          ) : null}
        </Stack>

        <Group justify="flex-end">
          <Button variant="light" color="gray" onClick={onClose} disabled={exporting}>
            Cancelar
          </Button>
          <Button
            leftSection={<IconFileExport size={14} />}
            onClick={onExport}
            loading={exporting}
            disabled={!canExport || loading}
          >
            Exportar PDF
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
