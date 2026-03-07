import { type PerformanceRow } from '../components/PerformanceTable';

export interface SyncResult {
    data: PerformanceRow[];
    lastSyncTime: Date;
    sourceUpdatedAt?: Date; // Optional, if we can read it from the sheet
}

const CACHE_KEY = 'partner_journey_data_cache';

// Basic CSV Parsing (handles quotes and commas inside quotes)
function parseCSV(csvText: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"'; // Escaped quote
                i++;
            } else {
                inQuotes = !inQuotes; // Toggle quote state
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if (char === '\n' && !inQuotes) {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else if (char !== '\r') {
            currentCell += char;
        }
    }

    // push last row if not empty
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }

    return rows;
}

export async function fetchGoogleSheetsData(url: string, apiKey?: string): Promise<PerformanceRow[]> {
    const headers: HeadersInit = {};
    if (apiKey) {
        headers['X-API-KEY'] = apiKey;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }

    // Assuming it's a CSV for now as per the user's current setup.
    // If JSON is needed later, we can check response headers or config.
    const isJson = url.toLowerCase().includes('json') || response.headers.get('content-type')?.includes('json');

    if (isJson) {
        let data = await response.json();

        // Handle Google Sheets API v4 format (array of arrays with wrapper)
        if (data.values && Array.isArray(data.values)) {
            data = data.values.map((row: any[]) => ({
                cidade: row[0],
                id: row[1],
                estabelecimento: row[2],
                status: row[3],
                lancamento: row[4],
                week_1: row[6],
                week_2: row[7],
                week_3: row[8],
                week_4: row[9]
            }));
        }

        // At this point data should be a plain array of objects (e.g. from remoteData.json)
        return validateAndMapData(Array.isArray(data) ? data : [data]);
    }

    // Parse CSV
    // Note: CSV must be encoded in UTF-8 to preserve accents, which is standard for Google Sheets exports.
    const csvText = await response.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
        throw new Error("CSV does not contain enough data rows.");
    }

    const headers_row = rows[0].map(h => h.toLowerCase().trim());
    const mappedData: any[] = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 5) continue; // Skip empty/invalid rows at the end

        const obj: any = {};
        headers_row.forEach((header, index) => {
            if (index < row.length) {
                obj[header] = row[index];
            }
        });
        mappedData.push(obj);
    }

    return validateAndMapData(mappedData);
}

function validateAndMapData(rawData: any[]): PerformanceRow[] {
    return rawData.map(row => {
        // Validate required columns
        const cidade = row['cidade'] || row['Cidade'] || 'Desconhecida';
        const estabelecimento = row['estabelecimento'] || row['Estabelecimento'] || 'Desconhecido';
        const status = (row['status'] || row['Status'] || 'ativo').toLowerCase() as 'ativo' | 'suspenso';
        const lancamento = row['lancamento'] || row['Lancamento'] || row['Lançamento'] || '';
        const analista = row['analista'] || row['Analista'] || row['Gestor'] || 'Desconhecido';
        const logo_url = row['logo_url'] || row['Logo_URL'] || '';

        // Treat empty week values as 0
        const parseWeek = (val: any) => {
            const num = parseInt(val, 10);
            return isNaN(num) ? 0 : num;
        };

        const week_1 = parseWeek(row['week_1'] || row['Week_1']);
        const week_2 = parseWeek(row['week_2'] || row['Week_2']);
        const week_3 = parseWeek(row['week_3'] || row['Week_3']);
        const week_4 = parseWeek(row['week_4'] || row['Week_4']);

        return {
            cidade,
            estabelecimento,
            status,
            lancamento,
            desempenho: '', // This will be calculated later visually or derived, currently unused strictly in row
            week_1,
            week_2,
            week_3,
            week_4,
            analista,
            ...(logo_url ? { logo_url } : {})
        };
    }).filter(row => row.estabelecimento !== 'Desconhecido'); // Filter out invalid rows mapped poorly
}

export function saveToCache(result: SyncResult): void {
    try {
        const cacheData = {
            data: result.data,
            lastSyncTime: result.lastSyncTime.toISOString(),
            sourceUpdatedAt: result.sourceUpdatedAt ? result.sourceUpdatedAt.toISOString() : undefined
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
        console.warn("Failed to save data to local storage cache", error);
    }
}

export function loadFromCache(): SyncResult | null {
    try {
        const cachedString = localStorage.getItem(CACHE_KEY);
        if (!cachedString) return null;

        const cachedData = JSON.parse(cachedString);
        return {
            data: cachedData.data,
            lastSyncTime: new Date(cachedData.lastSyncTime),
            sourceUpdatedAt: cachedData.sourceUpdatedAt ? new Date(cachedData.sourceUpdatedAt) : undefined
        };
    } catch (error) {
        console.warn("Failed to load data from local storage cache", error);
        return null;
    }
}
