import { Container } from '@mantine/core';
import PageHeader from '../../components/PageHeader';
import RncCultivarSelector from '../Rnc/RncCultivarSelector';

export default function CulturasBusca() {
  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Busca de Culturas" />
      <RncCultivarSelector mode="catalog" />
    </Container>
  );
}
