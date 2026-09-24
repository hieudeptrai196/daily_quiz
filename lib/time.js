// Mọi "ngày" trong bot tính theo giờ Việt Nam (UTC+7, không có DST).
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// "YYYY-MM-DD" theo giờ VN
export function dayKey(date = new Date()) {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

// ISO week của một dayKey, ví dụ "2026-09-24" -> "2026-W39"
export function weekKey(day) {
  const [y, m, d] = String(day).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay() || 7; // Thứ 2 = 1 ... Chủ nhật = 7
  dt.setUTCDate(dt.getUTCDate() + 4 - dow); // nhảy tới thứ 5 của tuần đó
  const isoYear = dt.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((dt.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

// "2026-09-24" -> "24/09"
export function formatDay(day) {
  const [, m, d] = String(day).split('-');
  return `${d}/${m}`;
}
