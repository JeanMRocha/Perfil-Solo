// src/types/property.ts

export interface Property {
    id: string;
    user_id: string;
    nome: string;
    contato?: string;
    contato_detalhes?: {
        email?: string;
        phone?: string;
        address?: string;
    };
    cidade?: string;
    estado?: string;
    total_area?: number;
    proprietario_principal?: PropertyOwnerRef | null;
    documentos?: PropertyDocuments;
    fiscal?: PropertyFiscalData;
    maquinas?: PropertyMachine[];
    galpoes?: PropertyGalpao[];
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

export interface PropertyMachine {
    id: string;
    nome: string;
    tipo?: string;
    valor?: number;
}

export interface PropertyGalpao {
    id: string;
    nome: string;
    area_construida_m2?: number;
    valor?: number;
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
    }[];
    created_at: string;
    updated_at: string;
}
