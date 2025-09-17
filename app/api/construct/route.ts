import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import PDFParser from 'pdf2json';
type PdfTextRun = { T?: string };
type PdfText = { R?: PdfTextRun[] };
type PdfPage = { Texts?: PdfText[] };
type PdfFormImage = { Pages?: PdfPage[] };
type PdfDataReadyEvent = { formImage?: PdfFormImage; Pages?: PdfPage[] };

interface Pdf2JsonParser {
  on(event: 'pdfParser_dataError', handler: (errData: unknown) => void): void;
  on(event: 'pdfParser_dataReady', handler: (evtData: PdfDataReadyEvent) => void): void;
  loadPDF(path: string): void;
  data?: { formImage?: PdfFormImage; Pages?: PdfPage[] };
}


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UploadResponse = {
  file_id: string;
  message: string;
  success?: boolean;
};

function getEnvOrDefault(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

async function parsePdfPages(buffer: Buffer): Promise<string[]> {
  // Write to a temp file and parse with pdf2json for robust server-side extraction
  const tempId = uuidv4();
  const tempPath = `/tmp/${tempId}.pdf`;
  await fs.writeFile(tempPath, buffer);

  const pages: string[] = await new Promise((resolve, reject) => {
    const ParserCtor = PDFParser as unknown as { new (ctx?: unknown, parseImages?: number): Pdf2JsonParser };
    const parser: Pdf2JsonParser = new ParserCtor(null, 1);

    const cleanup = async () => {
      try {
        await fs.unlink(tempPath);
      } catch {}
    };

    parser.on('pdfParser_dataError', async (errData: unknown) => {
      await cleanup();
      if (typeof errData === 'object' && errData !== null && Object.prototype.hasOwnProperty.call(errData, 'parserError')) {
        const pe = (errData as Record<string, unknown>).parserError;
        reject(pe ?? new Error('PDF parse error'));
      } else {
        reject(errData ?? new Error('PDF parse error'));
      }
    });

    parser.on('pdfParser_dataReady', async (evtData: PdfDataReadyEvent) => {
      try {
        const pagesSrc: PdfPage[] = (evtData?.formImage?.Pages
          ?? evtData?.Pages
          ?? parser.data?.formImage?.Pages
          ?? parser.data?.Pages
          ?? []) as PdfPage[];

        const out: string[] = Array.isArray(pagesSrc)
          ? pagesSrc.map((p: PdfPage) => {
              const texts: PdfText[] = Array.isArray(p?.Texts) ? (p.Texts as PdfText[]) : [];
              const str = texts
                .map((t: PdfText) => {
                  const runs: PdfTextRun[] = Array.isArray(t?.R) ? (t.R as PdfTextRun[]) : [];
                  const combined = runs.map((r: PdfTextRun) => decodeURIComponent(r?.T ?? '')).join('');
                  return combined;
                })
                .join(' ');
              return str;
            })
          : [];
        await cleanup();
        resolve(out);
      } catch (e) {
        await cleanup();
        reject(e);
      }
    });

    parser.loadPDF(tempPath);
  });

  return pages;
}

export async function POST(req: NextRequest) {
  try {
    // Branch: delegate LLM answer generation
    const requestUrl = new URL(req.url);
    const action = requestUrl.searchParams.get('action');
    if (action === 'llm_answer') {
      return handleLlmAnswer(req);
    }

    const apiKey = getEnvOrDefault('CORTEX_API_KEY');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server misconfiguration: CORTEX_API_KEY is not set' },
        { status: 500 },
      );
    }

    const tenantIdFromQuery = requestUrl.searchParams.get('tenant_id') ?? undefined;
    const subTenantIdFromQuery = requestUrl.searchParams.get('sub_tenant_id') ?? undefined;

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file in form-data under key "file"' }, { status: 400 });
    }

    const tenantId = (form.get('tenant_id') as string | null) ?? tenantIdFromQuery ?? getEnvOrDefault('TENANT_ID', 'tenant_1234');
    const subTenantId = (form.get('sub_tenant_id') as string | null) ?? subTenantIdFromQuery ?? getEnvOrDefault('SUB_TENANT_ID') ?? undefined;

    const tenantMetadata = (form.get('tenant_metadata') as string | null) ?? undefined;
    const documentMetadata = (form.get('document_metadata') as string | null) ?? undefined;

    // Read file buffer for local PDF parsing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Start parsing PDF pages (do not block on upload) but await before respond
    const pagesPromise = parsePdfPages(buffer);

    // Prepare multipart form for Cortex upload
    const outboundForm = new FormData();
    // Recreate a fresh File to ensure correct stream consumption
    const outboundFile = new File([buffer], file.name || 'document.pdf', { type: file.type || 'application/pdf' });
    outboundForm.append('file', outboundFile);
    if (tenantMetadata) outboundForm.append('tenant_metadata', tenantMetadata);
    if (documentMetadata) outboundForm.append('document_metadata', documentMetadata);

    const cortexUrl = new URL('https://api.usecortex.ai/upload/upload_document');
    if (tenantId) cortexUrl.searchParams.set('tenant_id', tenantId);
    if (subTenantId) cortexUrl.searchParams.set('sub_tenant_id', subTenantId);

    const cortexRes = await fetch(cortexUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: outboundForm,
    });

    if (!cortexRes.ok) {
      const errorText = await cortexRes.text();
      return NextResponse.json(
        { error: 'Upload to Cortex failed', details: errorText },
        { status: cortexRes.status },
      );
    }

    const upload: UploadResponse = await cortexRes.json();
    const pages = await pagesPromise;

    return NextResponse.json({ upload, pages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Unexpected server error', details: message }, { status: 500 });
  }
}

type LlmAnswerRequest = {
  query: string;
  chunks: Array<{ chunk_uuid?: string; chunk_content?: string; source_id?: string; page?: number | null }>;
};

async function handleLlmAnswer(req: NextRequest) {
  try {
    const { query, chunks } = (await req.json()) as LlmAnswerRequest;
    if (!query || !Array.isArray(chunks)) {
      return NextResponse.json({ error: 'query and chunks are required' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
    }

    const systemPrompt = `You are a helpful assistant. You will be given a user query and a set of retrieved document chunks (with optional page numbers). Synthesize a concise, accurate answer strictly grounded in the provided chunks. If the chunks do not contain enough information, clearly say so. Always cite page numbers inline like (p.X) where relevant.`;

    const contextBlocks = chunks
      .map((c, i) => {
        // Try to read a page number if present in the object
        let page: number | null = null;
        if (typeof (c as Record<string, unknown>).page === 'number') {
          page = (c as Record<string, unknown>).page as number;
        } else if (typeof (c as Record<string, unknown>).layout === 'object' && (c as Record<string, unknown>).layout !== null) {
          const layoutObj = (c as Record<string, unknown>).layout as { page?: number };
          if (typeof layoutObj.page === 'number') page = layoutObj.page;
        }
        const pageText = page ? `\nPage: ${page}` : '';
        const content = (c.chunk_content ?? '').trim();
        return `Chunk ${i + 1}:${pageText}\n${content}`;
      })
      .join('\n\n---\n\n');

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `User query:\n${query}\n\nRetrieved chunks:\n\n${contextBlocks}` },
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: 'OpenAI call failed', details: errText }, { status: res.status });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ answer: content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Unexpected server error', details: message }, { status: 500 });
  }
}


