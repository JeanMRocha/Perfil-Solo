import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import {
    Select as ShadSelect,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../ui/select';
import {
    Search,
    Loader2,
    Plus,
    Map as IconMap2,
    MapPinOff,
    Square,
    Spline,
    Ban,
    Check,
    Trash2,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { GEO_BASE_LAYERS, type GeoLayerId } from '../../../modules/geo/baseLayers';
import type { DrawMode } from '../../../modules/talhao/types';

interface TalhaoMapControlsProps {
    drawMode: DrawMode;
    statusLabel: string;
    mapSearchValue: string;
    setMapSearchValue: (value: string) => void;
    mapSearchLoading: boolean;
    applyRealMapBackground: () => Promise<void>;
    pointSearchValue: string;
    setPointSearchValue: (value: string) => void;
    addPointFromCoordinates: () => void;
    mapLayerId: GeoLayerId;
    setMapLayerId: (value: GeoLayerId) => void;
    mapInteractive: boolean;
    setMapInteractive: (value: boolean) => void;
    mapHasRealBackground: boolean;
    clearRealMapBackground: () => void;
    startMainDrawing: () => void;
    startZoneDrawing: () => void;
    cancelDrawing: () => void;
    finishDrawing: () => void;
    canDeleteSelection: boolean;
    removeCurrentSelection: () => void;
    mainPointsLength: number;
}

export function TalhaoMapControls({
    drawMode,
    statusLabel,
    mapSearchValue,
    setMapSearchValue,
    mapSearchLoading,
    applyRealMapBackground,
    pointSearchValue,
    setPointSearchValue,
    addPointFromCoordinates,
    mapLayerId,
    setMapLayerId,
    mapInteractive,
    setMapInteractive,
    mapHasRealBackground,
    clearRealMapBackground,
    startMainDrawing,
    startZoneDrawing,
    cancelDrawing,
    finishDrawing,
    canDeleteSelection,
    removeCurrentSelection,
    mainPointsLength,
}: TalhaoMapControlsProps) {
    return (
        <div className="space-y-4">
            <div className="flex flex-row items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Croqui do talhão</h3>
                <Badge variant={drawMode === 'none' ? 'secondary' : 'destructive'} className="text-[10px] font-bold">
                    {statusLabel}
                </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-2 overflow-x-auto">
                <div className="flex items-center gap-1 shrink-0">
                    <Input
                        className="h-9 w-[180px] text-xs"
                        placeholder="CEP ou coordenadas"
                        value={mapSearchValue}
                        onChange={(event) => setMapSearchValue(event.currentTarget.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void applyRealMapBackground();
                            }
                        }}
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 border-blue-200 text-blue-600 hover:bg-blue-50"
                        disabled={mapSearchLoading}
                        onClick={() => void applyRealMapBackground()}
                    >
                        {mapSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                </div>

                <div className="flex items-center gap-1 shrink-0 px-2 border-l">
                    <Input
                        className="h-9 w-[160px] text-xs"
                        placeholder="Lat, Lon do ponto"
                        value={pointSearchValue}
                        onChange={(event) => setPointSearchValue(event.currentTarget.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                addPointFromCoordinates();
                            }
                        }}
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 border-teal-200 text-teal-600 hover:bg-teal-50"
                        onClick={addPointFromCoordinates}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-1 shrink-0 px-2 border-l">
                    <ShadSelect
                        value={mapLayerId}
                        onValueChange={(value: string) => setMapLayerId(value as GeoLayerId)}
                        disabled={!mapHasRealBackground}
                    >
                        <SelectTrigger className="h-9 w-[120px] text-xs">
                            <SelectValue placeholder="Camada" />
                        </SelectTrigger>
                        <SelectContent>
                            {GEO_BASE_LAYERS.map((layer) => (
                                <SelectItem key={layer.id} value={layer.id}>
                                    {layer.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </ShadSelect>

                    <Button
                        variant={mapInteractive ? "secondary" : "ghost"}
                        size="icon"
                        className={cn("h-9 w-9", mapInteractive ? "bg-teal-100 text-teal-700" : "text-slate-500")}
                        onClick={() => setMapInteractive(!mapInteractive)}
                        disabled={!mapHasRealBackground || drawMode !== 'none'}
                        title="Alternar navegação"
                    >
                        <IconMap2 className="h-4 w-4" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-slate-500"
                        onClick={clearRealMapBackground}
                        disabled={!mapHasRealBackground}
                        title="Fundo ilustrativo"
                    >
                        <MapPinOff className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-1 shrink-0 px-2 border-l">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 border-slate-200 text-slate-600"
                        onClick={startMainDrawing}
                        disabled={drawMode !== 'none' || mainPointsLength >= 3 || mapInteractive}
                        title="Desenhar limite"
                    >
                        <Square className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={startZoneDrawing}
                        disabled={drawMode !== 'none' || mapInteractive}
                        title="Adicionar zona de exclusão"
                    >
                        <Spline className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-slate-400"
                        onClick={cancelDrawing}
                        disabled={drawMode === 'none' || mapInteractive}
                        title="Cancelar desenho"
                    >
                        <Ban className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 border-green-200 text-green-600 hover:bg-green-50"
                        onClick={finishDrawing}
                        disabled={drawMode === 'none' || mapInteractive}
                        title="Concluir desenho"
                    >
                        <Check className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-1 shrink-0 px-2 border-l">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-600 hover:bg-red-50"
                        onClick={removeCurrentSelection}
                        disabled={!canDeleteSelection}
                        title="Excluir seleção"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
