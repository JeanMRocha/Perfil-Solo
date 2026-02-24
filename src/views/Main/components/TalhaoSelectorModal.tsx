import { Loader } from '@mantine/core';
import {
  IconEdit,
  IconFileExport,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import type { Talhao } from '../../../types/property';
import { Button as ShadButton } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../components/ui/dialog';
import { Input as ShadInput } from '../../../components/ui/input';
import { ScrollArea as ShadScrollArea } from '../../../components/ui/scroll-area';
import { cn } from '../../../lib/utils';

export type TalhaoSelectionRow = Talhao & {
  analysesCount: number;
};

type TalhaoSelectorModalProps = {
  opened: boolean;
  onClose: () => void;
  propertyName: string;
  tema: string;
  loading: boolean;
  loadError: string | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  rows: TalhaoSelectionRow[];
  selectedTalhaoId: string | null;
  onSelectTalhao: (talhaoId: string) => void;
  onExport: () => void;
  onCreateTalhao: () => void;
  onEditTalhao: (talhaoId: string) => void;
  onDeleteTalhao: (row: TalhaoSelectionRow) => void;
  onRetryLoad: () => void;
};

function formatAreaHa(value: number | null | undefined): string {
  const safeValue = Number(value ?? 0);
  if (!Number.isFinite(safeValue) || safeValue <= 0) return '0,00';
  return safeValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isPositiveNumber(value: unknown): boolean {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0;
}

function normalizeKey(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isUnclassifiedSoil(value?: string | null): boolean {
  const normalized = normalizeKey(value);
  return (
    normalized === 'nao classificado' || normalized === '__nao_classificado__'
  );
}

export default function TalhaoSelectorModal({
  opened,
  onClose,
  propertyName,
  tema,
  loading,
  loadError,
  searchValue,
  onSearchChange,
  rows,
  selectedTalhaoId,
  onSelectTalhao,
  onExport,
  onCreateTalhao,
  onEditTalhao,
  onDeleteTalhao,
  onRetryLoad,
}: TalhaoSelectorModalProps) {
  return (
    <Dialog open={opened} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[760px] w-[92vw] overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Talhões de {propertyName}</DialogTitle>
          <DialogDescription className="hidden">
            Gerencie os talhões da propriedade selecionada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <ShadInput
                placeholder="Buscar talhão por nome"
                value={searchValue}
                onChange={(event) => onSearchChange(event.currentTarget.value)}
                className="pl-9"
                disabled={loading}
              />
            </div>
            <div className="flex gap-2 whitespace-nowrap">
              <ShadButton
                variant="outline"
                size="sm"
                onClick={onExport}
                disabled={loading}
                className="h-9"
              >
                <IconFileExport className="mr-2 h-4 w-4" />
                Exportar
              </ShadButton>
              <ShadButton
                size="sm"
                onClick={onCreateTalhao}
                disabled={loading}
                className="h-9 bg-amber-600 hover:bg-amber-700"
              >
                <IconPlus className="mr-2 h-4 w-4" />
                Cadastrar
              </ShadButton>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader size="sm" />
              <span className="text-sm text-slate-500">Carregando talhões...</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-red-500">{loadError}</span>
              <ShadButton variant="outline" size="sm" onClick={onRetryLoad}>
                Tentar novamente
              </ShadButton>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-4">
              <span className="text-sm text-slate-500 italic">
                Nenhum talhão encontrado para esta propriedade.
              </span>
            </div>
          ) : (
            <ShadScrollArea className="flex-1 -mx-2 px-2 overflow-y-auto max-h-[52vh]">
              <div className="flex flex-col gap-2 pr-4">
                {rows.map((row) => {
                  const selected = row.id === selectedTalhaoId;
                  const tipoSoloRaw = String(row.tipo_solo ?? '').trim();
                  const tipoSolo =
                    tipoSoloRaw && !isUnclassifiedSoil(tipoSoloRaw) ? tipoSoloRaw : '';
                  const rowMetaParts: string[] = [];
                  if (isPositiveNumber(row.area_ha)) {
                    rowMetaParts.push(`Área: ${formatAreaHa(row.area_ha)} ha`);
                  }
                  if (tipoSolo) {
                    rowMetaParts.push(`Solo: ${tipoSolo}`);
                  }
                  if (row.analysesCount > 0) {
                    rowMetaParts.push(`Análises: ${row.analysesCount}`);
                  }
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        "group rounded-xl border p-3 transition-all",
                        selected
                          ? tema === 'dark'
                            ? 'border-amber-500/50 bg-amber-500/10'
                            : 'border-amber-200 bg-amber-50'
                          : tema === 'dark'
                            ? 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                            : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <span
                            className={cn(
                              "font-bold text-sm truncate",
                              selected ? "text-amber-700 dark:text-amber-400" : ""
                            )}
                          >
                            {row.nome}
                          </span>
                          {rowMetaParts.length > 0 && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              {rowMetaParts.join(' | ')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 shrink-0">
                          <ShadButton
                            size="sm"
                            variant={selected ? 'default' : 'ghost'}
                            className={cn(
                              "h-8 text-xs",
                              selected 
                                ? "bg-amber-600 hover:bg-amber-700 text-white" 
                                : "bg-slate-200/50 dark:bg-slate-800/50 hover:bg-slate-300 dark:hover:bg-slate-700"
                            )}
                            onClick={() => onSelectTalhao(row.id)}
                          >
                            {selected ? 'Ativo' : 'Selecionar'}
                          </ShadButton>
                          <ShadButton
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-400"
                            onClick={() => onEditTalhao(row.id)}
                          >
                            <IconEdit className="mr-1.5 h-3 w-3" />
                            Editar
                          </ShadButton>
                          <ShadButton
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
                            onClick={() => onDeleteTalhao(row)}
                          >
                            <IconTrash className="mr-1.5 h-3 w-3" />
                            Excluir
                          </ShadButton>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ShadScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
