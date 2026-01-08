// pages/api/conversations/index.js
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const chatDir = path.join(process.cwd(), 'chat');
    
    // chatフォルダが存在しない場合
    try {
      await fs.access(chatDir);
    } catch {
      return res.json([]);
    }

    const files = await fs.readdir(chatDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const conversations = await Promise.all(
      jsonFiles.map(async (file) => {
        const filepath = path.join(chatDir, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const data = JSON.parse(content);
        
        const lastMessage = data.messages && data.messages.length > 0
          ? data.messages[data.messages.length - 1].message
          : '';

        return {
          id: data.id,
          topic: data.topic,
          last_message: lastMessage.substring(0, 50) + (lastMessage.length > 50 ? '...' : ''),
          created_at: data.created_at,
          message_count: data.messages?.length || 0
        };
      })
    );

    // 新しい順にソート
    conversations.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );

    res.json(conversations);
  } catch (error) {
    console.error('Error loading conversations:', error);
    res.status(500).json({ error: error.message });
  }
}
