'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import dataset from './data.json';

interface ChatData {
  context: string;
  answer: string;
  wait: {
    llm: string;
    vectorDb: string;
  };
}

interface Data {
  pinecone: ChatData;
  cortex: ChatData;
}

export default function ChatInterface() {
  const data = dataset as unknown as Data;

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);

  const [pineconeContextVisible, setPineconeContextVisible] = useState(false);
  const [pineconeAnswerVisible, setPineconeAnswerVisible] = useState(false);
  const [cortexContextVisible, setCortexContextVisible] = useState(false);
  const [cortexAnswerVisible, setCortexAnswerVisible] = useState(false);
  const [pineShowContext, setPineShowContext] = useState(false);
  const [cortexShowContext, setCortexShowContext] = useState(false);

  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearAllTimers = () => {
    timeoutsRef.current.forEach((id) => clearTimeout(id));
    timeoutsRef.current = [];
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  useEffect(() => {
    if (pineconeAnswerVisible && cortexAnswerVisible) {
      setIsLoading(false);
    }
  }, [pineconeAnswerVisible, cortexAnswerVisible]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setHasAsked(true);
    setIsLoading(true);
    setPineconeContextVisible(false);
    setPineconeAnswerVisible(false);
    setCortexContextVisible(false);
    setCortexAnswerVisible(false);
    clearAllTimers();

    const minWait = 1200;
    const pineVectorMs = Math.max(Number(data.pinecone.wait.vectorDb), minWait);
    const pineLlmMs = Math.max(Number(data.pinecone.wait.llm), minWait);
    const cortexVectorMs = Math.max(Number(data.cortex.wait.vectorDb), minWait);
    const cortexLlmMs = Math.max(Number(data.cortex.wait.llm), minWait);

    // Pinecone staged reveal
    timeoutsRef.current.push(
      setTimeout(() => setPineconeContextVisible(true), pineVectorMs)
    );
    timeoutsRef.current.push(
      setTimeout(() => setPineconeAnswerVisible(true), pineVectorMs + pineLlmMs)
    );

    // Cortex staged reveal
    timeoutsRef.current.push(
      setTimeout(() => setCortexContextVisible(true), cortexVectorMs)
    );
    timeoutsRef.current.push(
      setTimeout(() => setCortexAnswerVisible(true), cortexVectorMs + cortexLlmMs)
    );
  };

  const minWait = 1200;
  const pineVectorMs = Math.max(Number(data.pinecone.wait.vectorDb), minWait);
  const pineLlmMs = Math.max(Number(data.pinecone.wait.llm), minWait);
  const cortexVectorMs = Math.max(Number(data.cortex.wait.vectorDb), minWait);
  const cortexLlmMs = Math.max(Number(data.cortex.wait.llm), minWait);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 mb-3">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Dual AI Comparator
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
            Pinecone vs Cortex
          </h1>
          <p className="mt-2 text-gray-600">Ask once, compare side by side.</p>
        </div>

        {/* Input */}
        <div className="max-w-4xl mx-auto mb-10">
          <form onSubmit={handleSubmit} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur opacity-20 group-hover:opacity-40 transition"></div>
            <div className="relative rounded-2xl bg-white backdrop-blur border border-slate-200 shadow-xl">
              <div className="flex items-center gap-3 px-4 py-3">
                <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 21l-4.3-4.3"/><circle cx="10" cy="10" r="7"/></svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Describe your question about Nightingale performance..."
                  className="w-full bg-transparent outline-none text-lg placeholder:text-slate-400 text-slate-900"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="ml-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-medium shadow hover:bg-black disabled:bg-slate-400 disabled:cursor-not-allowed transition"
                >
                  {isLoading ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                      Processing
                    </>
                  ) : (
                    <>
                      Ask
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Top loading banner */}
        {isLoading && (
          <div className="max-w-4xl mx-auto mb-10">
            <div className="relative overflow-hidden rounded-2xl bg-white backdrop-blur border border-slate-200 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 animate-pulse" />
              <div className="relative flex items-center justify-center gap-3 p-5 text-slate-700">
                <div className="flex -space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce" />
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '240ms' }} />
                </div>
                Analyzing and generating responses…
              </div>
            </div>
          </div>
        )}

        {/* Panels */}
        {(hasAsked || !isLoading) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pinecone */}
            <div className="relative group">
              <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 opacity-25 blur group-hover:opacity-40 transition" />
              <div className="relative rounded-3xl bg-white backdrop-blur border border-emerald-200 shadow-xl overflow-hidden">
                <div className="flex items-center p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h2 className="text-lg font-semibold text-emerald-700">Pinecone</h2>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Context */}
                  {!pineconeContextVisible ? (
                    <div className="animate-pulse">
                      <div className="h-4 w-32 bg-emerald-100 rounded mb-3" />
                      <div className="h-24 bg-slate-100 rounded-xl" />
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl p-4 border border-emerald-200 bg-white">
                        <div className="text-xs font-medium text-emerald-700 mb-2">Answer</div>
                        <div className="text-slate-800">
                          <ReactMarkdown
                            components={{
                              h1: ({ children }) => <h1 className="text-xl font-bold mb-3 text-emerald-800">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 text-emerald-800">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-semibold mb-2 text-emerald-800">{children}</h3>,
                              p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                              ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold text-emerald-900">{children}</strong>,
                              em: ({ children }) => <em className="italic text-emerald-800">{children}</em>,
                              code: ({ children }) => <code className="bg-emerald-100 px-1.5 py-0.5 rounded text-sm font-mono text-emerald-900">{children}</code>,
                              pre: ({ children }) => <pre className="bg-slate-100 p-3 rounded-lg overflow-x-auto mb-3 text-sm">{children}</pre>,
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-emerald-300 pl-4 italic text-emerald-800 mb-3">{children}</blockquote>,
                            }}
                          >
                            {data.pinecone.answer}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <button
                        onClick={() => setPineShowContext((v) => !v)}
                        className="text-sm text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
                      >
                        {pineShowContext ? 'Hide context' : 'Show context'}
                        <svg className={`w-4 h-4 transition-transform ${pineShowContext ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </button>
                      {pineShowContext && (
                        <div className="rounded-xl p-4 border border-emerald-200 bg-emerald-50">
                          <div className="text-xs font-medium text-emerald-700 mb-1">Retrieved Context</div>
                          <div className="text-sm text-slate-700 whitespace-pre-wrap">{data.pinecone.context}</div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Answer loading state */}
                  {!pineconeAnswerVisible ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm text-emerald-700">Generating answer…</span>
                    </div>
                  ) : (
                    /* Latency Display */
                    <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <div className="text-xs font-medium text-emerald-700 mb-3">Performance Metrics</div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-white rounded-lg p-3 border border-emerald-100">
                          <div className="text-lg font-semibold text-emerald-700">{pineVectorMs}ms</div>
                          <div className="text-xs text-emerald-600">Vector DB</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-emerald-100">
                          <div className="text-lg font-semibold text-emerald-700">{pineLlmMs}ms</div>
                          <div className="text-xs text-emerald-600">LLM</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-emerald-100">
                          <div className="text-lg font-semibold text-emerald-700">{pineVectorMs + pineLlmMs}ms</div>
                          <div className="text-xs text-emerald-600">Total</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cortex */}
            <div className="relative group">
              <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-br from-purple-400 to-pink-500 opacity-25 blur group-hover:opacity-40 transition" />
              <div className="relative rounded-3xl bg-white backdrop-blur border border-purple-200 shadow-xl overflow-hidden">
                <div className="flex items-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <h2 className="text-lg font-semibold text-purple-700">Cortex</h2>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Context */}
                  {!cortexContextVisible ? (
                    <div className="animate-pulse">
                      <div className="h-4 w-32 bg-purple-100 rounded mb-3" />
                      <div className="h-24 bg-slate-100 rounded-xl" />
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl p-4 border border-purple-200 bg-white">
                        <div className="text-xs font-medium text-purple-700 mb-2">Answer</div>
                        <div className="text-slate-800">
                          <ReactMarkdown
                            components={{
                              h1: ({ children }) => <h1 className="text-xl font-bold mb-3 text-purple-800">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 text-purple-800">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-semibold mb-2 text-purple-800">{children}</h3>,
                              p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                              ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold text-purple-900">{children}</strong>,
                              em: ({ children }) => <em className="italic text-purple-800">{children}</em>,
                              code: ({ children }) => <code className="bg-purple-100 px-1.5 py-0.5 rounded text-sm font-mono text-purple-900">{children}</code>,
                              pre: ({ children }) => <pre className="bg-slate-100 p-3 rounded-lg overflow-x-auto mb-3 text-sm">{children}</pre>,
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-purple-300 pl-4 italic text-purple-800 mb-3">{children}</blockquote>,
                            }}
                          >
                            {data.cortex.answer}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <button
                        onClick={() => setCortexShowContext((v) => !v)}
                        className="text-sm text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
                      >
                        {cortexShowContext ? 'Hide context' : 'Show context'}
                        <svg className={`w-4 h-4 transition-transform ${cortexShowContext ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </button>
                      {cortexShowContext && (
                        <div className="rounded-xl p-4 border border-purple-200 bg-purple-50">
                          <div className="text-xs font-medium text-purple-700 mb-1">Retrieved Context</div>
                          <div className="text-sm text-slate-700 whitespace-pre-wrap">{data.cortex.context}</div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Answer loading state */}
                  {!cortexAnswerVisible ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                      <span className="text-sm text-purple-700">Generating answer…</span>
                    </div>
                  ) : (
                    /* Latency Display */
                    <div className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-200">
                      <div className="text-xs font-medium text-purple-700 mb-3">Performance Metrics</div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-white rounded-lg p-3 border border-purple-100">
                          <div className="text-lg font-semibold text-purple-700">{cortexVectorMs}ms</div>
                          <div className="text-xs text-purple-600">Vector DB</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-purple-100">
                          <div className="text-lg font-semibold text-purple-700">{cortexLlmMs}ms</div>
                          <div className="text-xs text-purple-600">LLM</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-purple-100">
                          <div className="text-lg font-semibold text-purple-700">{cortexVectorMs + cortexLlmMs}ms</div>
                          <div className="text-xs text-purple-600">Total</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
