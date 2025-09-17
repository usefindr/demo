"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  page?: number; // 1-based
};

type Highlight = {
  pageIndex: number; // 0-based
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

  const [query, setQuery] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>("");
  const [results, setResults] = useState<SearchChunk[]>([]);

  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  pageRefs.current = useMemo(() => Array.from({ length: pages.length }, () => null), [pages.length]);

  useEffect(() => {
    if (highlight) {
      const ref = pageRefs.current[highlight.pageIndex];
      if (ref) {
        ref.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [highlight]);

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
      setFileId(data.upload?.file_id ?? "");
      setPages(data.pages ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  }, [tenantId, subTenantId]);

  const onSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
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
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSearchError(msg);
    } finally {
      setSearching(false);
    }
  }, [query, tenantId, subTenantId]);

  const onChunkClick = useCallback((chunk: SearchChunk) => {
    let layout = parseLayout(chunk.layout ?? null);
    console.log(`Setting highlight to ${chunk.layout} layout`);

    if (typeof layout == "string") {
        layout = JSON.parse(layout) as LayoutData;
        console.log("Parsed layout", layout);
    }
    const pageNum = layout?.page ?? 1; // 1-based default 1
    const pageIndex = Math.max(0, pageNum - 1);
    const start = layout?.offsets?.page_level_start_index ?? 0 ;
    const end = start + (chunk.chunk_content?.length ?? 0);

    console.log(`Setting highlight to ${pageIndex}, ${start}, ${end}`);
    setHighlight({ pageIndex, start, end, chunkId: chunk.chunk_uuid, chunkText: chunk.chunk_content });
  }, [pages]);

  return (
    <div className="w-full h-screen overflow-hidden flex">
      {/* Left Pane: Uploader + Chat/Search */}
      <div className="w-1/2 h-full border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Upload PDF</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="tenant_id (optional)"
              className="border rounded px-2 py-1 text-sm"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
            <input
              type="text"
              placeholder="sub_tenant_id (optional)"
              className="border rounded px-2 py-1 text-sm"
              value={subTenantId}
              onChange={(e) => setSubTenantId(e.target.value)}
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input type="file" accept="application/pdf" onChange={onFileChange} />
            {uploading && <span className="text-sm text-gray-600">Uploading & parsing…</span>}
          </div>
          {uploadError && <div className="mt-2 text-sm text-red-600">{uploadError}</div>}
          {fileId && <div className="mt-2 text-xs text-gray-600">file_id: {fileId}</div>}
        </div>

        <div className="p-4 flex-1 flex flex-col">
          <h2 className="text-lg font-semibold">Chat / Search</h2>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              placeholder="Ask something…"
              className="flex-1 border rounded px-2 py-2"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
            />
            <button
              className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
              onClick={onSearch}
              disabled={searching}
            >
              {searching ? "Searching…" : "Send"}
            </button>
          </div>
          {searchError && <div className="mt-2 text-sm text-red-600">{searchError}</div>}

          <div className="mt-4 flex-1 overflow-auto">
            {results.length === 0 && !searching && (
              <div className="text-sm text-gray-500">No results yet. Ask a question to search.</div>
            )}
            <div className="space-y-3">
              {results.map((r) => {
                const layout = parseLayout(r.layout ?? null);
                const pageLabel = layout?.page ? `p.${layout.page}` : "p.?";
                const startIdx = layout?.offsets?.page_level_start_index ?? 0;
                return (
                  <button
                    key={r.chunk_uuid}
                    onClick={() => onChunkClick(r)}
                    className="w-full text-left border rounded p-3 hover:bg-gray-50"
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      <span>{pageLabel}</span>
                      {typeof r.relevancy_score === "number" && (
                        <span className="ml-2">score: {r.relevancy_score.toFixed(3)}</span>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      {r.chunk_content?.slice(0, 300) || "(empty chunk)"}
                      {r.chunk_content && r.chunk_content.length > 300 ? "…" : ""}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">start: {startIdx}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Page-wise PDF text with highlighting */}
      <div className="w-1/2 h-full overflow-auto">
        <div className="p-4">
          <h2 className="text-lg font-semibold">Extracted PDF (page-wise)</h2>
          {pages.length === 0 ? (
            <div className="mt-2 text-sm text-gray-500">Upload a PDF to display its extracted text by page.</div>
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
                  className={`border rounded p-3 ${isHighlightedPage ? "ring-2 ring-yellow-400" : ""}`}
                >
                  <div className="text-xs text-gray-500 mb-2">Page {idx + 1}</div>
                  <div className="whitespace-pre-wrap break-words">
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


