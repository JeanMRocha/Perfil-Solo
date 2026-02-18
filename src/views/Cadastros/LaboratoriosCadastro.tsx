import { Container } from '@mantine/core';
import PageHeader from '../../components/PageHeader';
import LaboratoriosSettings from '../Config/LaboratoriosSettings';

export default function LaboratoriosCadastro() {
  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Cadastro de Laboratorio" />
      <LaboratoriosSettings startInCreateMode />
    </Container>
  );
}
