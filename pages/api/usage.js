// pages/api/usage.js
import { google } from 'googleapis';

export default async function handler(req, res) {
    try {
        const usage = {
            byMonth: {},
            total: { openai: 0, anthropic: 0, gemini: 0, cost: 0 }
        };

        // OpenAI の取得
        const openaiCosts = await getOpenAICosts();

        // Anthropic の取得
        const anthropicCosts = await getAnthropicCosts();

        // Google Cloud (Gemini) の取得
        const geminiCosts = await getGeminiCosts();

        // データを集計
        const allMonths = new Set([
            ...Object.keys(openaiCosts),
            ...Object.keys(anthropicCosts),
            ...Object.keys(geminiCosts)
        ]);

        allMonths.forEach(month => {
            usage.byMonth[month] = {
                openai: openaiCosts[month] || 0,
                anthropic: anthropicCosts[month] || 0,
                gemini: geminiCosts[month] || 0,
                cost: (openaiCosts[month] || 0) + (anthropicCosts[month] || 0) + (geminiCosts[month] || 0)
            };

            usage.total.openai += openaiCosts[month] || 0;
            usage.total.anthropic += anthropicCosts[month] || 0;
            usage.total.gemini += geminiCosts[month] || 0;
            usage.total.cost += usage.byMonth[month].cost;
        });

        res.status(200).json(usage);
    } catch (error) {
        console.error('Usage API Error:', error);
        res.status(500).json({ error: error.message });
    }
}

// OpenAI Costs
async function getOpenAICosts() {
    const OPENAI_ADMIN_KEY = process.env.OPENAI_ADMIN_KEY;

    // 過去6ヶ月分のデータを取得
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startTime = Math.floor(sixMonthsAgo.getTime() / 1000);

    try {
        const response = await fetch(
            `https://api.openai.com/v1/organization/costs?start_time=${startTime}&limit=180`,
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_ADMIN_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            console.error('OpenAI API Error:', response.status);
            return {};
        }

        const data = await response.json();
        const costsByMonth = {};

        data.data.forEach(bucket => {
            const date = new Date(bucket.start_time * 1000);
            const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            bucket.results.forEach(result => {
                if (!costsByMonth[month]) {
                    costsByMonth[month] = 0;
                }
                costsByMonth[month] += result.amount.value;
            });
        });

        return costsByMonth;
    } catch (error) {
        console.error('OpenAI fetch error:', error);
        return {};
    }
}

// Anthropic Costs
async function getAnthropicCosts() {
    const ANTHROPIC_ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY;

    // 過去6ヶ月分
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startingAt = sixMonthsAgo.toISOString();

    try {
        const response = await fetch(
            `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${startingAt}&bucket_width=1d&limit=180`,
            {
                headers: {
                    'anthropic-version': '2023-06-01',
                    'x-api-key': ANTHROPIC_ADMIN_KEY,
                    'content-type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            console.error('Anthropic API Error:', response.status);
            return {};
        }

        const data = await response.json();
        const costsByMonth = {};

        data.data.forEach(bucket => {
            const date = new Date(bucket.starting_at);
            const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            bucket.results.forEach(result => {
                if (!costsByMonth[month]) {
                    costsByMonth[month] = 0;
                }
                // amountは文字列でcents単位なのでdollarに変換
                costsByMonth[month] += parseFloat(result.amount) / 100;
            });
        });

        return costsByMonth;
    } catch (error) {
        console.error('Anthropic fetch error:', error);
        return {};
    }
}

// Google Cloud (Gemini) Costs
async function getGeminiCosts() {
    const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!GOOGLE_SERVICE_ACCOUNT) {
        console.error('Google Service Account JSON not found');
        return {};
    }

    try {
        const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT);

        const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-billing.readonly']
        });

        const authClient = await auth.getClient();
        const cloudbilling = google.cloudbilling({ version: 'v1', auth: authClient });

        // Billing Accountを取得
        const billingAccounts = await cloudbilling.billingAccounts.list();

        if (!billingAccounts.data.billingAccounts || billingAccounts.data.billingAccounts.length === 0) {
            console.error('No billing accounts found');
            return {};
        }

        const billingAccountName = billingAccounts.data.billingAccounts[0].name;

        // 過去6ヶ月の使用量を取得
        // 注: Cloud Billing APIは直接コストを返さないので、BigQueryエクスポートが推奨
        // ここでは簡易実装として空のオブジェクトを返す
        console.log('Gemini costs require BigQuery export setup');
        return {};

    } catch (error) {
        console.error('Google Cloud fetch error:', error);
        return {};
    }
}