import { Badge, Box, Group, Progress, Text } from '@mantine/core';

type Props = {
  planLabel: string;
  creditsLabel: string;
  creditsProgress: number;
  creditsNumber: number;
  isDark: boolean;
};

export default function HeaderCreditsSummary({
  planLabel,
  creditsLabel,
  creditsProgress,
  creditsNumber,
  isDark,
}: Props) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Badge variant="light" color="cyan" style={{ minWidth: 92, textAlign: 'center' }}>
        Plano {planLabel}
      </Badge>
      <Box style={{ width: 176, minWidth: 176 }}>
        <Group justify="space-between" mb={2}>
          <Text size="10px" c={isDark ? 'gray.4' : 'dimmed'}>
            Creditos
          </Text>
          <Text
            size="11px"
            fw={700}
            ff="monospace"
            c={isDark ? '#f3f4f6' : '#111827'}
            style={{ minWidth: 74, textAlign: 'right' }}
          >
            {creditsLabel}
          </Text>
        </Group>
        <Progress
          value={creditsProgress}
          size="sm"
          radius="xl"
          color={creditsNumber > 100 ? 'grape' : 'orange'}
        />
      </Box>
    </Group>
  );
}
