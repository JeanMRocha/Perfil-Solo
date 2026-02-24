/**
 * CosmeticsShop.tsx
 *
 * Seção da loja interna para compra de cosméticos.
 * Exibe todos os slots com seus itens, estado de desbloqueio,
 * e opções de compra (créditos ou dinheiro).
 */

import { useCallback, useEffect, useState } from 'react';
import {
    Badge,
    Box,
    Button,
    Card,
    Group,
    Modal,
    SegmentedControl,
    SimpleGrid,
    Stack,
    Text,
    ThemeIcon,
    Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
    IconCheck,
    IconCoin,
    IconCreditCard,
    IconLock,
    IconSparkles,
    IconStar,
} from '@tabler/icons-react';
import { useStore } from '@nanostores/react';
import { $currUser } from '../../global-state/user';
import { $tema } from '../../global-state/themeStore';
import { getUserCredits, CREDITS_UPDATED_EVENT } from '../../services/creditsService';
import {
    COSMETICS_UPDATED_EVENT,
    equipCosmetic,
    formatCosmeticPrice,
    getCosmeticsBySlot,
    getCosmeticSlots,
    getUserCosmeticInventory,
    isCosmeticUnlocked,
    purchaseCosmeticWithCredits,
    requestCosmeticPurchaseWithMoney,
    type CosmeticItem,
    type CosmeticPaymentMethod,
    type CosmeticSlot,
    type CosmeticUserInventory,
} from '../../services/cosmeticsService';
import { isLocalDataMode } from '../../services/dataProvider';

