// pages/chat/[id].js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

export default function ChatPage() {
  const router = useRouter();
  const { id } = router.query;

  const [messages, setMessages] = useState([]);
  const [topic, setTopic] = useState('');
  const [inputText, setInputText] = useState('');
  const [turns, setTurns] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [abortController, setAbortController] = useState(null);
  const [isComposing, setIsComposing] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (id === 'new') {
      inputRef.current?.focus();
    } else {
      loadConversation(id);
    }
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async (convId) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      const data = await res.json();
      setTopic(data.topic);
      setMessages(data.messages);
      setConversationId(convId);
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const startChat = async (e) => {
    e.preventDefault();

    const currentTopic = topic || inputText;
    if (!currentTopic.trim() || isLoading) return;

    setIsLoading(true);

    const isContinuation = topic && conversationId;

    if (isContinuation) {
      const userMessage = {
        ai: 'You',
        message: inputText,
        timestamp: new Date().toISOString(),
        isUser: true
      };
      setMessages(prev => [...(prev || []), userMessage]);
    }

    const actualTopic = isContinuation ? `${topic}（追加質問: ${inputText}）` : currentTopic;

    if (!topic) {
      setTopic(currentTopic);
    }

    setInputText('');

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: actualTopic,
          turns: turns,
          conversationId: isContinuation ? conversationId : null,
          isContinuation: isContinuation
        }),
        signal: controller.signal
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              setIsLoading(false);
              inputRef.current?.focus();
              continue;
            }

            try {
              const event = JSON.parse(data);

              if (event.type === 'message') {
                setMessages(prev => [...(prev || []), event.data]);
              } else if (event.type === 'complete') {
                setConversationId(event.data.conversation_id);
                if (id === 'new') {
                  router.replace(`/chat/${event.data.conversation_id}`, undefined, { shallow: true });
                }
              }
            } catch (e) {
              // JSON parse error
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Chat stopped by user');
      } else {
        console.error('Error:', error);
      }
      setIsLoading(false);
    } finally {
      setAbortController(null);
    }
  };

  const stopChat = () => {
    if (abortController) {
      abortController.abort();
      setIsLoading(false);

      // 専用のstop APIも呼ぶ
      fetch('/api/stop', { method: 'POST' }).catch(console.error);

      const stopMessage = {
        ai: 'System',
        message: '⏹ 会話を停止しました',
        timestamp: new Date().toISOString(),
        isSystem: true
      };
      setMessages(prev => [...(prev || []), stopMessage]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => router.push('/')}
            className="mr-4 text-blue-500 text-lg"
          >
            ‹
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900 truncate">
              {topic || '新しい会話'}
            </h1>
            <p className="text-xs text-gray-500">GPT-4, Claude, Gemini</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {(!messages || messages.length === 0) && !topic && (
          <div className="text-center py-20">
            <p className="text-6xl mb-4">💬</p>
            <p className="text-gray-500 mb-2">AIたちと会話を始めよう</p>
            <p className="text-sm text-gray-400">お題を入力してください</p>
          </div>
        )}

        {messages && messages.map((msg, idx) => (
          <div key={idx} className="mb-4">
            {msg.isSystem ? (
              <div className="flex justify-center">
                <div className="bg-gray-200 rounded-full px-4 py-2">
                  <p className="text-gray-600 text-sm">{msg.message}</p>
                </div>
              </div>
            ) : msg.isUser ? (
              <div className="flex justify-end">
                <div className="bg-blue-500 rounded-2xl rounded-tr-none px-4 py-3 shadow-sm max-w-[80%]">
                  <p className="text-white whitespace-pre-wrap break-words">{msg.message}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${getAIColor(msg.ai)}`}>
                  {getAIInitial(msg.ai)}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">{msg.ai}</span>
                    <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                    <p className="text-gray-900 whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
              <div className="animate-pulse text-white">●●●</div>
            </div>
            <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-gray-200 px-4 py-3 safe-bottom">
        {!topic && (
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
            <span>往復数:</span>
            <select
              value={turns}
              onChange={(e) => setTurns(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1"
            >
              <option value={5}>5往復</option>
              <option value={10}>10往復</option>
              <option value={15}>15往復</option>
              <option value={20}>20往復</option>
            </select>
          </div>
        )}

        <form onSubmit={startChat} className="flex items-end gap-2">
          <div className="flex-1 bg-gray-100 rounded-full px-4 py-2">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={(e) => {
                setIsComposing(false);
                setInputText(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  if (isComposing) return;
                  e.preventDefault();
                  if (!isLoading) startChat(e);
                }
              }}
              placeholder={topic ? "続きを話す..." : "お題を入力..."}
              className="w-full bg-transparent outline-none resize-none text-gray-900 placeholder-gray-400"
              rows={1}
              disabled={isLoading}
            />
          </div>

          {isLoading ? (
            <button
              type="button"
              onClick={stopChat}
              className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white"
            >
              ■
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputText.trim() && !topic}
              className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ▲
            </button>
          )}
        </form>
      </div>

      <style jsx>{`
        .safe-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
        textarea {
          font-size: 16px;
        }
      `}</style>
    </div>
  );
}

function getAIColor(ai) {
  switch (ai) {
    case 'GPT-4': return 'bg-green-500';
    case 'Claude': return 'bg-purple-500';
    case 'Gemini': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
}

function getAIInitial(ai) {
  switch (ai) {
    case 'GPT-4': return 'G';
    case 'Claude': return 'C';
    case 'Gemini': return 'M';
    default: return '?';
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit'
  });
}