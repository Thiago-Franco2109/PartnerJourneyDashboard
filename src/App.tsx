import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import Header from './components/Header';
import FilterToolbar from './components/FilterToolbar';
import PerformanceTable from './components/PerformanceTable';
import type { SortConfig } from './components/PerformanceTable';
import PartnerDetailsView from './components/PartnerDetailsView';
import SettingsView from './components/SettingsView';
import { DATA_SOURCE } from './config/dataSource';
import { enrichPartnerData, type EnrichedPerformanceRow, slugify } from './utils/calculations';
import { useManualOverrides } from './hooks/useManualOverrides';
import { useAnalyticsOverrides } from './hooks/useAnalyticsOverrides';
import { useDataSync } from './hooks/useDataSync';

function App() {
  const navigate = useNavigate();
  const [cityFilter, setCityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'indice_desempenho', direction: 'asc' });

  const sheetsDataUrl = import.meta.env.VITE_SHEETS_DATA_URL || DATA_SOURCE.url;
  const { data: syncData, isLoading: loadingSync, error: syncError, lastSyncTime, isUsingCache, refreshData } = useDataSync({
    url: sheetsDataUrl,
    apiKey: DATA_SOURCE.apiKey
  });

  // -- Manual overrides (persisted in localStorage) --------------------------
  const { overrides, saveOverride, clearOverride } = useManualOverrides();

  // -- Analytics overrides (store access CSV imports) -------------------------
  const { analytics, bulkSaveAnalytics, clearAnalytics } = useAnalyticsOverrides();

  // Enrich Data – apply manual overrides before enriching
  const enrichedData = useMemo(() =>
    syncData.map(row => {
      const override = overrides[row.estabelecimento];
      const merged = override ? { ...row, ...override } : row;
      return enrichPartnerData(merged);
    }),
    [syncData, overrides]
  );

  // Extract unique cities and managers
  const uniqueCities = useMemo(() => Array.from(new Set(enrichedData.map(row => row.cidade))).sort(), [enrichedData]);
  const uniqueManagers = useMemo(() => Array.from(new Set(enrichedData.map(row => row.analista || 'Desconhecido'))).filter(m => m !== 'Desconhecido').sort(), [enrichedData]);

  // Filter Data
  const filteredTableData = useMemo(() => {
    let data = enrichedData.filter((row: EnrichedPerformanceRow) => {
      let matches = true;
      if (cityFilter && row.cidade !== cityFilter) matches = false;
      if (searchQuery && !row.estabelecimento.toLowerCase().includes(searchQuery.toLowerCase())) matches = false;
      if (priorityFilter && row.priority_stars.toString() !== priorityFilter) matches = false;
      if (managerFilter && row.analista !== managerFilter) matches = false;
      return matches;
    });

    // Sort Data
    if (sortConfig !== null) {
      data.sort((a: EnrichedPerformanceRow, b: EnrichedPerformanceRow) => {
        const { key, direction } = sortConfig;
        let aVal: any = a[key as keyof EnrichedPerformanceRow];
        let bVal: any = b[key as keyof EnrichedPerformanceRow];

        // Handle specific types
        if (key === 'lancamento') {
          const [aD, aM, aY] = (aVal as string).split('/');
          const [bD, bM, bY] = (bVal as string).split('/');
          aVal = new Date(parseInt(aY), parseInt(aM) - 1, parseInt(aD)).getTime();
          bVal = new Date(parseInt(bY), parseInt(bM) - 1, parseInt(bD)).getTime();
        } else if (key === 'desempenho' && typeof aVal === 'string') {
          aVal = parseFloat((aVal as string).replace('%', ''));
          bVal = parseFloat((bVal as string).replace('%', ''));
        }

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [enrichedData, cityFilter, searchQuery, priorityFilter, managerFilter, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Summary Metrics Calculation
  const metrics = useMemo(() => {
    const totalPartners = filteredTableData.length;
    const criticalCount = filteredTableData.filter((p: EnrichedPerformanceRow) => p.priority_stars === 5).length;
    const highRiskCount = filteredTableData.filter((p: EnrichedPerformanceRow) => p.priority_stars === 4).length;
    const onTrackCount = filteredTableData.filter((p: EnrichedPerformanceRow) => p.priority_stars <= 2).length;
    const avgIndice = totalPartners > 0 ? (filteredTableData.reduce((acc: number, p: EnrichedPerformanceRow) => acc + p.indice_desempenho, 0) / totalPartners) : 0;

    const pctCritical = totalPartners > 0 ? Math.round((criticalCount / totalPartners) * 100) : 0;
    const pctHighRisk = totalPartners > 0 ? Math.round((highRiskCount / totalPartners) * 100) : 0;
    const pctOnTrack = totalPartners > 0 ? Math.round((onTrackCount / totalPartners) * 100) : 0;

    return [
      { label: 'Total Parceiros', value: totalPartners, icon: 'groups', color: 'text-blue-500', bg: 'bg-blue-50' },
      { label: '% Crítico (5★)', value: `${pctCritical}%`, icon: 'error', color: 'text-red-500', bg: 'bg-red-50' },
      { label: '% Alto Risco (4★)', value: `${pctHighRisk}%`, icon: 'warning', color: 'text-orange-500', bg: 'bg-orange-50' },
      { label: '% Na Meta (1-2★)', value: `${pctOnTrack}%`, icon: 'check_circle', color: 'text-green-500', bg: 'bg-green-50' },
      { label: 'Índice Médio', value: avgIndice.toFixed(2), icon: 'analytics', color: 'text-indigo-500', bg: 'bg-indigo-50' },
    ];
  }, [filteredTableData]);

  const handleRowClick = (row: EnrichedPerformanceRow) => {
    navigate(`/estabelecimento/${slugify(row.estabelecimento)}`);
  };

  // Component for Partner Details that uses URL params
  const PartnerDetailsWrapper = () => {
    const { slug } = useParams<{ slug: string }>();
    const partner = useMemo(() =>
      enrichedData.find(p => slugify(p.estabelecimento) === slug),
      [slug, enrichedData]
    );

    if (!partner) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-12">
          <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">search_off</span>
          <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">Parceiro não encontrado</h2>
          <button onClick={() => navigate('/')} className="mt-4 text-primary font-medium hover:underline">Voltar para o Dashboard</button>
        </div>
      );
    }

    return (
      <PartnerDetailsView
        partner={partner}
        onBack={() => navigate('/')}
        onSaveOrders={(name, vals) => saveOverride(name, vals)}
        onClearOrders={(name) => clearOverride(name)}
        override={overrides[partner.estabelecimento]}
        storeAnalytics={analytics[partner.estabelecimento]}
        onSaveAnalytics={bulkSaveAnalytics}
        onClearAnalytics={clearAnalytics}
      />
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden relative bg-white dark:bg-slate-900">
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      <main className="flex flex-1 flex-col xl:flex-row h-full">
        <Routes>
          <Route path="/configuracoes" element={<SettingsView />} />
          <Route path="/estabelecimento/:slug" element={<PartnerDetailsWrapper />} />
          <Route path="/" element={
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 xl:border-r border-slate-200 dark:border-slate-700">
              <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <h1 className="text-slate-900 dark:text-white text-3xl font-bold leading-tight tracking-tight mb-2">Jornada do Parceiro – Monitoramento de 28 Dias</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base font-normal">Acompanhe as métricas de desempenho e o status de saúde dos parceiros nos primeiros 28 dias críticos de ativação.</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <button
                      onClick={() => refreshData()}
                      disabled={loadingSync}
                      className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium px-4 py-2 rounded-lg transition-colors focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className={`material-symbols-outlined text-lg ${loadingSync ? 'animate-spin text-primary' : ''}`}>sync</span>
                      {loadingSync ? 'Atualizando...' : 'Atualizar agora'}
                    </button>

                    {lastSyncTime && (
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center justify-end gap-1">
                        Última atualização: {format(lastSyncTime, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    )}
                  </div>
                </div>

                {isUsingCache && (
                  <div className="mt-4 flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-amber-800 dark:text-amber-400">
                    <span className="material-symbols-outlined shrink-0">cloud_off</span>
                    <div>
                      <p className="text-sm font-semibold">Usando dados em cache</p>
                      <p className="text-sm opacity-90">Não foi possível conectar à base de dados no momento. Mostrando as últimas informações salvas localmente.</p>
                    </div>
                  </div>
                )}

                {syncError && !isUsingCache && (
                  <div className="mt-4 flex items-start gap-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-red-800 dark:text-red-400">
                    <span className="material-symbols-outlined shrink-0">error</span>
                    <div>
                      <p className="text-sm font-semibold">Erro ao atualizar dados</p>
                      <p className="text-sm opacity-90">{syncError}</p>
                    </div>
                  </div>
                )}
              </div>

              <FilterToolbar
                cityFilter={cityFilter}
                setCityFilter={setCityFilter}
                cities={uniqueCities}
                priorityFilter={priorityFilter}
                setPriorityFilter={setPriorityFilter}
                managerFilter={managerFilter}
                setManagerFilter={setManagerFilter}
                managers={uniqueManagers}
              />

              {loadingSync ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 min-h-[400px]">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                  <p className="text-slate-500 font-medium">Sincronizando dados...</p>
                </div>
              ) : (
                <div className="flex flex-col flex-1 divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="p-6 grid grid-cols-2 lg:grid-cols-5 gap-4 bg-slate-50/30 dark:bg-slate-900/50">
                    {metrics.map((card, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{card.label}</span>
                          <span className={`material-symbols-outlined text-[20px] ${card.color}`}>{card.icon}</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</span>
                      </div>
                    ))}
                  </div>

                  <PerformanceTable
                    data={filteredTableData}
                    sortConfig={sortConfig}
                    requestSort={requestSort}
                    onRowClick={handleRowClick}
                  />
                </div>
              )}
            </div>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;
