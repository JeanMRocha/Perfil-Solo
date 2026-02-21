import {
  Button,
  Card,
  ColorInput,
  Container,
  Group,
  ScrollArea,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { type AppThemeMode, getBrandPalette, type BrandPalette } from '../../mantine/brand';
import {
  resetBrandThemeAll,
  resetBrandThemeMode,
  subscribeBrandTheme,
  updateBrandThemeMode,
} from '../../services/brandThemeService';

type SectionKey = keyof BrandPalette;

type PaletteField = {
  label: string;
  section: SectionKey;
  key: string;
};

const PALETTE_FIELDS: PaletteField[] = [
  { label: 'Header fundo', section: 'header', key: 'background' },
  { label: 'Header borda', section: 'header', key: 'border' },
  { label: 'Header texto', section: 'header', key: 'text' },
  { label: 'Header subtitulo', section: 'header', key: 'textMuted' },
  { label: 'Menu superior (admin)', section: 'menu', key: 'superRowBackground' },
  { label: 'Menu principal', section: 'menu', key: 'mainRowBackground' },
  { label: 'Footer fundo', section: 'footer', key: 'background' },
  { label: 'Footer borda', section: 'footer', key: 'border' },
  { label: 'Texto titulo', section: 'typography', key: 'title' },
  { label: 'Texto subtitulo', section: 'typography', key: 'subtitle' },
  { label: 'Texto padrao', section: 'typography', key: 'body' },
  { label: 'Botao principal fundo', section: 'actions', key: 'primaryButtonBackground' },
  { label: 'Botao principal texto', section: 'actions', key: 'primaryButtonText' },
  { label: 'Credito comprado (anel)', section: 'credits', key: 'ringPurchased' },
  { label: 'Credito promocional (anel)', section: 'credits', key: 'ringPromotional' },
  { label: 'Credito consumido (anel)', section: 'credits', key: 'ringConsumed' },
  { label: 'Credito comprado (texto)', section: 'credits', key: 'textPurchased' },
  { label: 'Credito promocional (texto)', section: 'credits', key: 'textPromotional' },
  { label: 'Credito consumido (texto)', section: 'credits', key: 'textConsumed' },
];

function getColorValue(palette: BrandPalette, section: SectionKey, key: string): string {
  const value = (palette as Record<string, any>)[section]?.[key];
  return typeof value === 'string' ? value : '#000000';
}

export default function ThemePersonalization() {
  const [, setVersion] = useState(0);
  const lightPalette = getBrandPalette('light');
  const darkPalette = getBrandPalette('dark');

  useEffect(() => {
    const unsubscribe = subscribeBrandTheme(() => {
      setVersion((current) => current + 1);
    });

    return unsubscribe;
  }, []);

  const handleColorChange = (mode: AppThemeMode, field: PaletteField, value: string) => {
    updateBrandThemeMode(mode, {
      [field.section]: {
        [field.key]: value,
      },
    } as Partial<BrandPalette>);
  };

  const handleResetMode = (mode: AppThemeMode) => {
    resetBrandThemeMode(mode);
    notifications.show({
      title: 'Tema resetado',
      message: `As cores de ${mode === 'dark' ? 'dark' : 'light'} voltaram ao padrao.`,
      color: 'green',
    });
  };

  const handleResetAll = () => {
    resetBrandThemeAll();
    notifications.show({
      title: 'Personalizacao removida',
      message: 'Todos os ajustes de cores foram resetados.',
      color: 'green',
    });
  };

  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Aparencia do Sistema" />
      <Text size="sm" c="dimmed" mb="md">
        Personalize por bloco visual: menu, textos, botoes e creditos. As mudancas sao salvas localmente.
      </Text>
      <Text size="sm" c="yellow.7" mb="md">
        Identidade da marca bloqueada: nome, logotipo e cores proprietarias nao podem ser alterados aqui.
      </Text>

      <Card withBorder radius="md" p="md" mb="md">
        <Group justify="space-between" wrap="wrap">
          <Text fw={600}>Tabela compacta: ajuste Light e Dark na mesma tela.</Text>
          <Group>
            <Button variant="light" color="yellow" onClick={() => handleResetMode('light')}>
              Resetar Light
            </Button>
            <Button variant="light" color="yellow" onClick={() => handleResetMode('dark')}>
              Resetar Dark
            </Button>
            <Button variant="light" color="red" onClick={handleResetAll}>
              Resetar tudo
            </Button>
          </Group>
        </Group>
      </Card>

      <Card withBorder radius="md" p={0}>
        <ScrollArea type="auto">
          <Table striped withTableBorder withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ minWidth: 220 }}>Elemento</Table.Th>
                <Table.Th style={{ minWidth: 280 }}>Light</Table.Th>
                <Table.Th style={{ minWidth: 280 }}>Dark</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {PALETTE_FIELDS.map((field) => (
                <Table.Tr key={`${field.section}.${field.key}`}>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {field.label}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ColorInput
                      format="hex"
                      value={getColorValue(lightPalette, field.section, field.key)}
                      onChange={(value) => handleColorChange('light', field, value)}
                      swatches={[
                        '#ffffff',
                        '#f8fafc',
                        '#e2e8f0',
                        '#1f2937',
                        '#0f172a',
                        '#16a34a',
                        '#2563eb',
                        '#dc2626',
                      ]}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ColorInput
                      format="hex"
                      value={getColorValue(darkPalette, field.section, field.key)}
                      onChange={(value) => handleColorChange('dark', field, value)}
                      swatches={[
                        '#ffffff',
                        '#f8fafc',
                        '#e2e8f0',
                        '#1f2937',
                        '#0f172a',
                        '#16a34a',
                        '#2563eb',
                        '#dc2626',
                      ]}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>
    </Container>
  );
}
