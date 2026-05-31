// Sprint E3 Phase 5 — QR-Generator-Wrapper
//
// Gleiche Optik wie /api/qr/wifi: retaha-Farben (dark #1A1A1A, light #FFF),
// Margin 1, Fehlerkorrektur 'M'. Wrapping kapselt qrcode-Lib-Aufruf damit
// Endpoints sich auf Auth + URL-Aufbau konzentrieren können.

import QRCode from 'qrcode';

const COMMON = {
  errorCorrectionLevel: 'M' as const,
  margin: 1,
  color: { dark: '#1A1A1A', light: '#FFFFFF' },
};

export async function generateQrSvg(data: string, width = 320): Promise<string> {
  return QRCode.toString(data, { type: 'svg', width, ...COMMON });
}

export async function generateQrPngBuffer(data: string, width = 600): Promise<Buffer> {
  return QRCode.toBuffer(data, { type: 'png', width, ...COMMON });
}
