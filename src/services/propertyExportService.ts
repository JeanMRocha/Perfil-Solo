import type { Property, Talhao } from '../types/property';
import type { AnalysisRow } from './propertyMapService';
import { parseTalhaoGeometry } from './propertyMapService';
import type { SoilResultResponse } from './soilClassificationContractService';

export type PropertyExportScope = 'full' | 'talhoes' | 'analises';

export type PropertyDeleteSnapshot = {
  property: Property;
  talhoes: Talhao[];
  analyses: AnalysisRow[];
};

type PropertyExportPayload = {
  scope?: PropertyExportScope;
  sections?: {
    properties?: boolean;
    talhoes?: boolean;
    analyses?: boolean;
    soilClassification?: boolean;
  };
  properties: Property[];
  talhoes: Talhao[];
  analyses: AnalysisRow[];
  title?: string;
  subtitle?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value: string | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
}

function formatArea(value: number | undefined): string {
  const area = Number(value ?? 0);
  if (!Number.isFinite(area) || area <= 0) return '0,00 ha';
  return `${area.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

function computePropertyAreaFromTalhoes(talhoes: Talhao[]): Record<string, number> {
  return talhoes.reduce<Record<string, number>>((acc, row) => {
    const area = Number(row.area_ha ?? 0);
    if (!Number.isFinite(area) || area <= 0) return acc;
    acc[row.property_id] = (acc[row.property_id] ?? 0) + area;
    return acc;
  }, {});
}

function openPrintDocument(html: string): void {
  const printWindow = window.open('', '_blank', 'width=1180,height=900');
  if (!printWindow) {
    throw new Error('Não foi possível abrir a janela para exportação em PDF.');
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    try {
      printWindow.print();
    } catch {
      // ignored
    }
  }, 280);
}

function renderPropertiesTable(
  properties: Property[],
  talhoes: Talhao[],
  analyses: AnalysisRow[],
): string {
  if (properties.length === 0) {
    return '<tr><td colspan="6">Nenhuma propriedade encontrada.</td></tr>';
  }

  const talhoesCountByProperty = talhoes.reduce<Record<string, number>>((acc, row) => {
    acc[row.property_id] = (acc[row.property_id] ?? 0) + 1;
    return acc;
  }, {});
  const analysesCountByProperty = analyses.reduce<Record<string, number>>((acc, row) => {
    acc[row.property_id] = (acc[row.property_id] ?? 0) + 1;
    return acc;
  }, {});
  const areaByProperty = computePropertyAreaFromTalhoes(talhoes);

  return properties
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.nome)}</td>
          <td>${escapeHtml(row.cidade ?? '-')}</td>
          <td>${escapeHtml(row.estado ?? '-')}</td>
          <td>${talhoesCountByProperty[row.id] ?? 0}</td>
          <td>${analysesCountByProperty[row.id] ?? 0}</td>
          <td>${escapeHtml(formatArea(areaByProperty[row.id]))}</td>
        </tr>
      `,
    )
    .join('');
}

function renderTalhoesTable(properties: Property[], talhoes: Talhao[]): string {
  if (talhoes.length === 0) {
    return '<tr><td colspan="6">Nenhum talhão encontrado.</td></tr>';
  }

  const propertyNameById = new Map(properties.map((row) => [row.id, row.nome]));
  return talhoes
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(propertyNameById.get(row.property_id) ?? row.property_id)}</td>
          <td>${escapeHtml(row.nome)}</td>
          <td>${escapeHtml(row.tipo_solo ?? '-')}</td>
          <td>${escapeHtml(formatArea(row.area_ha))}</td>
          <td>${escapeHtml(formatDateTime(row.created_at))}</td>
        </tr>
      `,
    )
    .join('');
}

function renderAnalysesTable(
  properties: Property[],
  talhoes: Talhao[],
  analyses: AnalysisRow[],
): string {
  if (analyses.length === 0) {
    return '<tr><td colspan="8">Nenhuma análise encontrada.</td></tr>';
  }

  const propertyNameById = new Map(properties.map((row) => [row.id, row.nome]));
  const talhaoNameById = new Map(talhoes.map((row) => [row.id, row.nome]));
  const sortedRows = [...analyses].sort((a, b) => {
    const aDate = new Date(a.data_amostragem || a.created_at || '').getTime();
    const bDate = new Date(b.data_amostragem || b.created_at || '').getTime();
    return (bDate || 0) - (aDate || 0);
  });

  return sortedRows
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(propertyNameById.get(row.property_id) ?? row.property_id)}</td>
          <td>${escapeHtml(talhaoNameById.get(row.talhao_id) ?? row.talhao_id)}</td>
          <td>${escapeHtml(String((row as any).codigo_amostra ?? row.id ?? '-'))}</td>
          <td>${escapeHtml(String((row as any).laboratorio ?? '-'))}</td>
          <td>${escapeHtml(formatDateTime(row.data_amostragem))}</td>
          <td>${escapeHtml(formatDateTime(row.created_at))}</td>
        </tr>
      `,
    )
    .join('');
}

