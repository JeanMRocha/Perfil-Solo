/**
 * Hook que gerencia o estado e lógica de culturas de um talhão.
 *
 * Responsabilidades:
 * - Estado de culturas (lista, draft de edição, modais)
 * - CRUD de culturas (vincular via RNC, editar período, remover, duplicar)
 * - Derivados (currentCultureOptions, selectedCulture)
 */

import { useState, useMemo } from 'react';
import { notifications } from '@mantine/notifications';
import type { RncCultivarSelectionPayload } from '../../../services/rncCultivarService';
import { duplicateCultivarTechnicalProfile } from '../../../services/cultivarTechnicalProfilesService';
import type { CultureEntry, CultureModalMode } from '../types';
import {
  normalizeMonthYear,
  monthYearOrder,
  normalizeKey,
} from '../utils/formatters';

const EMPTY_DRAFT: CultureEntry = {
  cultura: '',
  cultivar: '',
  data_inicio: '',
  data_fim: '',
};

export interface UseTalhaoCulturesReturn {
  cultures: CultureEntry[];
  setCultures: React.Dispatch<React.SetStateAction<CultureEntry[]>>;
  currentCulture: string;
  setCurrentCulture: React.Dispatch<React.SetStateAction<string>>;
  cultureDraft: CultureEntry;
  setCultureDraft: React.Dispatch<React.SetStateAction<CultureEntry>>;
  cultureModalOpened: boolean;
  cultureModalMode: CultureModalMode;
  cultureLinkModalOpened: boolean;
  editingCultureIndex: number | null;
  currentCultureOptions: { value: string; label: string }[];

  openCultureLinkModal: () => void;
  closeCultureLinkModal: () => void;
  handleLinkCultureFromRnc: (payload: RncCultivarSelectionPayload) => void;
  openEditCultureModal: (index: number) => void;
  closeCultureModal: () => void;
  saveCultureDraft: () => void;
  removeCulture: (index: number) => void;
  duplicateCultivarForTechnicalProfile: (index: number) => void;

  /** Reinicializa todo o estado de culturas (chamado ao abrir o modal). */
  resetFromTalhao: (
    parsedCultures: CultureEntry[],
    persistedCurrentCulture: string,
  ) => void;
}

