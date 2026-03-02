// Configuration for data source (Google Sheets)
// Choose either 'csv' for a public CSV URL or 'json' for an Apps Script endpoint returning JSON.
// If using the Apps Script endpoint, provide the API key (X-API-KEY header).

export const DATA_SOURCE = {
    // type: 'csv' | 'json'
    type: 'csv' as const,
    // Use the public spreadsheet URL directly (simplifies deployment so we don't need env vars)
    url: import.meta.env.VITE_SHEETS_URL || 'https://docs.google.com/spreadsheets/d/1Y5_TXSIi2RFyd_uUMXcWLQTQ52Oy8kCwYZrnlj6a5Xk/export?format=csv',
    // If using JSON endpoint, set the API key here (optional)
    apiKey: ''
};
