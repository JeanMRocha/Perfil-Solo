import { useEffect, useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Switch,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  IconBrandWhatsapp,
  IconBriefcase,
  IconBuildingStore,
  IconLeaf,
  IconMail,
  IconPrinter,
  IconUser,
} from '@tabler/icons-react';
import type { AnalysisContainer } from '../../types/soil';
import { analisesMock } from '../../data/analisesMock';
import { getProfile, type UserProfile } from '../../services/profileService';

interface ReportProps {
  analysis?: AnalysisContainer;
}

function StatusBar({
  value,
  min,
  max,
  label,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
}) {
  let color = '#66bb6a';
  let status = 'Adequado';
  let width = '50%';

  if (value < min) {
    color = '#ef5350';
    status = 'Baixo';
    width = '20%';
  } else if (value > max) {
    color = '#ff9800';
    status = 'Alto';
    width = '80%';
  }

  return (
    <Box mb="xs">
      <Group justify="space-between" mb={2}>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        <Text size="sm" fw={700} c={color}>
          {value} ({status})
        </Text>
      </Group>
      <div
        style={{
          width: '100%',
          height: 8,
          background: '#e0e0e0',
          borderRadius: 4,
        }}
      >
        <div
          style={{
            width,
            height: '100%',
            background: color,
            borderRadius: 4,
          }}
        />
      </div>
    </Box>
  );
}

