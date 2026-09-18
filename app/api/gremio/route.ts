import { NextRequest, NextResponse } from 'next/server';
import { callSheetsApi } from '@/lib/server';

export const dynamic = 'force-dynamic';

const publicActions = new Set(['status', 'student', 'chapas', 'vote']);
const adminActions = new Set(['stats', 'students_summary', 'save_chapa', 'delete_chapa', 'set_status', 'election_info']);

export async function GET(request: NextRequest) {
  return handle({ request, method: 'GET' });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, message: 'JSON inválido.' }, { status: 400 });
  }
  return handle({ request, method: 'POST', body });
}

async function handle({ request, method, body = {} }: { request: NextRequest; method: 'GET'|'POST'; body?: Record<string, unknown> }) {
  const payload = method === 'GET'
    ? Object.fromEntries(request.nextUrl.searchParams.entries()) as Record<string, unknown>
    : body;
  const action = String(payload.action || '');

  if (!publicActions.has(action) && !adminActions.has(action)) {
    return NextResponse.json({ ok: false, message: 'Ação inválida.' }, { status: 400 });
  }

  if (adminActions.has(action)) {
    const password = String(payload.password || '');
    const envPassword = process.env.ADMIN_PASSWORD;
    if (envPassword && password !== envPassword) {
      return NextResponse.json({ ok: false, message: 'Senha administrativa inválida.' }, { status: 401 });
    }
    if (!envPassword) {
      return NextResponse.json({ ok: false, message: 'ADMIN_PASSWORD não configurada no Vercel.' }, { status: 500 });
    }
  }

  try {
    const result = await callSheetsApi(payload as any, method);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro de comunicação.';
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}