export default function CosmeticsShop() {
    const user = useStore($currUser);
    const tema = useStore($tema);
    const userId = user?.id ?? (isLocalDataMode ? 'local-user' : '');

    const [inventory, setInventory] = useState<CosmeticUserInventory | null>(null);
    const [credits, setCredits] = useState(0);
    const [activeSlot, setActiveSlot] = useState<CosmeticSlot>('property');
    const [confirmItem, setConfirmItem] = useState<CosmeticItem | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<CosmeticPaymentMethod>('credits');
    const [purchasing, setPurchasing] = useState(false);

    const refreshInventory = useCallback(() => {
        if (!userId) return;
        setInventory(getUserCosmeticInventory(userId));
        setCredits(getUserCredits(userId));
    }, [userId]);

    useEffect(() => {
        refreshInventory();
    }, [refreshInventory]);

    useEffect(() => {
        const onUpdate = () => refreshInventory();
        window.addEventListener(COSMETICS_UPDATED_EVENT, onUpdate);
        window.addEventListener(CREDITS_UPDATED_EVENT, onUpdate);
        window.addEventListener('storage', onUpdate);
        return () => {
            window.removeEventListener(COSMETICS_UPDATED_EVENT, onUpdate);
            window.removeEventListener(CREDITS_UPDATED_EVENT, onUpdate);
            window.removeEventListener('storage', onUpdate);
        };
    }, [refreshInventory]);

    const slots = getCosmeticSlots();
    const slotItems = getCosmeticsBySlot(activeSlot);

    const handleEquip = (item: CosmeticItem) => {
        if (!userId) return;
        try {
            equipCosmetic(userId, item.id);
            refreshInventory();
            notifications.show({
                title: '✓ Equipado!',
                message: `"${item.label}" está ativo agora.`,
                color: 'teal',
            });
        } catch (err: any) {
            notifications.show({
                title: 'Erro',
                message: err?.message ?? 'Não foi possível equipar.',
                color: 'red',
            });
        }
    };

    const handlePurchase = () => {
        if (!userId || !confirmItem) return;
        setPurchasing(true);
        try {
            const result =
                paymentMethod === 'credits'
                    ? purchaseCosmeticWithCredits(userId, confirmItem.id)
                    : requestCosmeticPurchaseWithMoney(userId, confirmItem.id);

            if (result.success) {
                notifications.show({
                    title: '✓ Compra realizada!',
                    message: result.message,
                    color: 'green',
                });
                refreshInventory();
                setConfirmItem(null);
            } else {
                notifications.show({
                    title: '⚠ Compra não concluída',
                    message: result.message,
                    color: 'orange',
                });
            }
        } catch (err: any) {
            notifications.show({
                title: 'Erro na compra',
                message: err?.message ?? 'Falha inesperada.',
                color: 'red',
            });
        } finally {
            setPurchasing(false);
        }
    };

    if (!userId) {
        return (
            <Text c="dimmed" ta="center" py="xl">
                Faça login para acessar a loja de cosméticos.
            </Text>
        );
    }

    const isDark = tema === 'dark';

    return (
        <Stack gap="lg">
            {/* Header */}
            <Card
                withBorder
                radius="md"
                p="md"
                style={{
                    background: isDark
                        ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(59, 130, 246, 0.08))'
                        : 'linear-gradient(135deg, rgba(139, 92, 246, 0.06), rgba(59, 130, 246, 0.04))',
                }}
            >
                <Group gap="md" wrap="nowrap">
                    <ThemeIcon size={48} radius="xl" variant="gradient" gradient={{ from: 'violet', to: 'blue' }}>
                        <IconSparkles size={24} />
                    </ThemeIcon>
                    <div>
                        <Text fw={700} size="lg">
                            Loja de Cosméticos
                        </Text>
                        <Text size="sm" c="dimmed">
                            Personalize seu dashboard com ícones exclusivos para propriedade,
                            talhão, loja e análise de solo.
                        </Text>
                    </div>
                    <Badge
                        size="lg"
                        variant="gradient"
                        gradient={{ from: 'orange', to: 'yellow' }}
                        leftSection={<IconCoin size={14} />}
                        ml="auto"
                    >
                        {credits} créditos
                    </Badge>
                </Group>
            </Card>

            {/* Slot selector */}
            <SegmentedControl
                value={activeSlot}
                onChange={(val) => setActiveSlot(val as CosmeticSlot)}
                data={slots.map((s) => ({ label: s.label, value: s.slot }))}
                fullWidth
                radius="md"
            />

            {/* Items grid */}
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
                {slotItems.map((item) => {
                    const unlocked = isCosmeticUnlocked(userId, item.id);
                    const equipped = inventory?.equipped[item.slot] === item.id;

                    return (
                        <Card
                            key={item.id}
                            withBorder
                            radius="md"
                            p="md"
                            style={{
                                position: 'relative',
                                overflow: 'hidden',
                                border: equipped
                                    ? `2px solid ${isDark ? 'rgba(20, 184, 166, 0.7)' : 'rgba(20, 184, 166, 0.6)'}`
                                    : undefined,
                                background: equipped
                                    ? isDark
                                        ? 'rgba(20, 184, 166, 0.06)'
                                        : 'rgba(20, 184, 166, 0.03)'
                                    : undefined,
                                transition: 'transform 180ms ease, box-shadow 180ms ease',
                                cursor: 'pointer',
                            }}
                            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                                e.currentTarget.style.transform = 'translateY(-3px)';
                                e.currentTarget.style.boxShadow = isDark
                                    ? '0 12px 24px rgba(0,0,0,0.4)'
                                    : '0 12px 24px rgba(15,23,42,0.12)';
                            }}
                            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '';
                            }}
                        >
                            {/* Equipped badge */}
                            {equipped && (
                                <Badge
                                    size="xs"
                                    color="teal"
                                    variant="filled"
                                    style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}
                                >
                                    Equipado
                                </Badge>
                            )}

                            {/* Lock overlay */}
                            {!unlocked && (
                                <Box
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        zIndex: 1,
                                        background: isDark
                                            ? 'rgba(2, 6, 23, 0.35)'
                                            : 'rgba(15, 23, 42, 0.08)',
                                        borderRadius: 'inherit',
                                        pointerEvents: 'none',
                                    }}
                                />
                            )}

                            <Stack align="center" gap="sm">
                                {/* Icon preview */}
                                <Box
                                    style={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: 16,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: isDark
                                            ? 'rgba(30, 41, 59, 0.6)'
                                            : 'rgba(241, 245, 249, 0.9)',
                                        border: isDark
                                            ? '1px solid rgba(71, 85, 105, 0.4)'
                                            : '1px solid rgba(203, 213, 225, 0.6)',
                                        fontSize: 36,
                                        position: 'relative',
                                        zIndex: 2,
                                    }}
                                >
                                    {item.emoji}
                                </Box>

                                <Text fw={700} size="sm" ta="center" style={{ zIndex: 2, position: 'relative' }}>
                                    {item.label}
                                </Text>

                                <Text
                                    size="xs"
                                    c="dimmed"
                                    ta="center"
                                    lineClamp={2}
                                    style={{ zIndex: 2, position: 'relative' }}
                                >
                                    {item.description}
                                </Text>

                                {/* Price / Status */}
                                <Group gap={6} justify="center" style={{ zIndex: 2, position: 'relative' }}>
                                    {item.price_credits === 0 ? (
                                        <Badge size="sm" variant="light" color="green">
                                            Grátis
                                        </Badge>
                                    ) : (
                                        <>
                                            <Tooltip label="Preço em créditos">
                                                <Badge
                                                    size="sm"
                                                    variant="light"
                                                    color="orange"
                                                    leftSection={<IconCoin size={10} />}
                                                >
                                                    {item.price_credits}
                                                </Badge>
                                            </Tooltip>
                                            {item.price_cents != null && (
                                                <Tooltip label="Preço em dinheiro">
                                                    <Badge
                                                        size="sm"
                                                        variant="light"
                                                        color="blue"
                                                        leftSection={<IconCreditCard size={10} />}
                                                    >
                                                        {formatCosmeticPrice(item.price_cents)}
                                                    </Badge>
                                                </Tooltip>
                                            )}
                                        </>
                                    )}
                                </Group>

                                {/* Action */}
                                <Box style={{ zIndex: 2, position: 'relative', width: '100%' }}>
                                    {equipped ? (
                                        <Button
                                            fullWidth
                                            size="xs"
                                            variant="light"
                                            color="teal"
                                            leftSection={<IconCheck size={14} />}
                                            disabled
                                        >
                                            Em uso
                                        </Button>
                                    ) : unlocked ? (
                                        <Button
                                            fullWidth
                                            size="xs"
                                            variant="light"
                                            color="indigo"
                                            leftSection={<IconStar size={14} />}
                                            onClick={() => handleEquip(item)}
                                        >
                                            Equipar
                                        </Button>
                                    ) : (
                                        <Button
                                            fullWidth
                                            size="xs"
                                            variant="gradient"
                                            gradient={{ from: 'violet', to: 'blue' }}
                                            leftSection={<IconLock size={14} />}
                                            onClick={() => {
                                                setConfirmItem(item);
                                                setPaymentMethod('credits');
                                            }}
                                        >
                                            Desbloquear
                                        </Button>
                                    )}
                                </Box>
                            </Stack>

                            {/* Tags */}
                            {item.tags.length > 0 && (
                                <Group
                                    gap={4}
                                    mt="xs"
                                    justify="center"
                                    style={{ zIndex: 2, position: 'relative' }}
                                >
                                    {item.tags.map((tag) => (
                                        <Badge key={tag} size="xs" variant="outline" color="gray">
                                            {tag}
                                        </Badge>
                                    ))}
                                </Group>
                            )}
                        </Card>
                    );
                })}
            </SimpleGrid>

            {/* Purchase confirmation modal */}
            <Modal
                opened={confirmItem !== null}
                onClose={() => {
                    if (purchasing) return;
                    setConfirmItem(null);
                }}
                centered
                radius="md"
                title="Confirmar compra de cosmético"
                size="sm"
            >
                {confirmItem && (
                    <Stack gap="md">
                        <Group gap="md" wrap="nowrap">
                            <Box
                                style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: isDark
                                        ? 'rgba(30, 41, 59, 0.6)'
                                        : 'rgba(241, 245, 249, 0.9)',
                                    fontSize: 32,
                                }}
                            >
                                {confirmItem.emoji}
                            </Box>
                            <div>
                                <Text fw={700}>{confirmItem.label}</Text>
                                <Text size="sm" c="dimmed">
                                    {confirmItem.description}
                                </Text>
                            </div>
                        </Group>

                        {/* Payment method choice */}
                        <div>
                            <Text size="sm" fw={600} mb={6}>
                                Método de pagamento:
                            </Text>
                            <SegmentedControl
                                value={paymentMethod}
                                onChange={(val) => setPaymentMethod(val as CosmeticPaymentMethod)}
                                fullWidth
                                data={[
                                    {
                                        label: `Créditos (${confirmItem.price_credits})`,
                                        value: 'credits',
                                    },
                                    ...(confirmItem.price_cents != null
                                        ? [
                                            {
                                                label: formatCosmeticPrice(confirmItem.price_cents),
                                                value: 'money' as const,
                                            },
                                        ]
                                        : []),
                                ]}
                            />
                        </div>

                        {/* Balance warning */}
                        {paymentMethod === 'credits' && credits < confirmItem.price_credits && (
                            <Text size="sm" c="red" fw={600}>
                                ⚠ Créditos insuficientes (saldo: {credits}, necessário:{' '}
                                {confirmItem.price_credits})
                            </Text>
                        )}

                        {paymentMethod === 'credits' && credits >= confirmItem.price_credits && (
                            <Text size="sm" c="teal" fw={600}>
                                Saldo após compra: {credits - confirmItem.price_credits} créditos
                            </Text>
                        )}

                        <Group justify="flex-end" gap="xs">
                            <Button
                                variant="default"
                                onClick={() => setConfirmItem(null)}
                                disabled={purchasing}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="gradient"
                                gradient={{ from: 'violet', to: 'blue' }}
                                onClick={handlePurchase}
                                loading={purchasing}
                                disabled={
                                    paymentMethod === 'credits' && credits < confirmItem.price_credits
                                }
                            >
                                Confirmar compra
                            </Button>
                        </Group>
                    </Stack>
                )}
            </Modal>
        </Stack>
    );
}
