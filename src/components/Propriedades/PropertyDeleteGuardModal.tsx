import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { modals } from '@mantine/modals';
export {
  exportPropertySnapshotToPdf,
  type PropertyDeleteSnapshot,
} from '../../services/propertyExportService';

type PropertyDeleteDecision = {
  exportPdf: boolean;
};

type TalhaoDeleteGuardOptions = {
  talhaoName: string;
  analysesCount?: number;
  onConfirm: () => Promise<boolean> | boolean;
};

type PropertyDeleteGuardOptions = {
  propertyName: string;
  talhoesCount: number;
  analysesCount: number;
  onConfirm: (decision: PropertyDeleteDecision) => Promise<boolean> | boolean;
};

type PropertyDeleteModalContentProps = {
  propertyName: string;
  talhoesCount: number;
  analysesCount: number;
  onCancel: () => void;
  onConfirm: (decision: PropertyDeleteDecision) => Promise<boolean> | boolean;
};

type TalhaoDeleteModalContentProps = {
  talhaoName: string;
  analysesCount?: number;
  onCancel: () => void;
  onConfirm: () => Promise<boolean> | boolean;
};

function PropertyDeleteModalContent({
  propertyName,
  talhoesCount,
  analysesCount,
  onCancel,
  onConfirm,
}: PropertyDeleteModalContentProps) {
  const [typedName, setTypedName] = useState('');
  const [exportPdf, setExportPdf] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const expected = useMemo(() => propertyName.trim(), [propertyName]);
  const matchesName = typedName.trim() === expected;

  const handleConfirm = async () => {
    if (!matchesName || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const shouldClose = await onConfirm({ exportPdf });
      if (shouldClose) onCancel();
    } catch (err: any) {
      setSubmitError(err?.message ?? 'Não foi possível concluir a exclusao.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Esta ação irá excluir definitivamente a propriedade <strong className="text-slate-900 dark:text-white">{propertyName}</strong>.
        </p>
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          Todos os talhões e análises vinculados serão removidos e não será possível desfazer.
        </p>
        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
          Talhões: {talhoesCount} | Análises: {analysesCount}
        </p>
      </div>

      <div className="flex items-start space-x-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
        <Checkbox
          id="export-pdf"
          checked={exportPdf}
          onCheckedChange={(checked) => setExportPdf(!!checked)}
          className="mt-0.5"
        />
        <div className="grid gap-1.5 leading-none">
          <Label
            htmlFor="export-pdf"
            className="text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            Exportar dados para PDF
          </Label>
          <p className="text-[10px] text-slate-400">
            Gera um relatório completo antes da exclusão definitiva.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-name" className="text-xs font-bold text-slate-500 uppercase tracking-tight">
          Confirme o nome da propriedade
        </Label>
        <div className="relative">
          <Input
            id="confirm-name"
            placeholder={propertyName}
            value={typedName}
            onChange={(event) => setTypedName(event.currentTarget.value)}
            className={cn(
              "h-10 text-sm",
              typedName.length > 0 && !matchesName ? "border-red-500 ring-red-500/10" : ""
            )}
          />
        </div>
        <p className="text-[10px] text-slate-400 italic">
          Digite exatamente: <span className="font-bold text-slate-900 dark:text-slate-200">{propertyName}</span>
        </p>
      </div>

      {submitError && (
        <div className="p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium text-center">{submitError}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-2">
        <Button 
          variant="outline" 
          onClick={onCancel} 
          disabled={submitting}
          className="h-10 px-6 text-xs font-bold text-slate-500"
        >
          CANCELAR
        </Button>
        <Button
          variant="destructive"
          onClick={() => void handleConfirm()}
          disabled={!matchesName || submitting}
          className="h-10 px-6 text-xs font-black uppercase tracking-widest shadow-lg shadow-red-500/20"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          EXCLUIR DEFINITIVAMENTE
        </Button>
      </div>
    </div>
  );
}

function TalhaoDeleteModalContent({
  talhaoName,
  analysesCount,
  onCancel,
  onConfirm,
}: TalhaoDeleteModalContentProps) {
  const [typedName, setTypedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const expected = useMemo(() => talhaoName.trim(), [talhaoName]);
  const matchesName = typedName.trim() === expected;

  const handleConfirm = async () => {
    if (!matchesName || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const shouldClose = await onConfirm();
      if (shouldClose) onCancel();
    } catch (err: any) {
      setSubmitError(err?.message ?? 'Não foi possível concluir a exclusao.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Esta ação irá excluir definitivamente o talhão <strong className="text-slate-900 dark:text-white">{talhaoName}</strong>.
        </p>
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          As análises vinculadas também serão removidas e não será possível desfazer.
        </p>
        {typeof analysesCount === 'number' && (
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Análises vinculadas: {analysesCount}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-talhao-name" className="text-xs font-bold text-slate-500 uppercase tracking-tight">
          Confirme o nome do talhão
        </Label>
        <Input
          id="confirm-talhao-name"
          placeholder={talhaoName}
          value={typedName}
          onChange={(event) => setTypedName(event.currentTarget.value)}
          className={cn(
            "h-10 text-sm",
            typedName.length > 0 && !matchesName ? "border-red-500 ring-red-500/10" : ""
          )}
        />
        <p className="text-[10px] text-slate-400 italic">
          Digite exatamente: <span className="font-bold text-slate-900 dark:text-slate-200">{talhaoName}</span>
        </p>
      </div>

      {submitError && (
        <div className="p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium text-center">{submitError}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-2">
        <Button 
          variant="outline" 
          onClick={onCancel} 
          disabled={submitting}
          className="h-10 px-6 text-xs font-bold text-slate-500"
        >
          CANCELAR
        </Button>
        <Button
          variant="destructive"
          onClick={() => void handleConfirm()}
          disabled={!matchesName || submitting}
          className="h-10 px-6 text-xs font-black uppercase tracking-widest shadow-lg shadow-red-500/20"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          EXCLUIR TALHÃO
        </Button>
      </div>
    </div>
  );
}

export function openPropertyDeleteGuardModal({
  propertyName,
  talhoesCount,
  analysesCount,
  onConfirm,
}: PropertyDeleteGuardOptions): void {
  const modalId = `property-delete-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const closeModal = () => modals.close(modalId);

  modals.open({
    modalId,
    title: 'Excluir Propriedade',
    centered: true,
    closeOnClickOutside: false,
    closeOnEscape: false,
    withCloseButton: true,
    size: 'lg',
    styles: {
      title: { fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' },
      header: { borderBottom: '1px solid #e2e8f0' },
      content: { borderRadius: '12px' }
    },
    children: (
      <div className="p-1">
        <PropertyDeleteModalContent
          propertyName={propertyName}
          talhoesCount={talhoesCount}
          analysesCount={analysesCount}
          onCancel={closeModal}
          onConfirm={onConfirm}
        />
      </div>
    ),
  });
}

export function openTalhaoDeleteGuardModal({
  talhaoName,
  analysesCount,
  onConfirm,
}: TalhaoDeleteGuardOptions): void {
  const modalId = `talhao-delete-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const closeModal = () => modals.close(modalId);

  modals.open({
    modalId,
    title: 'Excluir Talhão',
    centered: true,
    closeOnClickOutside: false,
    closeOnEscape: false,
    withCloseButton: true,
    size: 'lg',
    styles: {
      title: { fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' },
      header: { borderBottom: '1px solid #e2e8f0' },
      content: { borderRadius: '12px' }
    },
    children: (
      <div className="p-1">
        <TalhaoDeleteModalContent
          talhaoName={talhaoName}
          analysesCount={analysesCount}
          onCancel={closeModal}
          onConfirm={onConfirm}
        />
      </div>
    ),
  });
}
