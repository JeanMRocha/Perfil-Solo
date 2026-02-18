import { Container } from '@mantine/core';
import PageHeader from '../../components/PageHeader';
import LaboratoriosSettings from '../Config/LaboratoriosSettings';

export default function LaboratoriosBusca() {
  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Busca de Laboratorios" />
      <LaboratoriosSettings />
    </Container>
  );
}
