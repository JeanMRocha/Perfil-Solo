import {
  Card,
  Group,
  Title,
  Switch,
  Stack,
  SimpleGrid,
  Divider,
  Select,
  Text,
  Button,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useStore } from '@nanostores/react';
import { analisesMock, AnaliseSolo } from '../../data/analisesMock';
import PhCard from './PhCard';
import NutrientCard from './NutrientCard';
import {
  getSoilParams,
  summarizeRanges,
} from '../../services/soilParamsService';
import type { NutrientKey, RangeMap } from '../../types/soil';
import { $currUser } from '../../global-state/user';
import {
  fetchOrCreateUserProperties,
  fetchTalhoesByProperty,
  saveLinkedAnalysis as persistLinkedAnalysis,
} from '../../services/propertyMapService';
import { NormalizationService } from '../../services/NormalizationService';
import { CalagemService } from '../../services/calculations/CalagemService';
import { GessagemService } from '../../services/calculations/GessagemService';
import { AdubacaoService } from '../../services/calculations/AdubacaoService';
import { isLocalDataMode } from '../../services/dataProvider';
import type { Property, Talhao } from '../../types/property';

const DEFAULT_UNITS: Record<string, string> = {
  pH: 'dmÂ³',
  P: 'mg/dmÂ³',
  K: 'mg/dmÂ³',
  Ca: 'cmolc/dmÂ³',
  Mg: 'cmolc/dmÂ³',
  Al: 'cmolc/dmÂ³',
  'M.O.': '%',
  MO: '%',
  'V%': '%',
  'm%': '%',
  'H+Al': 'cmolc/dmÂ³',
  SB: 'cmolc/dmÂ³',
  CTC: 'cmolc/dmÂ³',
  Argila: '%',
};

function mapDepthToEnum(depth: string): '0-10' | '0-20' | '20-40' | 'outra' {
  const normalized = depth.toLowerCase();
  if (normalized.includes('0-10')) return '0-10';
  if (normalized.includes('0-20')) return '0-20';
  if (normalized.includes('20-40')) return '20-40';
  return 'outra';
}

function toAgeInMonths(ageText?: string) {
  if (!ageText) return 24;
  const number = Number(ageText.replace(/\D/g, ''));
  return Number.isFinite(number) && number > 0 ? number : 24;
}

