// src/types/property.ts

export interface Property {
    id: string;
    user_id: string;
    nome: string;
    contato?: string;
    cidade?: string;
    estado?: string;
    total_area?: number;
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
        safra: string;
    }[];
    created_at: string;
    updated_at: string;
}
