import { Container } from '@mantine/core';
import PageHeader from '../../components/PageHeader';
import RncCultivarSelector from '../Rnc/RncCultivarSelector';

export default function CulturasCadastro() {
  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Catálogo de Culturas (RNC)" />
      <RncCultivarSelector mode="catalog" />
    </Container>
  );
}
