// src/components/GameWorld/GameMap.tsx
import { useState, useEffect } from 'react';
import { Stage, Layer, Line, Text as KonvaText } from 'react-konva';
import { Card, Button, Group, Text, Title, Badge, Tooltip } from '@mantine/core';
import { IconDeviceFloppy, IconBrush, IconEraser, IconMap2 } from '@tabler/icons-react';
import { supabaseClient } from '../../supabase/supabaseClient';
import { AnalysisContainer } from '../../types/soil';

interface Point {
    x: number;
    y: number;
}

interface TalhaoDraw {
    id: string;
    points: Point[];
    color: string;
    name: string;
    status?: string; // Nível de fertilidade (ex: 'low', 'medium', 'high')
    lastAnalysis?: string;
}

/**
 * GameMap: Componente central da UI 2D com integração de dados.
 */
export default function GameMap() {
    const [mode, setMode] = useState<'view' | 'draw'>('view');
    const [talhoes, setTalhoes] = useState<TalhaoDraw[]>([]);
    const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
    const [mousePos, setMousePos] = useState<Point | null>(null);

    // Simulação de carregamento de dados (Futuro: virá do Supabase)
    useEffect(() => {
        // Aqui buscaríamos os talhões salvos no banco
        // Por enquanto, iniciamos vazio ou com mock se necessário
    }, []);

    const handleStageClick = (e: any) => {
        if (mode !== 'draw') return;
        const stage = e.target.getStage();
        const point = stage.getPointerPosition();
        setCurrentPoints([...currentPoints, point]);
    };

    const handleMouseMove = (e: any) => {
        if (mode === 'draw') {
            const stage = e.target.getStage();
            setMousePos(stage.getPointerPosition());
        }
    };

    const finishDrawing = async () => {
        if (currentPoints.length < 3) {
            alert('Desenhe pelo menos 3 pontos.');
            return;
        }

        // Simula salvamento
        const newTalhao: TalhaoDraw = {
            id: crypto.randomUUID(),
            points: currentPoints,
            color: '#81C784', // Cor base (sem análise)
            name: `Talhão ${talhoes.length + 1}`
        };

        setTalhoes([...talhoes, newTalhao]);
        setCurrentPoints([]);
        setMode('view');
    };

    const flattenPoints = (points: Point[]) => points.flatMap(p => [p.x, p.y]);

    // Função auxiliar para determinar cor baseada no status (Mock)
    // Futuro: Receber AnalysisContainer e calcular cor real
    const getTalhaoColor = (t: TalhaoDraw) => {
        if (mode === 'draw') return '#e0e0e0';
        return t.color;
    };

    return (
        <Card shadow="sm" radius="md" withBorder p="0" style={{ overflow: 'hidden' }}>
            <Group p="md" justify="space-between" bg="gray.1">
                <Group>
                    <IconMap2 size={24} />
                    <Title order={4}>Mapa Gamificado (GIS)</Title>
                </Group>

                <Group>
                    <Badge color={mode === 'view' ? 'blue' : 'orange'} variant="light">
                        {mode === 'view' ? 'Navegação' : 'Desenhando...'}
                    </Badge>

                    {mode === 'view' ? (
                        <Button
                            leftSection={<IconBrush size={16} />}
                            onClick={() => setMode('draw')}
                            color="green"
                        >
                            Novo Talhão
                        </Button>
                    ) : (
                        <Group gap="xs">
                            <Button color="red" variant="subtle" size="xs" onClick={() => {
                                setCurrentPoints([]);
                                setMode('view');
                            }}>
                                Cancelar
                            </Button>
                            <Button
                                leftSection={<IconDeviceFloppy size={16} />}
                                color="teal"
                                onClick={finishDrawing}
                            >
                                Salvar
                            </Button>
                        </Group>
                    )}
                </Group>
            </Group>

            <div style={{ background: '#f1f8e9', cursor: mode === 'draw' ? 'crosshair' : 'default' }}>
                <Stage
                    width={800}
                    height={500}
                    onMouseDown={handleStageClick}
                    onMouseMove={handleMouseMove}
                >
                    <Layer>
                        {talhoes.map((t) => (
                            <Group key={t.id}>
                                <Line
                                    points={flattenPoints(t.points)}
                                    closed
                                    stroke="white"
                                    strokeWidth={2}
                                    fill={getTalhaoColor(t)}
                                    opacity={0.7}
                                    shadowColor="black"
                                    shadowBlur={5}
                                    shadowOpacity={0.2}
                                    onMouseEnter={(e) => {
                                        const container = e.target.getStage()?.container();
                                        if (container) container.style.cursor = 'pointer';
                                        e.target.to({ opacity: 0.9, scaleX: 1.01, scaleY: 1.01, duration: 0.2 });
                                    }}
                                    onMouseLeave={(e) => {
                                        const container = e.target.getStage()?.container();
                                        if (container) container.style.cursor = 'default';
                                        e.target.to({ opacity: 0.7, scaleX: 1, scaleY: 1, duration: 0.2 });
                                    }}
                                />
                                <KonvaText
                                    x={t.points[0].x}
                                    y={t.points[0].y}
                                    text={t.name}
                                    fontSize={14}
                                    fontStyle="bold"
                                    fill="#1b5e20"
                                />
                            </Group>
                        ))}

                        {currentPoints.length > 0 && (
                            <Line
                                points={flattenPoints([...currentPoints, mousePos || currentPoints[currentPoints.length - 1]])}
                                stroke="#ff9800"
                                strokeWidth={2}
                                dash={[5, 5]}
                            />
                        )}
                    </Layer>
                </Stage>
            </div>

            <Group p="xs" bg="gray.50" justify="center">
                <Text size="xs" c="dimmed">
                    Pinte seus talhões clicando no mapa. A cor mudará automaticamente conforme a saúde do solo.
                </Text>
            </Group>
        </Card>
    );
}
