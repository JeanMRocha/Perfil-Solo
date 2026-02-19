import { NavLink, ScrollArea } from '@mantine/core';
import {
  IconFlask,
  IconGraph,
  IconHome,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';

interface SidebarNavProps {
  isActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
}

export default function SidebarNav({ isActive, onNavigate }: SidebarNavProps) {
  return (
    <ScrollArea h="100%">
      <NavLink
        label="Dashboard"
        leftSection={<IconHome size={18} />}
        active={isActive('/dashboard')}
        onClick={() => onNavigate('/dashboard')}
      />
      <NavLink
        label="Culturas"
        leftSection={<IconFlask size={18} />}
        active={isActive('/cadastros/culturas')}
        defaultOpened={isActive('/cadastros/culturas')}
      >
        <NavLink
          label="Busca"
          active={isActive('/cadastros/culturas/busca')}
          onClick={() => onNavigate('/cadastros/culturas/busca')}
        />
        <NavLink
          label="Cadastro"
          active={isActive('/cadastros/culturas/cadastro')}
          onClick={() => onNavigate('/cadastros/culturas/cadastro')}
        />
      </NavLink>
      <NavLink
        label="Laboratorios"
        leftSection={<IconFlask size={18} />}
        active={isActive('/cadastros/laboratorios')}
        defaultOpened={isActive('/cadastros/laboratorios')}
      >
        <NavLink
          label="Busca"
          active={isActive('/cadastros/laboratorios/busca')}
          onClick={() => onNavigate('/cadastros/laboratorios/busca')}
        />
        <NavLink
          label="Cadastro"
          active={isActive('/cadastros/laboratorios/cadastro')}
          onClick={() => onNavigate('/cadastros/laboratorios/cadastro')}
        />
      </NavLink>
      <NavLink
        label="Pessoas"
        leftSection={<IconUser size={18} />}
        active={isActive('/cadastros/pessoas')}
        defaultOpened={isActive('/cadastros/pessoas')}
      >
        <NavLink
          label="Busca"
          active={isActive('/cadastros/pessoas/busca')}
          onClick={() => onNavigate('/cadastros/pessoas/busca')}
        />
        <NavLink
          label="Cadastro"
          active={isActive('/cadastros/pessoas/cadastro')}
          onClick={() => onNavigate('/cadastros/pessoas/cadastro')}
        />
      </NavLink>
      <NavLink
        label="Produtos"
        leftSection={<IconGraph size={18} />}
        active={isActive('/cadastros/produtos')}
        defaultOpened={isActive('/cadastros/produtos')}
      >
        <NavLink
          label="Busca"
          active={isActive('/cadastros/produtos/busca')}
          onClick={() => onNavigate('/cadastros/produtos/busca')}
        />
        <NavLink
          label="Cadastro"
          active={isActive('/cadastros/produtos/cadastro')}
          onClick={() => onNavigate('/cadastros/produtos/cadastro')}
        />
      </NavLink>
      <NavLink
        label="Servicos"
        leftSection={<IconSettings size={18} />}
        active={isActive('/cadastros/servicos')}
        defaultOpened={isActive('/cadastros/servicos')}
      >
        <NavLink
          label="Busca"
          active={isActive('/cadastros/servicos/busca')}
          onClick={() => onNavigate('/cadastros/servicos/busca')}
        />
        <NavLink
          label="Cadastro"
          active={isActive('/cadastros/servicos/cadastro')}
          onClick={() => onNavigate('/cadastros/servicos/cadastro')}
        />
      </NavLink>
      <NavLink
        label="Analises de Solo"
        leftSection={<IconFlask size={18} />}
        active={isActive('/analise-solo')}
        onClick={() => onNavigate('/analise-solo')}
      />
      <NavLink
        label="Relatorios"
        leftSection={<IconGraph size={18} />}
        active={isActive('/relatorios')}
        onClick={() => onNavigate('/relatorios')}
      />
      <NavLink
        label="Clientes"
        leftSection={<IconUser size={18} />}
        active={isActive('/clientes')}
        onClick={() => onNavigate('/clientes')}
      />
    </ScrollArea>
  );
}
