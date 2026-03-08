import type { PerformanceRow } from '../components/PerformanceTable';

export type CalculatedMetrics = {
    dias_desde_lancamento: number;
    total_pedidos: number;
    pedidos_esperados: number;
    indice_desempenho: number;
    city_weight: number;
    priority_stars: number;
    logo_url?: string;
};

export type EnrichedPerformanceRow = PerformanceRow & CalculatedMetrics;

// 1) Total_Pedidos
export const calculateTotalPedidos = (partner: PerformanceRow): number => {
    return (partner.week_1 || 0) + (partner.week_2 || 0) + (partner.week_3 || 0) + (partner.week_4 || 0);
};

// 2) Dias_Desde_Lancamento (Assuming 'today' is the current date when this runs, 
// for testing consistency we can use a fixed 'today' or `new Date()`. Given the mock data is around Feb 2026, 
// let's use the actual current date or for now, calculate relative to real `new Date()`.
// Warning: If the mock data is in the future relative to today, this will be negative.
// To ensure it works with the mock data, let's assume 'today' is 28/03/2026 to see 30 days of data, 
// OR just use `new Date()`. I will use new Date() and we will see.
export const calculateDiasDesdeLancamento = (lancamentoStr: string): number => {
    const [d, m, y] = lancamentoStr.split('/');
    const lancamentoDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const today = new Date();

    // Calculate difference in time
    const timeDiff = today.getTime() - lancamentoDate.getTime();

    // Calculate difference in days
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

    // If it's a future date, return 0 for now
    return Math.max(0, daysDiff);
};

// 3) Meta proporcional ao tempo
export const calculatePedidosEsperados = (dias: number): number => {
    if (dias === 0) return 0;
    // Freeze expected orders at max 30 if > 28 days
    const cappedDays = Math.min(dias, 28);
    return Math.round((cappedDays / 28) * 30); // Round to integer
};

// 4) Índice de desempenho
export const calculateIndiceDesempenho = (totalPedidos: number, pedidosEsperados: number): number => {
    if (pedidosEsperados === 0) return totalPedidos > 0 ? 1 : 0;
    return totalPedidos / pedidosEsperados;
};

// City Priority Weight
export const getCityWeight = (city: string): number => {
    const weights: Record<number, string[]> = {
        5: ['Natividade', 'Ubá'],
        4: ['Cláudio', 'Bom Jesus do Itabapoana', 'Bom Jesus do Norte', 'Barroso'],
        3: ['Silva Jardim', 'Paraopeba', 'Caetanópolis', 'Carandaí', 'Espera Feliz', 'Guaçuí', 'Cordeiro', 'Cantagalo'],
        2: ['Bicas', 'Ervália'],
        1: ['Santos Dumont', 'Além Paraíba', 'Muriaé']
    };

    for (let weight = 5; weight >= 1; weight--) {
        if (weights[weight].includes(city)) return weight;
    }
    return 1; // Default
};

// Priority Score Calculation
export const calculatePriorityStars = (
    partner: PerformanceRow,
    dias: number,
    totalPedidos: number,
    indiceDesempenho: number,
    cityWeight: number
): number => {
    // Edge Cases
    if (partner.status === 'suspenso') return 5;
    if (totalPedidos === 0 && dias > 7) return 5;
    if (dias < 3) return 1; // Grace period: do not classify as critical yet

    // Base score by performance index
    let baseScore = 1;
    if (indiceDesempenho < 0.2) baseScore = 5;
    else if (indiceDesempenho < 0.4) baseScore = 4;
    else if (indiceDesempenho < 0.7) baseScore = 3;
    else if (indiceDesempenho < 1.0) baseScore = 2;

    // Final Score adjustment by city weight
    // Only apply strategic city weight urgency if the partner is NOT meeting the goal (baseScore > 1)
    let finalScore = baseScore;
    if (baseScore > 1) {
        finalScore = baseScore + (cityWeight - 1);
    }

    // Limit between 1 and 5
    return Math.max(1, Math.min(5, finalScore));
};

export const enrichPartnerData = (partner: PerformanceRow, logoUrl?: string): EnrichedPerformanceRow => {
    const total_pedidos = calculateTotalPedidos(partner);
    const dias_desde_lancamento = calculateDiasDesdeLancamento(partner.lancamento);
    const pedidos_esperados = calculatePedidosEsperados(dias_desde_lancamento);
    const indice_desempenho = calculateIndiceDesempenho(total_pedidos, pedidos_esperados);
    const city_weight = getCityWeight(partner.cidade);
    const priority_stars = calculatePriorityStars(partner, dias_desde_lancamento, total_pedidos, indice_desempenho, city_weight);

    return {
        ...partner,
        total_pedidos,
        dias_desde_lancamento,
        pedidos_esperados,
        indice_desempenho,
        city_weight,
        priority_stars,
        logo_url: logoUrl || partner.logo_url
    };
};

// UI Helpers
export const getStarColor = (stars: number): string => {
    switch (stars) {
        case 5: return 'text-red-500';
        case 4: return 'text-orange-500';
        case 3: return 'text-yellow-500';
        case 2: return 'text-yellow-200';
        case 1: return 'text-green-500';
        default: return 'text-slate-300';
    }
};

export const getInterpretationBox = (stars: number): { text: string; bg: string; border: string; icon: string; textClass: string } => {
    switch (stars) {
        case 5: return {
            text: 'This partner is significantly below the expected onboarding performance and requires immediate intervention.',
            bg: 'bg-red-50 dark:bg-red-900/10',
            border: 'border-red-200 dark:border-red-800/30',
            icon: 'error',
            textClass: 'text-red-800 dark:text-red-400'
        };
        case 4: return {
            text: 'High risk of underperformance. Action recommended.',
            bg: 'bg-orange-50 dark:bg-orange-900/10',
            border: 'border-orange-200 dark:border-orange-800/30',
            icon: 'warning',
            textClass: 'text-orange-800 dark:text-orange-400'
        };
        case 3: return {
            text: 'Moderate performance gap. Monitor closely.',
            bg: 'bg-yellow-50 dark:bg-yellow-900/10',
            border: 'border-yellow-200 dark:border-yellow-800/30',
            icon: 'visibility',
            textClass: 'text-yellow-800 dark:text-yellow-400'
        };
        default: return {
            text: 'Partner is on track.',
            bg: 'bg-green-50 dark:bg-green-900/10',
            border: 'border-green-200 dark:border-green-800/30',
            icon: 'check_circle',
            textClass: 'text-green-800 dark:text-green-400'
        };
    }
};
export const slugify = (text: string): string => {
    return text
        .toString()
        .normalize('NFD') // split accented characters into their base characters and diacritical marks
        .replace(/[\u0300-\u036f]/g, '') // remove diacritical marks
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-') // replace spaces with -
        .replace(/[^\w-]+/g, '') // remove all non-word chars
        .replace(/--+/g, '-'); // replace multiple - with single -
};
