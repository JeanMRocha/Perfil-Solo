import { Group, Button, Text, Divider } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  color?: string;
}

export default function PageHeader({ title, color = 'green' }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <>
      <Group justify="space-between" align="center" mb="md" mt="md">
        <Group>
          <Button
            variant="light"
            color={color}
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/dashboard')}
          >
            Voltar
          </Button>
          <Text fz="xl" fw={700} c={`${color}.8`}>
            {title}
          </Text>
        </Group>
      </Group>
      <Divider my="sm" />
    </>
  );
}
