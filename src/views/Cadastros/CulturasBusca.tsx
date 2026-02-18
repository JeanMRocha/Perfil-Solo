import { Container } from '@mantine/core';
import PageHeader from '../../components/PageHeader';
import CulturasSettings from '../Config/CulturasSettings';

export default function CulturasBusca() {
  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Busca de Culturas" />
      <CulturasSettings />
    </Container>
  );
}
