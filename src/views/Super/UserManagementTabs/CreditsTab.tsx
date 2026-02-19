import { Badge, Button, Card, Group, NumberInput, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import type { TransactionFlowFilter, CreditsTabProps } from './types';

export default function CreditsTab({
  selectedUser,
  selectedBalance,
  operationAmount,
  operationReason,
  setBalanceValue,
  transactionDateFrom,
  transactionDateTo,
  transactionFlowFilter,
  filteredTransactions,
  onOperationAmountChange,
  onOperationReasonChange,
  onSetBalanceValueChange,
  onTransactionDateFromChange,
  onTransactionDateToChange,
  onTransactionFlowFilterChange,
  onClearTransactionFilters,
  onGrant,
  onDebit,
  onApplySetBalance,
  onRefund,
}: CreditsTabProps) {
  return (
    <Stack>
      <Card withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Text fw={700}>Ajustes de saldo {selectedUser ? `- ${selectedUser.name}` : ''}</Text>

          {!selectedUser ? (
            <Text size="sm" c="dimmed">
              Selecione um usuario na aba Usuarios para liberar os menus de ajuste.
            </Text>
          ) : (
            <>
              <Group grow align="end">
                <NumberInput
                  label="Valor da operacao"
                  min={1}
                  value={operationAmount}
                  onChange={(value) => onOperationAmountChange(typeof value === 'number' ? value : '')}
                />
                <TextInput
                  label="Motivo"
                  value={operationReason}
                  onChange={(event) => onOperationReasonChange(event.currentTarget.value)}
                />
              </Group>
              <Group>
                <Button color="teal" onClick={onGrant}>
                  Dar creditos
                </Button>
                <Button color="orange" onClick={onDebit}>
                  Remover creditos
                </Button>
              </Group>
              <Group align="end">
                <NumberInput
                  label="Definir saldo exato"
                  min={0}
                  value={setBalanceValue}
                  onChange={(value) => onSetBalanceValueChange(typeof value === 'number' ? value : '')}
                  w={220}
                />
                <Button variant="light" onClick={onApplySetBalance}>
                  Aplicar saldo exato
                </Button>
                <Badge color="grape">Saldo atual: {selectedBalance}</Badge>
              </Group>
            </>
          )}
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Text fw={700} mb="sm">
          Historico do usuario selecionado
        </Text>
        {!selectedUser ? (
          <Text c="dimmed" size="sm">
            Selecione um usuario para visualizar transacoes com filtros.
          </Text>
        ) : (
          <Stack gap="sm">
            <Group grow align="end">
              <TextInput
                label="Data inicial"
                type="date"
                value={transactionDateFrom}
                onChange={(event) => onTransactionDateFromChange(event.currentTarget.value)}
              />
              <TextInput
                label="Data final"
                type="date"
                value={transactionDateTo}
                onChange={(event) => onTransactionDateToChange(event.currentTarget.value)}
              />
              <Select
                label="Fluxo"
                data={[
                  { value: 'all', label: 'Todos' },
                  { value: 'entry', label: 'Entrada (compra ou ganhar)' },
                  { value: 'exit', label: 'Saida (gasto ou uso)' },
                ]}
                value={transactionFlowFilter}
                onChange={(value) =>
                  onTransactionFlowFilterChange((value as TransactionFlowFilter) ?? 'all')
                }
              />
              <Button variant="light" onClick={onClearTransactionFilters}>
                Limpar filtros
              </Button>
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Movimento</Table.Th>
                  <Table.Th>Saldo apos</Table.Th>
                  <Table.Th>Descricao</Table.Th>
                  <Table.Th>Ressarcir</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredTransactions.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text c="dimmed" size="sm">
                        Nenhuma transacao encontrada para os filtros aplicados.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <Table.Tr key={tx.id}>
                      <Table.Td>{new Date(tx.created_at).toLocaleString('pt-BR')}</Table.Td>
                      <Table.Td>{tx.type}</Table.Td>
                      <Table.Td>
                        <Text c={tx.amount < 0 ? 'red.6' : 'teal.6'} fw={700}>
                          {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                        </Text>
                      </Table.Td>
                      <Table.Td>{tx.balance_after}</Table.Td>
                      <Table.Td>{tx.description}</Table.Td>
                      <Table.Td>
                        {tx.amount < 0 ? (
                          <Button size="xs" variant="light" onClick={() => onRefund(tx)}>
                            Ressarcir
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
        )}
      </Card>
    </Stack>
  );
}
