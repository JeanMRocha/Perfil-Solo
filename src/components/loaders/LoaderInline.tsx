import { Group, Loader, Text, useMantineColorScheme } from '@mantine/core';

type Props = { message?: string };

export default function LoaderInline({ message = 'Carregando...' }: Props) {
  const { colorScheme } = useMantineColorScheme();

  return (
    <Group gap="xs" align="center" aria-busy="true">
      <Loader size="sm" />
      <Text size="sm" c={colorScheme === 'dark' ? 'gray.4' : 'dimmed'}>
        {message}
      </Text>
    </Group>
  );
}
