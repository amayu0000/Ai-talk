// pages/usage.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function UsagePage() {
    const router = useRouter();
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchUsage();
    }, []);

    const fetchUsage = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/usage');
            if (!res.ok) {
                throw new Error('Failed to fetch usage data');
            }
            const data = await res.json();
            setUsage(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">読み込み中...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
                    <h2 className="text-red-800 font-semibold mb-2">エラー</h2>
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={fetchUsage}
                        className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                    >
                        再試行
                    </button>
                </div>
            </div>
        );
    }

    if (!usage) return null;

    const sortedMonths = Object.keys(usage.byMonth).sort().reverse();

    return (
        <div className="min-h-screen bg-gray-100 pb-20">
            {/* ヘッダー */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="flex items-center px-4 py-3">
                    <button
                        onClick={() => router.push('/')}
                        className="mr-4 text-blue-500 text-lg"
                    >
                        ‹
                    </button>
                    <div className="flex-1">
                        <h1 className="font-semibold text-gray-900">API使用料</h1>
                        <p className="text-xs text-gray-500">過去6ヶ月の使用状況</p>
                    </div>
                    <button
                        onClick={fetchUsage}
                        className="text-blue-500 text-sm"
                    >
                        更新
                    </button>
                </div>
            </header>

            <div className="max-w-4xl mx-auto p-4">
                {/* 合計 */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg p-6 mb-6 text-white shadow-lg">
                    <h2 className="text-sm opacity-90 mb-2">累計使用料</h2>
                    <div className="text-4xl font-bold mb-4">
                        ${usage.total.cost.toFixed(2)}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <div className="opacity-75">OpenAI</div>
                            <div className="font-semibold">${usage.total.openai.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="opacity-75">Anthropic</div>
                            <div className="font-semibold">${usage.total.anthropic.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="opacity-75">Gemini</div>
                            <div className="font-semibold">${usage.total.gemini.toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                {/* 月別 */}
                <h2 className="text-lg font-semibold mb-3 text-gray-900">月別使用料</h2>

                {sortedMonths.length === 0 ? (
                    <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                        データがありません
                    </div>
                ) : (
                    sortedMonths.map(month => {
                        const data = usage.byMonth[month];
                        return (
                            <div key={month} className="bg-white rounded-lg p-4 mb-3 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-gray-900">{month}</h3>
                                    <div className="text-xl font-bold text-gray-900">
                                        ${data.cost.toFixed(2)}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {/* OpenAI */}
                                    {data.openai > 0 && (
                                        <div className="flex items-center">
                                            <div className="w-20 text-sm text-gray-600">OpenAI</div>
                                            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                                                <div
                                                    className="bg-green-500 h-2 rounded-full"
                                                    style={{ width: `${(data.openai / data.cost) * 100}%` }}
                                                />
                                            </div>
                                            <div className="w-20 text-right font-mono text-sm">
                                                ${data.openai.toFixed(2)}
                                            </div>
                                        </div>
                                    )}

                                    {/* Anthropic */}
                                    {data.anthropic > 0 && (
                                        <div className="flex items-center">
                                            <div className="w-20 text-sm text-gray-600">Anthropic</div>
                                            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                                                <div
                                                    className="bg-purple-500 h-2 rounded-full"
                                                    style={{ width: `${(data.anthropic / data.cost) * 100}%` }}
                                                />
                                            </div>
                                            <div className="w-20 text-right font-mono text-sm">
                                                ${data.anthropic.toFixed(2)}
                                            </div>
                                        </div>
                                    )}

                                    {/* Gemini */}
                                    {data.gemini > 0 && (
                                        <div className="flex items-center">
                                            <div className="w-20 text-sm text-gray-600">Gemini</div>
                                            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                                                <div
                                                    className="bg-blue-500 h-2 rounded-full"
                                                    style={{ width: `${(data.gemini / data.cost) * 100}%` }}
                                                />
                                            </div>
                                            <div className="w-20 text-right font-mono text-sm">
                                                ${data.gemini.toFixed(2)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}