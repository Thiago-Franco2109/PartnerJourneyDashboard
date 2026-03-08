import { GoogleAuth } from "google-auth-library";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const auth = new GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

async function testFetch() {
    try {
        const client = await auth.getClient();
        const tokenResult = await client.getAccessToken();
        const token = tokenResult.token;

        const url = "https://docs.google.com/spreadsheets/d/1fSmujBzlFtu4ZTuTl5v2nUcFwL3uol3QFqRrzEUULEA/gviz/tq?tqx=out:csv&gid=1132787546";

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            redirect: "follow"
        });

        const text = await response.text();
        console.log(text.split('\n').slice(0, 15).join('\n'));
    } catch (e) {
        console.error(e);
    }
}

testFetch();
