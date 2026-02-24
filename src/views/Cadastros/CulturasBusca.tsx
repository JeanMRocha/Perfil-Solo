import { useState } from 'react';
import {
  Container,
  Tabs,
  Stack,
  Text,
  ThemeIcon,
  Group,
  Badge,
  Card,
  Alert,
} from '@mantine/core';
import {
  IconPlant2,
  IconLeaf,
  IconDownload,
  IconDatabase,
  IconInfoCircle,
} from '@tabler/icons-react';
import PageHeader from '../../components/PageHeader';
import CulturasSettings from '../Config/CulturasSettings';
import RncCultivarSelector from '../Rnc/RncCultivarSelector';

/**
 * Hub principal de Culturas — consolida cadastro manual e integração RNC.
 *
 * Tabs:
 *  1. Minhas Culturas  → CRUD local (CulturasSettings)
 *  2. Importar do RNC   → Seletor RNC com importação para perfil técnico
 *  3. Catálogo RNC      → Explorar catálogo público (modo catalog)
 */
export default function CulturasBusca() {
  const [activeTab, setActiveTab] = useState<string | null>('minhas');

  return (
    <Container size="xl" mt="xl" pb="xl">
      <PageHeader title="Culturas" />

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        variant="pills"
        radius="md"
        mt="lg"
      >
        <Tabs.List mb="lg">
          <Tabs.Tab
            value="minhas"
            leftSection={
              <ThemeIcon variant="transparent" size="sm">
                <IconPlant2 size={16} />
              </ThemeIcon>
            }
          >
            <Group gap={6}>
              <Text size="sm" fw={600}>
                Minhas Culturas
              </Text>
            </Group>
          </Tabs.Tab>

          <Tabs.Tab
            value="importar"
            leftSection={
              <ThemeIcon variant="transparent" size="sm">
                <IconDownload size={16} />
              </ThemeIcon>
            }
          >
            <Group gap={6}>
              <Text size="sm" fw={600}>
                Importar do RNC
              </Text>
              <Badge size="xs" variant="light" color="green">
                MAPA
              </Badge>
            </Group>
          </Tabs.Tab>

          <Tabs.Tab
            value="catalogo"
            leftSection={
              <ThemeIcon variant="transparent" size="sm">
                <IconDatabase size={16} />
              </ThemeIcon>
            }
          >
            <Text size="sm" fw={600}>
              Catálogo RNC
            </Text>
          </Tabs.Tab>
        </Tabs.List>

        {/* ──────────────── ABA 1: MINHAS CULTURAS ──────────────── */}
        <Tabs.Panel value="minhas">
          <Stack gap="lg">
            <Card
              withBorder
              radius="md"
              p="md"
              style={{
                background:
                  'linear-gradient(135deg, rgba(34, 139, 34, 0.06), rgba(107, 142, 35, 0.04))',
              }}
            >
              <Group gap="md" wrap="nowrap">
                <ThemeIcon
                  size={44}
                  radius="xl"
                  variant="light"
                  color="green"
                >
                  <IconLeaf size={22} />
                </ThemeIcon>
                <div>
                  <Text fw={700} size="lg">
                    Cadastro de Culturas Local
                  </Text>
                  <Text size="sm" c="dimmed">
                    Defina culturas, cultivares, faixas ideais de nutrientes e
                    dados de produtos para recomendações agronômicas e emissão
                    fiscal.
                  </Text>
                </div>
              </Group>
            </Card>

            <CulturasSettings />
          </Stack>
        </Tabs.Panel>

        {/* ──────────────── ABA 2: IMPORTAR DO RNC ──────────────── */}
        <Tabs.Panel value="importar">
          <Stack gap="lg">
            <Alert
              icon={<IconDownload size={18} />}
              title="Importação do Registro Nacional de Cultivares"
              color="blue"
              radius="md"
            >
              <Text size="sm">
                Busque cultivares registrados no MAPA e importe-os para o seu
                perfil técnico. As espécies e cultivares importados podem ser
                editados na aba{' '}
                <Text span fw={700}>
                  Minhas Culturas
                </Text>
                .
              </Text>
            </Alert>

            <RncCultivarSelector mode="catalog" />
          </Stack>
        </Tabs.Panel>

        {/* ──────────────── ABA 3: CATÁLOGO RNC ──────────────── */}
        <Tabs.Panel value="catalogo">
          <Stack gap="lg">
            <Alert
              icon={<IconInfoCircle size={18} />}
              title="Catálogo Público do RNC"
              color="grape"
              radius="md"
            >
              <Text size="sm">
                Explore o catálogo completo de cultivares registrados no
                Ministério da Agricultura. Este catálogo é apenas para consulta —
                use a aba{' '}
                <Text span fw={700}>
                  Importar do RNC
                </Text>{' '}
                para adicionar cultivares ao seu perfil.
              </Text>
            </Alert>

            <RncCultivarSelector mode="catalog" />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
