import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import { Search } from 'lucide-react';
import { Badge } from '../../ui/badge';
import {
    Select as ShadSelect,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../ui/select';
import { UNCLASSIFIED_SOIL_VALUE } from '../../../modules/talhao/constants';

interface TalhaoFormProps {
    nome: string;
    setNome: (value: string) => void;
    areaHa: number | '';
    setAreaHa: (value: number | '') => void;
    tipoSolo: string;
    setTipoSolo: (value: string) => void;
    soilOptions: Array<{ value: string; label: string }>;
    selectedSoilDescription: string | null;
    openSoilClassifier: () => void;
    lastClassificationSummary: string | null;
}

export function TalhaoForm({
    nome,
    setNome,
    areaHa,
    setAreaHa,
    tipoSolo,
    setTipoSolo,
    soilOptions,
    selectedSoilDescription,
    openSoilClassifier,
    lastClassificationSummary,
}: TalhaoFormProps) {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                    <Label htmlFor="talhao-nome" className="text-[10px] font-bold uppercase tracking-tight text-slate-500 mb-1.5 block">
                        Nome do talhão
                    </Label>
                    <Input
                        id="talhao-nome"
                        value={nome}
                        onChange={(event) => setNome(event.currentTarget.value)}
                        className="h-10 text-sm"
                    />
                </div>
                <div className="w-[120px] shrink-0">
                    <Label htmlFor="talhao-area" className="text-[10px] font-bold uppercase tracking-tight text-slate-500 mb-1.5 block">
                        Área (ha)
                    </Label>
                    <Input
                        id="talhao-area"
                        type="number"
                        value={areaHa}
                        min={0}
                        step={0.01}
                        onChange={(event) => {
                            const value = event.currentTarget.value;
                            if (value === '') {
                                setAreaHa('');
                                return;
                            }
                            setAreaHa(Number(value));
                        }}
                        className="h-10 text-sm"
                    />
                </div>
                <div className="flex-1 min-w-[220px] flex items-end gap-2">
                    <div className="flex-1">
                        <Label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 mb-1.5 block">
                            Classe de solo (SiBCS)
                        </Label>
                        <ShadSelect
                            value={tipoSolo.trim() ? tipoSolo : UNCLASSIFIED_SOIL_VALUE}
                            onValueChange={(value: string) => setTipoSolo(value || UNCLASSIFIED_SOIL_VALUE)}
                        >
                            <SelectTrigger className="h-10 text-sm">
                                <SelectValue placeholder="Selecione a classe" />
                            </SelectTrigger>
                            <SelectContent>
                                {soilOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </ShadSelect>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 border-teal-200 dark:border-teal-800 text-teal-600 hover:bg-teal-50"
                        onClick={openSoilClassifier}
                        title="Classificar SiBCS com IA"
                    >
                        <Search className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between -mt-2">
                <div className="flex gap-2">
                    {lastClassificationSummary && (
                        <Badge variant="secondary" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-bold">
                            Última: {lastClassificationSummary}
                        </Badge>
                    )}
                </div>
            </div>

            {selectedSoilDescription && (
                <p className="text-[11px] text-slate-500 italic -mt-2 leading-relaxed">
                    {selectedSoilDescription}
                </p>
            )}
        </div>
    );
}
