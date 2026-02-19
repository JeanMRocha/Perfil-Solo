import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Card,
  Divider,
  Grid,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import PageHeader from '../../components/PageHeader';

type KnowledgeLesson = {
  id: string;
  title: string;
  objective: string;
  summary: string;
  videoEmbedUrl: string;
  keyPoints: string[];
};

const lessons: KnowledgeLesson[] = [
  {
    id: 'coleta-solo',
    title: 'Como coletar analise de solo',
    objective: 'Padronizar coleta para reduzir erro de interpretacao.',
    summary:
      'Defina profundidade, numero de subamostras e separacao por talhao para formar uma amostra representativa.',
    videoEmbedUrl: 'https://www.youtube.com/embed/i6XPz7r5VJ0',
    keyPoints: [
      'Separar a area por manejo e historico semelhante.',
      'Evitar bordaduras, beira de estrada e pontos anormais.',
      'Usar profundidade padrao e identificar corretamente cada amostra.',
    ],
  },
  {
    id: 'interpretacao-valores',
    title: 'Como interpretar valores da analise',
    objective: 'Transformar dados laboratoriais em decisao tecnica pratica.',
    summary:
      'Leia faixa ideal por nutriente, risco de limitacao e prioridade de correcao para o cultivo atual.',
    videoEmbedUrl: 'https://www.youtube.com/embed/tgbNymZ7vqY',
    keyPoints: [
      'Avaliar pH, V% e aluminio como base de diagnostico.',
      'Cruzar P, K, Ca, Mg e materia organica com a cultura.',
      'Priorizar limitantes mais severos antes de ajustes finos.',
    ],
  },
  {
    id: 'conversao-unidades',
    title: 'Conversao de unidades no campo',
    objective: 'Evitar erro operacional em recomendacoes e dosagens.',
    summary:
      'Aplicar conversoes mais usadas entre mg/dm3, cmolc/dm3, mmolc/dm3 e kg/ha conforme necessidade.',
    videoEmbedUrl: 'https://www.youtube.com/embed/kJQP7kiw5Fk',
    keyPoints: [
      'Conferir sempre unidade original do laboratorio.',
      'Padronizar unidade antes de comparar historicos.',
      'Documentar a conversao usada no relatorio tecnico.',
    ],
  },
];

export default function KnowledgeHub() {
  const [searchValue, setSearchValue] = useState('');
  const [selectedId, setSelectedId] = useState(lessons[0]?.id ?? '');

  const filteredItems = useMemo(() => {
    const needle = searchValue.trim().toLowerCase();
    if (!needle) return lessons;
    return lessons.filter((item) =>
      `${item.title} ${item.summary} ${item.objective}`
        .toLowerCase()
        .includes(needle),
    );
  }, [searchValue]);

  useEffect(() => {
    if (!filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0]?.id ?? '');
    }
  }, [filteredItems, selectedId]);

  const selectedLesson =
    filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;

  return (
    <Stack>
      <PageHeader title="Conhecimento" color="grape" />

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="md" p="sm" h="100%">
            <Stack gap="sm" h="100%">
              <TextInput
                value={searchValue}
                onChange={(event) => setSearchValue(event.currentTarget.value)}
                placeholder="Buscar aula tecnica"
                leftSection={<IconSearch size={14} />}
              />

              <ScrollArea h={420} type="always">
                <Stack gap={4}>
                  {filteredItems.map((lesson) => (
                    <NavLink
                      key={lesson.id}
                      active={lesson.id === selectedId}
                      label={lesson.title}
                      description={lesson.objective}
                      onClick={() => setSelectedId(lesson.id)}
                    />
                  ))}
                </Stack>
              </ScrollArea>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          {selectedLesson ? (
            <Stack gap="md">
              <Card withBorder radius="md" p="lg">
                <Group justify="space-between" mb="xs">
                  <Title order={4}>{selectedLesson.title}</Title>
                  <Badge color="grape" variant="light">
                    Aula tecnica
                  </Badge>
                </Group>
                <Text fw={700} size="sm" mb={4}>
                  Objetivo
                </Text>
                <Text c="dimmed" size="sm" mb="md">
                  {selectedLesson.objective}
                </Text>
                <Text fw={700} size="sm" mb={4}>
                  Resumo
                </Text>
                <Text c="dimmed" size="sm">
                  {selectedLesson.summary}
                </Text>
              </Card>

              <Card withBorder radius="md" p="lg">
                <Title order={5}>Video da aula</Title>
                <Divider my="sm" />
                <KnowledgeVideo
                  src={selectedLesson.videoEmbedUrl}
                  title={selectedLesson.title}
                />
              </Card>

              <Card withBorder radius="md" p="lg">
                <Title order={5}>Pontos principais</Title>
                <Divider my="sm" />
                <Stack gap={6}>
                  {selectedLesson.keyPoints.map((point, index) => (
                    <Text key={`${selectedLesson.id}-point-${index}`} size="sm">
                      {index + 1}. {point}
                    </Text>
                  ))}
                </Stack>
              </Card>

              <Card withBorder radius="md" p="lg">
                <Title order={5}>Tabela rapida de conversao</Title>
                <Divider my="sm" />
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>De</Table.Th>
                      <Table.Th>Para</Table.Th>
                      <Table.Th>Regra simplificada</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>g/kg</Table.Td>
                      <Table.Td>%</Table.Td>
                      <Table.Td>Dividir por 10</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>mg/dm3</Table.Td>
                      <Table.Td>kg/ha</Table.Td>
                      <Table.Td>Multiplicar por 2 (camada 0-20 cm)</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>cmolc/dm3</Table.Td>
                      <Table.Td>mmolc/dm3</Table.Td>
                      <Table.Td>Multiplicar por 10</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          ) : (
            <Card withBorder radius="md" p="lg">
              <Text c="dimmed">Nenhuma aula encontrada para o filtro informado.</Text>
            </Card>
          )}
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function KnowledgeVideo({ src, title }: { src: string; title: string }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%',
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
      }}
    >
      <iframe
        title={`Video ${title}`}
        src={src}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}
