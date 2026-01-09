// pages/index.js
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      setConversations(data);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">
            AI Chat
          </h1>
        </div>
      </header>

      {/* トーク一覧 */}
      <main className="max-w-4xl mx-auto">
        {/* 新規作成ボタン */}
        <Link href="/chat/new">
          <div className="bg-white border-b border-gray-200 p-4 hover:bg-gray-50 cursor-pointer transition">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl">
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900">新しい会話を始める</h2>
                <p className="text-sm text-gray-500">3つのAIと話してみよう</p>
              </div>
              <div className="text-gray-400">›</div>
            </div>
          </div>
        </Link>

        {/* 過去の会話リスト */}
        {conversations.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-6xl mb-4">💬</p>
            <p>まだ会話がありません</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <Link key={conv.id} href={`/chat/${conv.id}`}>
              <div className="bg-white border-b border-gray-200 p-4 hover:bg-gray-50 cursor-pointer transition">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-gray-900 truncate">
                      {conv.topic}
                    </h2>
                    <p className="text-sm text-gray-500 truncate">
                      {conv.last_message}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">
                      {formatDate(conv.created_at)}
                    </p>
                    <div className="text-gray-400 mt-1">›</div>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </main>

      <style jsx>{`
        /* iOS Safari対応 */
        @supports (-webkit-touch-callout: none) {
          .min-h-screen {
            min-height: -webkit-fill-available;
          }
        }
      `}</style>
    </div>
  );
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '今';
  if (minutes < 60) return `${minutes}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days < 7) return `${days}日前`;

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}
