import {
  IconChevronDown,
  IconChevronRight,
  IconFileExport,
  IconSquareCheck,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../components/ui/dialog';
import { Button as ShadButton } from '../../../components/ui/button';
import { Checkbox as ShadCheckbox } from '../../../components/ui/checkbox';
import { Label } from '../../../components/ui/label';
import { ScrollArea as ShadScrollArea } from '../../../components/ui/scroll-area';
import { cn } from '../../../lib/utils';
import { Loader } from '@mantine/core';

export type PropertyExportAnalysisNode = {
  id: string;
  nodeId: string;
  label: string;
};

export type PropertyExportTalhaoNode = {
  id: string;
  nodeId: string;
  label: string;
  analyses: PropertyExportAnalysisNode[];
};

export type PropertyExportPropertyNode = {
  id: string;
  nodeId: string;
  label: string;
  talhoes: PropertyExportTalhaoNode[];
};

type PropertyExportModalProps = {
  opened: boolean;
  onClose: () => void;
  loading: boolean;
  exporting: boolean;
  tree: PropertyExportPropertyNode[];
  selectedNodeIds: string[];
  onSelectedNodeIdsChange: (next: string[]) => void;
  includeSoilClassification: boolean;
  onIncludeSoilClassificationChange: (next: boolean) => void;
  onExport: () => void;
};

function collectAllNodeIds(tree: PropertyExportPropertyNode[]): string[] {
  const ids: string[] = [];
  tree.forEach((property) => {
    ids.push(property.nodeId);
    property.talhoes.forEach((talhao) => {
      ids.push(talhao.nodeId);
      talhao.analyses.forEach((analysis) => ids.push(analysis.nodeId));
    });
  });
  return ids;
}

function normalizeSelection(
  tree: PropertyExportPropertyNode[],
  current: Set<string>,
): Set<string> {
  const next = new Set(current);

  tree.forEach((property) => {
    property.talhoes.forEach((talhao) => {
      if (talhao.analyses.length === 0) return;
      const allAnalysesSelected = talhao.analyses.every((analysis) =>
        next.has(analysis.nodeId),
      );
      if (allAnalysesSelected) {
        next.add(talhao.nodeId);
      } else {
        next.delete(talhao.nodeId);
      }
    });

    if (property.talhoes.length === 0) return;
    const allTalhoesSelected = property.talhoes.every((talhao) =>
      next.has(talhao.nodeId),
    );
    if (allTalhoesSelected) {
      next.add(property.nodeId);
    } else {
      next.delete(property.nodeId);
    }
  });

  return next;
}

export default function PropertyExportModal({
  opened,
  onClose,
  loading,
  exporting,
  tree,
  selectedNodeIds,
  onSelectedNodeIdsChange,
  includeSoilClassification,
  onIncludeSoilClassificationChange,
  onExport,
}: PropertyExportModalProps) {
  const [openPropertyIds, setOpenPropertyIds] = useState<Record<string, boolean>>({});
  const [openTalhaoIds, setOpenTalhaoIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!opened) return;
    const firstPropertyId = tree[0]?.id;
    setOpenPropertyIds(firstPropertyId ? { [firstPropertyId]: true } : {});
    setOpenTalhaoIds({});
  }, [opened, tree]);

  const selectedSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  const selectedPropertyCount = useMemo(
    () => tree.filter((property) => selectedSet.has(property.nodeId)).length,
    [tree, selectedSet],
  );
  const selectedTalhaoCount = useMemo(
    () =>
      tree.reduce(
        (acc, property) =>
          acc + property.talhoes.filter((talhao) => selectedSet.has(talhao.nodeId)).length,
        0,
      ),
    [tree, selectedSet],
  );
  const selectedAnalysisCount = useMemo(
    () =>
      tree.reduce(
        (acc, property) =>
          acc +
          property.talhoes.reduce(
            (talhaoAcc, talhao) =>
              talhaoAcc +
              talhao.analyses.filter((analysis) => selectedSet.has(analysis.nodeId)).length,
            0,
          ),
        0,
      ),
    [tree, selectedSet],
  );

  const canExport = selectedSet.size > 0;

  const updateSelection = (next: Set<string>) => {
    const normalized = normalizeSelection(tree, next);
    onSelectedNodeIdsChange(Array.from(normalized));
  };

  const toggleProperty = (property: PropertyExportPropertyNode, checked: boolean) => {
    const ids = [
      property.nodeId,
      ...property.talhoes.flatMap((talhao) => [
        talhao.nodeId,
        ...talhao.analyses.map((analysis) => analysis.nodeId),
      ]),
    ];
    const next = new Set(selectedSet);
    if (checked) {
      ids.forEach((id) => next.add(id));
    } else {
      ids.forEach((id) => next.delete(id));
    }
    updateSelection(next);
  };

  const toggleTalhao = (talhao: PropertyExportTalhaoNode, checked: boolean) => {
    const ids = [talhao.nodeId, ...talhao.analyses.map((analysis) => analysis.nodeId)];
    const next = new Set(selectedSet);
    if (checked) {
      ids.forEach((id) => next.add(id));
    } else {
      ids.forEach((id) => next.delete(id));
    }
    updateSelection(next);
  };

  const toggleAnalysis = (analysis: PropertyExportAnalysisNode, checked: boolean) => {
    const next = new Set(selectedSet);
    if (checked) {
      next.add(analysis.nodeId);
    } else {
      next.delete(analysis.nodeId);
    }
    updateSelection(next);
  };

  const markAll = () => {
    onSelectedNodeIdsChange(collectAllNodeIds(tree));
  };

  const clearAll = () => {
    onSelectedNodeIdsChange([]);
  };

  return (
    <Dialog open={opened} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[840px] w-[92vw] overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Exportar dados em PDF</DialogTitle>
          <DialogDescription>
            Estrutura em árvore: selecionar propriedade marca toda a subárvore de talhões e análises.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          <div className="flex items-center space-x-2">
            <ShadCheckbox
              id="include-soil"
              checked={includeSoilClassification}
              onCheckedChange={(checked) =>
                onIncludeSoilClassificationChange(checked === true)
              }
            />
            <Label htmlFor="include-soil" className="text-xs font-normal cursor-pointer">
              Incluir bloco Classificação SiBCS do talhão no PDF
            </Label>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Propriedades cadastradas
            </span>
            <div className="flex gap-2">
              <ShadButton
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2"
                onClick={markAll}
                disabled={tree.length === 0 || loading}
              >
                <IconSquareCheck className="mr-1 h-3.5 w-3.5" />
                Marcar tudo
              </ShadButton>
              <ShadButton
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] text-slate-500 px-2"
                onClick={clearAll}
                disabled={selectedSet.size === 0 || loading}
              >
                <IconTrash className="mr-1 h-3.5 w-3.5" />
                Limpar
              </ShadButton>
            </div>
          </div>

          <ShadScrollArea className="flex-1 -mx-2 px-2 overflow-y-auto max-h-[45vh]">
            <div className="flex flex-col gap-3 pr-4">
              {loading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader size="sm" />
                  <span className="text-sm text-slate-500">Carregando talhões e análises...</span>
                </div>
              ) : tree.length === 0 ? (
                <span className="text-sm text-slate-500 italic py-4">
                  Nenhuma propriedade disponível para exportação.
                </span>
              ) : (
                tree.map((property) => {
                  const propertyChecked = selectedSet.has(property.nodeId);
                  const propertyHasAnyChild = property.talhoes.some(
                    (talhao) =>
                      selectedSet.has(talhao.nodeId) ||
                      talhao.analyses.some((analysis) => selectedSet.has(analysis.nodeId)),
                  );
                  const propertyIndeterminate = !propertyChecked && propertyHasAnyChild;

                  return (
                    <div
                      key={property.id}
                      className={cn(
                        "rounded-lg border p-2",
                        propertyChecked ? "bg-teal-500/5 border-teal-500/20" : "bg-slate-50/50 border-slate-100"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <ShadButton
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400"
                          onClick={() =>
                            setOpenPropertyIds((prev) => ({
                              ...prev,
                              [property.id]: !prev[property.id],
                            }))
                          }
                        >
                          {openPropertyIds[property.id] ? (
                            <IconChevronDown className="h-4 w-4" />
                          ) : (
                            <IconChevronRight className="h-4 w-4" />
                          )}
                        </ShadButton>
                        <ShadCheckbox
                          id={`prop-${property.id}`}
                          checked={propertyChecked ? true : (propertyIndeterminate ? "indeterminate" : false)}
                          onCheckedChange={(checked) => toggleProperty(property, checked === true)}
                        />
                        <Label
                          htmlFor={`prop-${property.id}`}
                          className="flex-1 text-sm font-semibold cursor-pointer"
                        >
                          {property.label} <span className="text-[10px] font-normal text-slate-400 ml-1">({property.talhoes.length} talhões)</span>
                        </Label>
                      </div>

                      {openPropertyIds[property.id] && property.talhoes.length > 0 && (
                        <div className="flex flex-col gap-2 mt-2 ml-8 pl-2 border-l border-slate-200">
                          {property.talhoes.map((talhao) => {
                            const talhaoChecked = selectedSet.has(talhao.nodeId);
                            const talhaoHasAnyAnalysis = talhao.analyses.some((analysis) =>
                              selectedSet.has(analysis.nodeId),
                            );
                            const talhaoIndeterminate =
                              !talhaoChecked && talhaoHasAnyAnalysis;

                            return (
                              <div key={talhao.id} className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <ShadButton
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-slate-400"
                                    onClick={() =>
                                      setOpenTalhaoIds((prev) => ({
                                        ...prev,
                                        [talhao.id]: !prev[talhao.id],
                                      }))
                                    }
                                  >
                                    {openTalhaoIds[talhao.id] ? (
                                      <IconChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                      <IconChevronRight className="h-3.5 w-3.5" />
                                    )}
                                  </ShadButton>
                                  <ShadCheckbox
                                    id={`talhao-${talhao.id}`}
                                    checked={talhaoChecked ? true : (talhaoIndeterminate ? "indeterminate" : false)}
                                    onCheckedChange={(checked) => toggleTalhao(talhao, checked === true)}
                                  />
                                  <Label
                                    htmlFor={`talhao-${talhao.id}`}
                                    className="flex-1 text-xs font-medium cursor-pointer"
                                  >
                                    {talhao.label} <span className="text-[9px] font-normal text-slate-400 ml-1">({talhao.analyses.length} análises)</span>
                                  </Label>
                                </div>

                                {openTalhaoIds[talhao.id] && talhao.analyses.length > 0 && (
                                  <div className="flex flex-col gap-1.5 ml-7 pl-2 border-l border-slate-100">
                                    {talhao.analyses.map((analysis) => (
                                      <div key={analysis.id} className="flex items-center gap-2 py-0.5">
                                        <ShadCheckbox
                                          id={`analysis-${analysis.id}`}
                                          checked={selectedSet.has(analysis.nodeId)}
                                          onCheckedChange={(checked) => toggleAnalysis(analysis, checked === true)}
                                        />
                                        <Label
                                          htmlFor={`analysis-${analysis.id}`}
                                          className="flex-1 text-[11px] cursor-pointer"
                                        >
                                          {analysis.label}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ShadScrollArea>

          <div className="flex flex-col gap-1 pt-2">
            <span className="text-[10px] text-slate-500 font-medium">
              Selecionados: {selectedPropertyCount} propriedades, {selectedTalhaoCount} talhões e {selectedAnalysisCount} análises.
            </span>
            {!canExport && (
              <span className="text-[10px] text-amber-600 font-bold">
                Marque ao menos um item da árvore para exportar.
              </span>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <ShadButton variant="ghost" size="sm" onClick={onClose} disabled={exporting}>
              Cancelar
            </ShadButton>
            <ShadButton
              onClick={onExport}
              disabled={!canExport || loading || exporting}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {exporting && <Loader size="xs" className="mr-2" />}
              <IconFileExport className="mr-2 h-4 w-4" />
              Exportar PDF
            </ShadButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
