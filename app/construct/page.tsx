"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type SearchChunk = {
  chunk_uuid: string;
  source_id: string;
  chunk_content: string;
  source_type?: string;
  source_upload_time?: string;
  source_title?: string;
  source_last_updated_time?: string;
  layout?: string | null;
  relevancy_score?: number | null;
  document_metadata?: Record<string, unknown> | null;
  tenant_metadata?: Record<string, unknown> | null;
};

type UploadResult = {
  upload: {
    file_id: string;
    message: string;
    success?: boolean;
  };
  pages: string[];
};

type LayoutData = {
  offsets?: {
    document_level_start_index?: number;
    page_level_start_index?: number;
  };
  page?: number; 
};

type Highlight = {
  pageIndex: number; 
  start: number;
  end: number;
  chunkId?: string;
  chunkText?: string;
};

function parseLayout(layout: unknown): LayoutData | null {
  if (!layout) return null;
  try {
    if (typeof layout === "string") {
      const val = JSON.parse(layout) as LayoutData;
      console.log("Returning", val);
      return val;
    }
    if (typeof layout === "object") {
      return layout as LayoutData;
    }
  } catch {
    // ignore
  }
  return null;
}

function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

function renderHighlighted(text: string, start: number, end: number) {
  const safeStart = clamp(start, 0, text.length);
  const safeEnd = clamp(end, 0, text.length);
  if (safeStart >= safeEnd) return <span>{text}</span>;
  const before = text.slice(0, safeStart);
  const middle = text.slice(safeStart, safeEnd);
  const after = text.slice(safeEnd);
  return (
    <span>
      <span>{before}</span>
      <mark className="bg-yellow-300 text-black px-0.5 rounded-sm">{middle}</mark>
      <span>{after}</span>
    </span>
  );
}

