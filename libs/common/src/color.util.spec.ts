import { rgbToHex } from './color.util';

describe('rgbToHex', () => {
  it('converts Google 0-1 RGB floats to hex', () => {
    expect(rgbToHex({ red: 1, green: 0, blue: 0 })).toBe('#FF0000');
    expect(rgbToHex({ red: 1, green: 0.8862745, blue: 0 })).toBe('#FFE200');
  });

  it('defaults missing channels to 0', () => {
    expect(rgbToHex({ red: 1, green: 0.8862745 })).toBe('#FFE200');
  });

  it('returns black for empty input', () => {
    expect(rgbToHex(null)).toBe('#000000');
    expect(rgbToHex(undefined)).toBe('#000000');
  });
});
