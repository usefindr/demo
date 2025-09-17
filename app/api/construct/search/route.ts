import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getEnvOrDefault(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnvOrDefault('CORTEX_API_KEY');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server misconfiguration: CORTEX_API_KEY is not set' },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      query,
      tenant_id,
      sub_tenant_id,
      max_chunks,
      alpha = 0.8,
      recency_bias = 0,
    } = body ?? {};

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const payload = {
      query,
      tenant_id: tenant_id ?? getEnvOrDefault('TENANT_ID', 'tenant_1234'),
      sub_tenant_id: sub_tenant_id ?? getEnvOrDefault('SUB_TENANT_ID') ?? null,
      max_chunks: typeof max_chunks === 'number' ? max_chunks : undefined,
      alpha,
      recency_bias,
    } as Record<string, unknown>;

    const cortexRes = await fetch('https://api.usecortex.ai/search/retrieve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!cortexRes.ok) {
      const errorText = await cortexRes.text();
      return NextResponse.json(
        { error: 'Search failed', details: errorText },
        { status: cortexRes.status },
      );
    }

    const results = await cortexRes.json();
    return NextResponse.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Unexpected server error', details: message }, { status: 500 });
  }
}


