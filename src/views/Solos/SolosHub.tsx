import { useEffect, useMemo, useState } from 'react';
import {
  Anchor,
  Badge,
  Card,
  Container,
  Divider,
  Group,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import PageHeader from '../../components/PageHeader';
import { SoilClassificationWorkspace } from '../../modules/soilClassification';
import {
  listDefaultSoilTechnicalProfiles,
  type SoilTechnicalProfile,
} from '../../services/soilProfilesService';

function normalize(input: string): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatRange(raw: string): string {
  const value = String(raw ?? '').trim();
  return value || '-';
}

function matchProfile(profile: SoilTechnicalProfile, query: string): boolean {
  const needle = normalize(query);
  if (!needle) return true;
  const haystack = [
    profile.ordem,
    profile.horizonte_diagnostico,
    profile.processo_formacao,
    profile.fertilidade_natural,
    profile.uso_agricola,
    ...(profile.subordens_disponiveis ?? []),
    ...(profile.limitacoes_agronomicas ?? []),
    ...(profile.culturas_tipicas ?? []),
  ]
    .map((item) => normalize(String(item ?? '')))
    .join(' ');
  return haystack.includes(needle);
}

function SoilProfileDetails({ profile }: { profile: SoilTechnicalProfile | null }) {
  if (!profile) {
    return (
      <Card withBorder p="md">
        <Text c="dimmed">Selecione uma classe para visualizar os detalhes tecnicos.</Text>
      </Card>
    );
  }

  return (
    <Card withBorder p="md">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text fw={700} size="lg">
            {profile.ordem}
          </Text>
          <Badge variant="light" color="teal">
            {profile.source}
          </Badge>
        </Group>

        <Text size="sm" c="dimmed">
          Horizonte diagnostico: {profile.horizonte_diagnostico}
        </Text>
        <Text size="sm" c="dimmed">
          Processo de formacao: {profile.processo_formacao}
        </Text>

        <Divider />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <Text size="sm">Profundidade: {formatRange(profile.profundidade_cm.raw)} cm</Text>
          <Text size="sm">Textura argila: {formatRange(profile.textura_argila_percentual.raw)}%</Text>
          <Text size="sm">CTC: {formatRange(profile.ctc_cmolc_kg.raw)} cmolc/kg</Text>
          <Text size="sm">V%: {formatRange(profile.v_percentual.raw)}</Text>
          <Text size="sm">pH: {formatRange(profile.ph.raw)}</Text>
          <Text size="sm">Fertilidade natural: {profile.fertilidade_natural}</Text>
        </SimpleGrid>

        <Divider />

        <Text size="sm" fw={600}>
          Limitações agronomicas
        </Text>
        <Text size="sm" c="dimmed">
          {profile.limitacoes_agronomicas.join(' | ') || '-'}
        </Text>

        <Text size="sm" fw={600}>
          Manejo recomendado
        </Text>
        <Text size="sm" c="dimmed">
          {profile.manejo_recomendado.join(' | ') || '-'}
        </Text>

        <Text size="sm" fw={600}>
          Culturas tipicas
        </Text>
        <Text size="sm" c="dimmed">
          {profile.culturas_tipicas.join(' | ') || '-'}
        </Text>

        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            Fonte oficial
          </Text>
          <Anchor href={profile.source_url} target="_blank" rel="noreferrer">
            Abrir referencia
          </Anchor>
        </Group>
      </Stack>
    </Card>
  );
}

export default function SolosHub() {
  const profiles = useMemo(() => listDefaultSoilTechnicalProfiles(), []);
  const [search, setSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('todas');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const orderOptions = useMemo(() => {
    const values = Array.from(new Set(profiles.map((item) => item.ordem))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
    return [{ value: 'todas', label: 'Todas as ordens' }, ...values.map((value) => ({ value, label: value }))];
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      if (orderFilter !== 'todas' && profile.ordem !== orderFilter) return false;
      return matchProfile(profile, search);
    });
  }, [profiles, orderFilter, search]);

  useEffect(() => {
    if (filteredProfiles.length === 0) {
      setSelectedProfileId(null);
      return;
    }
    const exists = filteredProfiles.some((item) => item.id === selectedProfileId);
    if (!exists) {
      setSelectedProfileId(filteredProfiles[0].id);
    }
  }, [filteredProfiles, selectedProfileId]);

  const selectedProfile = useMemo(
    () => filteredProfiles.find((item) => item.id === selectedProfileId) ?? null,
    [filteredProfiles, selectedProfileId],
  );

  return (
    <Container size="xl" py="md">
      <PageHeader title="Solos" />

      <Tabs defaultValue="consulta" variant="outline" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="consulta">Consulta tecnica SiBCS</Tabs.Tab>
          <Tabs.Tab value="identificacao">Identificacao SiBCS</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="consulta" pt="md">
          <Stack gap="sm">
            <Group grow align="end">
              <TextInput
                label="Buscar por ordem, subordem, processo ou cultura"
                placeholder="Ex.: Argissolo, latolizacao, soja"
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
              <Select
                label="Filtro por ordem"
                value={orderFilter}
                data={orderOptions}
                onChange={(value) => setOrderFilter(value ?? 'todas')}
              />
            </Group>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              <Card withBorder p="md">
                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <Text fw={700}>Classes cadastradas</Text>
                    <Badge variant="light">{filteredProfiles.length}</Badge>
                  </Group>
                  <ScrollArea h={480}>
                    <Stack gap={6}>
                      {filteredProfiles.map((profile) => {
                        const selected = profile.id === selectedProfileId;
                        return (
                          <Card
                            key={profile.id}
                            withBorder
                            p="xs"
                            onClick={() => setSelectedProfileId(profile.id)}
                            style={{
                              cursor: 'pointer',
                              borderColor: selected ? 'var(--mantine-color-green-6)' : undefined,
                              background: selected ? 'rgba(34,197,94,0.08)' : undefined,
                            }}
                          >
                            <Group justify="space-between" align="flex-start" wrap="nowrap">
                              <Stack gap={2}>
                                <Text fw={600} size="sm">
                                  {profile.ordem}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Horizonte: {profile.horizonte_diagnostico}
                                </Text>
                              </Stack>
                              <Badge size="xs" variant="light">
                                {profile.subordens_disponiveis.length} subordens
                              </Badge>
                            </Group>
                          </Card>
                        );
                      })}
                    </Stack>
                  </ScrollArea>
                </Stack>
              </Card>

              <SoilProfileDetails profile={selectedProfile} />
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="identificacao" pt="md">
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Utilize o motor hibrido SiBCS para triagem por laboratorio e checklist de campo.
            </Text>
            <SoilClassificationWorkspace />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}

