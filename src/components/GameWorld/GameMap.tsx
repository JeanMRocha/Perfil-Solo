import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Stage,
  Layer,
  Line,
  Text as KonvaText,
  Group as KonvaGroup,
} from 'react-konva';
import {
  Card,
  Button,
  Group,
  Text,
  Title,
  Badge,
  Select,
} from '@mantine/core';
import {
  IconDeviceFloppy,
  IconBrush,
  IconMap2,
  IconPlus,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useStore } from '@nanostores/react';
import { $currUser } from '../../global-state/user';
import {
  MapPoint,
  TalhaoTechnicalStatus,
  createPropertyForUser,
  createTalhaoForProperty,
  fetchLatestAnalysisByTalhao,
  fetchOrCreateUserProperties,
  fetchTalhoesByProperty,
  mapTalhaoToDraw,
  statusToLabel,
  statusToTalhaoColor,
} from '../../services/propertyMapService';
import { dataProviderLabel, isLocalDataMode } from '../../services/dataProvider';
import type { Property } from '../../types/property';

type TalhaoDraw = {
  id: string;
  points: MapPoint[];
  color: string;
  name: string;
  status: TalhaoTechnicalStatus;
  lastAnalysisAt: string | null;
};

const STAGE_HEIGHT = 500;

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

function formatDate(dateLike: string | null) {
  if (!dateLike) return 'Sem analise';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return 'Sem analise';
  return date.toLocaleDateString();
}

