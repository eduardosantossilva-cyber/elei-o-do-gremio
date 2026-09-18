export type ApiRequest = {
  action: string;
  [key: string]: unknown;
};

export async function callSheetsApi(payload: ApiRequest, method: 'GET' | 'POST' = 'POST') {
  const base = process.env.GOOGLE_SHEETS_API_URL;
  if (!base) throw new Error('GOOGLE_SHEETS_API_URL não configurada.');

  const url = new URL(base);
  let response: Response;

  if (method === 'GET') {
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    response = await fetch(url.toString(), { cache: 'no-store' });
  } else {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      redirect: 'follow',
    });
  }

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { ok: false, message: text || 'Resposta inválida do Google Apps Script.' }; }
  if (!response.ok) throw new Error(`Google Apps Script respondeu ${response.status}.`);
  return data;
}
