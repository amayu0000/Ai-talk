// pages/api/stop.js
import { exec } from 'child_process';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // すべてのnatural_ai_chat_api.pyプロセスをkill
        exec('pkill -f natural_ai_chat_api.py', (error) => {
            if (error) {
                console.log('No processes to kill or error:', error.message);
            }
            res.json({ success: true });
        });
    } catch (error) {
        console.error('Stop error:', error);
        res.status(500).json({ error: error.message });
    }
}