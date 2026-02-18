import {
  Center,
  Stack,
  Loader,
  Text,
  useMantineColorScheme,
  Card,
} from '@mantine/core';

type Props = { message?: string };

export default function LoaderGlobal({ message = 'Carregando...' }: Props) {
  const { colorScheme } = useMantineColorScheme();

  return (
    <Center
      h="100vh"
      w="100vw"
      style={{
        background: colorScheme === 'dark' ? '#1a1b1e' : '#f8f9fa',
      }}
    >
      <Card withBorder radius="md" p="lg" shadow="sm">
        <Stack align="center" gap="xs">
          <Loader size="lg" />
          <Text fw={600} c="dimmed">
            {message}
          </Text>
        </Stack>
      </Card>
    </Center>
  );
}