type TalhaoSoilSnapshotRow = {
  propertyName: string;
  talhaoName: string;
  order: SoilResultResponse['result']['primary']['order'];
  confidence: number;
  mode: SoilResultResponse['result']['primary']['mode'];
  appliedAt: string;
  alternatives: string;
  pendingChecks: string;
};

function formatPercent(value: number | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '-';
  return `${Math.round(num)}%`;
}

function buildTalhaoSoilSnapshotRows(
  properties: Property[],
  talhoes: Talhao[],
): TalhaoSoilSnapshotRow[] {
  if (talhoes.length === 0) return [];

  const propertyNameById = new Map(properties.map((row) => [row.id, row.nome]));

  return talhoes
    .map((talhao): TalhaoSoilSnapshotRow | null => {
      const geometry = parseTalhaoGeometry(talhao.coordenadas_svg);
      const snapshot = geometry.soilClassification;
      const primary = snapshot?.response?.result?.primary;
      if (!snapshot || !primary) return null;

      const alternatives = snapshot.response.alternatives
        .slice(0, 2)
        .map((row) => `${row.order} (${formatPercent(row.confidence)})`)
        .join(' | ');
      const pendingChecks = snapshot.response.next_steps
        .slice(0, 2)
        .map((row) => row.what)
        .join(' | ');

      return {
        propertyName: propertyNameById.get(talhao.property_id) ?? talhao.property_id,
        talhaoName: talhao.nome,
        order: primary.order,
        confidence: primary.confidence,
        mode: primary.mode,
        appliedAt: snapshot.applied_at,
        alternatives,
        pendingChecks,
      };
    })
    .filter((row): row is TalhaoSoilSnapshotRow => row !== null);
}

