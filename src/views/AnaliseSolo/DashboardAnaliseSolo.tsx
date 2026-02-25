import CadastroAnaliseSolo from './CadastroAnaliseSolo';

export default function DashboardAnaliseSolo() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-brand">
          Analises de Solo
        </h3>
        <p className="text-sm text-muted-foreground">
          Cadastro, interpretacao e historico da area.
        </p>
      </div>
      <CadastroAnaliseSolo />
    </div>
  );
}
