const FALLBACK_SUPABASE_URL = "https://turtsegyvhqrbbxzzkuj.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_RcaR2F9n5M3t95F3uBZ8zA_CnX32rkn";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
