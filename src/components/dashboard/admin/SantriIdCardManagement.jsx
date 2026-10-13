import React, { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  CreditCard,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import AdminEmptyState from '@/components/dashboard/shared/AdminEmptyState';
import AdminErrorState from '@/components/dashboard/shared/AdminErrorState';
import SantriIdCardLiveEditor from '@/components/dashboard/admin/SantriIdCardLiveEditor';
import { getAllSessions, getSessionName } from '@/utils/sessionMapping';
import { fetchIdCardBranding, fetchSantriForIdCards } from '@/lib/santriIdCardAdapters';
import { filterIdCardSantri, toggleFilteredIdCardSelection } from '@/lib/santriIdCardSelection';
import {
  buildIdCardPrintHtml,
  DEFAULT_ID_CARD_DESIGN,
  getIdCardPaperConfig,
  ID_CARD_PAPER_OPTIONS,
  normalizeIdCardDesign,
  waitForIdCardAssets,
} from '@/lib/santriIdCardPrint';
import '@/styles/santri-id-card.css';

const getInitial = (name) => String(name || 'S').trim().charAt(0).toUpperCase() || 'S';

const normalizeEntryDate = (value) => String(value || '').slice(0, 10);

const formatEntryDate = (value) => {
  const normalized = normalizeEntryDate(value);
  if (!normalized) return 'Tanggal masuk belum diatur';

  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Tanggal masuk belum diatur';

  return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const SantriIdCardManagement = () => {
  const { role, loading: authLoading } = useAuth();
  const [santri, setSantri] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [filters, setFilters] = useState({ search: '', kategori: 'all', tanggalMasuk: 'newest', sesi: 'all' });
  const [paperSize, setPaperSize] = useState('A4');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lpqLogoUrl, setLpqLogoUrl] = useState('');
  const [rightLogoUrl, setRightLogoUrl] = useState('');
  const [design, setDesign] = useState(() => {
    try {
      const saved = window.localStorage.getItem('lpq_al_muhajirun_santri_id_card_design');
      return normalizeIdCardDesign(saved ? JSON.parse(saved) : DEFAULT_ID_CARD_DESIGN);
    } catch {
      return normalizeIdCardDesign(DEFAULT_ID_CARD_DESIGN);
    }
  });
  const [qrDataUrls, setQrDataUrls] = useState({});
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrError, setQrError] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);

  const loadSantri = useCallback(async () => {
    if (role !== 'admin') return;
    setIsLoading(true);
    setError('');
    try {
      const [data, branding] = await Promise.all([
        fetchSantriForIdCards(),
        fetchIdCardBranding(),
      ]);
      setSantri(data || []);
      setLpqLogoUrl(branding.logoUrl);
      setRightLogoUrl(branding.logoRightUrl);
      setSelectedIds((current) => new Set([...current].filter((id) => data.some((row) => row.id === id))));
    } catch (loadError) {
      setSantri([]);
      setError(loadError.message || 'Gagal memuat data santri untuk ID Card.');
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    loadSantri();
  }, [loadSantri]);

  const filteredSantri = useMemo(() => filterIdCardSantri(santri, filters), [filters, santri]);
  const sessions = useMemo(() => [...new Set([...getAllSessions().map((session) => session.name), ...santri.map((row) => getSessionName(row.sesi_mengaji)).filter(Boolean)])], [santri]);

  const selectedSantri = useMemo(
    () => santri.filter((item) => selectedIds.has(item.id)),
    [santri, selectedIds],
  );

  const paperConfig = getIdCardPaperConfig(paperSize);
  const allFilteredSelected = filteredSantri.length > 0 && filteredSantri.every((item) => selectedIds.has(item.id));
  const designForRender = useMemo(() => {
    const next = {
      ...design,
      logoUrl: design.logoUrl || lpqLogoUrl,
      logoRightUrl: design.logoRightUrl || rightLogoUrl,
    };
    if (next.backgroundUrl && typeof window !== 'undefined' && !/^(?:https?:|data:image\/)/i.test(next.backgroundUrl)) {
      try {
        next.backgroundUrl = new URL(next.backgroundUrl, window.location.origin).href;
      } catch {
        // Keep the original path; the print renderer will show its fallback.
      }
    }
    return next;
  }, [design, lpqLogoUrl, rightLogoUrl]);

  useEffect(() => {
    let cancelled = false;
    const qrDesign = designForRender;
    setQrError('');

    if (selectedSantri.length === 0) {
      setQrDataUrls({});
      setIsGeneratingQr(false);
      return undefined;
    }

    setIsGeneratingQr(true);
    if (qrDesign.qrColor === qrDesign.qrBackgroundColor) {
      setQrError('Warna QR harus berbeda dari warna latarnya agar dapat dipindai.');
      setIsGeneratingQr(false);
      return undefined;
    }
    Promise.all(selectedSantri.map(async (item) => {
      if (!item.nomor_induk_qiroati) return [item.id, ''];
      try {
        const dataUrl = await QRCode.toDataURL(String(item.nomor_induk_qiroati), {
          width: 160,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: qrDesign.qrColor,
            light: qrDesign.qrBackgroundColor,
          },
        });
        return [item.id, dataUrl];
      } catch {
        if (!cancelled) setQrError('Sebagian QR belum dapat dibuat. Coba muat ulang atau kurangi jumlah pilihan.');
        return [item.id, ''];
      }
    })).then((entries) => {
      if (!cancelled) setQrDataUrls(Object.fromEntries(entries));
    }).finally(() => {
      if (!cancelled) setIsGeneratingQr(false);
    });

    return () => { cancelled = true; };
  }, [designForRender.qrBackgroundColor, designForRender.qrColor, selectedSantri]);

  const toggleSantri = (santriId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(santriId)) next.delete(santriId);
      else next.add(santriId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((current) => toggleFilteredIdCardSelection(current, filteredSantri));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handlePrint = async () => {
    if (selectedSantri.length === 0 || isGeneratingQr || isPrinting || qrError) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Jendela cetak diblokir', description: 'Izinkan pop-up untuk membuka pratinjau cetak.', variant: 'destructive' });
      return;
    }

    setIsPrinting(true);
    try {
      const html = buildIdCardPrintHtml({
        cards: selectedSantri,
        designConfig: designForRender,
        logoUrl: designForRender.logoUrl,
        paperSize,
        qrDataUrls,
        baseUrl: window.location.origin,
      });
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      await waitForIdCardAssets(printWindow.document);
      if (!printWindow.closed) { printWindow.focus(); printWindow.print(); }
    } catch (printError) {
      toast({ title: 'Cetak belum siap', description: printError.message, variant: 'destructive' });
    } finally { setIsPrinting(false); }
  };

  const saveDesign = () => {
    try {
      window.localStorage.setItem('lpq_al_muhajirun_santri_id_card_design', JSON.stringify(design));
      toast({ title: 'Pengaturan disimpan', description: 'Kustomisasi ID Card tersimpan di browser ini.' });
    } catch {
      toast({ title: 'Gagal menyimpan', description: 'Browser tidak mengizinkan penyimpanan pengaturan.', variant: 'destructive' });
    }
  };

  const resetDesign = () => {
    setDesign(normalizeIdCardDesign(DEFAULT_ID_CARD_DESIGN));
    try { window.localStorage.removeItem('lpq_al_muhajirun_santri_id_card_design'); } catch { /* storage may be unavailable */ }
  };

  if (authLoading) return <div role="status">Memuat akses ID Card...</div>;
  if (role !== 'admin') {
    return <AdminErrorState message="ID Card Santri hanya dapat diakses oleh administrator." />;
  }

  return (
    <section className="santri-id-card" aria-labelledby="santri-id-card-title">
      <header className="santri-id-card__hero">
        <div className="santri-id-card__hero-copy">
          <span className="santri-id-card__hero-icon"><CreditCard aria-hidden="true" /></span>
          <div>
            <p className="santri-id-card__eyebrow">Administrasi · Identitas santri</p>
            <h2 id="santri-id-card-title">ID Card Santri</h2>
            <p>Pilih santri TPQ aktif untuk membuat kartu identitas yang siap dicetak.</p>
          </div>
        </div>
        <div className="santri-id-card__privacy"><ShieldCheck aria-hidden="true" /><span>Data aktual<br /><strong>Tidak disimpan ulang</strong></span></div>
      </header>

      {error && <AdminErrorState message={error} onRetry={loadSantri} className="mb-5" />}
      {qrError && <AdminErrorState message={qrError} />}
      {previewError && <AdminErrorState message={previewError} />}
      {isLoading && <div role="status" className="santri-id-card__loading">Memuat santri dan logo...</div>}

      <div className="santri-id-card__toolbar" aria-label="Filter santri untuk ID Card">
        <div className="santri-id-card__search">
          <Search aria-hidden="true" />
          <Input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Cari nama atau nomor induk…"
            aria-label="Cari santri untuk ID Card"
          />
        </div>
        <Select value={filters.tanggalMasuk} onValueChange={(value) => setFilters((current) => ({ ...current, tanggalMasuk: value }))}>
          <SelectTrigger aria-label="Urutan tanggal masuk"><SelectValue placeholder="Tanggal masuk" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Masuk terbaru</SelectItem>
            <SelectItem value="oldest">Masuk terlama</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.sesi} onValueChange={(value) => setFilters((current) => ({ ...current, sesi: value }))}>
          <SelectTrigger aria-label="Filter sesi mengaji"><SelectValue placeholder="Sesi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua sesi</SelectItem>
            {sessions.map((session) => <SelectItem key={session} value={session}>{session}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="santri-id-card__workspace">
        <div className="santri-id-card__preview-panel">
          <div className="santri-id-card__preview-header">
            <div className="santri-id-card__preview-heading">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSelectionOpen(true)}
                className="santri-id-card__selection-trigger"
                aria-haspopup="dialog"
                aria-expanded={isSelectionOpen}
              >
                <Users aria-hidden="true" />
                <span>Seleksi Santri</span>
                <strong aria-live="polite">{selectedSantri.length}</strong>
              </Button>
              <div><p>Preview & cetak</p><h3>{selectedSantri.length === 0 ? 'Belum ada kartu dipilih' : `${selectedSantri.length} ID Card siap dibuat`}</h3></div>
            </div>
            <div className="santri-id-card__paper-controls">
              <Select value={paperSize} onValueChange={setPaperSize}>
                <SelectTrigger aria-label="Pilih ukuran kertas"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ID_CARD_PAPER_OPTIONS).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" onClick={handlePrint} disabled={selectedSantri.length === 0 || isGeneratingQr || isPrinting || !!qrError || isLoading} className="santri-id-card__print-button" aria-label={`Cetak ${selectedSantri.length} ID Card`}><Printer aria-hidden="true" />{isPrinting ? 'Menyiapkan cetak...' : isGeneratingQr ? 'Menyiapkan QR…' : 'Cetak'}</Button>
            </div>
          </div>
          <div className="santri-id-card__print-status" role="status">
            <span><CreditCard aria-hidden="true" /><strong>{paperConfig.label} · {paperConfig.orientation}</strong></span>
            <span>{paperConfig.cardsPerPage} kartu per halaman · 53,8 × 86 mm · cetak skala 100%</span>
          </div>
          <SantriIdCardLiveEditor design={design} onChange={setDesign} onReset={resetDesign} onSave={saveDesign} />
          {selectedSantri.length === 0 ? (
            <AdminEmptyState icon={CreditCard} title="Pilih santri untuk melihat preview" description="ID Card dapat dibuat untuk satu santri atau seluruh hasil filter." />
          ) : (
            <iframe
              title="Preview ID Card santri"
              sandbox="allow-same-origin"
              onLoad={(event) => {
                setPreviewError('');
                waitForIdCardAssets(event.currentTarget.contentDocument).catch((error) => setPreviewError(error.message));
              }}
              className="santri-id-card__preview-frame"
              srcDoc={buildIdCardPrintHtml({ cards: selectedSantri, designConfig: designForRender, logoUrl: designForRender.logoUrl, paperSize, qrDataUrls, preview: true, baseUrl: window.location.origin })}
            />
          )}
        </div>
      </div>

      <Dialog open={isSelectionOpen} onOpenChange={setIsSelectionOpen}>
        <DialogContent className="santri-id-card__selection-dialog">
          <DialogHeader>
            <DialogTitle className="santri-id-card__selection-dialog-title"><Users aria-hidden="true" /> Seleksi Santri</DialogTitle>
            <DialogDescription>{filteredSantri.length} hasil sesuai filter · {selectedSantri.length} santri dipilih</DialogDescription>
          </DialogHeader>

          <div className="santri-id-card__search">
            <Search aria-hidden="true" />
            <Input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Cari nama lengkap, panggilan, atau nomor induk…"
              aria-label="Cari santri dalam modal seleksi"
              autoFocus
            />
          </div>

          <div className="santri-id-card__selection-actions">
            <Button type="button" variant="outline" size="sm" onClick={toggleSelectAllFiltered} disabled={filteredSantri.length === 0}>
              {allFilteredSelected ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}
              {allFilteredSelected ? 'Batalkan hasil' : 'Pilih semua hasil'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection} disabled={selectedSantri.length === 0}>Deselect all</Button>
          </div>

          {isLoading ? (
            <div className="santri-id-card__loading" role="status" aria-live="polite"><RefreshCw className="animate-spin" aria-hidden="true" /> Memuat data santri…</div>
          ) : filteredSantri.length === 0 ? (
            <AdminEmptyState icon={Users} title="Santri tidak ditemukan" description="Coba ubah pencarian atau filter yang digunakan." />
          ) : (
            <div className="santri-id-card__list santri-id-card__selection-list" tabIndex={0} role="region" aria-label="Daftar santri TPQ, dapat digulir">
              {filteredSantri.map((item) => (
                <label key={item.id} className={`santri-id-card__student ${selectedIds.has(item.id) ? 'is-selected' : ''}`}>
                  <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSantri(item.id)} aria-label={`Pilih ${item.nama_lengkap}`} />
                  <span className="santri-id-card__student-avatar">
                    <span aria-hidden="true">{getInitial(item.nama_lengkap)}</span>
                    {item.foto_url && <img src={item.foto_url} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
                  </span>
                  <span className="santri-id-card__student-copy"><strong>{item.nama_lengkap || 'Tanpa nama'}</strong><small>{item.nomor_induk_qiroati || 'Nomor induk belum tersedia'} · {getSessionName(item.sesi_mengaji) || 'Sesi belum diatur'} · Masuk {formatEntryDate(item.tanggal_pendaftaran)}</small></span>
                </label>
              ))}
            </div>
          )}

          <DialogFooter className="santri-id-card__selection-dialog-footer">
            <Button type="button" onClick={() => setIsSelectionOpen(false)}>Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default SantriIdCardManagement;
