import { createClient } from '@supabase/supabase-js';

function sanitizeUrl(url: string): string {
  let cleaned = (url || '').trim().replace(/^["']|["']$/g, '');
  cleaned = cleaned.replace(/\/+$/, '');
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  cleaned = cleaned.replace(/\/rest\/?$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

function sanitizeKey(key: string): string {
  return (key || '').trim().replace(/^["']|["']$/g, '');
}

const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://fffdbrllkrursawtcdlt.supabase.co';

const rawKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_bVbCVCBsSniuibo6nc-_Tg_yJe271L7';

export const supabaseUrl = sanitizeUrl(rawUrl);
export const supabaseAnonKey = sanitizeKey(rawKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

