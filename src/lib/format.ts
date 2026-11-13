const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
// calendar days, not 24-hour blocks: on the day the clocks change a day is 23 or 25 hours long, and adding 24 hours then
// lands on the same date twice (Sun Nov 01 2026 appeared twice in the date lists, which gave duplicate React keys)
export const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function fmtDay(d: Date) {
  const diff = Math.round((d.getTime() - today().getTime()) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `${DN[d.getDay()]}, ${MN[d.getMonth()]} ${d.getDate()}`;
}
export const fmtLong = (d: Date) => `${DAYS[d.getDay()]}, ${MN[d.getMonth()]} ${d.getDate()}`;
export const dayShort = (d: Date) => DN[d.getDay()];

export function t12(t: string) {
  if (!t) return '';
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

export const money = (n: number) => `$${n.toFixed(2)}`;
export const city = (s: string) => s.replace(/, (ON|QC)$/, '');

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
