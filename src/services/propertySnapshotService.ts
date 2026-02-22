import type { Property, Talhao } from '../types/property';
import {
  fetchAnalysesByProperties,
  fetchTalhoesByProperties,
  type AnalysisRow,
} from './propertyMapService';

export type PropertyDeletionSnapshot = {
  property: Property;
  talhoes: Talhao[];
  analyses: AnalysisRow[];
};

export type PropertyExportDataset = {
  properties: Property[];
  talhoes: Talhao[];
  analyses: AnalysisRow[];
};

export async function loadPropertyDeletionSnapshot(
  property: Property,
): Promise<PropertyDeletionSnapshot> {
  const propertyId = String(property.id ?? '').trim();
  if (!propertyId) {
    throw new Error('Propriedade inválida para gerar snapshot de exclusao.');
  }

  const [talhoes, analyses] = await Promise.all([
    fetchTalhoesByProperties([propertyId]),
    fetchAnalysesByProperties([propertyId]),
  ]);

  return {
    property,
    talhoes,
    analyses,
  };
}

export async function loadPropertyExportDataset(input: {
  visibleProperties: Property[];
  selectedPropertyIds: string[];
  includeTalhoes: boolean;
  includeAnalyses: boolean;
}): Promise<PropertyExportDataset> {
  const visibleProperties = input.visibleProperties;
  if (visibleProperties.length === 0) {
    return { properties: [], talhoes: [], analyses: [] };
  }

  const selectedIdsSet = new Set(
    input.selectedPropertyIds
      .map((id) => String(id ?? '').trim())
      .filter((id) => id.length > 0),
  );
  const scopedProperties = visibleProperties.filter((row) =>
    selectedIdsSet.has(row.id),
  );
  if (scopedProperties.length === 0) {
    return { properties: [], talhoes: [], analyses: [] };
  }

  const scopedPropertyIds = scopedProperties.map((row) => row.id);
  const talhoes =
    input.includeTalhoes || input.includeAnalyses
      ? await fetchTalhoesByProperties(scopedPropertyIds)
      : [];

  const analyses =
    input.includeAnalyses
      ? await fetchAnalysesByProperties(scopedPropertyIds)
      : [];

  return {
    properties: scopedProperties,
    talhoes,
    analyses,
  };
}
