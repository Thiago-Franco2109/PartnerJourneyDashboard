import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from project root, then .env as fallback
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const LOGOS_CSV_URL =
    process.env.LOGOS_SHEET_CSV_URL ||
    "https://docs.google.com/spreadsheets/d/1Y5_TXSIi2RFyd_uUMXcWLQTQ52Oy8kCwYZrnlj6a5Xk/export?format=csv";

// ---------- Auth (using drive.readonly scope – does NOT require Sheets API enabled) ----------
const auth = new GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

// ---------- Fetch partner logos from the public spreadsheet ----------
async function fetchLogos() {
    console.log("  ↳ Buscando logos dos parceiros...");
    try {
        const response = await fetch(LOGOS_CSV_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const csvText = await response.text();
        const lines = csvText.split("\n").filter((l) => l.trim() !== "");

        const mapping = {};
        for (const line of lines) {
            const parts = line.split(",");
            if (parts.length >= 4) {
                const name = parts[1].trim();
                const url = parts[3].trim();
                if (name === "loja_nome" || name === "Estabelecimento") continue;
                mapping[name.toLowerCase()] = url;
            }
        }

        console.log(`  ↳ ${Object.keys(mapping).length} logos encontrados`);
        return mapping;
    } catch (err) {
        console.warn("  ⚠️ Não foi possível carregar logos:", err.message);
        return {};
    }
}

// ---------- Fetch Analytics from the new spreadsheet ----------
async function fetchAnalytics(token) {
    console.log("  ↳ Buscando dados de acessos (Analytics)...");
    try {
        const url = "https://docs.google.com/spreadsheets/d/1fSmujBzlFtu4ZTuTl5v2nUcFwL3uol3QFqRrzEUULEA/gviz/tq?tqx=out:csv&gid=1132787546";
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            redirect: "follow",
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const csvText = await response.text();
        const rows = parseCSV(csvText);

        const mapping = {};
        // Skip header row
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 3) {
                const lojaPadronizada = row[2].trim().toLowerCase();
                const acessos = parseInt(row[1], 10) || 0;
                if (lojaPadronizada) {
                    mapping[lojaPadronizada] = acessos;
                }
            }
        }

        console.log(`  ↳ ${Object.keys(mapping).length} registros de acessos encontrados`);
        return mapping;
    } catch (err) {
        console.warn("  ⚠️ Não foi possível carregar dados de acessos:", err.message);
        return {};
    }
}

// ---------- Parse CSV (handles quoted fields with commas) ----------
function parseCSV(csvText) {
    const rows = [];
    let currentRow = [];
    let currentCell = "";
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = "";
        } else if (char === "\n" && !inQuotes) {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = "";
        } else if (char !== "\r") {
            currentCell += char;
        }
    }

    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }

    return rows;
}

// ---------- Main sync ----------
async function syncSheets() {
    console.log("Iniciando sincronização de dados...");
    try {
        const spreadsheetId =
            process.env.GOOGLE_SHEET_ID || process.env.VITE_GOOGLE_SHEET_ID;

        if (!spreadsheetId) {
            throw new Error("ID da planilha não encontrado em .env.local");
        }

        // Authenticate with Service Account
        const client = await auth.getClient();
        const tokenResult = await client.getAccessToken();
        const token = tokenResult.token;

        // Fetch data via Google Visualization Query (gviz/tq) – works WITHOUT Sheets API enabled
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=NOVOS&range=A6:J100`;
        console.log("  ↳ Buscando dados da aba NOVOS via gviz...");

        const response = await fetch(gvizUrl, {
            headers: { Authorization: `Bearer ${token}` },
            redirect: "follow",
        });

        if (!response.ok) {
            throw new Error(
                `Falha ao buscar dados: ${response.status} ${response.statusText}`
            );
        }

        const csvText = await response.text();
        const rows = parseCSV(csvText);

        if (rows.length === 0) {
            console.log("Nenhum dado retornado da planilha.");
            return;
        }

        // Fetch logos
        const logoMapping = await fetchLogos();

        // Fetch analytics
        const analyticsMapping = await fetchAnalytics(token);

        // Map CSV rows to data objects
        // Columns: A:cidade, B:id, C:estabelecimento, D:status, E:lancamento, F:?(skip), G:week_1, H:week_2, I:week_3, J:week_4
        const mappedData = rows
            .map((row) => {
                const estabelecimento = row[2] || "";
                const logoUrl =
                    logoMapping[estabelecimento.toLowerCase()] || "";
                const acessos = analyticsMapping[estabelecimento.toLowerCase()] || 0;

                return {
                    cidade: row[0] || "",
                    id: row[1] || "",
                    estabelecimento,
                    status: row[3] || "ativo",
                    lancamento: row[4] || "",
                    week_1: parseInt(row[6]) || 0,
                    week_2: parseInt(row[7]) || 0,
                    week_3: parseInt(row[8]) || 0,
                    week_4: parseInt(row[9]) || 0,
                    acessos,
                    ...(logoUrl ? { logo_url: logoUrl } : {}),
                };
            })
            .filter((r) => r.estabelecimento);

        const outputPath = path.resolve(
            __dirname,
            "../../public/remoteData.json"
        );

        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(mappedData, null, 2));

        const withLogos = mappedData.filter((r) => r.logo_url).length;
        console.log(
            `✅ ${mappedData.length} parceiros salvos em public/remoteData.json (${withLogos} com logo)`
        );
    } catch (err) {
        console.error("❌ Falha ao sincronizar dados:", err);
        process.exit(1);
    }
}

syncSheets();
