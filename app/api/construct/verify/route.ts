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
    const { file_id, tenant_id } = body as { file_id?: string; tenant_id?: string };
    if (!file_id) {
      return NextResponse.json({ error: 'file_id is required' }, { status: 400 });
    }

    const url = new URL('https://api.usecortex.ai/upload/verify_processing');
    url.searchParams.set('file_id', file_id);
    const resolvedTenant = tenant_id ?? getEnvOrDefault('TENANT_ID', 'tenant_1234');
    if (resolvedTenant) url.searchParams.set('tenant_id', resolvedTenant);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: 'Verify failed', details: txt }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Unexpected server error', details: message }, { status: 500 });
  }
}


