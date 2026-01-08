// pages/api/chat.js
import { spawn } from 'child_process';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic, turns = 10, conversationId, isContinuation } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(': connected\n\n');
  res.flush();

  let pythonProcess = null;

  try {
    const pythonScript = path.join(process.cwd(), 'natural_ai_chat_api.py');

    // spawnを使用（execよりプロセス制御が確実）
    pythonProcess = spawn('python3', [
      '-u',
      pythonScript,
      topic,
      turns.toString(),
      conversationId || '',
      isContinuation ? 'true' : 'false'
    ]);

    pythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          res.write(`data: ${line}\n\n`);
          if (res.flush) res.flush();
        }
      });
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error('Python error:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      if (code === 0) {
        res.write('data: [DONE]\n\n');
      } else {
        res.write(`data: {"error": "Process exited with code ${code}"}\n\n`);
      }
      if (!res.writableEnded) {
        res.end();
      }
    });

    // クライアント切断時にプロセスをkill
    req.on('close', () => {
      console.log('Client disconnected, killing Python process...');
      if (pythonProcess && !pythonProcess.killed) {
        pythonProcess.kill('SIGTERM');

        // 1秒待ってもまだ生きてたら強制終了
        setTimeout(() => {
          if (pythonProcess && !pythonProcess.killed) {
            console.log('Force killing Python process...');
            pythonProcess.kill('SIGKILL');
          }
        }, 1000);
      }

      if (!res.writableEnded) {
        res.end();
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.write(`data: {"error": "${error.message}"}\n\n`);
    if (!res.writableEnded) {
      res.end();
    }
  }
}