export default function RelatorioAnalise({}: ReportProps) {
  const [mode, setMode] = useState<'farmer' | 'consultant'>('consultant');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getProfile();
      if (!alive) return;
      setProfile(data);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const mockData = {
    client: profile?.company_name || 'Fazenda Vale Verde',
    date: '17/02/2026',
    talhao: 'Talhao 01 - Cafe',
    analise: analisesMock[0],
  };

  const shareEmail = profile?.contact?.email || profile?.email || '';
  const sharePhoneRaw = profile?.contact?.phone || '';
  const sharePhone = sharePhoneRaw.replace(/\D/g, '');
  const shareSubject = encodeURIComponent(
    `Relatorio de Analise - ${mockData.talhao}`,
  );
  const shareBody = encodeURIComponent(
    `Segue relatorio da area ${mockData.talhao} (${mockData.date}).`,
  );
  const shareMessage = encodeURIComponent(
    `Segue relatorio da area ${mockData.talhao} (${mockData.date}).`,
  );

  return (
    <Box p="md" style={{ maxWidth: '210mm', margin: '0 auto', background: 'white' }}>
      <Card mb="xl" className="no-print" withBorder p="sm" bg="gray.1">
        <Group justify="space-between">
          <Group>
            <Title order={4}>Configuracao do Laudo</Title>
            <Switch
              size="lg"
              onLabel={<IconBriefcase size={16} />}
              offLabel={<IconUser size={16} />}
              checked={mode === 'consultant'}
              onChange={(event) =>
                setMode(event.currentTarget.checked ? 'consultant' : 'farmer')
              }
              label={
                mode === 'consultant'
                  ? 'Modo Tecnico (Consultor)'
                  : 'Modo Simplificado (Produtor)'
              }
            />
          </Group>
          <Group>
            <Button leftSection={<IconPrinter />} onClick={() => window.print()}>
              Imprimir / Salvar PDF
            </Button>
            <Button
              variant="light"
              leftSection={<IconMail size={16} />}
              disabled={!shareEmail}
              onClick={() =>
                window.open(
                  `mailto:${shareEmail}?subject=${shareSubject}&body=${shareBody}`,
                  '_blank',
                )
              }
            >
              Compartilhar email
            </Button>
            <Button
              variant="light"
              color="green"
              leftSection={<IconBrandWhatsapp size={16} />}
              disabled={!sharePhone}
              onClick={() =>
                window.open(
                  `https://wa.me/${sharePhone}?text=${shareMessage}`,
                  '_blank',
                )
              }
            >
              Compartilhar WhatsApp
            </Button>
          </Group>
        </Group>
      </Card>

      <Card withBorder padding="lg" radius="md" mb="md" style={{ borderTop: '4px solid #4CAF50' }}>
        <Group justify="space-between" align="center">
          <div>
            <Group>
              <IconLeaf size={32} color="#4CAF50" />
              <Title order={2} c="green.9">
                PerfilSolo Pro
              </Title>
              {mode === 'consultant' && (
                <Badge color="blue" variant="light">
                  RELATORIO TECNICO
                </Badge>
              )}
            </Group>
            <Text c="dimmed" size="sm">
              Tecnologia em Nutricao de Plantas
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Group justify="flex-end" mb={6}>
              <Avatar radius="md" size="md" src={profile?.logo_url || undefined}>
                <IconBuildingStore size={16} />
              </Avatar>
              <Avatar radius="xl" size="md" src={profile?.avatar_url || undefined}>
                <IconUser size={16} />
              </Avatar>
            </Group>
            <Text fw={700} size="lg">
              {mockData.client}
            </Text>
            <Text>Relatorio: {mockData.talhao}</Text>
            <Text size="sm" c="dimmed">
              Data: {mockData.date}
            </Text>
          </div>
        </Group>
      </Card>

      <Grid gutter="md">
        {mode === 'consultant' && (
          <Grid.Col span={6}>
            <Card withBorder p="md" radius="md" h="100%">
              <Title order={4} mb="md" c="blue.8">
                Resultados Laboratoriais
              </Title>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nutriente</Table.Th>
                    <Table.Th>Valor</Table.Th>
                    <Table.Th>Unid.</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(mockData.analise.nutrientes).map(([key, val]) => (
                    <Table.Tr key={key}>
                      <Table.Td fw={500}>{key}</Table.Td>
                      <Table.Td>{val}</Table.Td>
                      <Table.Td>cmolc/dm3</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </Grid.Col>
        )}

        <Grid.Col span={mode === 'consultant' ? 6 : 12}>
          <Card withBorder p="md" radius="md" h="100%">
            <Title order={4} mb="md" c="orange.8">
              {mode === 'farmer' ? 'Como esta seu solo?' : 'Interpretacao Agronomica'}
            </Title>
            <StatusBar value={5.2} min={5.5} max={6.5} label="pH (Acidez)" />
            <StatusBar value={12} min={15} max={30} label="Fosforo (P)" />
            <StatusBar value={45} min={50} max={70} label="Saturacao por Bases (V%)" />
            <StatusBar value={0.2} min={0} max={0.5} label="Aluminio (Toxico)" />

            {mode === 'farmer' && (
              <Text mt="md" size="sm" c="dimmed">
                Barras vermelhas indicam niveis criticos para acao imediata.
              </Text>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      <Title order={3} mt="xl" mb="md" c="green.9">
        {mode === 'farmer' ? 'O que precisa ser feito?' : 'Recomendacoes Tecnicas'}
      </Title>

      <Grid gutter="lg">
        <Grid.Col span={4}>
          <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #FFC107' }}>
            <Title order={5} mb="xs">
              Calagem (Calcario)
            </Title>
            <Text size="xl" fw={800}>
              2.5 t/ha
            </Text>
            <Text size="sm" c="dimmed">
              PRNT 80%
            </Text>
          </Card>
        </Grid.Col>

        <Grid.Col span={4}>
          <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #2196F3' }}>
            <Title order={5} mb="xs">
              Gessagem
            </Title>
            <Text size="xl" fw={800}>
              1.2 t/ha
            </Text>
            <Text size="sm" c="dimmed">
              Aplicar em area total
            </Text>
          </Card>
        </Grid.Col>

        <Grid.Col span={4}>
          <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #4CAF50' }}>
            <Title order={5} mb="xs">
              Adubacao (Plantio)
            </Title>
            <Text size="xl" fw={800}>
              400 kg/ha
            </Text>
            <Text size="sm" c="dimmed">
              Formula 04-14-08
            </Text>
          </Card>
        </Grid.Col>
      </Grid>

      <Divider my="xl" />
      <Group justify="space-between" align="end">
        <Text size="xs" c="dimmed">
          Gerado por PerfilSolo Pro © 2026. <br />
          Responsavel Tecnico: {profile?.name || 'Consultor'} (CREA 12345)
        </Text>
        <Box style={{ textAlign: 'center' }}>
          <div style={{ borderBottom: '1px solid black', width: 200, marginBottom: 4 }} />
          <Text size="sm">Assinatura - {profile?.name || 'Consultor'}</Text>
        </Box>
      </Group>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; -webkit-print-color-adjust: exact; }
          @page { margin: 1cm; size: A4; }
        }
      `}</style>
    </Box>
  );
}
