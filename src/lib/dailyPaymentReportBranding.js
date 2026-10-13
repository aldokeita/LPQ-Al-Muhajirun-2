import { fetchClassAttendanceAppearance } from './classAttendancePrintAdapters';
import { DEFAULT_CLASS_ATTENDANCE_PRINT_CONFIG } from './classAttendancePrintConfig';

export const defaultDailyReportBranding = DEFAULT_CLASS_ATTENDANCE_PRINT_CONFIG.content;

// Rasterisasi juga mendukung logo SVG/WebP yang belum dapat ditanam langsung
// oleh ExcelJS. Kop teks tetap tersedia jika gambar tidak dapat dibaca.
const loadLogoPng = (url) => new Promise((resolve) => {
  if (!url) return resolve('');
  const logo = new Image();
  logo.crossOrigin = 'anonymous';
  const timer = setTimeout(() => resolve(''), 8000);
  const finish = (value) => { clearTimeout(timer); resolve(value); };
  logo.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, 400 / Math.max(logo.naturalWidth, logo.naturalHeight));
      const width = Math.max(1, Math.round(logo.naturalWidth * ratio));
      const height = Math.max(1, Math.round(logo.naturalHeight * ratio));
      canvas.width = canvas.height = Math.max(width, height);
      canvas.getContext('2d').drawImage(logo, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      finish(canvas.toDataURL('image/png'));
    } catch { finish(''); }
  };
  logo.onerror = () => finish('');
  logo.src = url;
});

export const loadDailyReportBranding = async () => {
  try {
    const { config, lpqLogoUrl } = await fetchClassAttendanceAppearance();
    return { ...config.content, logoDataUrl: await loadLogoPng(lpqLogoUrl) };
  } catch {
    return { ...defaultDailyReportBranding, logoDataUrl: '' };
  }
};
