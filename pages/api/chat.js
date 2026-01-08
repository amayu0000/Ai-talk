// pages/api/chat.js
import { exec } from 'child_process';
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

  try {
    const pythonScript = path.join(process.cwd(), 'natural_ai_chat_api.py');
    const child = exec(`python3 -u ${pythonScript} "${topic}" ${turns} ${conversationId || ''} ${isContinuation || false}`);

    let pythonProcess = child;

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          res.write(`data: ${line}\n\n`);
          if (res.flush) res.flush();
        }
      });
    });

    child.stderr.on('data', (data) => {
      console.error('Python error:', data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        res.write('data: [DONE]\n\n');
      } else {
        res.write(`data: {"error": "Process exited with code ${code}"}\n\n`);
      }
      res.end();
    });

    req.on('close', () => {
      if (pythonProcess && !pythonProcess.killed) {
        pythonProcess.kill('SIGTERM');
        setTimeout(() => {
          if (pythonProcess && !pythonProcess.killed) {
            pythonProcess.kill('SIGKILL');
          }
        }, 1000);
      }
      res.end();
    });

  } catch (error) {
    console.error('Error:', error);
    res.write(`data: {"error": "${error.message}"}\n\n`);
    res.end();
  }
}