function renderSoilClassificationTable(rows: TalhaoSoilSnapshotRow[]): string {
  if (rows.length === 0) {
    return '<tr><td colspan="8">Nenhum snapshot SiBCS encontrado nos talhões selecionados.</td></tr>';
  }

  return rows
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.propertyName)}</td>
          <td>${escapeHtml(row.talhaoName)}</td>
          <td>${escapeHtml(row.order)}</td>
          <td>${escapeHtml(formatPercent(row.confidence))}</td>
          <td>${escapeHtml(row.mode)}</td>
          <td>${escapeHtml(formatDateTime(row.appliedAt))}</td>
          <td>${escapeHtml(row.alternatives || '-')}</td>
          <td>${escapeHtml(row.pendingChecks || '-')}</td>
        </tr>
      `,
    )
    .join('');
}

export function exportPropertiesDataToPdf(payload: PropertyExportPayload): void {
  const includeProperties =
    payload.sections?.properties ??
    (payload.scope === 'full' || payload.scope == null);
  const includeTalhoes =
    payload.sections?.talhoes ??
    (payload.scope === 'full' || payload.scope === 'talhoes');
  const includeAnalyses =
    payload.sections?.analyses ??
    (payload.scope === 'full' || payload.scope === 'analises');
  const includeSoilClassification =
    payload.sections?.soilClassification ?? includeTalhoes;

  const derivedScope: PropertyExportScope | null =
    includeProperties && includeTalhoes && includeAnalyses
      ? 'full'
      : !includeProperties && includeTalhoes && !includeAnalyses
        ? 'talhoes'
        : !includeProperties && !includeTalhoes && includeAnalyses
          ? 'analises'
          : null;

  const titleByScope: Record<PropertyExportScope, string> = {
    full: 'Exportacao completa de propriedades',
    talhoes: 'Exportação da lista de talhões',
    analises: 'Exportação da lista de análises de solo',
  };

  const title =
    payload.title ??
    (derivedScope ? titleByScope[derivedScope] : 'Exportação personalizada de propriedades');
  const subtitle =
    payload.subtitle ??
    'Relatório gerado no menu de seleção de propriedade para backup e auditoria.';

  const areaByProperty = computePropertyAreaFromTalhoes(payload.talhoes);
  const totalArea = Object.values(areaByProperty).reduce((acc, value) => acc + value, 0);

  const propertiesTable = renderPropertiesTable(
    payload.properties,
    payload.talhoes,
    payload.analyses,
  );
  const talhoesTable = renderTalhoesTable(payload.properties, payload.talhoes);
  const analysesTable = renderAnalysesTable(
    payload.properties,
    payload.talhoes,
    payload.analyses,
  );
  const soilSnapshotRows = buildTalhaoSoilSnapshotRows(
    payload.properties,
    payload.talhoes,
  );
  const soilClassificationTable = renderSoilClassificationTable(soilSnapshotRows);

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 28px; }
          h1 { margin: 0 0 8px; font-size: 24px; }
          h2 { margin: 24px 0 10px; font-size: 16px; }
          p { margin: 6px 0; }
          .meta { color: #374151; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f3f4f6; }
          .hint { margin-top: 18px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
        <p class="meta">Gerado em ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
        <p class="meta">
          Propriedades: ${payload.properties.length} | Talhões: ${payload.talhoes.length} | Análises: ${payload.analyses.length} | Snapshots SiBCS: ${soilSnapshotRows.length} | Área total: ${escapeHtml(formatArea(totalArea))}
        </p>

        ${
          includeProperties
            ? `
              <h2>Propriedades</h2>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Propriedade</th>
                    <th>Cidade</th>
                    <th>UF</th>
                    <th>Talhões</th>
                    <th>Análises</th>
                    <th>Área (talhões)</th>
                  </tr>
                </thead>
                <tbody>
                  ${propertiesTable}
                </tbody>
              </table>
            `
            : ''
        }

        ${
          includeTalhoes
            ? `
              <h2>Talhões</h2>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Propriedade</th>
                    <th>Talhão</th>
                    <th>Tipo de solo</th>
                    <th>Área</th>
                    <th>Cadastrado em</th>
                  </tr>
                </thead>
                <tbody>
                  ${talhoesTable}
                </tbody>
              </table>
            `
            : ''
        }

        ${
          includeSoilClassification
            ? `
              <h2>Classificação SiBCS do talhão</h2>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Propriedade</th>
                    <th>Talhão</th>
                    <th>Ordem provável</th>
                    <th>Confiança</th>
                    <th>Modo</th>
                    <th>Aplicada em</th>
                    <th>Alternativas</th>
                    <th>Pendências para confirmar</th>
                  </tr>
                </thead>
                <tbody>
                  ${soilClassificationTable}
                </tbody>
              </table>
            `
            : ''
        }

        ${
          includeAnalyses
            ? `
              <h2>Análises de solo</h2>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Propriedade</th>
                    <th>Talhão</th>
                    <th>Amostra</th>
                    <th>Laboratorio</th>
                    <th>Data amostragem</th>
                    <th>Criada em</th>
                  </tr>
                </thead>
                <tbody>
                  ${analysesTable}
                </tbody>
              </table>
            `
            : ''
        }

        <p class="hint">Na janela de impressao do navegador, escolha "Salvar como PDF".</p>
      </body>
    </html>
  `;

  openPrintDocument(html);
}

export function exportPropertySnapshotToPdf(snapshot: PropertyDeleteSnapshot): void {
  exportPropertiesDataToPdf({
    scope: 'full',
    title: `Backup da propriedade antes da exclusão: ${snapshot.property.nome}`,
    subtitle:
      'Arquivo de segurança gerado automaticamente antes da exclusão definitiva da propriedade.',
    properties: [snapshot.property],
    talhoes: snapshot.talhoes,
    analyses: snapshot.analyses,
  });
}
