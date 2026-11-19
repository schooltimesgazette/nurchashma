import { supabase } from "./db.js";
import { config } from "./config.js";

export const PLAN_LABELS = { 30: "1 oy", 90: "3 oy", 365: "1 yil" };
export const PLANS = Object.keys(PLAN_LABELS).map((days) => ({
  days: Number(days),
  label: PLAN_LABELS[days],
  price: config.prices[days],
}));

export const paymeEnabled = () => Boolean(config.payme.merchantId && config.payme.key);
export const clickEnabled = () => Boolean(config.click.serviceId && config.click.merchantId && config.click.secretKey);

/** Payme to'lov havolasi (summa tiyinda) */
export function paymeUrl(order, returnUrl) {
  const params = [
    `m=${config.payme.merchantId}`,
    `ac.order_id=${order.id}`,
    `a=${order.amount_uzs * 100}`,
    "l=uz",
    `c=${returnUrl}`,
  ].join(";");
  const host = config.payme.test ? "https://test.paycom.uz" : "https://checkout.paycom.uz";
  return `${host}/${Buffer.from(params).toString("base64")}`;
}

/** Click to'lov havolasi (summa so'mda) */
export function clickUrl(order, returnUrl) {
  const query = new URLSearchParams({
    service_id: config.click.serviceId,
    merchant_id: config.click.merchantId,
    amount: String(order.amount_uzs),
    transaction_param: order.id,
    return_url: returnUrl,
  });
  return `https://my.click.uz/services/pay?${query}`;
}

/**
 * To'lov muvaffaqiyatli bo'lganda: buyurtmani "to'langan" qilib, Pro kunlarini qo'shadi.
 * Ikkala amal bazadagi bitta funksiyada (fulfill_order) bajariladi, shuning uchun yarim holat bo'lmaydi.
 * Takroriy chaqiruvda hech narsa qilmaydi va false qaytaradi.
 */
export async function fulfillOrder(orderId) {
  const { data, error } = await supabase.rpc("fulfill_order", { p_order: orderId });
  if (error) throw error;
  return Boolean(data);
}

/** To'lov bekor qilinganda (qaytarilganda) Pro kunlarini ayiradi (atomik). */
export async function revertOrder(orderId) {
  const { data, error } = await supabase.rpc("revert_order", { p_order: orderId });
  if (error) throw error;
  return Boolean(data);
}
