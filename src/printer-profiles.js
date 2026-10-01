const mmPerInch = 25.4;

export const PRINTERS = Object.freeze({
  konica: { id: 'konica', label: 'Konica Digital Press' },
  epson: { id: 'epson', label: 'Epson SureColor S80670' },
});

export const EPSON_MEDIA_SIZES = Object.freeze([
  { id: '49x24.5', label: '49 × 24.5 in · Landscape', w: 49 * mmPerInch, h: 24.5 * mmPerInch },
  { id: '59x25.1', label: '59 × 25.1 in · Landscape', w: 59 * mmPerInch, h: 25.1 * mmPerInch },
]);

export const DEFAULT_EPSON_MEDIA_SIZE = '59x25.1';
export const DEFAULT_EPSON_MARGINS_MM = Object.freeze({ top: 0.25 * mmPerInch, right: 0.25 * mmPerInch, bottom: 0.25 * mmPerInch, left: 0.25 * mmPerInch });
export const DEFAULT_EPSON_GAP_MM = 2;
export const DEFAULT_EPSON_MARK_LENGTH_MM = 10;
export const DEFAULT_KONICA_MARK_LENGTH_MM = 5;

export function epsonMediaSize(id) {
  return EPSON_MEDIA_SIZES.find(size => size.id === id) || EPSON_MEDIA_SIZES.find(size => size.id === DEFAULT_EPSON_MEDIA_SIZE);
}
