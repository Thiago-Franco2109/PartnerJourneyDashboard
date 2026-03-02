import { getStarColor, type EnrichedPerformanceRow } from '../utils/calculations';

export type PerformanceRow = {
    cidade: string;
    estabelecimento: string;
    status: string;
    lancamento: string;
    desempenho: string;
    week_1: number;
    week_2: number;
    week_3: number;
    week_4: number;
    logo_url?: string;
};

export type SortConfig = {
    key: string;
    direction: 'asc' | 'desc';
} | null;

interface PerformanceTableProps {
    data: EnrichedPerformanceRow[];
    sortConfig: SortConfig;
    requestSort: (key: string) => void;
    onRowClick: (row: EnrichedPerformanceRow) => void;
}

export default function PerformanceTable({ data, sortConfig, requestSort, onRowClick }: PerformanceTableProps) {
    // Generate stars visual
    const renderStars = (stars: number) => {
        return (
            <div className={`flex items-center justify-center ${getStarColor(stars)}`}>
                <span className="material-symbols-outlined text-[16px]">star</span>
                <span className="font-bold ml-1">{stars}</span>
            </div>
        );
    };
    const renderSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return (
            <span className="material-symbols-outlined text-[16px] ml-1 align-bottom text-primary">
                {sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
            </span>
        );
    };
    return (
        <div className="flex-1 overflow-x-auto p-6 flex flex-col">
            <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('cidade')}>
                                    Cidade {renderSortIcon('cidade')}
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('estabelecimento')}>
                                    Estabelecimento {renderSortIcon('estabelecimento')}
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('status')}>
                                    Status {renderSortIcon('status')}
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('dias_desde_lancamento')}>
                                    Dias Ativo {renderSortIcon('dias_desde_lancamento')}
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('total_pedidos')}>
                                    Pedidos {renderSortIcon('total_pedidos')}
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('indice_desempenho')}>
                                    Índice {renderSortIcon('indice_desempenho')}
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('city_weight')}>
                                    Peso (Cid.) {renderSortIcon('city_weight')}
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('priority_stars')}>
                                    Prioridade {renderSortIcon('priority_stars')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                            {data.map((row, index) => {
                                // Highlight top 10 critical/high risk partners (Index < 10 && stars >= 4 implies we need to be sorted descending by stars theoretically, but we'll apply it just to index 0-9 if they are >= 4 stars)
                                const isTopPriority = index < 10 && row.priority_stars >= 4;

                                return (
                                    <tr
                                        key={`${row.estabelecimento}-${row.cidade}`}
                                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group ${isTopPriority ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}
                                        onClick={() => onRowClick(row)}
                                    >
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-base font-semibold text-slate-700 dark:text-slate-300 sm:pl-6 group-hover:text-primary transition-colors relative">
                                            {isTopPriority && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>}
                                            {row.cidade}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-slate-900 dark:text-slate-200 group-hover:text-primary transition-colors">
                                            <div className="flex items-center gap-3">
                                                {row.logo_url ? (
                                                    <img src={row.logo_url} alt={row.estabelecimento} className="size-12 rounded-full border border-slate-100 dark:border-slate-700 shadow-sm object-cover" />
                                                ) : (
                                                    <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                                        <span className="material-symbols-outlined text-[24px]">store</span>
                                                    </div>
                                                )}
                                                {row.estabelecimento}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${row.status === 'ativo'
                                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 ring-green-600/20'
                                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-red-600/20'
                                                }`}>
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-slate-500 dark:text-slate-400">{row.dias_desde_lancamento}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-center">
                                            <span className="font-bold text-lg text-slate-900 dark:text-white">{row.total_pedidos}</span>
                                            <span className="text-slate-400 mx-1 text-sm">/</span>
                                            <span className="text-slate-500 text-sm">{row.pedidos_esperados}</span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center font-medium text-slate-700 dark:text-slate-300">
                                            {row.indice_desempenho.toFixed(2)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-slate-500 dark:text-slate-400">{row.city_weight}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                                            {renderStars(row.priority_stars)}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
