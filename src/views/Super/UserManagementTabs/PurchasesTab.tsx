import { Badge, Button, Card, Group, Select, Stack, Table, Text } from '@mantine/core';
import type { RequestStatusFilter, PurchasesTabProps } from './types';

export default function PurchasesTab({
  requestStatusFilter,
  rows,
  userById,
  onRequestStatusFilterChange,
  onClearRequestFilters,
  onReviewRequest,
  formatCreditPrice,
}: PurchasesTabProps) {
  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Group grow align="end">
          <Select
            label="Status"
            value={requestStatusFilter}
            data={[
              { value: 'all', label: 'Todos' },
              { value: 'pending', label: 'Pendentes' },
              { value: 'approved', label: 'Aprovadas' },
              { value: 'denied', label: 'Negadas' },
            ]}
            onChange={(value) =>
              onRequestStatusFilterChange((value as RequestStatusFilter) ?? 'all')
            }
          />
          <Button variant="light" onClick={onClearRequestFilters}>
            Limpar filtro
          </Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data</Table.Th>
              <Table.Th>Usuario</Table.Th>
              <Table.Th>Pacote</Table.Th>
              <Table.Th>Creditos</Table.Th>
              <Table.Th>Cupom</Table.Th>
              <Table.Th>Valor final</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Acoes</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text c="dimmed" size="sm">
                    Nenhuma solicitacao encontrada para os filtros atuais.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((request) => {
                const requestUser = userById.get(request.user_id);
                return (
                  <Table.Tr key={request.id}>
                    <Table.Td>{new Date(request.created_at).toLocaleString('pt-BR')}</Table.Td>
                    <Table.Td>{requestUser?.email ?? request.user_id}</Table.Td>
                    <Table.Td>{request.package_label ?? request.package_id}</Table.Td>
                    <Table.Td>{request.credits_requested}</Table.Td>
                    <Table.Td>{request.coupon_code ?? '-'}</Table.Td>
                    <Table.Td>
                      {formatCreditPrice(
                        request.final_price_cents ?? request.price_cents ?? 0,
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          request.status === 'approved'
                            ? 'teal'
                            : request.status === 'denied'
                              ? 'red'
                              : 'yellow'
                        }
                      >
                        {request.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {request.status === 'pending' ? (
                        <Group gap={6}>
                          <Button
                            size="xs"
                            color="teal"
                            onClick={() => onReviewRequest(request, true)}
                          >
                            Aprovar
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() => onReviewRequest(request, false)}
                          >
                            Negar
                          </Button>
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">
                          Revisada
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}
