// src/types/marketplace.ts

export type PartnerType = 'lab' | 'consultant' | 'vendor';

export interface Partner {
    id: string;
    name: string;
    type: PartnerType;
    region: string; // Estado ou Cidade base
    rating: number;
    contact_info: {
        email?: string;
        phone?: string;
        website?: string;
    };
    services: string[]; // ex: ["Análise Completa", "Consultoria Café", "Venda de Calcário"]
    logo_url?: string;
    verified: boolean;
}

export interface RegionalBenchmark {
    region: string; // ex: "Sul de Minas"
    crop: string; // ex: "Café"
    avg_ph: number;
    avg_productivity: number; // sacas/ha
    top_performer_avg_ph: number; // pH médio dos top 10% produtores
    last_updated: string;
}
