import { Button, Checkbox, Group, Stack, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useMemo, useState } from 'react';
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
    <Stack gap="sm">
      <Text size="sm">
        Esta acao ira excluir definitivamente a propriedade <b>{propertyName}</b>.
      </Text>
      <Text size="sm" c="red">
        Todos os talhoes e analises vinculados serao removidos e nao sera possivel desfazer.
      </Text>
      <Text size="xs" c="dimmed">
        Talhoes cadastrados: {talhoesCount} | Analises cadastradas: {analysesCount}
      </Text>

      <Checkbox
        checked={exportPdf}
        onChange={(event) => setExportPdf(event.currentTarget.checked)}
        label="Exportar os dados da propriedade para PDF antes de excluir"
      />

      <TextInput
        label="Digite o nome da propriedade para confirmar"
        description={`Digite exatamente: ${propertyName}`}
        placeholder={propertyName}
        value={typedName}
        onChange={(event) => setTypedName(event.currentTarget.value)}
        error={typedName.length > 0 && !matchesName ? 'Nome não confere com a propriedade.' : null}
      />

      {submitError ? (
        <Text size="xs" c="red">
          {submitError}
        </Text>
      ) : null}

      <Group justify="flex-end" mt="xs">
        <Button variant="light" color="gray" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          color="red"
          onClick={() => void handleConfirm()}
          loading={submitting}
          disabled={!matchesName}
        >
          Excluir definitivamente
        </Button>
      </Group>
    </Stack>
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
    <Stack gap="sm">
      <Text size="sm">
        Esta acao ira excluir definitivamente o talhão <b>{talhaoName}</b>.
      </Text>
      <Text size="sm" c="red">
        As analises vinculadas tambem serao removidas e nao sera possivel desfazer.
      </Text>
      {typeof analysesCount === 'number' ? (
        <Text size="xs" c="dimmed">
          Analises vinculadas: {analysesCount}
        </Text>
      ) : null}

      <TextInput
        label="Digite o nome do talhao para confirmar"
        description={`Digite exatamente: ${talhaoName}`}
        placeholder={talhaoName}
        value={typedName}
        onChange={(event) => setTypedName(event.currentTarget.value)}
        error={typedName.length > 0 && !matchesName ? 'Nome não confere com o talhão.' : null}
      />

      {submitError ? (
        <Text size="xs" c="red">
          {submitError}
        </Text>
      ) : null}

      <Group justify="flex-end" mt="xs">
        <Button variant="light" color="gray" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          color="red"
          onClick={() => void handleConfirm()}
          loading={submitting}
          disabled={!matchesName}
        >
          Excluir definitivamente
        </Button>
      </Group>
    </Stack>
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
    title: 'Confirmar exclusao da propriedade',
    centered: true,
    closeOnClickOutside: false,
    closeOnEscape: false,
    withCloseButton: true,
    children: (
      <PropertyDeleteModalContent
        propertyName={propertyName}
        talhoesCount={talhoesCount}
        analysesCount={analysesCount}
        onCancel={closeModal}
        onConfirm={onConfirm}
      />
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
    title: 'Confirmar exclusao do talhão',
    centered: true,
    closeOnClickOutside: false,
    closeOnEscape: false,
    withCloseButton: true,
    children: (
      <TalhaoDeleteModalContent
        talhaoName={talhaoName}
        analysesCount={analysesCount}
        onCancel={closeModal}
        onConfirm={onConfirm}
      />
    ),
  });
}
