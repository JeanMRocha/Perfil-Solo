import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Avatar,
  Button,
  Card,
  Container,
  Divider,
  FileInput,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import PageHeader from '../../components/PageHeader';
import {
  getSystemBrand,
  resetSystemBrand,
  subscribeSystemConfig,
  updateSystemBrand,
  type SystemBrandConfig,
} from '../../services/systemConfigService';
import {
  addPropertyAreaCategory,
  listPropertyAreaCategories,
  removePropertyAreaCategory,
  renamePropertyAreaCategory,
  setPropertyAreaCategoryActive,
  subscribePropertyAreaCategories,
  type PropertyAreaCategory,
} from '../../services/propertyAreaCategoriesService';

type IdentityDraft = {
  name: string;
  logo_url: string;
};

function toDraft(brand: SystemBrandConfig): IdentityDraft {
  return {
    name: brand.name,
    logo_url: brand.logo_url,
  };
}

const MAX_LOGO_FILE_BYTES = 1_500_000;
const ACCEPTED_LOGO_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

function isAcceptedLogoFile(file: File): boolean {
  if (!file.type) return false;
  if (ACCEPTED_LOGO_TYPES.has(file.type)) return true;
  return file.type.startsWith('image/');
}

export default function SystemIdentity() {
  const [brand, setBrand] = useState<SystemBrandConfig>(() => getSystemBrand());
  const [draft, setDraft] = useState<IdentityDraft>(() => toDraft(getSystemBrand()));
  const [areaCategories, setAreaCategories] = useState<PropertyAreaCategory[]>(
    () => listPropertyAreaCategories(true),
  );
  const [newAreaCategoryName, setNewAreaCategoryName] = useState('');
  const [categoryRenameDraft, setCategoryRenameDraft] = useState<Record<string, string>>(
    {},
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeSystemConfig((config) => {
      setBrand(config.brand);
      setDraft(toDraft(config.brand));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const refresh = () => {
      setAreaCategories(listPropertyAreaCategories(true));
    };
    refresh();
    const unsubscribe = subscribePropertyAreaCategories((rows) => {
      setAreaCategories(
        [...rows].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      );
    });
    return unsubscribe;
  }, []);

  const previewName = useMemo(() => {
    const value = draft.name.trim();
    return value || 'PerfilSolo';
  }, [draft.name]);

  const hasChanges =
    draft.name.trim() !== brand.name || draft.logo_url.trim() !== brand.logo_url;

  const handleLogoFile = (file: File | null) => {
    if (!file) {
      setDraft((prev) => ({ ...prev, logo_url: '' }));
      return;
    }

    if (file.size > MAX_LOGO_FILE_BYTES) {
      notifications.show({
        title: 'Arquivo muito grande',
        message: 'Use uma imagem de ate 1.5 MB para a logo do sistema.',
        color: 'yellow',
      });
      return;
    }

    if (!isAcceptedLogoFile(file)) {
      notifications.show({
        title: 'Formato não suportado',
        message: 'Use PNG, JPG, WEBP ou SVG para a logo do sistema.',
        color: 'yellow',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      setDraft((prev) => ({ ...prev, logo_url: result }));
    };
    reader.onerror = () => {
      notifications.show({
        title: 'Falha no upload',
        message: 'Não foi possível ler o arquivo da logo selecionada.',
        color: 'red',
      });
    };
    reader.readAsDataURL(file);
  };

  const saveIdentity = () => {
    setIsSaving(true);
    try {
      const next = updateSystemBrand({
        name: draft.name,
        logo_url: draft.logo_url,
      });
      setBrand(next.brand);
      setDraft(toDraft(next.brand));
      notifications.show({
        title: 'Identidade atualizada',
        message: 'Nome e logo foram atualizados para todo o sistema.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Falha ao salvar',
        message: 'Não foi possível atualizar a identidade do sistema.',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const restoreDefault = () => {
    const next = resetSystemBrand();
    setBrand(next.brand);
    setDraft(toDraft(next.brand));
    notifications.show({
      title: 'Padrao restaurado',
      message: 'O sistema voltou para o nome e logo padrao.',
      color: 'blue',
    });
  };

  const createAreaCategory = () => {
    try {
      addPropertyAreaCategory(newAreaCategoryName);
      setNewAreaCategoryName('');
      notifications.show({
        title: 'Categoria criada',
        message: 'A categoria de area foi adicionada.',
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao criar categoria',
        message: String(error?.message ?? 'Não foi possível criar a categoria.'),
        color: 'red',
      });
    }
  };

  const saveCategoryRename = (category: PropertyAreaCategory) => {
    const draftName = categoryRenameDraft[category.id];
    if (draftName == null) return;
    try {
      renamePropertyAreaCategory(category.id, draftName);
      setCategoryRenameDraft((prev) => {
        const next = { ...prev };
        delete next[category.id];
        return next;
      });
      notifications.show({
        title: 'Categoria renomeada',
        message: 'Nome da categoria atualizado com sucesso.',
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao renomear',
        message: String(error?.message ?? 'Não foi possível renomear a categoria.'),
        color: 'red',
      });
    }
  };

  const toggleCategoryActive = (category: PropertyAreaCategory) => {
    try {
      setPropertyAreaCategoryActive(category.id, !category.active);
      notifications.show({
        title: category.active ? 'Categoria desativada' : 'Categoria ativada',
        message: `Categoria ${category.name} atualizada.`,
        color: category.active ? 'yellow' : 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao atualizar categoria',
        message: String(error?.message ?? 'Não foi possível atualizar a categoria.'),
        color: 'red',
      });
    }
  };

  const removeCategory = (category: PropertyAreaCategory) => {
    const confirmed = window.confirm(
      `Remover a categoria "${category.name}"?`,
    );
    if (!confirmed) return;
    try {
      removePropertyAreaCategory(category.id);
      notifications.show({
        title: 'Categoria removida',
        message: 'Categoria de area removida com sucesso.',
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Falha ao remover categoria',
        message: String(error?.message ?? 'Não foi possível remover a categoria.'),
        color: 'red',
      });
    }
  };

  return (
    <Container size="md" mt="xl">
      <PageHeader title="Identidade do Sistema" color="teal" />

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Text c="dimmed" size="sm">
            Esta configuracao e global. O nome e a logo definidos aqui aparecem no
            header e nas telas que usam a identidade principal do sistema.
          </Text>

          <Group gap="md" wrap="nowrap">
            <Avatar radius="md" size="lg" src={draft.logo_url || undefined}>
              {previewName.slice(0, 2).toUpperCase()}
            </Avatar>
            <div>
              <Text fw={700}>{previewName}</Text>
              <Text size="xs" c="dimmed">
                Pre-visualizacao da marca
              </Text>
            </div>
          </Group>

          <TextInput
            label="Nome do sistema"
            placeholder="Ex.: PerfilSolo"
            value={draft.name}
            maxLength={40}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, name: event.currentTarget.value }))
            }
          />

          <TextInput
            label="URL da logo"
            placeholder="https://..."
            value={draft.logo_url}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, logo_url: event.currentTarget.value }))
            }
          />

          <FileInput
            label="Carregar logo"
            placeholder="Selecione PNG, JPG, WEBP ou SVG"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            clearable
            leftSection={<IconUpload size={16} />}
            onChange={handleLogoFile}
          />
          <Text size="xs" c="dimmed">
            Upload salva a imagem em base64 localmente e substitui a URL atual da logo.
          </Text>

          <Group justify="flex-end">
            <Button variant="default" onClick={restoreDefault}>
              Restaurar padrao
            </Button>
            <Button
              color="teal"
              loading={isSaving}
              disabled={!hasChanges}
              onClick={saveIdentity}
            >
              Salvar identidade
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg" mt="md">
        <Stack gap="md">
          <Text fw={700}>Categorias de Areas</Text>
          <Text c="dimmed" size="sm">
            Essas categorias aparecem no cadastro de propriedades na aba de resumo de
            areas. Apenas o super usuario deve alterar esta lista.
          </Text>

          <Group align="end">
            <TextInput
              label="Nova categoria"
              placeholder="Ex.: Area de servidao"
              value={newAreaCategoryName}
              onChange={(event) => setNewAreaCategoryName(event.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={createAreaCategory}>Adicionar</Button>
          </Group>

          <Divider />

          {areaCategories.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nenhuma categoria cadastrada.
            </Text>
          ) : (
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Categoria</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Acoes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {areaCategories.map((category) => {
                  const renameValue =
                    categoryRenameDraft[category.id] ?? category.name;
                  return (
                    <Table.Tr key={category.id}>
                      <Table.Td>
                        <TextInput
                          value={renameValue}
                          onChange={(event) =>
                            setCategoryRenameDraft((prev) => ({
                              ...prev,
                              [category.id]: event.currentTarget.value,
                            }))
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <Badge color={category.active ? 'green' : 'gray'}>
                          {category.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => saveCategoryRename(category)}
                          >
                            Renomear
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color={category.active ? 'yellow' : 'green'}
                            onClick={() => toggleCategoryActive(category)}
                          >
                            {category.active ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            onClick={() => removeCategory(category)}
                          >
                            Remover
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </Container>
  );
}
