import { Group, Text, Divider } from '@mantine/core';
import { useStore } from '@nanostores/react';
import { $tema } from '@global/themeStore';
import { getBrandPalette } from '../mantine/brand';

interface PageHeaderProps {
  title: string;
  color?: string;
}

export default function PageHeader({ title, color }: PageHeaderProps) {
  const tema = useStore($tema);
  const palette = getBrandPalette(tema);

  return (
    <>
      <Group justify="space-between" align="center" mb="md" mt="md">
        <Group>
          <Text fz="xl" fw={700} c={color ? `${color}.8` : palette.typography.title}>
            {title}
          </Text>
        </Group>
      </Group>
      <Divider my="sm" />
    </>
  );
}
