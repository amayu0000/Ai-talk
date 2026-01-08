// pages/api/conversations/[id].js
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filepath = path.join(process.cwd(), 'chat', `chat_${id}.json`);
    const content = await fs.readFile(filepath, 'utf-8');
    const data = JSON.parse(content);
    
    res.json(data);
  } catch (error) {
    console.error('Error loading conversation:', error);
    res.status(404).json({ error: 'Conversation not found' });
  }
}
