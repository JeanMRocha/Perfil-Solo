import { rem } from '@mantine/core';
import {
  IconDashboard,
  IconFileText,
  IconHome,
  IconSearch,
} from '@tabler/icons-react';
import { Spotlight, SpotlightActionData } from '@mantine/spotlight';
import { getSystemBrand } from '@services/systemConfigService';

const systemName = getSystemBrand().name;

const Spotlightactions: SpotlightActionData[] = [
  {
    id: 'home',
    label: 'Home',
    description: 'Ir para a página inicial',
    onClick: () => (window.location.href = '/'),
    leftSection: (
      <IconHome style={{ width: rem(24), height: rem(24) }} stroke={1.5} />
    ),
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: `Abrir painel ${systemName}`,
    onClick: () => (window.location.href = '/dashboard'),
    leftSection: (
      <IconDashboard style={{ width: rem(24), height: rem(24) }} stroke={1.5} />
    ),
  },
  {
    id: 'documentation',
    label: 'Documentação',
    description: 'Visitar documentação do Mantine',
    onClick: () => window.open('https://mantine.dev', '_blank'),
    leftSection: (
      <IconFileText style={{ width: rem(24), height: rem(24) }} stroke={1.5} />
    ),
  },
];

export const CustomSpotlight = () => (
  <Spotlight
    actions={Spotlightactions}
    nothingFound="Nada encontrado..."
    highlightQuery
    searchProps={{
      leftSection: (
        <IconSearch style={{ width: rem(20), height: rem(20) }} stroke={1.5} />
      ),
      placeholder: 'Buscar...',
    }}
  />
);
