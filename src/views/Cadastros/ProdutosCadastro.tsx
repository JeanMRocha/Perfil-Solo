import PageHeader from '../../components/PageHeader';
import ProdutosManager from './ProdutosManager';

export default function ProdutosCadastro() {
  return (
    <div className="container mx-auto mt-6 max-w-7xl">
      <PageHeader title="Cadastro de Produto" />
      <ProdutosManager startInCreateMode />
    </div>
  );
}
