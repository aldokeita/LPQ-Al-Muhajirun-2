import React, { useRef, useState } from 'react';
import { RotateCcw, Save, Settings2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ID_CARD_FONTS as FONT_OPTIONS } from '@/lib/santriIdCardPrint';

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('File tidak dapat dibaca.'));
  reader.readAsDataURL(file);
});

const ControlGroup = ({ children, title, description }) => (
  <section className="santri-id-card-editor__group">
    <div className="santri-id-card-editor__group-heading">
      <h4>{title}</h4>
      {description && <p>{description}</p>}
    </div>
    {children}
  </section>
);

const RangeField = ({ label, max, min, onChange, step = 1, unit, value }) => (
  <label className="santri-id-card-editor__range">
    <span><strong>{label}</strong><em>{value}{unit}</em></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
);

const ColorField = ({ label, onChange, value }) => (
  <label className="santri-id-card-editor__color">
    <span>{label}</span>
    <Input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
  </label>
);

const SantriIdCardLiveEditor = ({ design, onChange, onReset, onSave }) => {
  const backgroundInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const logoRightInputRef = useRef(null);
  const [uploadError, setUploadError] = useState('');
  const [isReading, setIsReading] = useState(false);

  const update = (field, value) => onChange((current) => ({ ...current, [field]: value }));

  const handleImageUpload = async (event, field) => {
    const input = event.target;
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setIsReading(true);
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Gunakan gambar JPG, PNG, atau WebP.');
      if (file.size > 2 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 2 MB agar pengaturan dapat disimpan di browser.');
      update(field, await readFileAsDataUrl(file));
    } catch (error) { setUploadError(error.message || 'Gambar gagal dibaca.'); }
    finally { input.value = ''; setIsReading(false); }
  };
  const handleBackgroundUpload = (event) => handleImageUpload(event, 'backgroundUrl');
  const handleLogoUpload = (event) => handleImageUpload(event, 'logoUrl');
  const handleRightLogoUpload = (event) => handleImageUpload(event, 'logoRightUrl');

  return (
    <section className="santri-id-card-editor" aria-labelledby="santri-id-card-editor-title">
      <header className="santri-id-card-editor__header">
        <div>
          <span className="santri-id-card-editor__eyebrow"><Settings2 aria-hidden="true" /> Live Editor</span>
          <h3 id="santri-id-card-editor-title">Kustomisasi ID Card</h3>
          <p>Perubahan langsung terlihat pada preview. Ukuran kartu tetap 53,8 × 86 mm.</p>
        </div>
        <div className="santri-id-card-editor__actions">
          <Button type="button" variant="ghost" size="sm" onClick={onReset}><RotateCcw aria-hidden="true" /> Reset</Button>
          <Button type="button" variant="outline" size="sm" onClick={onSave} disabled={isReading}><Save aria-hidden="true" /> Simpan pengaturan</Button>
        </div>
      </header>
      {uploadError && <p role="alert" className="px-4 py-2 text-sm text-destructive">{uploadError}</p>}
      {isReading && <p role="status" className="px-4 py-2 text-sm">Membaca gambar...</p>}

      <div className="santri-id-card-editor__grid">
        <ControlGroup title="Background & logo" description="Gunakan aset milik LPQ. Upload lokal tersimpan untuk browser ini.">
          <div className="santri-id-card-editor__field">
            <Label htmlFor="id-card-background-url">Background kartu</Label>
            <div className="santri-id-card-editor__input-pair"><Input id="id-card-background-url" value={design.backgroundUrl} onChange={(event) => update('backgroundUrl', event.target.value)} /><Button type="button" variant="outline" size="icon" onClick={() => backgroundInputRef.current?.click()} aria-label="Upload background"><Upload aria-hidden="true" /></Button><input ref={backgroundInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBackgroundUpload} hidden /></div>
          </div>
          <div className="santri-id-card-editor__field">
            <Label htmlFor="id-card-logo-url">Logo LPQ pojok kiri atas</Label>
            <div className="santri-id-card-editor__input-pair"><Input id="id-card-logo-url" value={design.logoUrl} placeholder="Gunakan logo LPQ dari konfigurasi" onChange={(event) => update('logoUrl', event.target.value)} /><Button type="button" variant="outline" size="icon" onClick={() => logoInputRef.current?.click()} aria-label="Upload logo"><Upload aria-hidden="true" /></Button><input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} hidden /></div>
          </div>
          <div className="santri-id-card-editor__two-col">
            <div className="santri-id-card-editor__field"><Label>Posisi logo</Label><Select value={design.logoPosition} onValueChange={(value) => update('logoPosition', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="top-left">Kiri atas</SelectItem><SelectItem value="top-center">Tengah atas</SelectItem><SelectItem value="top-right">Kanan atas</SelectItem></SelectContent></Select></div>
            <RangeField label="Ukuran logo" value={design.logoSizeMm} min={7} max={22} unit=" mm" onChange={(value) => update('logoSizeMm', value)} />
          </div>
          <div className="santri-id-card-editor__two-col"><RangeField label="Geser logo kiri ↔ kanan" value={design.logoOffsetXmm} min={-12} max={12} unit=" mm" onChange={(value) => update('logoOffsetXmm', value)} /><RangeField label="Geser logo atas ↕ bawah" value={design.logoOffsetYmm} min={-8} max={8} unit=" mm" onChange={(value) => update('logoOffsetYmm', value)} /></div>
          <div className="santri-id-card-editor__field"><Label htmlFor="id-card-logo-right-url">Logo kanan atas (opsional)</Label><div className="santri-id-card-editor__input-pair"><Input id="id-card-logo-right-url" value={design.logoRightUrl} placeholder="URL atau upload logo kedua" onChange={(event) => update('logoRightUrl', event.target.value)} /><Button type="button" variant="outline" size="icon" onClick={() => logoRightInputRef.current?.click()} aria-label="Upload logo kanan"><Upload aria-hidden="true" /></Button><input ref={logoRightInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleRightLogoUpload} hidden /></div></div>
          <div className="santri-id-card-editor__two-col"><RangeField label="Ukuran logo kanan" value={design.logoRightSizeMm} min={7} max={22} unit=" mm" onChange={(value) => update('logoRightSizeMm', value)} /><RangeField label="Geser logo kanan X" value={design.logoRightOffsetXmm} min={-12} max={12} unit=" mm" onChange={(value) => update('logoRightOffsetXmm', value)} /></div>
          <RangeField label="Geser logo kanan Y" value={design.logoRightOffsetYmm} min={-8} max={8} unit=" mm" onChange={(value) => update('logoRightOffsetYmm', value)} />
        </ControlGroup>

        <ControlGroup title="Nama panggilan" description="Nama dicetak tanpa label tambahan.">
          <div className="santri-id-card-editor__field"><Label>Font nama</Label><Select value={design.nameFontFamily} onValueChange={(value) => update('nameFontFamily', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FONT_OPTIONS.map((font) => <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="santri-id-card-editor__two-col"><ColorField label="Warna nama" value={design.nameColor} onChange={(value) => update('nameColor', value)} /><RangeField label="Ukuran nama" value={design.nameSizePt} min={9} max={18} unit=" pt" onChange={(value) => update('nameSizePt', value)} /></div>
          <RangeField label="Jarak foto → nama" value={design.nameGapMm} min={0} max={8} unit=" mm" step={0.5} onChange={(value) => update('nameGapMm', value)} />
          <RangeField label="Geser nama atas ↕ bawah" value={design.nameOffsetYmm} min={-8} max={8} unit=" mm" step={0.5} onChange={(value) => update('nameOffsetYmm', value)} />
        </ControlGroup>

        <ControlGroup title="Nomor induk" description="Nomor tampil langsung tanpa teks “Nomor Induk Qiroati”.">
          <div className="santri-id-card-editor__field"><Label>Font nomor</Label><Select value={design.numberFontFamily} onValueChange={(value) => update('numberFontFamily', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FONT_OPTIONS.map((font) => <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="santri-id-card-editor__two-col"><ColorField label="Warna nomor" value={design.numberColor} onChange={(value) => update('numberColor', value)} /><RangeField label="Ukuran nomor" value={design.numberSizePt} min={7} max={15} unit=" pt" onChange={(value) => update('numberSizePt', value)} /></div>
          <RangeField label="Jarak nama → nomor" value={design.numberGapMm} min={0} max={8} unit=" mm" step={0.5} onChange={(value) => update('numberGapMm', value)} />
          <RangeField label="Lebar bidang nomor" value={design.numberWidthMm} min={26} max={42} unit=" mm" onChange={(value) => update('numberWidthMm', value)} />
          <RangeField label="Jarak huruf nomor" value={design.numberLetterSpacing} min={0} max={0.18} step={0.01} unit=" em" onChange={(value) => update('numberLetterSpacing', value)} />
        </ControlGroup>

        <ControlGroup title="Foto & QR Code" description="QR dapat dipindahkan ke arah mana pun dari posisi kanan bawah.">
          <RangeField label="Diameter foto" value={design.photoSizeMm} min={22} max={36} unit=" mm" onChange={(value) => update('photoSizeMm', value)} />
          <div className="santri-id-card-editor__two-col"><RangeField label="Geser avatar kiri ↔ kanan" value={design.photoOffsetXmm} min={-12} max={12} unit=" mm" step={0.5} onChange={(value) => update('photoOffsetXmm', value)} /><RangeField label="Geser avatar atas ↕ bawah" value={design.photoOffsetYmm} min={-12} max={12} unit=" mm" step={0.5} onChange={(value) => update('photoOffsetYmm', value)} /></div>
          <div className="santri-id-card-editor__two-col"><ColorField label="Warna border avatar" value={design.photoBorderColor} onChange={(value) => update('photoBorderColor', value)} /><RangeField label="Tebal border avatar" value={design.photoBorderWidthMm} min={0} max={2} unit=" mm" step={0.1} onChange={(value) => update('photoBorderWidthMm', value)} /></div>
          <RangeField label="Ukuran QR" value={design.qrSizeMm} min={10} max={22} unit=" mm" onChange={(value) => update('qrSizeMm', value)} />
          <div className="santri-id-card-editor__two-col"><RangeField label="Jarak kanan QR" value={design.qrRightMm} min={0} max={10} unit=" mm" step={0.5} onChange={(value) => update('qrRightMm', value)} /><RangeField label="Jarak bawah QR" value={design.qrBottomMm} min={0} max={10} unit=" mm" step={0.5} onChange={(value) => update('qrBottomMm', value)} /></div>
          <div className="santri-id-card-editor__two-col"><RangeField label="Geser QR kiri ↔ kanan" value={design.qrOffsetXmm} min={-12} max={12} unit=" mm" step={0.5} onChange={(value) => update('qrOffsetXmm', value)} /><RangeField label="Geser QR atas ↕ bawah" value={design.qrOffsetYmm} min={-12} max={12} unit=" mm" step={0.5} onChange={(value) => update('qrOffsetYmm', value)} /></div>
          <div className="santri-id-card-editor__two-col"><ColorField label="Warna QR" value={design.qrColor} onChange={(value) => update('qrColor', value)} /><ColorField label="Latar QR" value={design.qrBackgroundColor} onChange={(value) => update('qrBackgroundColor', value)} /></div>
        </ControlGroup>

        <ControlGroup title="Bingkai luar" description="Atur warna bingkai dan bentuk sudut kartu.">
          <div className="santri-id-card-editor__switch"><div><strong>Tampilkan border luar</strong><span>Border tidak masuk ke area isi.</span></div><Switch checked={design.showOuterBorder} onCheckedChange={(value) => update('showOuterBorder', value)} /></div>
          <div className="santri-id-card-editor__two-col"><ColorField label="Warna border" value={design.outerBorderColor} onChange={(value) => update('outerBorderColor', value)} /><RangeField label="Tebal border" value={design.outerBorderWidthMm} min={0} max={2} unit=" mm" step={0.1} onChange={(value) => update('outerBorderWidthMm', value)} /></div>
          <RangeField label="Radius sudut" value={design.cardRadiusMm} min={0} max={8} unit=" mm" step={0.5} onChange={(value) => update('cardRadiusMm', value)} />
        </ControlGroup>
      </div>
    </section>
  );
};

export default SantriIdCardLiveEditor;
