/** Инициалы для аватара в shell bar, например `Jane Doe` становится `JD`. */
export function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return `${first}${second}`.toUpperCase();
}