export default function GameMap() {
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);

  const [mode, setMode] = useState<'view' | 'draw'>('view');
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [talhoes, setTalhoes] = useState<TalhaoDraw[]>([]);
  const [currentPoints, setCurrentPoints] = useState<MapPoint[]>([]);
  const [mousePos, setMousePos] = useState<MapPoint | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = useState(960);

  const propertyOptions = useMemo(
    () => properties.map((p) => ({ value: p.id, label: p.nome })),
    [properties],
  );

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;

    const updateWidth = () => {
      setStageWidth(Math.max(320, Math.floor(element.clientWidth)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;

    const loadProperties = async () => {
      if (!currentUserId) return;
      setLoadingData(true);
      try {
        const list = await fetchOrCreateUserProperties(currentUserId);
        if (!alive) return;
        setProperties(list);
        setSelectedPropertyId((prev) => prev ?? list[0]?.id ?? null);
      } catch (err: any) {
        notifications.show({
          title: 'Falha ao carregar propriedades',
          message: err?.message ?? 'Nao foi possivel buscar propriedades.',
          color: 'red',
        });
      } finally {
        if (alive) setLoadingData(false);
      }
    };

    void loadProperties();
    return () => {
      alive = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    let alive = true;

    const loadTalhoes = async () => {
      if (!selectedPropertyId) {
        setTalhoes([]);
        return;
      }

      setLoadingData(true);
      try {
        const [rows, analysesByTalhao] = await Promise.all([
          fetchTalhoesByProperty(selectedPropertyId),
          fetchLatestAnalysisByTalhao(selectedPropertyId),
        ]);
        if (!alive) return;

        const mapped = rows
          .map((row) => {
            const base = mapTalhaoToDraw(row);
            const analysis = analysesByTalhao[row.id];
            const status = analysis?.status ?? 'unknown';

            return {
              ...base,
              status,
              lastAnalysisAt: analysis?.lastAnalysisAt ?? null,
              color: statusToTalhaoColor(status, base.color),
            };
          })
          .filter((talhao) => talhao.points.length >= 3);

        setTalhoes(mapped);
      } catch (err: any) {
        notifications.show({
          title: 'Falha ao carregar talhoes',
          message: err?.message ?? 'Nao foi possivel buscar os talhoes.',
          color: 'red',
        });
      } finally {
        if (alive) setLoadingData(false);
      }
    };

    void loadTalhoes();
    return () => {
      alive = false;
    };
  }, [selectedPropertyId]);

  const handleStageClick = (e: any) => {
    if (mode !== 'draw') return;
    if (e?.evt?.button === 2) return;
    const stage = e.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;
    setCurrentPoints((prev) => [...prev, { x: point.x, y: point.y }]);
  };

  const handleMouseMove = (e: any) => {
    if (mode !== 'draw') return;
    const stage = e.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;
    setMousePos({ x: point.x, y: point.y });
  };

  const handleCreateProperty = async () => {
    if (!currentUserId) {
      notifications.show({
        title: 'Sessao ausente',
        message: 'Faca login para criar propriedades.',
        color: 'red',
      });
      return;
    }

    try {
      setLoadingData(true);
      const propertyName = `Propriedade ${properties.length + 1}`;
      const created = await createPropertyForUser(currentUserId, propertyName);
      setProperties((prev) => [...prev, created]);
      setSelectedPropertyId(created.id);
      notifications.show({
        title: 'Propriedade criada',
        message: `${created.nome} foi adicionada com sucesso.`,
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao criar propriedade',
        message: err?.message ?? 'Nao foi possivel criar a propriedade.',
        color: 'red',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const finishDrawing = async () => {
    if (currentPoints.length < 3) {
      notifications.show({
        title: 'Desenho incompleto',
        message: 'Desenhe pelo menos 3 pontos para formar um talhao.',
        color: 'yellow',
      });
      return;
    }

    if (!selectedPropertyId) {
      notifications.show({
        title: 'Propriedade nao selecionada',
        message: 'Selecione uma propriedade antes de salvar o talhao.',
        color: 'red',
      });
      return;
    }

    try {
      setSaving(true);
      const created = await createTalhaoForProperty({
        propertyId: selectedPropertyId,
        nome: `Talhao ${talhoes.length + 1}`,
        points: currentPoints,
      });
      const mapped = mapTalhaoToDraw(created);
      setTalhoes((prev) => [
        ...prev,
        {
          ...mapped,
          status: 'unknown',
          lastAnalysisAt: null,
        },
      ]);
      setCurrentPoints([]);
      setMousePos(null);
      setMode('view');

      notifications.show({
        title: 'Talhao salvo',
        message: `${created.nome} persistido no banco com sucesso.`,
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar talhao',
        message: err?.message ?? 'Nao foi possivel persistir o desenho.',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelDrawing = () => {
    setCurrentPoints([]);
    setMousePos(null);
    setMode('view');
  };

  const handleCloseWithRightClick = (e: any) => {
    e?.evt?.preventDefault?.();
    if (mode !== 'draw') return;
    void finishDrawing();
  };

  return (
    <Card shadow="sm" radius="md" withBorder p="0" style={{ overflow: 'hidden' }}>
      <Group p="md" justify="space-between" bg="gray.1" align="flex-end">
        <Group>
          <IconMap2 size={24} />
          <div>
            <Title order={4}>Mapa de Talhoes (status tecnico)</Title>
            <Text size="xs" c="dimmed">
              Cor baseada na ultima analise vinculada ao talhao.
            </Text>
            <Text size="xs" c="dimmed">
              Fonte de dados: {dataProviderLabel}
            </Text>
          </div>
        </Group>

        <Group align="flex-end">
          <Select
            label="Propriedade"
            placeholder="Selecione"
            data={propertyOptions}
            value={selectedPropertyId}
            onChange={setSelectedPropertyId}
            disabled={loadingData}
            w={260}
          />

          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={handleCreateProperty}
            disabled={loadingData || !currentUserId}
          >
            Nova propriedade
          </Button>

          <Badge color={mode === 'view' ? 'blue' : 'orange'} variant="light">
            {mode === 'view' ? 'Navegacao' : 'Desenhando'}
          </Badge>

          {mode === 'view' ? (
            <Button
              leftSection={<IconBrush size={16} />}
              onClick={() => setMode('draw')}
              color="green"
              disabled={!selectedPropertyId || loadingData}
            >
              Novo talhao
            </Button>
          ) : (
            <Group gap="xs">
              <Button color="red" variant="subtle" size="xs" onClick={cancelDrawing}>
                Cancelar
              </Button>
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                color="teal"
                onClick={finishDrawing}
                loading={saving}
              >
                Salvar
              </Button>
            </Group>
          )}
        </Group>
      </Group>

      <div
        ref={canvasRef}
        style={{ background: '#f1f8e9', cursor: mode === 'draw' ? 'crosshair' : 'default' }}
      >
        <Stage
          width={stageWidth}
          height={STAGE_HEIGHT}
          onMouseDown={handleStageClick}
          onMouseMove={handleMouseMove}
          onContextMenu={handleCloseWithRightClick}
        >
          <Layer>
            {talhoes.map((talhao) => {
              const center = centroid(talhao.points);
              return (
                <KonvaGroup key={talhao.id}>
                  <Line
                    points={flattenPoints(talhao.points)}
                    closed
                    stroke="white"
                    strokeWidth={2}
                    fill={talhao.color}
                    opacity={0.75}
                    shadowColor="black"
                    shadowBlur={5}
                    shadowOpacity={0.2}
                    onMouseEnter={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container) container.style.cursor = 'pointer';
                      e.target.to({
                        opacity: 0.9,
                        scaleX: 1.01,
                        scaleY: 1.01,
                        duration: 0.2,
                      });
                    }}
                    onMouseLeave={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container) container.style.cursor = 'default';
                      e.target.to({ opacity: 0.75, scaleX: 1, scaleY: 1, duration: 0.2 });
                    }}
                  />
                  <KonvaText
                    x={center.x}
                    y={center.y}
                    offsetX={48}
                    text={`${talhao.name} (${statusToLabel(talhao.status)})`}
                    fontSize={13}
                    fontStyle="bold"
                    fill="#1b5e20"
                  />
                </KonvaGroup>
              );
            })}

            {currentPoints.length > 0 ? (
              <Line
                points={flattenPoints([
                  ...currentPoints,
                  mousePos ?? currentPoints[currentPoints.length - 1],
                ])}
                stroke="#ff9800"
                strokeWidth={2}
                dash={[5, 5]}
              />
            ) : null}
          </Layer>
        </Stage>
      </div>

      <Group p="xs" bg="gray.0" justify="space-between" wrap="wrap">
        <Group gap="xs">
          <Badge color="green">Saudavel</Badge>
          <Badge color="yellow">Atencao</Badge>
          <Badge color="red">Critico</Badge>
          <Badge color="gray">Sem analise</Badge>
        </Group>
        <Text size="xs" c="dimmed">
          Talhoes: {talhoes.length} | Ultima atualizacao de status por talhao:{' '}
          {talhoes.find((t) => t.lastAnalysisAt)?.lastAnalysisAt
            ? formatDate(talhoes.find((t) => t.lastAnalysisAt)?.lastAnalysisAt ?? null)
            : 'Sem analise'}
        </Text>
      </Group>
    </Card>
  );
}
