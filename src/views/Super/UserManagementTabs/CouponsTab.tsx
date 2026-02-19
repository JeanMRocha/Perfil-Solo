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
  Textarea,
  Title,
} from '@mantine/core';
import type { CreditCouponType } from '../../../services/creditsService';
import type { CouponsTabProps } from './types';

export default function CouponsTab({
  couponCode,
  couponType,
  couponValue,
  couponMaxRedemptions,
  couponExpiresAt,
  couponNotes,
  couponRows,
  couponRedemptions,
  userById,
  onCouponCodeChange,
  onCouponTypeChange,
  onCouponValueChange,
  onCouponMaxRedemptionsChange,
  onCouponExpiresAtChange,
  onCouponNotesChange,
  onCreateCoupon,
  onToggleCoupon,
  formatCreditPrice,
}: CouponsTabProps) {
  return (
    <Stack>
      <Card withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={5}>Cupons de desconto</Title>
          <Group grow align="end">
            <TextInput
              label="Codigo do cupom"
              value={couponCode}
              onChange={(event) => onCouponCodeChange(event.currentTarget.value)}
              placeholder="EX: SOLO10"
            />
            <Select
              label="Tipo"
              data={[
                { value: 'percent', label: 'Percentual (%)' },
                { value: 'fixed', label: 'Fixo (R$)' },
              ]}
              value={couponType}
              onChange={(value) => onCouponTypeChange((value as CreditCouponType) ?? 'percent')}
            />
            <NumberInput
              label={couponType === 'percent' ? 'Valor (%)' : 'Valor (R$)'}
              min={1}
              value={couponValue}
              onChange={(value) => onCouponValueChange(typeof value === 'number' ? value : '')}
            />
            <NumberInput
              label="Limite de usos"
              min={1}
              value={couponMaxRedemptions}
              onChange={(value) =>
                onCouponMaxRedemptionsChange(typeof value === 'number' ? value : '')
              }
              placeholder="Vazio = ilimitado"
            />
            <TextInput
              label="Expira em"
              type="datetime-local"
              value={couponExpiresAt}
              onChange={(event) => onCouponExpiresAtChange(event.currentTarget.value)}
            />
          </Group>
          <Textarea
            label="Observacoes"
            value={couponNotes}
            onChange={(event) => onCouponNotesChange(event.currentTarget.value)}
            minRows={2}
          />
          <Group justify="flex-end">
            <Button color="violet" onClick={onCreateCoupon}>
              Criar cupom
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Text fw={700} mb="sm">
          Cupons cadastrados
        </Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Codigo</Table.Th>
              <Table.Th>Desconto</Table.Th>
              <Table.Th>Usos</Table.Th>
              <Table.Th>Expira</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Acoes</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {couponRows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" size="sm">
                    Nenhum cupom cadastrado.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              couponRows.map((coupon) => (
                <Table.Tr key={coupon.id}>
                  <Table.Td>{coupon.code}</Table.Td>
                  <Table.Td>
                    {coupon.type === 'percent'
                      ? `${coupon.value}%`
                      : formatCreditPrice(Math.round(coupon.value * 100))}
                  </Table.Td>
                  <Table.Td>
                    {coupon.redeemed_count}/
                    {coupon.max_redemptions == null ? 'ilimitado' : coupon.max_redemptions}
                  </Table.Td>
                  <Table.Td>
                    {coupon.expires_at
                      ? new Date(coupon.expires_at).toLocaleString('pt-BR')
                      : '-'}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={coupon.active ? 'teal' : 'gray'}>
                      {coupon.active ? 'ativo' : 'inativo'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => onToggleCoupon(coupon)}
                    >
                      {coupon.active ? 'Desativar' : 'Ativar'}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Text fw={700} mb="sm">
          Historico de uso de cupons
        </Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data</Table.Th>
              <Table.Th>Cupom</Table.Th>
              <Table.Th>Usuario</Table.Th>
              <Table.Th>Pacote</Table.Th>
              <Table.Th>Desconto</Table.Th>
              <Table.Th>Valor final</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {couponRedemptions.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" size="sm">
                    Nenhum uso de cupom registrado.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              couponRedemptions.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{new Date(row.created_at).toLocaleString('pt-BR')}</Table.Td>
                  <Table.Td>{row.coupon_code}</Table.Td>
                  <Table.Td>{userById.get(row.user_id)?.email ?? row.user_id}</Table.Td>
                  <Table.Td>{row.package_id}</Table.Td>
                  <Table.Td>{formatCreditPrice(row.discount_cents)}</Table.Td>
                  <Table.Td>{formatCreditPrice(row.final_price_cents)}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
