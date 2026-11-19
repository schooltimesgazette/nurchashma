# Nurchashma — tuzatishlar (debug natijasi)

Tuzatilgan fayllar:
- `server.js` — so'rovlar limitini chetlab o'tish tuzatildi (IP bo'yicha "shift" limit qo'shildi; Payme/Click callback'lari alohida limitda).
- `src/routes/kids.js` — `/watch/heartbeat`, `/videos/:id/like` va ro'yxatga qo'shishda video mavjudligi, nashr etilgani va yoshga mosligi tekshiriladi
  (avval mavjud bo'lmagan `video_id` 500 xato berardi, kattaroq yoshdagi videoga vaqt/like yozilardi).

Qolgan tavsiyalar (kodga tegilmagan): `fulfillOrder` atomikligi, PIN bloklashni bazada saqlash, `.env` kalitlarini almashtirish.

## 2-qism: Supabase uchun SQL (supabase/update-atomic.sql)
- `fulfill_order` / `revert_order` — to'lov va Pro kunlari bitta tranzaksiyada (`src/billing.js` shularni chaqiradi).
- `pin_attempts` jadvali + `pin_*` funksiyalar — PIN bloklash server qayta ishga tushsa ham saqlanadi (`src/pin.js`, `src/routes/parent.js`).
- Payme `PerformTransaction` qayta so'ralganda Pro berishni qayta urinadi (`src/routes/payments.js`).
MUHIM: avval SQL ni ishga tushiring, keyin yangi kodni deploy qiling.
