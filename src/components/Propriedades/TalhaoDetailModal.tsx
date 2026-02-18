import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  Stage,
  Layer,
  Line,
  Circle,
  Group as KonvaGroup,
  Text as KonvaText,
} from 'react-konva';
import type { Talhao } from '../../types/property';
import {
  listLocalCultureProfiles,
  type LocalCultureProfile,
} from '../../services/cultureProfilesService';
import {
  parseTalhaoGeometry,
  type MapPoint,
  updateTalhaoForProperty,
} from '../../services/propertyMapService';

type DrawMode = 'none' | 'main' | 'zone';
type CultureModalMode = 'create' | 'edit';

type CultureEntry = {
  cultura: string;
  cultivar?: string;
  data_inicio: string;
  data_fim: string;
};

function flattenPoints(points: MapPoint[]) {
  return points.flatMap((p) => [p.x, p.y]);
}

function centroid(points: MapPoint[]): MapPoint {
  if (!points.length) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function safeDate(value?: string | null) {
  return value ? value : '';
}

function normalizeKey(value?: string | null): string {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

interface TalhaoDetailModalProps {
  opened: boolean;
  talhao: Talhao | null;
  onClose: () => void;
  onSaved: (talhaoId: string) => Promise<void> | void;
}

export default function TalhaoDetailModal({
  opened,
  talhao,
  onClose,
  onSaved,
}: TalhaoDetailModalProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = useState(900);
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [currentPoints, setCurrentPoints] = useState<MapPoint[]>([]);
  const [mousePos, setMousePos] = useState<MapPoint | null>(null);
  const [mainPoints, setMainPoints] = useState<MapPoint[]>([]);
  const [zones, setZones] = useState<MapPoint[][]>([]);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState('');
  const [areaHa, setAreaHa] = useState<number | ''>('');
  const [tipoSolo, setTipoSolo] = useState('');
  const [cor, setCor] = useState('#81C784');
  const [cultureDraft, setCultureDraft] = useState<CultureEntry>({
    cultura: '',
    cultivar: '',
    data_inicio: '',
    data_fim: '',
  });
  const [cultures, setCultures] = useState<CultureEntry[]>([]);
  const [availableCultures, setAvailableCultures] = useState<LocalCultureProfile[]>(
    [],
  );
  const [manualCultivar, setManualCultivar] = useState(false);
  const [cultureModalOpened, setCultureModalOpened] = useState(false);
  const [cultureModalMode, setCultureModalMode] =
    useState<CultureModalMode>('create');
  const [editingCultureIndex, setEditingCultureIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const element = canvasRef.current;
    if (!element || !opened) return;

    const updateWidth = () => {
      setStageWidth(Math.max(340, Math.floor(element.clientWidth)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [opened]);

  useEffect(() => {
    if (!opened) return;
    setAvailableCultures(listLocalCultureProfiles());
  }, [opened]);

  useEffect(() => {
    if (!opened || !talhao) return;
    const geometry = parseTalhaoGeometry(talhao.coordenadas_svg);
    setMainPoints(geometry.points);
    setZones(geometry.exclusionZones);
    setSelectedZoneIndex(null);
    setDrawMode('none');
    setCurrentPoints([]);
    setMousePos(null);
    setNome(talhao.nome ?? '');
    setAreaHa(talhao.area_ha == null ? '' : talhao.area_ha);
    setTipoSolo(talhao.tipo_solo ?? '');
    setCor(talhao.cor_identificacao ?? '#81C784');
    setCultures(
      Array.isArray(talhao.historico_culturas)
        ? talhao.historico_culturas.map((item) => ({
            cultura: item.cultura ?? '',
            cultivar: item.cultivar ?? '',
            data_inicio: safeDate(item.data_inicio ?? item.safra),
            data_fim: safeDate(item.data_fim ?? item.safra),
          }))
        : [],
    );
    setCultureDraft({ cultura: '', cultivar: '', data_inicio: '', data_fim: '' });
    setManualCultivar(false);
    setCultureModalOpened(false);
    setCultureModalMode('create');
    setEditingCultureIndex(null);
  }, [opened, talhao]);

  const statusLabel = useMemo(() => {
    if (drawMode === 'main') return 'Desenhando limite principal';
    if (drawMode === 'zone') return 'Desenhando zona de exclusao';
    return 'Visualizacao';
  }, [drawMode]);

  const cultureOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of availableCultures) {
      const label = row.cultura?.trim();
      if (!label) continue;
      const key = normalizeKey(label);
      if (!key || map.has(key)) continue;
      map.set(key, label);
    }
    return Array.from(map.values())
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((value) => ({ value, label: value }));
  }, [availableCultures]);

  const cultivarOptions = useMemo(() => {
    const culturaKey = normalizeKey(cultureDraft.cultura);
    if (!culturaKey) return [];

    const map = new Map<string, string>();
    for (const row of availableCultures) {
      if (normalizeKey(row.cultura) !== culturaKey) continue;
      const label = row.variedade?.trim();
      if (!label) continue;
      const key = normalizeKey(label);
      if (!key || map.has(key)) continue;
      map.set(key, label);
    }

    return Array.from(map.values())
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((value) => ({ value, label: value }));
  }, [availableCultures, cultureDraft.cultura]);

  const handleStageClick = (event: any) => {
    if (drawMode === 'none') return;
    if (event?.evt?.button === 2) return;
    const stage = event.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;
    setCurrentPoints((prev) => [...prev, { x: point.x, y: point.y }]);
  };

  const handleMouseMove = (event: any) => {
    if (drawMode === 'none') return;
    const stage = event.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;
    setMousePos({ x: point.x, y: point.y });
  };

  const startMainDrawing = () => {
    setDrawMode('main');
    setCurrentPoints([]);
    setMousePos(null);
  };

  const startZoneDrawing = () => {
    if (mainPoints.length < 3) {
      notifications.show({
        title: 'Desenhe o limite primeiro',
        message: 'Defina o limite do talhao antes de criar zonas de exclusao.',
        color: 'yellow',
      });
      return;
    }
    setDrawMode('zone');
    setCurrentPoints([]);
    setMousePos(null);
  };

  const cancelDrawing = () => {
    setDrawMode('none');
    setCurrentPoints([]);
    setMousePos(null);
  };

  const finishDrawing = () => {
    if (currentPoints.length < 3) {
      notifications.show({
        title: 'Desenho incompleto',
        message: 'Desenhe pelo menos 3 pontos.',
        color: 'yellow',
      });
      return;
    }

    if (drawMode === 'main') {
      setMainPoints(currentPoints);
      notifications.show({
        title: 'Limite atualizado',
        message: 'Desenho principal do talhao definido.',
        color: 'green',
      });
    } else if (drawMode === 'zone') {
      setZones((prev) => [...prev, currentPoints]);
      notifications.show({
        title: 'Zona adicionada',
        message: 'Zona de exclusao adicionada ao talhao.',
        color: 'green',
      });
    }

    setDrawMode('none');
    setCurrentPoints([]);
    setMousePos(null);
  };

  const persistDrawingOnly = async (
    nextMainPoints: MapPoint[],
    nextZones: MapPoint[][],
  ) => {
    if (!talhao) return;
    try {
      await updateTalhaoForProperty({
        talhaoId: talhao.id,
        nome: talhao.nome || 'Talhao',
        area_ha: talhao.area_ha,
        tipo_solo: talhao.tipo_solo,
        color: talhao.cor_identificacao,
        points: nextMainPoints,
        exclusionZones: nextZones,
        historico_culturas: cultures.map((item) => ({
          cultura: item.cultura,
          cultivar: item.cultivar,
          data_inicio: item.data_inicio,
          data_fim: item.data_fim,
        })),
      });
      notifications.show({
        title: 'Desenho salvo',
        message: 'Poligono fechado e salvo com clique direito.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar desenho',
        message:
          err?.message ?? 'Nao foi possivel salvar o desenho automaticamente.',
        color: 'red',
      });
    }
  };

  const handleCloseWithRightClick = (event: any) => {
    event?.evt?.preventDefault?.();
    if (drawMode === 'none') return;
    if (currentPoints.length < 3) {
      notifications.show({
        title: 'Desenho incompleto',
        message: 'Desenhe pelo menos 3 pontos.',
        color: 'yellow',
      });
      return;
    }

    const nextMainPoints = drawMode === 'main' ? currentPoints : mainPoints;
    const nextZones = drawMode === 'zone' ? [...zones, currentPoints] : zones;

    if (drawMode === 'main') {
      setMainPoints(nextMainPoints);
    } else if (drawMode === 'zone') {
      setZones(nextZones);
    }

    setDrawMode('none');
    setCurrentPoints([]);
    setMousePos(null);

    void persistDrawingOnly(nextMainPoints, nextZones);
  };

  const removeSelectedZone = () => {
    if (selectedZoneIndex == null) return;
    setZones((prev) => prev.filter((_, idx) => idx !== selectedZoneIndex));
    setSelectedZoneIndex(null);
  };

  const openCreateCultureModal = () => {
    setCultureModalMode('create');
    setEditingCultureIndex(null);
    setCultureDraft({
      cultura: '',
      cultivar: '',
      data_inicio: '',
      data_fim: '',
    });
    setManualCultivar(false);
    setCultureModalOpened(true);
  };

  const openEditCultureModal = (index: number) => {
    const row = cultures[index];
    if (!row) return;
    const rowCultivarOptions = availableCultures
      .filter((item) => normalizeKey(item.cultura) === normalizeKey(row.cultura))
      .map((item) => (item.variedade ?? '').trim())
      .filter((item) => item.length > 0);

    setCultureModalMode('edit');
    setEditingCultureIndex(index);
    setCultureDraft({
      cultura: row.cultura,
      cultivar: row.cultivar ?? '',
      data_inicio: row.data_inicio,
      data_fim: row.data_fim,
    });
    setManualCultivar(
      Boolean(row.cultivar) && !rowCultivarOptions.includes(row.cultivar ?? ''),
    );
    setCultureModalOpened(true);
  };

  const closeCultureModal = () => {
    setCultureModalOpened(false);
  };

  const saveCultureDraft = () => {
    const cultura = cultureDraft.cultura.trim();
    const cultivar = cultureDraft.cultivar?.trim() || '';
    const dataInicio = cultureDraft.data_inicio.trim();
    const dataFim = cultureDraft.data_fim.trim();

    if (!cultura || !dataInicio || !dataFim) {
      notifications.show({
        title: 'Dados incompletos',
        message: 'Informe cultura, data inicial e data final.',
        color: 'yellow',
      });
      return;
    }

    if (new Date(dataInicio).getTime() > new Date(dataFim).getTime()) {
      notifications.show({
        title: 'Periodo invalido',
        message: 'A data final deve ser maior ou igual a data inicial.',
        color: 'yellow',
      });
      return;
    }

    const row: CultureEntry = {
      cultura,
      cultivar: cultivar || undefined,
      data_inicio: dataInicio,
      data_fim: dataFim,
    };

    if (cultureModalMode === 'edit' && editingCultureIndex != null) {
      setCultures((prev) =>
        prev.map((item, index) => (index === editingCultureIndex ? row : item)),
      );
    } else {
      setCultures((prev) => [...prev, row]);
    }

    setCultureModalOpened(false);
  };

  const removeCulture = (index: number) => {
    setCultures((prev) => prev.filter((_, idx) => idx !== index));
  };

  const moveMainAnchor = (index: number, point: MapPoint) => {
    setMainPoints((prev) =>
      prev.map((item, idx) => (idx === index ? point : item)),
    );
  };

  const moveZoneAnchor = (
    zoneIndex: number,
    pointIndex: number,
    point: MapPoint,
  ) => {
    setZones((prev) =>
      prev.map((zone, zIdx) => {
        if (zIdx !== zoneIndex) return zone;
        return zone.map((item, pIdx) => (pIdx === pointIndex ? point : item));
      }),
    );
  };

  const save = async () => {
    if (!talhao) return;
    if (!nome.trim()) {
      notifications.show({
        title: 'Nome obrigatorio',
        message: 'Informe o nome do talhao.',
        color: 'yellow',
      });
      return;
    }

    if (mainPoints.length < 3) {
      notifications.show({
        title: 'Limite obrigatorio',
        message: 'Cada talhao precisa ter um desenho principal.',
        color: 'yellow',
      });
      return;
    }

    try {
      setSaving(true);
      await updateTalhaoForProperty({
        talhaoId: talhao.id,
        nome: nome.trim(),
        area_ha: areaHa === '' ? undefined : Number(areaHa),
        tipo_solo: tipoSolo.trim() || undefined,
        color: cor,
        points: mainPoints,
        exclusionZones: zones,
        historico_culturas: cultures.map((item) => ({
          cultura: item.cultura,
          cultivar: item.cultivar,
          data_inicio: item.data_inicio,
          data_fim: item.data_fim,
        })),
      });

      await onSaved(talhao.id);
      notifications.show({
        title: 'Talhao atualizado',
        message: 'Detalhamento do talhao salvo com sucesso.',
        color: 'green',
      });
      onClose();
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar talhao',
        message: err?.message ?? 'Nao foi possivel salvar o detalhamento.',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={talhao ? `Detalhamento do talhao: ${talhao.nome}` : 'Detalhamento do talhao'}
      size="95%"
      centered
    >
      {!talhao ? (
        <Text c="dimmed">Selecione um talhao para detalhar.</Text>
      ) : (
        <GridLayout
          nome={nome}
          setNome={setNome}
          areaHa={areaHa}
          setAreaHa={setAreaHa}
          tipoSolo={tipoSolo}
          setTipoSolo={setTipoSolo}
          cor={cor}
          setCor={setCor}
          cultures={cultures}
          cultureDraft={cultureDraft}
          setCultureDraft={setCultureDraft}
          cultureOptions={cultureOptions}
          cultivarOptions={cultivarOptions}
          manualCultivar={manualCultivar}
          setManualCultivar={setManualCultivar}
          cultureModalOpened={cultureModalOpened}
          closeCultureModal={closeCultureModal}
          saveCultureDraft={saveCultureDraft}
          cultureModalMode={cultureModalMode}
          openCreateCultureModal={openCreateCultureModal}
          openEditCultureModal={openEditCultureModal}
          removeCulture={removeCulture}
          drawMode={drawMode}
          statusLabel={statusLabel}
          startMainDrawing={startMainDrawing}
          startZoneDrawing={startZoneDrawing}
          cancelDrawing={cancelDrawing}
          finishDrawing={finishDrawing}
          zones={zones}
          selectedZoneIndex={selectedZoneIndex}
          setSelectedZoneIndex={setSelectedZoneIndex}
          removeSelectedZone={removeSelectedZone}
          canvasRef={canvasRef}
          stageWidth={stageWidth}
          mainPoints={mainPoints}
          currentPoints={currentPoints}
          mousePos={mousePos}
          handleStageClick={handleStageClick}
          handleMouseMove={handleMouseMove}
          handleCloseWithRightClick={handleCloseWithRightClick}
          moveMainAnchor={moveMainAnchor}
          moveZoneAnchor={moveZoneAnchor}
          save={save}
          saving={saving}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function GridLayout(props: {
  nome: string;
  setNome: (value: string) => void;
  areaHa: number | '';
  setAreaHa: (value: number | '') => void;
  tipoSolo: string;
  setTipoSolo: (value: string) => void;
  cor: string;
  setCor: (value: string) => void;
  cultures: CultureEntry[];
  cultureDraft: CultureEntry;
  setCultureDraft: (value: CultureEntry) => void;
  cultureOptions: Array<{ value: string; label: string }>;
  cultivarOptions: Array<{ value: string; label: string }>;
  manualCultivar: boolean;
  setManualCultivar: (value: boolean) => void;
  cultureModalOpened: boolean;
  closeCultureModal: () => void;
  saveCultureDraft: () => void;
  cultureModalMode: CultureModalMode;
  openCreateCultureModal: () => void;
  openEditCultureModal: (index: number) => void;
  removeCulture: (index: number) => void;
  drawMode: DrawMode;
  statusLabel: string;
  startMainDrawing: () => void;
  startZoneDrawing: () => void;
  cancelDrawing: () => void;
  finishDrawing: () => void;
  zones: MapPoint[][];
  selectedZoneIndex: number | null;
  setSelectedZoneIndex: (index: number | null) => void;
  removeSelectedZone: () => void;
  canvasRef: RefObject<HTMLDivElement | null>;
  stageWidth: number;
  mainPoints: MapPoint[];
  currentPoints: MapPoint[];
  mousePos: MapPoint | null;
  handleStageClick: (event: any) => void;
  handleMouseMove: (event: any) => void;
  handleCloseWithRightClick: (event: any) => void;
  moveMainAnchor: (index: number, point: MapPoint) => void;
  moveZoneAnchor: (
    zoneIndex: number,
    pointIndex: number,
    point: MapPoint,
  ) => void;
  save: () => Promise<void>;
  saving: boolean;
  onClose: () => void;
}) {
  return (
    <Stack gap="md">
      <Group grow>
        <TextInput
          label="Nome do talhao"
          value={props.nome}
          onChange={(event) => props.setNome(event.currentTarget.value)}
        />
        <NumberInput
          label="Area (ha)"
          value={props.areaHa}
          min={0}
          decimalScale={2}
          onChange={(value) => {
            if (value == null || value === '') {
              props.setAreaHa('');
              return;
            }
            props.setAreaHa(Number(value));
          }}
        />
        <TextInput
          label="Tipo de solo"
          value={props.tipoSolo}
          onChange={(event) => props.setTipoSolo(event.currentTarget.value)}
        />
        <TextInput
          label="Cor"
          value={props.cor}
          onChange={(event) => props.setCor(event.currentTarget.value)}
        />
      </Group>

      <Card withBorder p="sm">
        <Group justify="space-between" mb="xs">
          <Text fw={700}>Cultura relacionada ao talhao</Text>
          <Badge color="grape">{props.cultures.length} registros</Badge>
        </Group>
        <Group justify="flex-end" mb="sm">
          <Button onClick={props.openCreateCultureModal}>Adicionar cultura/safra</Button>
        </Group>

        {props.cultures.length > 0 ? (
          <Table striped highlightOnHover withTableBorder mt="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Cultura</Table.Th>
                <Table.Th>Cultivar</Table.Th>
                <Table.Th>Data inicial</Table.Th>
                <Table.Th>Data final</Table.Th>
                <Table.Th>Acoes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {props.cultures.map((item, index) => (
                <Table.Tr
                  key={`${item.cultura}-${item.data_inicio}-${item.data_fim}-${index}`}
                >
                  <Table.Td>{item.cultura}</Table.Td>
                  <Table.Td>{item.cultivar || '-'}</Table.Td>
                  <Table.Td>{item.data_inicio}</Table.Td>
                  <Table.Td>{item.data_fim}</Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => props.openEditCultureModal(index)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="xs"
                        color="red"
                        variant="light"
                        onClick={() => props.removeCulture(index)}
                      >
                        Remover
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed" mt="sm">
            Nenhuma cultura informada para este talhao.
          </Text>
        )}
      </Card>

      <Modal
        opened={props.cultureModalOpened}
        onClose={props.closeCultureModal}
        title={
          props.cultureModalMode === 'create'
            ? 'Adicionar cultura e safra'
            : 'Editar cultura e safra'
        }
        centered
      >
        <Stack>
          <Select
            label="Cultura"
            placeholder="Selecione a cultura"
            data={props.cultureOptions}
            searchable
            nothingFoundMessage="Nenhuma cultura cadastrada"
            value={props.cultureDraft.cultura || null}
            onChange={(value) =>
              props.setCultureDraft({
                ...props.cultureDraft,
                cultura: value ?? '',
                cultivar: '',
              })
            }
          />

          <Group align="end" wrap="nowrap">
            {props.manualCultivar ? (
              <TextInput
                style={{ flex: 1 }}
                label="Cultivar (manual)"
                placeholder="Digite o cultivar"
                value={props.cultureDraft.cultivar ?? ''}
                onChange={(event) =>
                  props.setCultureDraft({
                    ...props.cultureDraft,
                    cultivar: event.currentTarget.value,
                  })
                }
              />
            ) : (
              <Select
                style={{ flex: 1 }}
                label="Cultivar"
                placeholder={
                  props.cultureDraft.cultura
                    ? 'Selecione o cultivar'
                    : 'Selecione a cultura primeiro'
                }
                data={props.cultivarOptions}
                searchable
                clearable
                nothingFoundMessage="Nenhum cultivar cadastrado"
                disabled={!props.cultureDraft.cultura}
                value={props.cultureDraft.cultivar || null}
                onChange={(value) =>
                  props.setCultureDraft({
                    ...props.cultureDraft,
                    cultivar: value ?? '',
                  })
                }
              />
            )}
            <ActionIcon
              variant="light"
              color={props.manualCultivar ? 'green' : 'blue'}
              size="lg"
              onClick={() => {
                props.setManualCultivar(!props.manualCultivar);
                if (!props.manualCultivar) {
                  props.setCultureDraft({
                    ...props.cultureDraft,
                    cultivar: '',
                  });
                }
              }}
              title={
                props.manualCultivar
                  ? 'Voltar para lista de cultivares'
                  : 'Informar cultivar manualmente'
              }
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Group>

          <Group grow>
            <TextInput
              type="date"
              label="Data inicial"
              value={props.cultureDraft.data_inicio}
              onChange={(event) =>
                props.setCultureDraft({
                  ...props.cultureDraft,
                  data_inicio: event.currentTarget.value,
                })
              }
            />
            <TextInput
              type="date"
              label="Data final"
              value={props.cultureDraft.data_fim}
              onChange={(event) =>
                props.setCultureDraft({
                  ...props.cultureDraft,
                  data_fim: event.currentTarget.value,
                })
              }
            />
          </Group>

          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={props.closeCultureModal}>
              Cancelar
            </Button>
            <Button onClick={props.saveCultureDraft}>Salvar periodo</Button>
          </Group>
        </Stack>
      </Modal>

      <Card withBorder p="sm">
        <Group justify="space-between" mb="xs">
          <Text fw={700}>Mapa do talhao</Text>
          <Badge color={props.drawMode === 'none' ? 'blue' : 'orange'}>
            {props.statusLabel}
          </Badge>
        </Group>

        <Group mb="sm">
          <Button
            variant="light"
            onClick={props.startMainDrawing}
            disabled={props.drawMode !== 'none'}
          >
            Desenhar limite do talhao
          </Button>
          <Button
            variant="light"
            color="red"
            onClick={props.startZoneDrawing}
            disabled={props.drawMode !== 'none'}
          >
            Adicionar zona de exclusao
          </Button>
          <Button
            variant="light"
            color="gray"
            onClick={props.cancelDrawing}
            disabled={props.drawMode === 'none'}
          >
            Cancelar desenho
          </Button>
          <Button onClick={props.finishDrawing} disabled={props.drawMode === 'none'}>
            Concluir desenho
          </Button>
          <Button
            color="red"
            variant="light"
            onClick={props.removeSelectedZone}
            disabled={props.selectedZoneIndex == null}
          >
            Remover zona selecionada
          </Button>
        </Group>

        <div
          ref={props.canvasRef}
          style={{
            width: '100%',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
          }}
        >
          <Stage
            width={props.stageWidth}
            height={440}
            onMouseDown={props.handleStageClick}
            onMouseMove={props.handleMouseMove}
            onContextMenu={props.handleCloseWithRightClick}
          >
            <Layer>
              {props.mainPoints.length >= 3 ? (
                <>
                  <Line
                    points={flattenPoints(props.mainPoints)}
                    closed
                    fill="rgba(34,197,94,0.35)"
                    stroke="#15803d"
                    strokeWidth={2}
                  />
                  <KonvaText
                    x={centroid(props.mainPoints).x - 42}
                    y={centroid(props.mainPoints).y - 8}
                    text="Talhao"
                    fontSize={13}
                    fontStyle="bold"
                    fill="#14532d"
                  />
                  {props.mainPoints.map((point, index) => (
                    <Circle
                      key={`main-anchor-${index}`}
                      x={point.x}
                      y={point.y}
                      radius={5}
                      fill="#0f172a"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      draggable={props.drawMode === 'none'}
                      onDragMove={(event) => {
                        const { x, y } = event.target.position();
                        props.moveMainAnchor(index, { x, y });
                      }}
                    />
                  ))}
                </>
              ) : null}

              {props.zones.map((zone, index) => (
                <KonvaGroup key={`zone-group-${index}`}>
                  <Line
                    points={flattenPoints(zone)}
                    closed
                    fill={
                      props.selectedZoneIndex === index
                        ? 'rgba(244,63,94,0.5)'
                        : 'rgba(239,68,68,0.35)'
                    }
                    stroke={props.selectedZoneIndex === index ? '#9f1239' : '#b91c1c'}
                    strokeWidth={2}
                    onClick={() => props.setSelectedZoneIndex(index)}
                  />
                  {zone.map((point, pointIndex) => (
                    <Circle
                      key={`zone-anchor-${index}-${pointIndex}`}
                      x={point.x}
                      y={point.y}
                      radius={4}
                      fill="#7f1d1d"
                      stroke="#ffffff"
                      strokeWidth={1.2}
                      draggable={props.drawMode === 'none'}
                      onDragMove={(event) => {
                        const { x, y } = event.target.position();
                        props.moveZoneAnchor(index, pointIndex, { x, y });
                      }}
                      onClick={() => props.setSelectedZoneIndex(index)}
                    />
                  ))}
                </KonvaGroup>
              ))}

              {props.currentPoints.length > 0 ? (
                <>
                  <Line
                    points={flattenPoints([
                      ...props.currentPoints,
                      props.mousePos ?? props.currentPoints[props.currentPoints.length - 1],
                    ])}
                    stroke="#0f172a"
                    strokeWidth={2}
                    dash={[6, 4]}
                  />
                  {props.currentPoints.map((point, index) => (
                    <Circle
                      key={`current-anchor-${index}`}
                      x={point.x}
                      y={point.y}
                      radius={4}
                      fill="#111827"
                      stroke="#ffffff"
                      strokeWidth={1.2}
                    />
                  ))}
                </>
              ) : null}
            </Layer>
          </Stage>
        </div>

        <Group justify="space-between" mt="sm">
          <Text size="sm" c="dimmed">
            Um desenho principal por talhao. Zonas de exclusao podem ser varias.
          </Text>
          <Badge color="red">{props.zones.length} zonas</Badge>
        </Group>
        <Text size="sm" c="dimmed" mt={4}>
          Arraste as bolinhas para editar os vertices e clique em "Salvar detalhamento".
        </Text>
      </Card>

      <Divider />

      <Group justify="flex-end">
        <Button variant="light" color="gray" onClick={props.onClose}>
          Fechar
        </Button>
        <Button onClick={() => void props.save()} loading={props.saving}>
          Salvar detalhamento
        </Button>
      </Group>
    </Stack>
  );
}
