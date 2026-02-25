import PageHeader from '../../components/PageHeader';
import LaboratoriosSettings from '../Config/LaboratoriosSettings';

export default function LaboratoriosCadastro() {
  return (
    <div className="container mx-auto mt-6 max-w-7xl">
      <PageHeader title="Cadastro de Laboratorio" />
      <LaboratoriosSettings startInCreateMode />
    </div>
  );
}
