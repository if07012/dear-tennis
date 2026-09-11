// `time` is stored as a datetime-local string (YYYY-MM-DDTHH:mm) from the
// admin picker; older rows hold free text ("Saturdays 09:00") — pass those
// through untouched.
export function formatActivityTime(raw: string): string {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
