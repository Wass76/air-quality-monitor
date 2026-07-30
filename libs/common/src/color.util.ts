/** Google returns RGB channels as 0–1 floats (channels may be omitted). */
export interface GoogleRgbColor {
  red?: number;
  green?: number;
  blue?: number;
}

export function rgbToHex(color?: GoogleRgbColor | null): string {
  if (!color) {
    return '#000000';
  }
  const toByte = (channel?: number) =>
    Math.round(Math.min(1, Math.max(0, channel ?? 0)) * 255);
  const r = toByte(color.red).toString(16).padStart(2, '0');
  const g = toByte(color.green).toString(16).padStart(2, '0');
  const b = toByte(color.blue).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}
