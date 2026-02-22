import { Button, Card, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import type { ReceiptTypeFilter, ReceiptsTabProps } from './types';

export default function ReceiptsTab({
  users,
  receiptUserFilter,
  receiptTypeFilter,
  receiptDateFrom,
  receiptDateTo,
  filteredReceipts,
  userById,
  onReceiptUserFilterChange,
  onReceiptTypeFilterChange,
  onReceiptDateFromChange,
  onReceiptDateToChange,
  onClearReceiptFilters,
}: ReceiptsTabProps) {
  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Group grow align="end">
          <Select
            label="Usuário"
            value={receiptUserFilter}
            data={[
              { value: 'all', label: 'Todos os usuários' },
              ...users.map((row) => ({
                value: row.id,
                label: row.name ? `${row.name} (${row.email})` : row.email,
              })),
            ]}
            onChange={(value) => onReceiptUserFilterChange(value ?? 'all')}
            searchable
          />
          <Select
            label="Tipo"
            value={receiptTypeFilter}
            data={[
              { value: 'all', label: 'Todos' },
              { value: 'avatar_icon', label: 'Ícone de avatar' },
            ]}
            onChange={(value) =>
              onReceiptTypeFilterChange((value as ReceiptTypeFilter) ?? 'all')
            }
          />
          <TextInput
            label="Data inicial"
            type="date"
            value={receiptDateFrom}
            onChange={(event) => onReceiptDateFromChange(event.currentTarget.value)}
          />
          <TextInput
            label="Data final"
            type="date"
            value={receiptDateTo}
            onChange={(event) => onReceiptDateToChange(event.currentTarget.value)}
          />
          <Button variant="light" onClick={onClearReceiptFilters}>
            Limpar filtros
          </Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data</Table.Th>
              <Table.Th>Comprovante</Table.Th>
              <Table.Th>Usuario</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Item</Table.Th>
              <Table.Th>Qtd.</Table.Th>
              <Table.Th>Custo unit.</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Transacao</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredReceipts.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text c="dimmed" size="sm">
                    Nenhum comprovante encontrado para os filtros atuais.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredReceipts.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{new Date(row.created_at).toLocaleString('pt-BR')}</Table.Td>
                  <Table.Td>{row.receipt_number}</Table.Td>
                  <Table.Td>{userById.get(row.user_id)?.email ?? row.user_id}</Table.Td>
                  <Table.Td>{row.purchase_type}</Table.Td>
                  <Table.Td>{row.item_label}</Table.Td>
                  <Table.Td>{row.quantity}</Table.Td>
                  <Table.Td>{row.unit_cost_credits}</Table.Td>
                  <Table.Td>{row.total_cost_credits}</Table.Td>
                  <Table.Td>{row.credit_transaction_id ?? '-'}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}