export default function ConstructPage() {
  const [tenantId, setTenantId] = useState<string>("");
  const [subTenantId, setSubTenantId] = useState<string>("");

  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [fileId, setFileId] = useState<string>("");
  const [pages, setPages] = useState<string[]>([]);

  const [indexingStatus, setIndexingStatus] = useState<string>("");
  const [indexingMessage, setIndexingMessage] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(false);

  const [query, setQuery] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>("");
  const [results, setResults] = useState<SearchChunk[]>([]);

  const [llmAnswer, setLlmAnswer] = useState<string>("");
  const [llmLoading, setLlmLoading] = useState<boolean>(false);
  const [llmError, setLlmError] = useState<string>("");

  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [activeChunkId, setActiveChunkId] = useState<string | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  pageRefs.current = useMemo(() => Array.from({ length: pages.length }, () => null), [pages.length]);

  const [activeTab, setActiveTab] = useState<"chunks" | "llm">("chunks");

  // Persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem("construct_state_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        tenantId: string;
        subTenantId: string;
        fileId: string;
        pages: string[];
        query: string;
        indexingStatus: string;
        indexingMessage: string;
      }>;
      if (parsed.tenantId) setTenantId(parsed.tenantId);
      if (parsed.subTenantId) setSubTenantId(parsed.subTenantId);
      if (parsed.fileId) setFileId(parsed.fileId);
      if (Array.isArray(parsed.pages)) setPages(parsed.pages);
      if (typeof parsed.query === "string") setQuery(parsed.query);
      if (typeof parsed.indexingStatus === "string") setIndexingStatus(parsed.indexingStatus);
      if (typeof parsed.indexingMessage === "string") setIndexingMessage(parsed.indexingMessage);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const toStore = JSON.stringify({ tenantId, subTenantId, fileId, pages, query, indexingStatus, indexingMessage });
      localStorage.setItem("construct_state_v1", toStore);
    } catch {}
  }, [tenantId, subTenantId, fileId, pages, query, indexingStatus, indexingMessage]);

  useEffect(() => {
    if (highlight) {
      const ref = pageRefs.current[highlight.pageIndex];
      if (ref) {
        ref.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [highlight]);

  const requestLlmAnswer = useCallback(async (q: string, chunks: SearchChunk[]) => {
    try {
      setLlmLoading(true);
      setLlmError("");
      setLlmAnswer("");
      const res = await fetch("/api/construct?action=llm_answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, chunks }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `LLM request failed (${res.status})`);
      }
      const data = (await res.json()) as { answer?: string };
      setLlmAnswer(data.answer || "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLlmError(msg);
    } finally {
      setLlmLoading(false);
    }
  }, []);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setFileId("");
    setPages([]);
    try {
      const form = new FormData();
      form.append("file", file);
      if (tenantId) form.append("tenant_id", tenantId);
      if (subTenantId) form.append("sub_tenant_id", subTenantId);

      const res = await fetch("/api/construct", { method: "POST", body: form });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Upload failed (${res.status})`);
      }
      const data = (await res.json()) as UploadResult;
      const newFileId = data.upload?.file_id ?? "";
      setFileId(newFileId);
      setPages(data.pages ?? []);
      setIndexingStatus("queued");
      setIndexingMessage("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  }, [tenantId, subTenantId]);

  // Verify indexing status with backoff when fileId changes
  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    let attempt = 0;
    setVerifying(true);

    const verifyOnce = async () => {
      try {
        const res = await fetch("/api/construct/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_id: fileId, tenant_id: tenantId || undefined }),
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data = (await res.json()) as { file_id: string; indexing_status: string; success?: boolean; message?: string };
        if (cancelled) return;
        setIndexingStatus(data.indexing_status);
        setIndexingMessage(data.message || "");
        if (data.indexing_status === "completed" || data.indexing_status === "failed") {
          setVerifying(false);
          return; // stop polling
        }
      } catch {
        if (cancelled) return;
        // keep trying with backoff
      }

      attempt += 1;
      const delay = Math.min(16000, 1000 * Math.pow(2, attempt));
      setTimeout(() => {
        if (!cancelled) void verifyOnce();
      }, delay);
    };

    void verifyOnce();
    return () => {
      cancelled = true;
    };
  }, [fileId, tenantId]);

  const onSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    setLlmAnswer("");
    setLlmError("");
    setLlmLoading(false);
    try {
      const res = await fetch("/api/construct/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, tenant_id: tenantId || undefined, sub_tenant_id: subTenantId || undefined }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Search failed (${res.status})`);
      }
      const data = (await res.json()) as SearchChunk[];
      const arr = Array.isArray(data) ? data : [];
      setResults(arr);
      if (arr.length > 0) {
        void requestLlmAnswer(query, arr);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSearchError(msg);
    } finally {
      setSearching(false);
    }
  }, [query, tenantId, subTenantId, requestLlmAnswer]);

  function findMatchWithinWindow(pageText: string, chunkText: string, approxStart: number, window: number = 150): number {
    if (!chunkText) return approxStart;
    const safeApprox = clamp(approxStart, 0, Math.max(0, pageText.length - 1));
    const startWindow = clamp(safeApprox - window, 0, pageText.length);
    const endWindow = clamp(safeApprox + chunkText.length + window, 0, pageText.length);
    const hay = pageText.slice(startWindow, endWindow);
    // exact
    let relIdx = hay.indexOf(chunkText);
    if (relIdx >= 0) return startWindow + relIdx;
    // case-insensitive
    relIdx = hay.toLowerCase().indexOf(chunkText.toLowerCase());
    if (relIdx >= 0) return startWindow + relIdx;
    return safeApprox;
  }

  const onChunkClick = useCallback(
    (chunk: SearchChunk) => {
      setActiveChunkId(chunk.chunk_uuid);
      let layout = parseLayout(chunk.layout ?? null);
      if (typeof layout == "string") {
        layout = JSON.parse(layout) as LayoutData;
      }
      const pageNum = layout?.page ?? 1; // 1-based default 1
      const pageIndex = Math.max(0, pageNum - 1);
      const approxStart = layout?.offsets?.page_level_start_index ?? 0;
      const chunkText = chunk.chunk_content ?? "";
      const chunkLen = chunkText.length;
      const pageText = pages[pageIndex] ?? "";

      let start = approxStart;
      let end = start + chunkLen;

      // Check if offsets exceed page bounds or if the exact match fails
      const offsetsExceedBounds = approxStart >= pageText.length || end > pageText.length;
      const exactMatch = pageText.slice(start, end) === chunkText;
      
      // If offsets exceed bounds or exact match fails, search for complete chunk content
      if (offsetsExceedBounds || !exactMatch) {
        if (chunk.chunk_content) {
          // First try exact match
          const foundIndex = pageText.indexOf(chunk.chunk_content);
          if (foundIndex !== -1) {
            start = foundIndex;
            end = start + chunk.chunk_content.length;
          } else {
            // Try case-insensitive match
            const foundIndexCI = pageText.toLowerCase().indexOf(chunk.chunk_content.toLowerCase());
            if (foundIndexCI !== -1) {
              start = foundIndexCI;
              end = start + chunk.chunk_content.length;
            } else {
              // If still not found, try windowed search as fallback
              start = findMatchWithinWindow(pageText, chunk.chunk_content, approxStart, 150);
              end = start + chunkLen;
            }
          }
        }
      }

      // Final clamp to page bounds
      start = clamp(start, 0, pageText.length);
      end = clamp(end, start, pageText.length);

      setHighlight({ pageIndex, start, end, chunkId: chunk.chunk_uuid, chunkText: chunk.chunk_content });
    },
    [pages]
  );

  return (
    <div className="w-full h-screen overflow-hidden flex bg-slate-900 text-white">
      {/* Left Pane: Uploader + Chat/Search */}
      <div className="w-1/2 h-full border-r border-slate-700 flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold">Upload PDF</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="tenant_id (optional)"
              className="border border-slate-600 bg-slate-800 rounded px-2 py-1 text-sm text-white placeholder-slate-400"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
            <input
              type="text"
              placeholder="sub_tenant_id (optional)"
              className="border border-slate-600 bg-slate-800 rounded px-2 py-1 text-sm text-white placeholder-slate-400"
              value={subTenantId}
              onChange={(e) => setSubTenantId(e.target.value)}
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="file"
              accept="application/pdf"
              onChange={onFileChange}
              className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-slate-300 hover:file:bg-slate-600"
            />
            {uploading && <span className="text-sm text-slate-400">Uploading & parsing…</span>}
          </div>
          {uploadError && <div className="mt-2 text-sm text-red-500">{uploadError}</div>}
          {fileId && (
            <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
              <span className="font-mono break-all">file_id: {fileId}</span>
              <span className="inline-flex items-center gap-1">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    indexingStatus === "completed"
                      ? "bg-green-500"
                      : indexingStatus === "failed"
                      ? "bg-red-500"
                      : "bg-yellow-400 animate-pulse"
                  }`}
                ></span>
                <span className="capitalize">{indexingStatus || (verifying ? "verifying" : "unknown")}</span>
              </span>
            </div>
          )}
          {pages.length > 0 && (
            <div className="mt-1 text-xs text-slate-400">
              Total pages: {pages.length}
            </div>
          )}
          {indexingMessage && <div className="mt-1 text-[11px] text-slate-500">{indexingMessage}</div>}
        </div>

        <div className="p-4 flex-1 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold">Chat / Search</h2>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              placeholder="Ask something…"
              className="flex-1 border border-slate-600 bg-slate-800 rounded px-2 py-2 text-white placeholder-slate-400"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(evt) => {
                if (evt.key === "Enter") onSearch();
              }}
            />
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
              onClick={onSearch}
              disabled={searching}
            >
              {searching ? "Searching…" : "Send"}
            </button>
          </div>
          {searchError && <div className="mt-2 text-sm text-red-500">{searchError}</div>}

          <div className="mt-4 border-b border-slate-700">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab("chunks")}
                className={`py-2 px-4 text-sm font-medium ${
                  activeTab === "chunks" ? "border-b-2 border-blue-500 text-blue-400" : "text-slate-400"
                }`}
              >
                Chunks
              </button>
              <button
                onClick={() => setActiveTab("llm")}
                className={`py-2 px-4 text-sm font-medium ${
                  activeTab === "llm" ? "border-b-2 border-blue-500 text-blue-400" : "text-slate-400"
                }`}
              >
                LLM Answer
              </button>
            </div>
          </div>

          <div className="mt-4 flex-1 overflow-auto min-h-0">
            {activeTab === "chunks" && (
              <>
                {results.length === 0 && !searching && (
                  <div className="text-sm text-slate-500">No results yet. Ask a question to search.</div>
                )}
                <div className="space-y-3">
                  {results.map((r) => {
                    let layout = parseLayout(r.layout ?? null);
                    if (typeof layout == "string") {
                      layout = JSON.parse(layout) as LayoutData;
                    }
                    const startIdx = layout?.offsets?.page_level_start_index ?? 0;
                    const isActive = r.chunk_uuid === activeChunkId;
                    return (
                      <button
                        key={r.chunk_uuid}
                        onClick={() => onChunkClick(r)}
                        className={`w-full text-left border border-slate-700 rounded p-3 ${
                          isActive ? "bg-slate-700" : "hover:bg-slate-800"
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap text-slate-300 mb-2">
                          {r.chunk_content?.slice(0, 300) || "(empty chunk)"}
                          {r.chunk_content && r.chunk_content.length > 300 ? "…" : ""}
                        </div>
                        <div className="text-xs text-slate-400 flex justify-between w-full">
                          <span>
                            Page: {layout?.page ?? "?"}, start: {startIdx}
                          </span>
                          {typeof r.relevancy_score === "number" && (
                            <span>score: {r.relevancy_score.toFixed(3)}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {activeTab === "llm" && (
              <div className="text-sm">
                {llmLoading && <div className="text-slate-400">Generating answer…</div>}
                {llmError && <div className="text-red-500">{llmError}</div>}
                {!llmLoading && !llmError && !llmAnswer && (
                  <div className="text-slate-500">No answer yet. Run a search to generate an answer.</div>
                )}
                {!llmLoading && !llmError && llmAnswer && (
                  <div className="prose prose-invert prose-slate max-w-none">
                    <ReactMarkdown>{llmAnswer}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Pane: Page-wise PDF text with highlighting */}
      <div className="w-1/2 h-full overflow-auto">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Extracted PDF (page-wise)</h2>
            <button
              onClick={() => {
                setPages([]);
                setHighlight(null);
                setActiveChunkId(null);
              }}
              className="px-3 py-1.5 text-sm rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
            >
              Clear
            </button>
          </div>
          {pages.length === 0 ? (
            <div className="mt-2 text-sm text-slate-500">Upload a PDF to display its extracted text by page.</div>
          ) : null}

          <div className="mt-3 space-y-6">
            {pages.map((txt, idx) => {
              const isHighlightedPage = highlight?.pageIndex === idx;
              const start = isHighlightedPage ? highlight!.start : -1;
              const end = isHighlightedPage ? highlight!.end : -1;
              return (
                <div
                  key={idx}
                  ref={(el) => {
                    pageRefs.current[idx] = el;
                  }}
                  className={`border border-slate-700 rounded p-3 ${isHighlightedPage ? "ring-2 ring-yellow-400" : ""}`}
                >
                  <div className="text-xs text-slate-400 mb-2">Page {idx + 1}</div>
                  <div className="whitespace-pre-wrap break-words text-slate-300">
                    {isHighlightedPage ? renderHighlighted(txt, start, end) : txt}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


