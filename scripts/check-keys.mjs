// Ishlatish:  node --env-file=.env scripts/check-keys.mjs
// Kalitlarning o'zini ko'rsatmaydi, faqat turini va bazaga ulanishni tekshiradi.
import { createClient } from "@supabase/supabase-js";
const role = (k = "") => (k.startsWith("sb_secret_") ? "service_role" : k.startsWith("sb_publishable_") ? "anon" : (() => { try { return JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()).role; } catch { return "noma'lum"; } })());
console.log("SUPABASE_ANON_KEY         ->", role(process.env.SUPABASE_ANON_KEY));
console.log("SUPABASE_SERVICE_ROLE_KEY ->", role(process.env.SUPABASE_SERVICE_ROLE_KEY));
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { error } = await sb.from("profiles").select("id").limit(1);
console.log(error ? `profiles o'qish xatosi: ${error.code} ${error.message}` : "profiles jadvaliga ulandi: OK");