export function useTalhaoCultures(): UseTalhaoCulturesReturn {
  const [cultures, setCultures] = useState<CultureEntry[]>([]);
  const [currentCulture, setCurrentCulture] = useState('');
  const [cultureDraft, setCultureDraft] = useState<CultureEntry>(EMPTY_DRAFT);
  const [cultureModalOpened, setCultureModalOpened] = useState(false);
  const [cultureLinkModalOpened, setCultureLinkModalOpened] = useState(false);
  const [cultureModalMode, setCultureModalMode] =
    useState<CultureModalMode>('edit');
  const [editingCultureIndex, setEditingCultureIndex] = useState<number | null>(
    null,
  );

  // ── Derivados ────────────────────────────────────────────────────────────

  const currentCultureOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of cultures) {
      const label = row.cultura.trim();
      if (!label) continue;
      const key = normalizeKey(label);
      if (!key || map.has(key)) continue;
      map.set(key, label);
    }
    const selected = currentCulture.trim();
    if (selected) {
      const key = normalizeKey(selected);
      if (key && !map.has(key)) {
        map.set(key, selected);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((value) => ({ value, label: value }));
  }, [cultures, currentCulture]);

  // ── Ações ────────────────────────────────────────────────────────────────

  const openCultureLinkModal = () => {
    setCultureLinkModalOpened(true);
  };

  const closeCultureLinkModal = () => {
    setCultureLinkModalOpened(false);
  };

  const handleLinkCultureFromRnc = (payload: RncCultivarSelectionPayload) => {
    const cultura = String(payload.cultura ?? '').trim();
    const cultivar = String(payload.cultivar ?? '').trim();
    const dataInicio = normalizeMonthYear(payload.dataInicio);
    const dataFim = normalizeMonthYear(payload.dataFim);
    if (!cultura || !dataInicio || !dataFim) {
      notifications.show({
        title: 'Seleção incompleta',
        message: 'A espécie e o período são obrigatórios para o vínculo.',
        color: 'yellow',
      });
      return;
    }
    if (monthYearOrder(dataInicio) > monthYearOrder(dataFim)) {
      notifications.show({
        title: 'Período inválido',
        message: 'O período selecionado é inválido.',
        color: 'yellow',
      });
      return;
    }

    const incomingRow: CultureEntry = {
      cultura,
      cultivar: cultivar || undefined,
      especie_nome_comum:
        String(payload.especieNomeComum ?? '').trim() || cultura,
      especie_nome_cientifico:
        String(payload.especieNomeCientifico ?? '').trim() || undefined,
      grupo_especie: String(payload.grupoEspecie ?? '').trim() || undefined,
      rnc_detail_url: String(payload.rncDetailUrl ?? '').trim() || undefined,
      technical_priority: cultivar ? 'cultivar' : 'species',
      data_inicio: dataInicio,
      data_fim: dataFim,
      fonte: payload.fonte,
    };

    setCultures((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          normalizeKey(item.cultura) === normalizeKey(incomingRow.cultura) &&
          normalizeKey(item.cultivar ?? '') ===
            normalizeKey(incomingRow.cultivar ?? ''),
      );
      if (existingIndex < 0) return [...prev, incomingRow];
      return prev.map((item, index) =>
        index === existingIndex ? incomingRow : item,
      );
    });

    if (!currentCulture.trim()) {
      setCurrentCulture(cultura);
    }

    notifications.show({
      title: 'Cultura vinculada',
      message: cultivar
        ? `${cultura} vinculada com refino da cultivar ${cultivar}.`
        : `${cultura} vinculada por espécie (sem refino de cultivar).`,
      color: 'green',
    });
    setCultureLinkModalOpened(false);
  };

  const openEditCultureModal = (index: number) => {
    const row = cultures[index];
    if (!row) return;

    setCultureModalMode('edit');
    setEditingCultureIndex(index);
    setCultureDraft({
      cultura: row.cultura,
      cultivar: row.cultivar ?? '',
      data_inicio: row.data_inicio,
      data_fim: row.data_fim,
    });
    setCultureModalOpened(true);
  };

  const closeCultureModal = () => {
    setCultureModalOpened(false);
  };

  const saveCultureDraft = () => {
    if (cultureModalMode !== 'edit' || editingCultureIndex == null) {
      notifications.show({
        title: 'Cadastro manual bloqueado',
        message: 'Use o seletor do RNC para incluir novas culturas no talhão.',
        color: 'yellow',
      });
      setCultureModalOpened(false);
      return;
    }

    const cultura = cultureDraft.cultura.trim();
    const cultivar = cultureDraft.cultivar?.trim() || '';
    const dataInicio = normalizeMonthYear(cultureDraft.data_inicio);
    const dataFim = normalizeMonthYear(cultureDraft.data_fim);

    if (!cultura || !dataInicio || !dataFim) {
      notifications.show({
        title: 'Dados incompletos',
        message: 'Informe espécie, mês/ano inicial e mês/ano final.',
        color: 'yellow',
      });
      return;
    }

    if (monthYearOrder(dataInicio) > monthYearOrder(dataFim)) {
      notifications.show({
        title: 'Periodo inválido',
        message: 'O mês/ano final deve ser maior ou igual ao mês/ano inicial.',
        color: 'yellow',
      });
      return;
    }

    const row: CultureEntry = {
      cultura,
      cultivar: cultivar || undefined,
      data_inicio: dataInicio,
      data_fim: dataFim,
    };

    setCultures((prev) =>
      prev.map((item, index) =>
        index === editingCultureIndex
          ? {
              ...item,
              ...row,
            }
          : item,
      ),
    );
    if (!currentCulture.trim()) {
      setCurrentCulture(row.cultura);
    }

    setCultureModalOpened(false);
  };

  const removeCulture = (index: number) => {
    setCultures((prev) => {
      const removed = prev[index];
      const next = prev.filter((_, idx) => idx !== index);
      if (
        removed &&
        normalizeKey(removed.cultura) === normalizeKey(currentCulture) &&
        !next.some(
          (item) => normalizeKey(item.cultura) === normalizeKey(currentCulture),
        )
      ) {
        setCurrentCulture(next[0]?.cultura ?? '');
      }
      return next;
    });
  };

  const duplicateCultivarForTechnicalProfile = (index: number) => {
    const row = cultures[index];
    if (!row) return;

    const especieNomeComum = String(
      row.especie_nome_comum || row.cultura || '',
    ).trim();
    const especieNomeCientifico = String(
      row.especie_nome_cientifico || '',
    ).trim();
    const grupoEspecie = String(row.grupo_especie || '').trim();
    const cultivarNome = String(row.cultivar || '').trim();

    if (!especieNomeComum) {
      notifications.show({
        title: 'Espécie inválida',
        message:
          'Não foi possível identificar a espécie para preparar os dados técnicos.',
        color: 'yellow',
      });
      return;
    }

    if (!cultivarNome) {
      notifications.show({
        title: 'Cultivar ausente',
        message:
          'Selecione uma cultivar para duplicar dados técnicos específicos.',
        color: 'yellow',
      });
      return;
    }

    const technicalProfile = duplicateCultivarTechnicalProfile({
      especieNomeComum,
      especieNomeCientifico,
      grupoEspecie,
      cultivarNome,
      rncDetailUrl: row.rnc_detail_url,
    });

    setCultures((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              cultivar: technicalProfile.cultivar_nome,
              technical_profile_id: technicalProfile.id,
              technical_priority: 'cultivar',
            }
          : item,
      ),
    );

    notifications.show({
      title: 'Cultivar duplicada para edição técnica',
      message: `${technicalProfile.cultivar_nome} preparada para receber seus dados de produção.`,
      color: 'green',
    });
  };

  // ── Reset ────────────────────────────────────────────────────────────────

  const resetFromTalhao = (
    parsedCultures: CultureEntry[],
    persistedCurrentCulture: string,
  ) => {
    setCultures(parsedCultures);
    setCurrentCulture(
      persistedCurrentCulture || parsedCultures[0]?.cultura || '',
    );
    setCultureDraft(EMPTY_DRAFT);
    setCultureModalOpened(false);
    setCultureLinkModalOpened(false);
    setCultureModalMode('edit');
    setEditingCultureIndex(null);
  };

  return {
    cultures,
    setCultures,
    currentCulture,
    setCurrentCulture,
    cultureDraft,
    setCultureDraft,
    cultureModalOpened,
    cultureModalMode,
    cultureLinkModalOpened,
    editingCultureIndex,
    currentCultureOptions,
    openCultureLinkModal,
    closeCultureLinkModal,
    handleLinkCultureFromRnc,
    openEditCultureModal,
    closeCultureModal,
    saveCultureDraft,
    removeCulture,
    duplicateCultivarForTechnicalProfile,
    resetFromTalhao,
  };
}
