import { Container } from '@mantine/core';
import PageHeader from '../../components/PageHeader';
import CulturasSettings from '../Config/CulturasSettings';

export default function CulturasCadastro() {
  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Cadastro de Cultura" />
      <CulturasSettings startInCreateMode />
    </Container>
  );
}
