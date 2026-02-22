// src/types/property.ts
import type { ContactInfo } from './contact';

export interface Property {
    id: string;
    user_id: string;
    nome: string;
    contato?: string;
    contato_detalhes?: ContactInfo;
    cidade?: string;
    estado?: string;
    total_area?: number;
    area_allocations?: PropertyAreaAllocation[];
    proprietario_principal?: PropertyOwnerRef | null;
    documentos?: PropertyDocuments;
    fiscal?: PropertyFiscalData;
    created_at: string;
    updated_at: string;
}

export interface PropertyOwnerRef {
    client_id: string;
    nome: string;
    email?: string;
    phone?: string;
    address?: string;
}

export interface PropertyDocuments {
    car?: string;
    itr?: string;
    ccir?: string;
    rgi?: string;
}

export interface PropertyFiscalData {
    cnpj?: string;
    cnaes?: string[];
    cartao_cnpj?: PropertyCnpjCardData;
    nfe?: PropertyNfeData;
}

export interface PropertyCnpjCardData {
    razao_social?: string;
    nome_fantasia?: string;
    situacao_cadastral?: string;
    data_abertura?: string;
    natureza_juridica?: string;
    porte?: string;
    capital_social?: number;
}

export interface PropertyNfeData {
    inscricao_estadual?: string;
    inscricao_municipal?: string;
    regime_tributario?: string;
    aliquota_icms?: number;
    codigo_municipio?: string;
    serie?: string;
    ultima_nf_emitida?: string;
    token?: string;
}

export interface PropertyAreaAllocation {
    id: string;
    category_id: string;
    category_name: string;
    area_ha: number;
    created_at?: string;
}

export type PropertyPersonLinkRole =
    | 'owner'
    | 'employee'
    | 'manager'
    | 'consultant'
    | 'tenant';

export interface PersonRecord {
    id: string;
    user_id: string;
    nome: string;
    tipo: 'individual' | 'company';
    documento?: string;
    email?: string;
    telefone?: string;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface PropertyPersonLink {
    id: string;
    user_id: string;
    property_id: string;
    pessoa_id: string;
    vinculo: PropertyPersonLinkRole;
    is_primary: boolean;
    inicio_vinculo?: string;
    fim_vinculo?: string;
    observacoes?: string;
    created_at: string;
    updated_at: string;
}

export interface PropertyEquipment {
    id: string;
    user_id: string;
    property_id: string;
    nome: string;
    tipo?: string;
    marca?: string;
    modelo?: string;
    identificador?: string;
    valor?: number;
    data_aquisicao?: string;
    status?: 'active' | 'maintenance' | 'inactive';
    observacoes?: string;
    created_at: string;
    updated_at: string;
}

export interface Laboratory {
    id: string;
    user_id: string;
    nome: string;
    cnpj?: string;
    email?: string;
    telefone?: string;
    endereco?: string;
    ativo?: boolean;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface LaboratoryServiceRecord {
    id: string;
    user_id: string;
    laboratorio_id: string;
    nome: string;
    preco: number;
    descricao?: string;
    created_at: string;
    updated_at: string;
}

export interface TalhaoCulturePeriod {
    id: string;
    user_id: string;
    property_id: string;
    talhao_id: string;
    cultura: string;
    cultivar?: string;
    data_inicio: string;
    data_fim: string;
    observacoes?: string;
    created_at: string;
    updated_at: string;
}

export interface Talhao {
    id: string;
    property_id: string;
    nome: string;
    area_ha?: number;
    tipo_solo?: string; // Textura: Arenoso, Médio, Argiloso
    coordenadas_svg?: string; // Desenho manual no mapa GIS
    cor_identificacao?: string;
    historico_culturas?: {
        cultura: string;
        cultivar?: string;
        data_inicio: string;
        data_fim: string;
        safra?: string;
        fonte?: string;
    }[];
    created_at: string;
    updated_at: string;
}
