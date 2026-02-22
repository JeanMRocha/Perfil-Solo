import { Badge, Button, Card, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import type { UserBalanceFilter, UsersTabProps } from './types';

export default function UsersTab({
  rows,
  selectedUserId,
  userSearch,
  userBalanceFilter,
  onUserSearchChange,
  onUserBalanceFilterChange,
  onSelectUser,
}: UsersTabProps) {
  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Group grow align="end">
          <TextInput
            label="Buscar usuário"
            placeholder="Nome ou email"
            value={userSearch}
            onChange={(event) => onUserSearchChange(event.currentTarget.value)}
          />
          <Select
            label="Filtro de saldo"
            value={userBalanceFilter}
            data={[
              { value: 'all', label: 'Todos' },
              { value: 'with_balance', label: 'Com saldo' },
              { value: 'zero_balance', label: 'Sem saldo' },
            ]}
            onChange={(value) =>
              onUserBalanceFilterChange((value as UserBalanceFilter) ?? 'all')
            }
          />
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Creditos</Table.Th>
              <Table.Th>Acao</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" size="sm">
                    Nenhum usuario encontrado para os filtros atuais.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{row.name}</Table.Td>
                  <Table.Td>{row.email}</Table.Td>
                  <Table.Td>
                    <Badge color="violet">{row.balance}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant={row.id === selectedUserId ? 'filled' : 'light'}
                      onClick={() => onSelectUser(row)}
                    >
                      {row.id === selectedUserId ? 'Selecionado' : 'Selecionar'}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}
