import crypto from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config.js";
import { supabase } from "./db.js";

const scrypt = promisify(crypto.scrypt);

export const isValidPin = (pin) => typeof pin === "string" && /^\d{4}$/.test(pin);

export async function hashPin(pin, salt = crypto.randomBytes(16).toString("hex")) {
  const key = await scrypt(pin, salt, 32);
  return { salt, hash: key.toString("hex") };
}

export async function verifyPin(pin, salt, hash) {
  const { hash: candidate } = await hashPin(pin, salt);
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- Ota-ona vaqtinchalik tokeni (PIN to'g'ri kiritilgach beriladi) ---------- */
const TOKEN_KEY = crypto.createHash("sha256").update(`nurchashma-parent-token:${config.serviceKey}`).digest();
export const PARENT_TOKEN_TTL_MS = 15 * 60 * 1000;

const sign = (payload) => crypto.createHmac("sha256", TOKEN_KEY).update(payload).digest("base64url");

export function signParentToken(parentId) {
  const payload = Buffer.from(JSON.stringify({ sub: parentId, exp: Date.now() + PARENT_TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyParentToken(token, parentId) {
  if (typeof token !== "string") return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.sub === parentId && data.exp > Date.now();
  } catch {
    return false;
  }
}

/* ---------- PIN taxmin qilishdan himoya: 5 ta xato → 5 daqiqa kutish (bazada saqlanadi) ---------- */
// supabase/update-atomic.sql ni ishga tushirish kerak (pin_attempts jadvali va funksiyalari)
export async function lockedForMs(parentId) {
  const { data, error } = await supabase.rpc("pin_lock_remaining_ms", { p_parent: parentId });
  if (error) throw error;
  return Number(data) || 0;
}

export async function recordPinFailure(parentId) {
  const { error } = await supabase.rpc("pin_record_failure", { p_parent: parentId });
  if (error) throw error;
}

export async function clearPinFailures(parentId) {
  const { error } = await supabase.rpc("pin_clear_failures", { p_parent: parentId });
  if (error) throw error;
}
