import {
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import type { BillingPlanId } from '../../../modules/billing';
import type { BillingLedgerTypeFilter, MonetizationTabProps } from './types';

function formatTypeLabel(type: string): string {
  if (type === 'monthly_invoice') return 'Mensalidade';
  if (type === 'credit_topup') return 'Compra de créditos (cosmeticos)';
  if (type === 'refund') return 'Estorno';
  return type;
}

function formatStatusLabel(status: string): string {
  if (status === 'posted') return 'Postado';
  if (status === 'refunded') return 'Estornado';
  if (status === 'partially_refunded') return 'Estorno parcial';
  return status;
}

function statusColor(status: string): string {
  if (status === 'refunded') return 'orange';
  if (status === 'partially_refunded') return 'yellow';
  return 'teal';
}

export default function MonetizationTab({
  users,
  selectedUserId,
  selectedPlanId,
  topupReais,
  stats,
  rows,
  userById,
  userFilter,
  typeFilter,
  dateFrom,
  dateTo,
  onSelectedUserChange,
  onSelectedPlanChange,
  onTopupReaisChange,
  onUserFilterChange,
  onTypeFilterChange,
  onDateFromChange,
  onDateToChange,
  onClearFilters,
  onApplyPlan,
  onGenerateInvoice,
  onTopupCredits,
  onRefund,
  catalogConfig,
  onCatalogPlanBasePriceChange,
  onCatalogFeatureChange,
  onSaveCatalogConfig,
  onResetCatalogConfig,
  formatMoney,
}: MonetizationTabProps) {
  return (
    <Stack>
      <Card
        withBorder
        radius="md"
        p="sm"
        style={{
          position: 'sticky',
          top: 8,
          zIndex: 20,
          borderColor: 'var(--mantine-color-violet-4)',
          background: 'var(--mantine-color-violet-0)',
        }}
      >
        <Group justify="space-between" gap="xs">
          <Text size="sm" fw={700}>
            Regra de moedas do sistema
          </Text>
          <Badge color="violet" variant="light">
            1 via
          </Badge>
        </Group>
        <Text size="sm" mt={4}>
          Funcionalidades do sistema sao cobradas em dinheiro (BRL).
        </Text>
        <Text size="sm">
          Creditos compram apenas itens cosmeticos dentro do app.
        </Text>
        <Text size="xs" c="dimmed">
          Conversao reversa de creditos para dinheiro e proibida.
        </Text>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={5}>Resumo financeiro</Title>
          <Group grow>
            <Card withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed">
                Bruto acumulado
              </Text>
              <Text fw={700}>{formatMoney(stats.total_gross_cents)}</Text>
            </Card>
            <Card withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed">
                Estornado
              </Text>
              <Text fw={700}>{formatMoney(stats.total_refunded_cents)}</Text>
            </Card>
            <Card withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed">
                Liquido
              </Text>
              <Text fw={700}>{formatMoney(stats.total_net_cents)}</Text>
            </Card>
            <Card withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed">
                Creditos emitidos
              </Text>
              <Text fw={700}>{stats.total_credits_issued}</Text>
            </Card>
          </Group>
          <Group>
            <Badge color="gray">Entradas: {stats.entries_count}</Badge>
            <Badge color="blue">Mensalidades: {stats.invoice_count}</Badge>
            <Badge color="grape">Topups: {stats.topup_count}</Badge>
            <Badge color="orange">Estornos: {stats.refund_count}</Badge>
            <Badge color="teal">
              Ativos Free: {stats.active_subscriptions_by_plan.free}
            </Badge>
            <Badge color="indigo">
              Ativos Premium: {stats.active_subscriptions_by_plan.premium}
            </Badge>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={5}>Catalogo publico (Landing + Assinatura)</Title>
          <Text size="sm" c="dimmed">
            Essas configuracoes aparecem na landing e na tela de planos do usuario.
          </Text>

          <Group grow>
            <NumberInput
              label="Plano Free (R$/mes)"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              value={catalogConfig.plans.free.base_price_cents / 100}
              onChange={(value) =>
                onCatalogPlanBasePriceChange(
                  'free',
                  typeof value === 'number' ? Math.round(value * 100) : '',
                )
              }
            />
            <NumberInput
              label="Plano Premium (R$/mes)"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              value={catalogConfig.plans.premium.base_price_cents / 100}
              onChange={(value) =>
                onCatalogPlanBasePriceChange(
                  'premium',
                  typeof value === 'number' ? Math.round(value * 100) : '',
                )
              }
            />
          </Group>

          {([
            ['properties', 'Propriedades'],
            ['talhoes', 'Talhões'],
            ['analises', 'Análises'],
          ] as const).map(([featureId, label]) => {
            const feature = catalogConfig.features[featureId];
            return (
              <Card key={featureId} withBorder radius="md" p="sm">
                <Stack gap="xs">
                  <Text fw={600}>{label}</Text>
                  <Group grow>
                    <NumberInput
                      label="Franquia Free"
                      min={0}
                      value={feature.included_by_plan.free}
                      onChange={(value) =>
                        onCatalogFeatureChange(featureId, {
                          included_free: typeof value === 'number' ? value : '',
                        })
                      }
                    />
                    <NumberInput
                      label="Franquia Premium"
                      min={0}
                      value={feature.included_by_plan.premium}
                      onChange={(value) =>
                        onCatalogFeatureChange(featureId, {
                          included_premium: typeof value === 'number' ? value : '',
                        })
                      }
                    />
                    <NumberInput
                      label="Adicional (R$)"
                      min={0}
                      decimalScale={2}
                      fixedDecimalScale
                      value={feature.extra_unit_price_cents / 100}
                      onChange={(value) =>
                        onCatalogFeatureChange(featureId, {
                          extra_unit_price_cents:
                            typeof value === 'number' ? Math.round(value * 100) : '',
                        })
                      }
                    />
                  </Group>
                </Stack>
              </Card>
            );
          })}

          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={onResetCatalogConfig}>
              Restaurar padrao
            </Button>
            <Button color="teal" onClick={onSaveCatalogConfig}>
              Salvar catalogo
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={5}>Acoes de monetizacao</Title>
          <Group grow align="end">
            <Select
              label="Usuário"
              data={users.map((row) => ({
                value: row.id,
                label: row.name ? `${row.name} (${row.email})` : row.email,
              }))}
              value={selectedUserId || null}
              onChange={(value) => onSelectedUserChange(value ?? '')}
              searchable
              nothingFoundMessage="Sem usuários"
            />
            <Select
              label="Plano"
              data={[
                { value: 'free', label: 'Free' },
                {
                  value: 'premium',
                  label: `Premium (${formatMoney(
                    catalogConfig.plans.premium.base_price_cents,
                  )})`,
                },
              ]}
              value={selectedPlanId}
              onChange={(value) => onSelectedPlanChange((value as BillingPlanId) ?? 'free')}
            />
            <Button onClick={onApplyPlan} disabled={!selectedUserId}>
              Aplicar plano
            </Button>
          </Group>

          <Group align="end" grow>
            <NumberInput
              label="Topup cosmetico (R$ -> créditos)"
              min={1}
              decimalScale={2}
              fixedDecimalScale
              value={topupReais}
              onChange={(value) => onTopupReaisChange(typeof value === 'number' ? value : '')}
            />
            <Button onClick={onTopupCredits} disabled={!selectedUserId}>
              Comprar creditos cosmeticos
            </Button>
            <Button variant="light" onClick={onGenerateInvoice} disabled={!selectedUserId}>
              Gerar fechamento mensal
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={5}>Historico detalhado</Title>
          <Group grow align="end">
            <Select
              label="Usuário"
              value={userFilter}
              data={[
                { value: 'all', label: 'Todos os usuários' },
                ...users.map((row) => ({
                  value: row.id,
                  label: row.name ? `${row.name} (${row.email})` : row.email,
                })),
              ]}
              onChange={(value) => onUserFilterChange(value ?? 'all')}
              searchable
            />
            <Select
              label="Tipo"
              value={typeFilter}
              data={[
                { value: 'all', label: 'Todos' },
                { value: 'monthly_invoice', label: 'Mensalidade' },
                { value: 'credit_topup', label: 'Compra de créditos (cosmeticos)' },
                { value: 'refund', label: 'Estorno' },
              ]}
              onChange={(value) =>
                onTypeFilterChange((value as BillingLedgerTypeFilter) ?? 'all')
              }
            />
            <TextInput
              label="Data inicial"
              type="date"
              value={dateFrom}
              onChange={(event) => onDateFromChange(event.currentTarget.value)}
            />
            <TextInput
              label="Data final"
              type="date"
              value={dateTo}
              onChange={(event) => onDateToChange(event.currentTarget.value)}
            />
            <Button variant="light" onClick={onClearFilters}>
              Limpar filtros
            </Button>
          </Group>

          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Data</Table.Th>
                <Table.Th>Usuario</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Valor</Table.Th>
                <Table.Th>Creditos</Table.Th>
                <Table.Th>Descricao</Table.Th>
                <Table.Th>Acoes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text c="dimmed" size="sm">
                      Nenhum lancamento encontrado para os filtros atuais.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                rows.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>{new Date(row.created_at).toLocaleString('pt-BR')}</Table.Td>
                    <Table.Td>{userById.get(row.user_id)?.email ?? row.user_id}</Table.Td>
                    <Table.Td>{formatTypeLabel(row.type)}</Table.Td>
                    <Table.Td>
                      <Badge color={statusColor(row.status)} variant="light">
                        {formatStatusLabel(row.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{formatMoney(row.amount_cents)}</Table.Td>
                    <Table.Td>{row.credits_delta}</Table.Td>
                    <Table.Td>{row.description}</Table.Td>
                    <Table.Td>
                      {row.type !== 'refund' && row.amount_cents > 0 ? (
                        <Button
                          size="xs"
                          variant="light"
                          color="orange"
                          onClick={() => onRefund(row)}
                        >
                          Estornar
                        </Button>
                      ) : (
                        <Text size="xs" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Stack>
      </Card>
    </Stack>
  );
}