export default function CadastroAnaliseSolo() {
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);

  const [analises] = useState<AnaliseSolo[]>(analisesMock);
  const [analise, setAnalise] = useState<AnaliseSolo>(analisesMock[0]);
  const [values, setValues] = useState<Record<string, number>>(
    analisesMock[0].nutrientes,
  );
  const [idealRanges, setIdealRanges] = useState<RangeMap>(
    analisesMock[0].faixaIdeal,
  );

  const [properties, setProperties] = useState<Property[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [selectedTalhaoId, setSelectedTalhaoId] = useState<string | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [savingAnalysis, setSavingAnalysis] = useState(false);

  const initialEnabled = useMemo(() => {
    const nutrients = Object.keys(analisesMock[0].nutrientes);
    return nutrients.reduce((acc, key) => ({ ...acc, [key]: true }), {});
  }, []);

  const [enabled, setEnabled] =
    useState<Record<string, boolean>>(initialEnabled);

  const amostrasOptions = useMemo(
    () => analises.map((a) => a.codigo_amostra),
    [analises],
  );

  const propertyOptions = useMemo(
    () => properties.map((property) => ({ value: property.id, label: property.nome })),
    [properties],
  );

  const talhaoOptions = useMemo(
    () => talhoes.map((talhao) => ({ value: talhao.id, label: talhao.nome })),
    [talhoes],
  );

  useEffect(() => {
    let alive = true;

    const loadProperties = async () => {
      if (!currentUserId) return;
      setLoadingLinks(true);
      try {
        const loaded = await fetchOrCreateUserProperties(currentUserId);
        if (!alive) return;
        setProperties(loaded);
        setSelectedPropertyId((prev) => prev ?? loaded[0]?.id ?? null);
      } catch (err: any) {
        notifications.show({
          title: 'Falha ao carregar propriedades',
          message: err?.message ?? 'Nao foi possivel carregar propriedades.',
          color: 'red',
        });
      } finally {
        if (alive) setLoadingLinks(false);
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
        setSelectedTalhaoId(null);
        return;
      }

      setLoadingLinks(true);
      try {
        const loaded = await fetchTalhoesByProperty(selectedPropertyId);
        if (!alive) return;
        setTalhoes(loaded);
        setSelectedTalhaoId((prev) => {
          if (prev && loaded.some((talhao) => talhao.id === prev)) return prev;
          return loaded[0]?.id ?? null;
        });
      } catch (err: any) {
        notifications.show({
          title: 'Falha ao carregar talhoes',
          message: err?.message ?? 'Nao foi possivel carregar os talhoes.',
          color: 'red',
        });
      } finally {
        if (alive) setLoadingLinks(false);
      }
    };

    void loadTalhoes();
    return () => {
      alive = false;
    };
  }, [selectedPropertyId]);

  useEffect(() => {
    (async () => {
      const q = {
        cultura: analise.cultura,
        variedade: analise.variedade,
        estado: analise.estado,
        cidade: analise.cidade,
        extrator: 'mehlich-1',
        estagio: analise.estagio ?? 'producao',
      };
      const params = await getSoilParams(q);
      if (params?.ideal) {
        setIdealRanges(params.ideal);
        notifications.show({
          title: 'Faixas ideais aplicadas',
          message: summarizeRanges(params.ideal),
          color: 'teal',
        });
      }
    })();
  }, [
    analise.cultura,
    analise.variedade,
    analise.estado,
    analise.cidade,
    analise.estagio,
  ]);

  const handleAmostraChange = (codigoAmostra: string | null) => {
    const novaAnalise = analises.find((item) => item.codigo_amostra === codigoAmostra);
    if (!novaAnalise) return;

    setAnalise(novaAnalise);
    setValues(novaAnalise.nutrientes);
    setIdealRanges(novaAnalise.faixaIdeal);
    setEnabled(
      Object.keys(novaAnalise.nutrientes).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {},
      ),
    );
  };

  const toggle = (key: string, value: boolean) =>
    setEnabled((prev) => ({ ...prev, [key]: value }));
  const setVal = (key: string, value: number) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const nutrientKeys = useMemo(() => Object.keys(values), [values]);

  const saveLinkedAnalysis = async () => {
    if (!currentUserId) {
      notifications.show({
        title: 'Usuario nao autenticado',
        message: 'Faca login para salvar analises.',
        color: 'red',
      });
      return;
    }

    if (!selectedPropertyId || !selectedTalhaoId) {
      notifications.show({
        title: 'Vinculo incompleto',
        message: 'Selecione propriedade e talhao antes de salvar.',
        color: 'yellow',
      });
      return;
    }

    try {
      setSavingAnalysis(true);

      const raw: Record<string, any> = {};
      for (const [key, value] of Object.entries(values)) {
        const nutrientKey = key === 'M.O.' ? 'MO' : key;
        raw[nutrientKey] = {
          value: Number(value),
          unit: (DEFAULT_UNITS[key] ?? '%') as any,
        };
      }

      const nowIso = new Date().toISOString();
      const processed = NormalizationService.processContainer({
        id: crypto.randomUUID(),
        user_id: currentUserId,
        property_id: selectedPropertyId,
        talhao_id: selectedTalhaoId,
        data_amostragem: nowIso.slice(0, 10),
        profundidade: mapDepthToEnum(analise.profundidade),
        laboratorio: 'PerfilSolo Manual',
        raw: raw as any,
        executions: {},
        alerts: [],
        ruleset_frozen: true,
        created_at: nowIso,
        updated_at: nowIso,
      });

      const normalizedData = (processed.normalized ?? {}) as Record<string, any>;
      const calcInput = {
        analysisId: String(processed.id ?? crypto.randomUUID()),
        normalizedData,
        params: {
          V2: 70,
          PRNT: 90,
          cultura: analise.cultura,
          idade_meses: toAgeInMonths(analise.idade),
          idealRanges,
          profundidade: analise.profundidade,
        },
        rulesetVersion: 'v1',
      };

      const calagem = CalagemService.calculate(calcInput).execution;
      const gessagem = GessagemService.calculate(calcInput).execution;
      const adubacao = AdubacaoService.calculate(calcInput).execution;

      const insertPayload = {
        user_id: currentUserId,
        property_id: selectedPropertyId,
        talhao_id: selectedTalhaoId,
        data_amostragem: nowIso.slice(0, 10),
        profundidade: mapDepthToEnum(analise.profundidade),
        laboratorio: 'PerfilSolo Manual',
        raw: processed.raw ?? raw,
        normalized: processed.normalized ?? {},
        executions: {
          calagem,
          gessagem,
          adubacao,
        },
        alerts: processed.alerts ?? [],
        ruleset_frozen: true,
      };
      await persistLinkedAnalysis(insertPayload as any);

      notifications.show({
        title: 'Analise salva',
        message: 'Analise vinculada ao talhao com sucesso.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar analise',
        message: err?.message ?? 'Nao foi possivel salvar a analise.',
        color: 'red',
      });
    } finally {
      setSavingAnalysis(false);
    }
  };

  return (
    <Stack>
      <Card withBorder radius="md" p="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap="xs">
            <Title order={4} c="green.7">
              Dados da Analise
            </Title>
            <Text size="sm">
              <b>Proprietario:</b> {analise.proprietario}
            </Text>
            <Text size="sm">
              <b>Amostra:</b> {analise.codigo_amostra} ({analise.profundidade})
            </Text>
            <Text size="sm">
              <b>Cultura:</b> {analise.cultura} ({analise.variedade || 'Padrao'})
            </Text>
          </Stack>

          <Stack gap="xs" maw={340} w="100%">
            <Select
              label="Selecionar Amostra"
              value={analise.codigo_amostra}
              placeholder="Selecione"
              data={amostrasOptions}
              onChange={handleAmostraChange}
            />
            <Select
              label="Propriedade"
              placeholder="Selecione a propriedade"
              data={propertyOptions}
              value={selectedPropertyId}
              onChange={setSelectedPropertyId}
              disabled={loadingLinks}
            />
            <Select
              label="Talhao"
              placeholder="Selecione o talhao"
              data={talhaoOptions}
              value={selectedTalhaoId}
              onChange={setSelectedTalhaoId}
              disabled={loadingLinks || !selectedPropertyId}
            />
            <Button
              onClick={saveLinkedAnalysis}
              loading={savingAnalysis}
              disabled={!selectedPropertyId || !selectedTalhaoId}
            >
              Salvar analise no talhao
            </Button>
          </Stack>
        </Group>

        <Divider my="md" />

        <Group gap="md" wrap="wrap">
          <Text fw={500} size="sm">
            Exibir nutrientes:
          </Text>
          {nutrientKeys.map((key) => (
            <Switch
              key={key}
              checked={!!enabled[key]}
              onChange={(event) => toggle(key, event.currentTarget.checked)}
              label={key}
              color="green"
            />
          ))}
        </Group>
      </Card>

      <Divider label="Interpretacao dos Resultados" labelPosition="center" />

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
        {enabled.pH ? (
          <PhCard
            value={values.pH ?? 7}
            onChange={(value) => setVal('pH', value)}
            ideal={idealRanges.pH ?? [5.5, 6.5]}
          />
        ) : null}

        {nutrientKeys.map((nutrient) => {
          if (nutrient === 'pH' || !enabled[nutrient]) return null;

          const nutrientKey = nutrient as NutrientKey;
          const unit = DEFAULT_UNITS[nutrient] ?? '';
          const ideal = idealRanges[nutrientKey] ?? [0, 0];
          const max = Math.max(ideal[1] * 2, values[nutrient] * 1.2, 10);

          return (
            <NutrientCard
              key={nutrient}
              name={nutrient}
              unit={unit}
              value={values[nutrient] ?? 0}
              onChange={(value) => setVal(nutrient, value)}
              ideal={ideal}
              min={0}
              max={max}
            />
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
