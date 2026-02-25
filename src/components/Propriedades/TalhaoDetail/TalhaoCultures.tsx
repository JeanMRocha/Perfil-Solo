import { useState, useMemo } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../../ui/dialog';
import {
    Select as ShadSelect,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../ui/select';
import { ScrollArea } from '../../ui/scroll-area';
import {
    Plus,
    ChevronDown,
    ChevronUp,
    Copy,
    Pencil,
    Trash2,
    X,
    Save,
} from 'lucide-react';
import { normalizeKey, formatMonthYear, normalizeMonthYear } from '../../../modules/talhao/utils/formatters';
import type { CultureEntry } from '../../../modules/talhao/types';
import type { RncCultivarSelectionPayload } from '../../../services/rncCultivarService';
import RncCultivarSelector from '../../../views/Rnc/RncCultivarSelector';

interface TalhaoCulturesProps {
    cultures: CultureEntry[];
    currentCulture: string;
    setCurrentCulture: (value: string) => void;
    currentCultureOptions: Array<{ value: string; label: string }>;
    cultureDraft: CultureEntry;
    setCultureDraft: (value: CultureEntry) => void;
    cultureModalOpened: boolean;
    cultureLinkModalOpened: boolean;
    closeCultureModal: () => void;
    closeCultureLinkModal: () => void;
    saveCultureDraft: () => void;
    openCultureLinkModal: () => void;
    handleLinkCultureFromRnc: (payload: RncCultivarSelectionPayload) => void;
    openEditCultureModal: (index: number) => void;
    removeCulture: (index: number) => void;
    duplicateCultivarForTechnicalProfile: (index: number) => void;
}

export function TalhaoCultures({
    cultures,
    currentCulture,
    setCurrentCulture,
    currentCultureOptions,
    cultureDraft,
    setCultureDraft,
    cultureModalOpened,
    cultureLinkModalOpened,
    closeCultureModal,
    closeCultureLinkModal,
    saveCultureDraft,
    openCultureLinkModal,
    handleLinkCultureFromRnc,
    openEditCultureModal,
    removeCulture,
    duplicateCultivarForTechnicalProfile,
}: TalhaoCulturesProps) {
    const [cultureSectionOpened, setCultureSectionOpened] = useState(false);

    const currentCultureRow = useMemo(
        () =>
            cultures.find(
                (row) => normalizeKey(row.cultura) === normalizeKey(currentCulture),
            ) ?? null,
        [cultures, currentCulture],
    );

    const historyCultureRows = useMemo(() => {
        const currentKey = normalizeKey(currentCulture);
        return cultures
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => {
                if (!currentKey) return true;
                return normalizeKey(row.cultura) !== currentKey;
            });
    }, [cultures, currentCulture]);

    return (
        <>
            <Card className="border-slate-200 dark:border-slate-800 shadow-none">
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500"
                            onClick={() => setCultureSectionOpened((prev) => !prev)}
                        >
                            {cultureSectionOpened ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                        <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            Culturas do talhão
                        </CardTitle>
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                            {cultures.length} registros
                        </Badge>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[10px] font-bold uppercase tracking-wider"
                        onClick={openCultureLinkModal}
                    >
                        <Plus className="mr-1.5 h-3 w-3" />
                        Vincular cultura
                    </Button>
                </CardHeader>

                {cultureSectionOpened && (
                    <CardContent className="p-4 pt-0">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            <div className="lg:col-span-4 rounded-lg border border-slate-100 dark:border-slate-800 p-3 space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">
                                    Espécie atual
                                </p>
                                <ShadSelect
                                    value={currentCulture || ""}
                                    onValueChange={(value: string) => setCurrentCulture(value)}
                                >
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Selecione a espécie ativa" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {currentCultureOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </ShadSelect>
                                {currentCultureRow ? (
                                    <p className="text-[10px] text-slate-500 leading-tight">
                                        Refino por cultivar: <strong className="text-slate-700 dark:text-slate-300">{currentCultureRow.cultivar || '-'}</strong>
                                        <br />
                                        Período: <span className="font-medium">{formatMonthYear(currentCultureRow.data_inicio)} a {formatMonthYear(currentCultureRow.data_fim)}</span>
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic">Sem espécie ativa selecionada.</p>
                                )}
                                <p className="text-[9px] text-slate-400 leading-tight">
                                    Prioridade de referência para cálculos: cultivar quando informada; senão, espécie.
                                </p>
                            </div>

                            <div className="lg:col-span-8 rounded-lg border border-slate-100 dark:border-slate-800 p-3 overflow-hidden">
                                <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400 mb-2">
                                    Histórico de culturas
                                </p>
                                {historyCultureRows.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-[11px] border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/50">
                                                    <th className="px-2 py-1.5">Espécie</th>
                                                    <th className="px-2 py-1.5">Cultivar</th>
                                                    <th className="px-2 py-1.5">Período</th>
                                                    <th className="px-2 py-1.5">Fonte</th>
                                                    <th className="px-2 py-1.5 text-right">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historyCultureRows.map(({ row, index }) => (
                                                    <tr
                                                        key={`${row.cultura}-${row.data_inicio}-${row.data_fim}-${index}`}
                                                        className="border-b border-slate-50 dark:border-slate-900 hover:bg-slate-50/30 dark:hover:bg-slate-900/30 transition-colors"
                                                    >
                                                        <td className="px-2 py-2 font-medium">{row.cultura}</td>
                                                        <td className="px-2 py-2 text-slate-500">{row.cultivar || '-'}</td>
                                                        <td className="px-2 py-2 text-slate-500">
                                                            {formatMonthYear(row.data_inicio)} a {formatMonthYear(row.data_fim)}
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <Badge variant="outline" className="text-[9px] py-0 h-4 bg-slate-50 text-slate-500 font-normal">
                                                                {row.technical_profile_id ? 'Custom' : row.technical_priority === 'cultivar' ? 'RNC' : 'Espécie'}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-2 py-2 text-right">
                                                            <div className="flex justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                                                                    onClick={() => duplicateCultivarForTechnicalProfile(index)}
                                                                    disabled={!row.cultivar}
                                                                    title="Duplicar para dados próprios"
                                                                >
                                                                    <Copy className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                    onClick={() => openEditCultureModal(index)}
                                                                    title="Editar"
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => removeCulture(index)}
                                                                    title="Remover"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic py-4 text-center">
                                        Nenhum histórico anterior para este talhão.
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            <Dialog open={cultureModalOpened} onOpenChange={(val: boolean) => !val && closeCultureModal()}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Editar período da cultura</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label className="text-[10px] uppercase font-bold text-slate-500">Espécie (RNC)</Label>
                            <Input value={cultureDraft.cultura} readOnly className="h-9 bg-slate-50 text-xs" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-[10px] uppercase font-bold text-slate-500">Cultivar (RNC - refino)</Label>
                            <Input value={cultureDraft.cultivar || ''} readOnly className="h-9 bg-slate-50 text-xs" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">Mês/ano inicial</Label>
                                <Input
                                    type="month"
                                    value={cultureDraft.data_inicio}
                                    onChange={(event) =>
                                        setCultureDraft({
                                            ...cultureDraft,
                                            data_inicio: normalizeMonthYear(event.currentTarget.value),
                                        })
                                    }
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">Mês/ano final</Label>
                                <Input
                                    type="month"
                                    value={cultureDraft.data_fim}
                                    onChange={(event) =>
                                        setCultureDraft({
                                            ...cultureDraft,
                                            data_fim: normalizeMonthYear(event.currentTarget.value),
                                        })
                                    }
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={closeCultureModal}>
                            <X className="mr-2 h-4 w-4" />
                            CANCELAR
                        </Button>
                        <Button onClick={saveCultureDraft} variant="destructive" className="bg-teal-600 hover:bg-teal-700">
                            <Save className="mr-2 h-4 w-4" />
                            SALVAR PERÍODO
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={cultureLinkModalOpened} onOpenChange={(val: boolean) => !val && closeCultureLinkModal()}>
                <DialogContent className="max-w-[1180px] w-[92vw] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="px-6 py-4 border-b">
                        <DialogTitle>Vincular espécie/cultivar ao talhão</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 p-6">
                        <RncCultivarSelector
                            mode="picker"
                            onSelect={handleLinkCultureFromRnc}
                        />
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
}
