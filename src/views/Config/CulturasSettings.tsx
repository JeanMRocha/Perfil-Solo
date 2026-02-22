import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import {
  CULTURE_PARAM_KEYS,
  deleteLocalCultureProfile,
  listLocalCultureProfiles,
  type LocalCultureProduct,
  type LocalCultureProfile,
  upsertLocalCultureProfile,
} from '../../services/cultureProfilesService';
import type { NutrientKey, RangeMap } from '../../types/soil';

type RangeDraft = { min: number | ''; max: number | '' };

type CultureDraft = {
  id?: string;
  cultura: string;
  variedade: string;
  estagio: string;
  extrator: string;
  idade_min: number | '';
  idade_max: number | '';
  observacoes: string;
  produtos: ProductDraft[];
  ranges: Record<string, RangeDraft>;
};

type ProductDraft = {
  id: string;
  nome: string;
  sku: string;
  valor_unitario: number | '';
  observacoes: string;
  unidade_comercial: string;
  ncm: string;
  cest: string;
  cfop: string;
  cst_icms: string;
  cst_pis: string;
  cst_cofins: string;
  aliquota_icms: number | '';
  aliquota_pis: number | '';
  aliquota_cofins: number | '';
};

function createProductId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `produto-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyProductDraft(): ProductDraft {
  return {
    id: createProductId(),
    nome: '',
    sku: '',
    valor_unitario: '',
    observacoes: '',
    unidade_comercial: '',
    ncm: '',
    cest: '',
    cfop: '',
    cst_icms: '',
    cst_pis: '',
    cst_cofins: '',
    aliquota_icms: '',
    aliquota_pis: '',
    aliquota_cofins: '',
  };
}

function createEmptyRanges(): Record<string, RangeDraft> {
  const out: Record<string, RangeDraft> = {};
  for (const key of CULTURE_PARAM_KEYS) {
    out[key] = { min: '', max: '' };
  }
  return out;
}

function createEmptyDraft(): CultureDraft {
  return {
    cultura: '',
    variedade: '',
    estagio: '',
    extrator: 'mehlich-1',
    idade_min: '',
    idade_max: '',
    observacoes: '',
    produtos: [],
    ranges: createEmptyRanges(),
  };
}

function toDraftNumber(value: unknown): number | '' {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : '';
}

function profileProductToDraft(product: LocalCultureProduct): ProductDraft {
  return {
    id: product.id,
    nome: product.nome ?? '',
    sku: product.sku ?? '',
    valor_unitario: toDraftNumber(product.valor_unitario),
    observacoes: product.observacoes ?? '',
    unidade_comercial: product.fiscal?.unidade_comercial ?? '',
    ncm: product.fiscal?.ncm ?? '',
    cest: product.fiscal?.cest ?? '',
    cfop: product.fiscal?.cfop ?? '',
    cst_icms: product.fiscal?.cst_icms ?? '',
    cst_pis: product.fiscal?.cst_pis ?? '',
    cst_cofins: product.fiscal?.cst_cofins ?? '',
    aliquota_icms: toDraftNumber(product.fiscal?.aliquota_icms),
    aliquota_pis: toDraftNumber(product.fiscal?.aliquota_pis),
    aliquota_cofins: toDraftNumber(product.fiscal?.aliquota_cofins),
  };
}

function profileToDraft(profile: LocalCultureProfile): CultureDraft {
  const ranges = createEmptyRanges();
  for (const [key, value] of Object.entries(profile.ideal ?? {})) {
    if (!Array.isArray(value)) continue;
    ranges[key] = { min: Number(value[0]), max: Number(value[1]) };
  }
  return {
    id: profile.id,
    cultura: profile.cultura ?? '',
    variedade: profile.variedade ?? '',
    estagio: profile.estagio ?? '',
    extrator: profile.extrator ?? 'mehlich-1',
    idade_min:
      profile.idade_min == null || !Number.isFinite(profile.idade_min)
        ? ''
        : profile.idade_min,
    idade_max:
      profile.idade_max == null || !Number.isFinite(profile.idade_max)
        ? ''
        : profile.idade_max,
    observacoes: profile.observacoes ?? '',
    produtos: Array.isArray(profile.produtos)
      ? profile.produtos.map(profileProductToDraft)
      : [],
    ranges,
  };
}

function buildRangeMap(ranges: Record<string, RangeDraft>): RangeMap {
  const out: RangeMap = {};
  for (const [key, draft] of Object.entries(ranges)) {
    if (!Number.isFinite(Number(draft.min)) || !Number.isFinite(Number(draft.max))) {
      continue;
    }
    out[key as NutrientKey] = [
      Math.min(Number(draft.min), Number(draft.max)),
      Math.max(Number(draft.min), Number(draft.max)),
    ];
  }
  return out;
}

function optionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function optionalNumber(value: number | ''): number | null {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildProducts(products: ProductDraft[]): LocalCultureProduct[] {
  return products
    .map((item) => {
      const nome = item.nome.trim();
      if (!nome) return null;
      const fiscal = {
        unidade_comercial: optionalText(item.unidade_comercial),
        ncm: optionalText(item.ncm),
        cest: optionalText(item.cest),
        cfop: optionalText(item.cfop),
        cst_icms: optionalText(item.cst_icms),
        cst_pis: optionalText(item.cst_pis),
        cst_cofins: optionalText(item.cst_cofins),
        aliquota_icms: optionalNumber(item.aliquota_icms),
        aliquota_pis: optionalNumber(item.aliquota_pis),
        aliquota_cofins: optionalNumber(item.aliquota_cofins),
      };
      const hasFiscal = Object.values(fiscal).some((value) => value != null);

      return {
        id: item.id,
        nome,
        sku: optionalText(item.sku),
        valor_unitario: optionalNumber(item.valor_unitario),
        observacoes: optionalText(item.observacoes),
        fiscal: hasFiscal ? fiscal : undefined,
      } as LocalCultureProduct;
    })
    .filter((item): item is LocalCultureProduct => item != null);
}

interface CulturasSettingsProps {
  startInCreateMode?: boolean;
}

export default function CulturasSettings({
  startInCreateMode = false,
}: CulturasSettingsProps) {
  const [rows, setRows] = useState<LocalCultureProfile[]>(() =>
    listLocalCultureProfiles(),
  );
  const [modalOpened, setModalOpened] = useState(false);
  const [draft, setDraft] = useState<CultureDraft>(createEmptyDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!startInCreateMode) return;
    setDraft(createEmptyDraft());
    setModalOpened(true);
  }, [startInCreateMode]);

  const validRangesCount = useMemo(
    () => Object.keys(buildRangeMap(draft.ranges)).length,
    [draft.ranges],
  );

  const openCreate = () => {
    setDraft(createEmptyDraft());
    setModalOpened(true);
  };

  const openEdit = (row: LocalCultureProfile) => {
    setDraft(profileToDraft(row));
    setModalOpened(true);
  };

  const addProduct = () => {
    setDraft((prev) => ({
      ...prev,
      produtos: [...prev.produtos, createEmptyProductDraft()],
    }));
  };

  const updateProduct = (
    productId: string,
    patch: Partial<ProductDraft>,
  ) => {
    setDraft((prev) => ({
      ...prev,
      produtos: prev.produtos.map((product) =>
        product.id === productId ? { ...product, ...patch } : product,
      ),
    }));
  };

  const removeProduct = (productId: string) => {
    setDraft((prev) => ({
      ...prev,
      produtos: prev.produtos.filter((product) => product.id !== productId),
    }));
  };

  const handleDelete = (row: LocalCultureProfile) => {
    modals.openConfirmModal({
      title: 'Excluir regra de cultura',
      centered: true,
      labels: { confirm: 'Excluir', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      children: (
        <Text size="sm">
          Remover regra de <b>{row.cultura}</b>
          {row.variedade ? ` / ${row.variedade}` : ''}?
        </Text>
      ),
      onConfirm: () => {
        deleteLocalCultureProfile(row.id);
        setRows(listLocalCultureProfiles());
        notifications.show({
          title: 'Regra removida',
          message: 'Cadastro de cultura removido com sucesso.',
          color: 'green',
        });
      },
    });
  };

  const handleSave = () => {
    const cultura = draft.cultura.trim();
    if (!cultura) {
      notifications.show({
        title: 'Cultura obrigatoria',
        message: 'Informe a cultura para salvar os parametros.',
        color: 'yellow',
      });
      return;
    }

    if (
      draft.idade_min !== '' &&
      draft.idade_max !== '' &&
      Number(draft.idade_min) > Number(draft.idade_max)
    ) {
      notifications.show({
        title: 'Faixa de idade inválida',
        message: 'Idade minima não pode ser maior que idade maxima.',
        color: 'yellow',
      });
      return;
    }

    const ideal = buildRangeMap(draft.ranges);
    if (Object.keys(ideal).length === 0) {
      notifications.show({
        title: 'Sem parametros',
        message: 'Preencha pelo menos um parametro com min e max.',
        color: 'yellow',
      });
      return;
    }

    try {
      setSaving(true);
      const produtos = buildProducts(draft.produtos);
      upsertLocalCultureProfile({
        id: draft.id,
        cultura,
        variedade: draft.variedade || null,
        estagio: draft.estagio || null,
        extrator: draft.extrator || null,
        estado: null,
        cidade: null,
        idade_min: draft.idade_min === '' ? null : Number(draft.idade_min),
        idade_max: draft.idade_max === '' ? null : Number(draft.idade_max),
        observacoes: draft.observacoes || null,
        produtos,
        ideal,
      });
      setRows(listLocalCultureProfiles());
      setModalOpened(false);
      notifications.show({
        title: 'Parametros salvos',
        message: 'Cadastro de cultura atualizado com sucesso.',
        color: 'green',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack>
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        centered
        size="xl"
        title="Cadastro de cultura e cultivar"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Defina parametros por cultura, cultivar e faixa de idade (fruteiras).
          </Text>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            <TextInput
              label="Cultura"
              value={draft.cultura}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, cultura: e.currentTarget.value }))
              }
              placeholder="Ex.: Abacate"
            />
            <TextInput
              label="Cultivar / Variedade"
              value={draft.variedade}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, variedade: e.currentTarget.value }))
              }
              placeholder="Ex.: Fortuna"
            />
            <TextInput
              label="Estagio"
              value={draft.estagio}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, estagio: e.currentTarget.value }))
              }
              placeholder="Ex.: produção"
            />
            <TextInput
              label="Extrator"
              value={draft.extrator}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, extrator: e.currentTarget.value }))
              }
              placeholder="mehlich-1"
            />
            <NumberInput
              label="Idade minima (meses)"
              value={draft.idade_min}
              min={0}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  idade_min: Number.isFinite(Number(value)) ? Number(value) : '',
                }))
              }
            />
            <NumberInput
              label="Idade maxima (meses)"
              value={draft.idade_max}
              min={0}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  idade_max: Number.isFinite(Number(value)) ? Number(value) : '',
                }))
              }
            />
          </SimpleGrid>

          <TextInput
            label="Observações"
            value={draft.observacoes}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, observacoes: e.currentTarget.value }))
            }
            placeholder="Observações tecnicas da regra"
          />

          <Card withBorder p="sm">
            <Group justify="space-between" mb="xs">
              <div>
                <Text fw={600}>Produtos e dados de NFe</Text>
                <Text size="xs" c="dimmed">
                  Cadastre produtos vinculados a cultura para emissao fiscal.
                </Text>
              </div>
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={addProduct}
              >
                Adicionar produto
              </Button>
            </Group>

            {draft.produtos.length === 0 ? (
              <Text size="sm" c="dimmed">
                Nenhum produto cadastrado para esta cultura.
              </Text>
            ) : (
              <ScrollArea h={280}>
                <Stack gap="sm">
                  {draft.produtos.map((product) => (
                    <Card key={product.id} withBorder p="sm">
                      <Group justify="space-between" mb="xs">
                        <Text fw={600}>{product.nome || 'Novo produto'}</Text>
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => removeProduct(product.id)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>

                      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
                        <TextInput
                          label="Nome do produto"
                          value={product.nome}
                          onChange={(e) =>
                            updateProduct(product.id, { nome: e.currentTarget.value })
                          }
                          placeholder="Ex.: Milho grao tipo 1"
                        />
                        <TextInput
                          label="SKU / Código interno"
                          value={product.sku}
                          onChange={(e) =>
                            updateProduct(product.id, { sku: e.currentTarget.value })
                          }
                        />
                        <NumberInput
                          label="Valor unitario"
                          min={0}
                          decimalScale={2}
                          value={product.valor_unitario}
                          onChange={(value) =>
                            updateProduct(product.id, {
                              valor_unitario:
                                Number.isFinite(Number(value)) && value !== ''
                                  ? Number(value)
                                  : '',
                            })
                          }
                        />
                        <TextInput
                          label="Unidade comercial"
                          value={product.unidade_comercial}
                          onChange={(e) =>
                            updateProduct(product.id, {
                              unidade_comercial: e.currentTarget.value,
                            })
                          }
                          placeholder="UN, KG, SC, CX"
                        />
                        <TextInput
                          label="NCM"
                          value={product.ncm}
                          onChange={(e) =>
                            updateProduct(product.id, { ncm: e.currentTarget.value })
                          }
                        />
                        <TextInput
                          label="CEST"
                          value={product.cest}
                          onChange={(e) =>
                            updateProduct(product.id, { cest: e.currentTarget.value })
                          }
                        />
                        <TextInput
                          label="CFOP"
                          value={product.cfop}
                          onChange={(e) =>
                            updateProduct(product.id, { cfop: e.currentTarget.value })
                          }
                        />
                        <TextInput
                          label="CST/CSOSN ICMS"
                          value={product.cst_icms}
                          onChange={(e) =>
                            updateProduct(product.id, { cst_icms: e.currentTarget.value })
                          }
                        />
                        <NumberInput
                          label="Aliquota ICMS (%)"
                          min={0}
                          max={100}
                          decimalScale={4}
                          value={product.aliquota_icms}
                          onChange={(value) =>
                            updateProduct(product.id, {
                              aliquota_icms:
                                Number.isFinite(Number(value)) && value !== ''
                                  ? Number(value)
                                  : '',
                            })
                          }
                        />
                        <TextInput
                          label="CST PIS"
                          value={product.cst_pis}
                          onChange={(e) =>
                            updateProduct(product.id, { cst_pis: e.currentTarget.value })
                          }
                        />
                        <NumberInput
                          label="Aliquota PIS (%)"
                          min={0}
                          max={100}
                          decimalScale={4}
                          value={product.aliquota_pis}
                          onChange={(value) =>
                            updateProduct(product.id, {
                              aliquota_pis:
                                Number.isFinite(Number(value)) && value !== ''
                                  ? Number(value)
                                  : '',
                            })
                          }
                        />
                        <TextInput
                          label="CST COFINS"
                          value={product.cst_cofins}
                          onChange={(e) =>
                            updateProduct(product.id, { cst_cofins: e.currentTarget.value })
                          }
                        />
                        <NumberInput
                          label="Aliquota COFINS (%)"
                          min={0}
                          max={100}
                          decimalScale={4}
                          value={product.aliquota_cofins}
                          onChange={(value) =>
                            updateProduct(product.id, {
                              aliquota_cofins:
                                Number.isFinite(Number(value)) && value !== ''
                                  ? Number(value)
                                  : '',
                            })
                          }
                        />
                      </SimpleGrid>

                      <Divider my="xs" />
                      <TextInput
                        label="Observações do produto"
                        value={product.observacoes}
                        onChange={(e) =>
                          updateProduct(product.id, { observacoes: e.currentTarget.value })
                        }
                      />
                    </Card>
                  ))}
                </Stack>
              </ScrollArea>
            )}
          </Card>

          <Card withBorder p="sm">
            <Group justify="space-between" mb="xs">
              <Text fw={600}>Faixas ideais por parametro</Text>
              <Badge color="indigo">{validRangesCount} parametros validos</Badge>
            </Group>
            <ScrollArea h={260}>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                {CULTURE_PARAM_KEYS.map((param) => (
                  <Group key={param} grow wrap="nowrap">
                    <Text w={55} fw={600}>
                      {param}
                    </Text>
                    <NumberInput
                      placeholder="min"
                      value={draft.ranges[param].min}
                      decimalScale={2}
                      onChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          ranges: {
                            ...prev.ranges,
                            [param]: {
                              ...prev.ranges[param],
                              min:
                                Number.isFinite(Number(value)) && value !== ''
                                  ? Number(value)
                                  : '',
                            },
                          },
                        }))
                      }
                    />
                    <NumberInput
                      placeholder="max"
                      value={draft.ranges[param].max}
                      decimalScale={2}
                      onChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          ranges: {
                            ...prev.ranges,
                            [param]: {
                              ...prev.ranges[param],
                              max:
                                Number.isFinite(Number(value)) && value !== ''
                                  ? Number(value)
                                  : '',
                            },
                          },
                        }))
                      }
                    />
                  </Group>
                ))}
              </SimpleGrid>
            </ScrollArea>
          </Card>

          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              onClick={() => setModalOpened(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Salvar parametros
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Group justify="space-between">
        <div>
          <Text fw={700}>Cadastro de Cultura</Text>
          <Text size="sm" c="dimmed">
            Parametros por cultivar e faixa de idade (fruteiras).
          </Text>
        </div>
        <Button onClick={openCreate}>Nova regra</Button>
      </Group>

      {rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          Nenhuma regra cadastrada ainda.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {rows.map((row) => (
            <Card key={row.id} withBorder radius="md" p="md">
              <Stack gap={6}>
                <Group justify="space-between">
                  <Text fw={700}>
                    {row.cultura}
                    {row.variedade ? ` / ${row.variedade}` : ''}
                  </Text>
                  <Group gap={6}>
                    <Badge color="teal">{Object.keys(row.ideal ?? {}).length} params</Badge>
                    <Badge color="indigo">{row.produtos?.length ?? 0} produtos</Badge>
                  </Group>
                </Group>
                <Text size="sm" c="dimmed">
                  Estagio: {row.estagio || '-'} | Extrator: {row.extrator || '-'}
                </Text>
                <Text size="sm" c="dimmed">
                  Idade: {row.idade_min ?? '-'} a {row.idade_max ?? '-'} meses
                </Text>
                {row.observacoes ? (
                  <Text size="sm" c="dimmed">
                    {row.observacoes}
                  </Text>
                ) : null}
                <Group mt="xs">
                  <Button size="xs" variant="light" onClick={() => openEdit(row)}>
                    Editar
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    onClick={() => handleDelete(row)}
                  >
                    Excluir
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
