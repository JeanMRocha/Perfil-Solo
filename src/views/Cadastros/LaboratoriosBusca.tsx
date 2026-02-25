import PageHeader from '../../components/PageHeader';
import LaboratoriosSettings from '../Config/LaboratoriosSettings';

export default function LaboratoriosBusca() {
  return (
    <div className="container mx-auto mt-6 max-w-7xl">
      <PageHeader title="Busca de Laboratorios" />
      <LaboratoriosSettings />
    </div>
  );
}
