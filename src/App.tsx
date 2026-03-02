import { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import FilterToolbar from './components/FilterToolbar';
import PerformanceTable from './components/PerformanceTable';
import type { SortConfig } from './components/PerformanceTable';
import PartnerDetailsView from './components/PartnerDetailsView';
import SettingsView from './components/SettingsView';
import { tableData } from './data/tableData';
import { fetchPartners } from './data/mockData';
import { enrichPartnerData, type EnrichedPerformanceRow } from './utils/calculations';
import { useManualOverrides } from './hooks/useManualOverrides';
import { useAnalyticsOverrides } from './hooks/useAnalyticsOverrides';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'priority_stars', direction: 'desc' });
  const [selectedRow, setSelectedRow] = useState<EnrichedPerformanceRow | null>(null);
  const [logoMapping, setLogoMapping] = useState<Record<string, string>>({});

  // -- Manual overrides (persisted in localStorage) --------------------------
  const { overrides, saveOverride, clearOverride } = useManualOverrides();

  // -- Analytics overrides (store access CSV imports) -------------------------
  const { analytics, bulkSaveAnalytics, clearAnalytics } = useAnalyticsOverrides();

  // Enrich Data – apply manual overrides before enriching
  const enrichedData = useMemo(() =>
    tableData.map(row => {
      const override = overrides[row.estabelecimento];
      const merged = override ? { ...row, ...override } : row;
      const logoUrl = logoMapping[row.estabelecimento];
      return enrichPartnerData(merged, logoUrl);
    }),
    [overrides, logoMapping]  // recompute whenever overrides or logos change
  );

  // Extract unique cities
  const uniqueCities = Array.from(new Set(enrichedData.map(row => row.cidade))).sort();

  // Filter Data
  let filteredTableData = enrichedData.filter((row: EnrichedPerformanceRow) => {
    let matches = true;
    if (dateFilter && row.lancamento !== dateFilter) matches = false;
    if (cityFilter && row.cidade !== cityFilter) matches = false;
    return matches;
  });

  // Sort Data
  if (sortConfig !== null) {
    filteredTableData.sort((a: EnrichedPerformanceRow, b: EnrichedPerformanceRow) => {
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

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    async function loadData() {
      try {
        await fetchPartners(); // simulate load

        // Fetch logos from Google Sheets (using hardcoded fallback to simplify live deploy)
        const sheetsUrl = import.meta.env.VITE_SHEETS_URL || 'https://docs.google.com/spreadsheets/d/1Y5_TXSIi2RFyd_uUMXcWLQTQ52Oy8kCwYZrnlj6a5Xk/export?format=csv';
        if (sheetsUrl) {
          const response = await fetch(sheetsUrl);
          const csvText = await response.text();

          // Simple CSV parsing (assuming headers: loja_id,loja_nome,logo_arquivo,logo_url,cms_arte_url)
          const lines = csvText.split('\n').filter(line => line.trim() !== '');
          const mapping: Record<string, string> = {};

          // Process lines
          for (let i = 0; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length >= 4) {
              const name = parts[1].trim();
              const url = parts[3].trim();
              if (name === 'loja_nome' || name === 'Estabelecimento') continue; // skip header if present
              mapping[name] = url;
            }
          }
          setLogoMapping(mapping);
        }
      } catch (error) {
        console.error("Failed to load data", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Summary Metrics Calculation
  const totalPartners = filteredTableData.length;
  const criticalCount = filteredTableData.filter((p: EnrichedPerformanceRow) => p.priority_stars === 5).length;
  const highRiskCount = filteredTableData.filter((p: EnrichedPerformanceRow) => p.priority_stars === 4).length;
  const onTrackCount = filteredTableData.filter((p: EnrichedPerformanceRow) => p.priority_stars <= 2).length;
  const avgIndice = totalPartners > 0 ? (filteredTableData.reduce((acc: number, p: EnrichedPerformanceRow) => acc + p.indice_desempenho, 0) / totalPartners) : 0;

  const pctCritical = totalPartners > 0 ? Math.round((criticalCount / totalPartners) * 100) : 0;
  const pctHighRisk = totalPartners > 0 ? Math.round((highRiskCount / totalPartners) * 100) : 0;
  const pctOnTrack = totalPartners > 0 ? Math.round((onTrackCount / totalPartners) * 100) : 0;

  const summaryCards = [
    { label: 'Total Parceiros', value: totalPartners, icon: 'groups', color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: '% Crítico (5★)', value: `${pctCritical}%`, icon: 'error', color: 'text-red-500', bg: 'bg-red-50' },
    { label: '% Alto Risco (4★)', value: `${pctHighRisk}%`, icon: 'warning', color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: '% Na Meta (1-2★)', value: `${pctOnTrack}%`, icon: 'check_circle', color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Índice Médio', value: avgIndice.toFixed(2), icon: 'analytics', color: 'text-indigo-500', bg: 'bg-indigo-50' },
  ];

  // Keep selectedRow in sync: recalculate whenever overrides change.
  const currentSelectedRow = selectedRow
    ? (enrichedData.find(r => r.estabelecimento === selectedRow.estabelecimento) ?? selectedRow)
    : null;

  // Always pass the latest enriched version on click.
  const handleRowClick = (row: EnrichedPerformanceRow) => {
    const latest = enrichedData.find(r => r.estabelecimento === row.estabelecimento) ?? row;
    setSelectedRow(latest);
  };

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden relative bg-white dark:bg-slate-900">
      <Header currentView={currentView} onNavigate={setCurrentView} />
      <main className="flex flex-1 flex-col xl:flex-row h-full">
        {currentView === 'settings' ? (
          <SettingsView />
        ) : (
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 xl:border-r border-slate-200 dark:border-slate-700">
            {currentSelectedRow ? (
              <PartnerDetailsView
                partner={currentSelectedRow}
                onBack={() => setSelectedRow(null)}
                onSaveOrders={(name, vals) => saveOverride(name, vals)}
                onClearOrders={(name) => clearOverride(name)}
                override={overrides[currentSelectedRow.estabelecimento]}
                storeAnalytics={analytics[currentSelectedRow.estabelecimento]}
                onSaveAnalytics={bulkSaveAnalytics}
                onClearAnalytics={clearAnalytics}
              />
            ) : (
              <>
                <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800">
                  <h1 className="text-slate-900 dark:text-white text-3xl font-bold leading-tight tracking-tight mb-2">Jornada do Parceiro – Monitoramento de 28 Dias</h1>
                  <p className="text-slate-500 dark:text-slate-400 text-base font-normal">Acompanhe as métricas de desempenho e o status de saúde dos parceiros nos primeiros 28 dias críticos de ativação.</p>
                </div>

                <FilterToolbar
                  dateFilter={dateFilter}
                  setDateFilter={setDateFilter}
                  cityFilter={cityFilter}
                  setCityFilter={setCityFilter}
                  cities={uniqueCities}
                />

                {loading ? (
                  <div className="flex-1 flex items-center justify-center p-6">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Summary Cards */}
                    <div className="p-6 grid grid-cols-2 lg:grid-cols-5 gap-4 bg-slate-50/30 dark:bg-slate-900/50">
                      {summaryCards.map((card, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{card.label}</span>
                            <span className={`material-symbols-outlined text-[20px] ${card.color}`}>{card.icon}</span>
                          </div>
                          <span className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Table */}
                    <PerformanceTable
                      data={filteredTableData}
                      sortConfig={sortConfig}
                      requestSort={requestSort}
                      onRowClick={handleRowClick}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
