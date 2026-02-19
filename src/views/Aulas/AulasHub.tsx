import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBell,
  IconChartBar,
  IconFlask,
  IconHome,
  IconMap,
  IconSearch,
  IconSettings,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';

type IconKey =
  | 'dashboard'
  | 'propriedades'
  | 'analises'
  | 'relatorios'
  | 'notificacoes'
  | 'configuracoes';

type IconGuideItem = {
  key: IconKey;
  label: string;
  description: string;
};

type AulaSistema = {
  id: string;
  title: string;
  summary: string;
  path: string;
  videoEmbedUrl: string;
  iconGuide: IconGuideItem[];
  steps: string[];
};

const aulasSistema: AulaSistema[] = [
  {
    id: 'propriedades',
    title: 'Cadastro de Propriedades e Talhoes',
    summary:
      'Como organizar a base da fazenda, vincular talhoes e preparar para analises.',
    path: '/propriedades',
    videoEmbedUrl: 'https://www.youtube.com/embed/aqz-KE-bpKQ',
    iconGuide: [
      {
        key: 'propriedades',
        label: 'Propriedades',
        description: 'Abre o cadastro base de propriedade e talhoes.',
      },
      {
        key: 'dashboard',
        label: 'Dashboard',
        description: 'Mostra os indicadores resumidos apos os cadastros.',
      },
      {
        key: 'configuracoes',
        label: 'Configuracoes',
        description: 'Permite ajustar preferencias gerais do ambiente.',
      },
    ],
    steps: [
      'Cadastre a propriedade principal.',
      'Adicione talhoes com nomes padrao da operacao.',
      'Valide contatos e dados para vincular analises futuras.',
    ],
  },
  {
    id: 'analises',
    title: 'Fluxo de Analises de Solo',
    summary:
      'Da selecao do talhao ao salvamento da analise com recomendacoes tecnicas.',
    path: '/analise-solo',
    videoEmbedUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    iconGuide: [
      {
        key: 'analises',
        label: 'Analises de Solo',
        description: 'Tela principal para cadastro e leitura das analises.',
      },
      {
        key: 'notificacoes',
        label: 'Notificacoes',
        description: 'Apresenta avisos de processos e pendencias.',
      },
      {
        key: 'relatorios',
        label: 'Relatorios',
        description: 'Consolida resultados para entrega ao cliente.',
      },
    ],
    steps: [
      'Selecione propriedade e talhao.',
      'Preencha ou importe os valores da analise.',
      'Revise calagem, gessagem e adubacao antes de salvar.',
    ],
  },
  {
    id: 'relatorios',
    title: 'Montagem de Relatorios',
    summary:
      'Como gerar relatorios com identidade visual e compartilhar com clientes.',
    path: '/relatorios',
    videoEmbedUrl: 'https://www.youtube.com/embed/jNQXAC9IVRw',
    iconGuide: [
      {
        key: 'relatorios',
        label: 'Relatorios',
        description: 'Acessa a tela de composicao e impressao dos laudos.',
      },
      {
        key: 'dashboard',
        label: 'Dashboard',
        description: 'Ajuda a validar resultados antes do laudo final.',
      },
      {
        key: 'notificacoes',
        label: 'Notificacoes',
        description: 'Mostra feedback de itens lidos e pendentes.',
      },
    ],
    steps: [
      'Selecione o modo de visualizacao do relatorio.',
      'Valide cabecalho, cliente e resumo tecnico.',
      'Use os botoes de compartilhar por email e WhatsApp.',
    ],
  },
];

function renderGuideIcon(key: IconKey) {
  switch (key) {
    case 'dashboard':
      return <IconHome size={14} />;
    case 'propriedades':
      return <IconMap size={14} />;
    case 'analises':
      return <IconFlask size={14} />;
    case 'relatorios':
      return <IconChartBar size={14} />;
    case 'notificacoes':
      return <IconBell size={14} />;
    case 'configuracoes':
      return <IconSettings size={14} />;
    default:
      return <IconHome size={14} />;
  }
}

export default function AulasHub() {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [selectedId, setSelectedId] = useState(aulasSistema[0]?.id ?? '');

  const filteredItems = useMemo(() => {
    const needle = searchValue.trim().toLowerCase();
    if (!needle) return aulasSistema;
    return aulasSistema.filter((item) =>
      `${item.title} ${item.summary}`.toLowerCase().includes(needle),
    );
  }, [searchValue]);

  useEffect(() => {
    if (!filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0]?.id ?? '');
    }
  }, [filteredItems, selectedId]);

  const selectedItem =
    filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;

  return (
    <Stack>
      <PageHeader title="Aulas do Sistema" color="indigo" />

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="md" p="sm" h="100%">
            <Stack gap="sm" h="100%">
              <TextInput
                value={searchValue}
                onChange={(event) => setSearchValue(event.currentTarget.value)}
                placeholder="Buscar funcionalidade"
                leftSection={<IconSearch size={14} />}
              />

              <ScrollArea h={420} type="always">
                <Stack gap={4}>
                  {filteredItems.map((item) => (
                    <NavLink
                      key={item.id}
                      active={item.id === selectedId}
                      label={item.title}
                      description={item.summary}
                      onClick={() => setSelectedId(item.id)}
                    />
                  ))}
                </Stack>
              </ScrollArea>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          {selectedItem ? (
            <Stack gap="md">
              <Card withBorder radius="md" p="lg">
                <Group justify="space-between" mb="xs">
                  <Title order={4}>{selectedItem.title}</Title>
                  <Badge color="indigo" variant="light">
                    Tutorial
                  </Badge>
                </Group>
                <Text c="dimmed" size="sm" mb="md">
                  {selectedItem.summary}
                </Text>
                <Button
                  size="sm"
                  variant="light"
                  onClick={() => navigate(selectedItem.path)}
                >
                  Abrir funcionalidade
                </Button>
              </Card>

              <Card withBorder radius="md" p="lg">
                <Title order={5}>Icones e significado</Title>
                <Divider my="sm" />
                <Stack gap="sm">
                  {selectedItem.iconGuide.map((guide) => (
                    <Group key={`${selectedItem.id}-${guide.key}`} wrap="nowrap" align="flex-start">
                      <ThemeIcon color="indigo" variant="light" radius="xl">
                        {renderGuideIcon(guide.key)}
                      </ThemeIcon>
                      <div>
                        <Text fw={700} size="sm">
                          {guide.label}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {guide.description}
                        </Text>
                      </div>
                    </Group>
                  ))}
                </Stack>
              </Card>

              <Card withBorder radius="md" p="lg">
                <Title order={5}>Video de uso</Title>
                <Divider my="sm" />
                <BoxVideo src={selectedItem.videoEmbedUrl} title={selectedItem.title} />
              </Card>

              <Card withBorder radius="md" p="lg">
                <Title order={5}>Passo a passo</Title>
                <Divider my="sm" />
                <Stack gap={6}>
                  {selectedItem.steps.map((step, index) => (
                    <Text key={`${selectedItem.id}-step-${index}`} size="sm">
                      {index + 1}. {step}
                    </Text>
                  ))}
                </Stack>
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

function BoxVideo({ src, title }: { src: string; title: string }) {
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
