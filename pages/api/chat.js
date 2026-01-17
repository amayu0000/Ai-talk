import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic, turns = 10 } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  try {
    sendEvent('start', { topic, turns });

    const conversation = [];
    const aiOrder = ['GPT-4', 'Claude', 'Gemini'];

    // 会話ループ
    for (let i = 0; i < turns; i++) {
      const ai = aiOrder[i % 3];
      
      let message;
      if (ai === 'GPT-4') {
        message = await callGPT(topic, conversation);
      } else if (ai === 'Claude') {
        message = await callClaude(topic, conversation);
      } else {
        message = await callGemini(topic, conversation);
      }

      const msg = {
        ai,
        message,
        turn: i + 1,
        timestamp: new Date().toISOString()
      };

      conversation.push(msg);
      sendEvent('message', msg);

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    sendEvent('complete', { total_messages: conversation.length });
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Error:', error);
    sendEvent('error', { message: error.message });
    res.end();
  }
}

async function callGPT(topic, history) {
  const prompt = buildPrompt(topic, history);
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500
  });
  return response.choices[0].message.content;
}

async function callClaude(topic, history) {
  const prompt = buildPrompt(topic, history);
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content[0].text;
}

async function callGemini(topic, history) {
  const prompt = buildPrompt(topic, history);
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  const response = await model.generateContent(prompt);
  return response.response.text();
}

function buildPrompt(topic, history) {
  const recent = history.slice(-5).map(m => `${m.ai}: ${m.message}`).join('\n');
  
  if (history.length === 0) {
    return `お題: ${topic}\n\n友達3人で会話しています。このお題について自然に話し始めてください。1-3文で簡潔に。`;
  }
  
  return `お題: ${topic}\n\nこれまでの会話:\n${recent}\n\n前の人の発言を受けて、自然に会話を続けてください。1-3文で簡潔に。`;
}