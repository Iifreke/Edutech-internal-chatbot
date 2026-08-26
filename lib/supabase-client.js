import { createClient } from '@supabase/supabase-js';

export const ALLOWED_DOMAINS = ['edutechbusiness.net', 'vigilearn.com'];

export function isAllowedEmail(email) {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

let _client = null;

export function getSupabaseClient() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured.');
  _client = createClient(url, key);
  return _client;
}
