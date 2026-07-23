import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  School,
  User,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import {
  fetchGuruTransferClassOptions,
  getClassTransferErrorMessage,
  transferSantriByGuru,
} from '@/lib/classTransferAdapters';
import { cn } from '@/lib/utils';

const sessionOrder = ['Pagi', 'Pagi 2', 'Siang', 'Sore', 'Malam'];

const classSort = (a, b) => {
  const aIndex = sessionOrder.indexOf(a.sesi);
  const bIndex = sessionOrder.indexOf(b.sesi);
  const safeA = aIndex === -1 ? sessionOrder.length : aIndex;
  const safeB = bIndex === -1 ? sessionOrder.length : bIndex;
  return safeA - safeB || String(a.nama_kelas || '').localeCompare(String(b.nama_kelas || ''), 'id');
};

const StudentTransferModal = ({ isOpen, onClose, santri, onTransferSuccess }) => {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isConfirmation, setIsConfirmation] = useState(false);

  const loadClasses = useCallback(async () => {
    if (!santri?.id) return;
    setStatus('loading');
    setErrorMessage('');
    try {
      const result = await fetchGuruTransferClassOptions(santri.id);
      setClasses(result.sort(classSort));
      setStatus('ready');
    } catch (error) {
      setClasses([]);
      setErrorMessage(getClassTransferErrorMessage(error));
      setStatus('error');
    }
  }, [santri?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedClassId('');
    setReason('');
    setIsConfirmation(false);
    loadClasses();
  }, [isOpen, loadClasses]);

  const currentClass = useMemo(
    () => classes.find((item) => item.is_current) || santri?.class || null,
    [classes, santri?.class],
  );
  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId],
  );
  const selectableClasses = useMemo(
    () => classes.filter((item) => item.is_selectable),
    [classes],
  );

  const closeModal = () => {
    if (status === 'submitting') return;
    onClose();
  };

  const submitTransfer = async () => {
    if (!selectedClass || !santri?.id) return;
    setStatus('submitting');
    setErrorMessage('');
    try {
      const result = await transferSantriByGuru({
        santriId: santri.id,
        targetClassId: selectedClass.id,
        reason: reason || `Transfer dari ${currentClass?.nama_kelas || 'kelas asal'} ke ${selectedClass.nama_kelas}`,
      });
      toast({
        title: 'Transfer kelas berhasil',
        description: `${santri.nama_lengkap} sekarang berada di ${selectedClass.nama_kelas}.`,
      });
      onClose();
      try {
        await onTransferSuccess?.(result);
      } catch {
        toast({
          title: 'Daftar kelas perlu dimuat ulang',
          description: 'Transfer sudah tersimpan. Muat ulang halaman bila daftar belum berubah.',
        });
      }
    } catch (error) {
      const friendlyMessage = getClassTransferErrorMessage(error);
      setErrorMessage(friendlyMessage);
      setStatus('error');
      toast({ title: 'Transfer kelas gagal', description: friendlyMessage, variant: 'destructive' });
    }
  };

  if (!santri) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
      <DialogContent className="guru-transfer-glass flex h-[min(94dvh,760px)] min-h-0 w-[calc(100%-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="guru-transfer-glass__header px-4 py-5 text-left sm:px-7 sm:py-6">
          <div className="flex items-start gap-3">
            <span className="guru-transfer-glass__hero-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
              <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-black tracking-tight sm:text-2xl">
                {isConfirmation ? 'Konfirmasi transfer kelas' : 'Transfer kelas santri'}
              </DialogTitle>
              <DialogDescription className="mt-1 leading-relaxed">
                {isConfirmation
                  ? 'Periksa perpindahan sebelum menyimpan. Riwayat mutasi akan dicatat otomatis.'
                  : 'Pilih kelas aktif dengan kategori yang sama. Kelas asal tidak dapat dipilih kembali.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="guru-transfer-glass__profile-wrap px-4 py-4 sm:px-7">
          <div className="guru-transfer-glass__profile flex items-center gap-3 p-3.5 sm:gap-4 sm:p-4">
            <Avatar className="guru-transfer-glass__avatar h-14 w-14 shrink-0 sm:h-16 sm:w-16">
              <AvatarImage src={santri.foto_url} className="object-cover" />
              <AvatarFallback className="bg-cyan-100 font-black text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100">
                {santri.nama_lengkap?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-foreground sm:text-lg">{santri.nama_lengkap}</p>
              <div className="guru-transfer-glass__profile-meta mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold sm:text-xs">
                <span>{santri.jilid || 'Jilid belum diatur'}</span>
                <span className="inline-flex items-center gap-1"><School className="h-3.5 w-3.5" />{currentClass?.nama_kelas || 'Kelas asal tidak ditemukan'}</span>
                <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Sesi {santri.sesi_mengaji || currentClass?.sesi || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {isConfirmation ? (
          <div className="guru-transfer-glass__body guru-transfer-glass__confirmation min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
            <div className="guru-transfer-glass__path grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="guru-transfer-glass__path-card is-origin p-4 sm:p-5">
                <p className="guru-transfer-glass__eyebrow">Kelas asal</p>
                <p className="mt-2 font-black">{currentClass?.nama_kelas || '-'}</p>
                <p className="mt-1 text-xs text-muted-foreground">Sesi {currentClass?.sesi || santri.sesi_mengaji || '-'}</p>
              </div>
              <span className="guru-transfer-glass__path-arrow mx-auto flex h-10 w-10 items-center justify-center rounded-full" aria-hidden="true">
                <ArrowRight className="h-5 w-5 rotate-90 sm:rotate-0" />
              </span>
              <div className="guru-transfer-glass__path-card is-target p-4 sm:p-5">
                <p className="guru-transfer-glass__eyebrow">Kelas tujuan</p>
                <p className="mt-2 font-black">{selectedClass?.nama_kelas}</p>
                <p className="mt-1 text-xs text-muted-foreground">Sesi {selectedClass?.sesi || '-'} · {selectedClass?.guru_name || 'Guru belum ditentukan'}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <label htmlFor="class-transfer-reason" className="text-sm font-bold">Alasan transfer <span className="font-normal text-muted-foreground">(opsional)</span></label>
              <Textarea
                id="class-transfer-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value.slice(0, 500))}
                placeholder="Contoh: Penyesuaian jadwal belajar"
                className="guru-transfer-glass__textarea min-h-[96px] resize-none"
                disabled={status === 'submitting'}
              />
              <p className="text-right text-xs text-muted-foreground">{reason.length}/500</p>
            </div>

            {errorMessage && (
              <div role="alert" className="guru-transfer-glass__state guru-transfer-glass__state--error mt-4 flex gap-3 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}
          </div>
        ) : (
          <div
            tabIndex={0}
            aria-label="Pilihan kelas tujuan"
            className="guru-transfer-glass__scroll min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain outline-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500"
          >
            <div className="px-5 py-5 sm:px-7">
              {status === 'loading' && (
                <div role="status" className="guru-transfer-glass__state flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                  <p>Memuat pilihan kelas aktif...</p>
                </div>
              )}

              {status === 'error' && (
                <div role="alert" className="guru-transfer-glass__state guru-transfer-glass__state--error flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <div><p className="font-bold">Pilihan kelas belum dapat dimuat</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{errorMessage}</p></div>
                  <Button type="button" variant="outline" onClick={loadClasses}><RefreshCw className="mr-2 h-4 w-4" />Coba lagi</Button>
                </div>
              )}

              {status === 'ready' && selectableClasses.length === 0 && (
                <div className="guru-transfer-glass__state flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center">
                  <School className="h-9 w-9 text-muted-foreground" />
                  <div><p className="font-bold">Belum ada kelas tujuan</p><p className="mt-1 text-sm text-muted-foreground">Tidak ditemukan kelas aktif lain dengan kategori yang sama.</p></div>
                </div>
              )}

              {status === 'ready' && classes.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {classes.map((kelas) => {
                    const isSelected = selectedClassId === kelas.id;
                    const isDisabled = !kelas.is_selectable;
                    return (
                      <button
                        key={kelas.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setSelectedClassId(kelas.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          'guru-transfer-glass__class-card min-h-[116px] p-4 text-left focus-visible:outline-none',
                          isDisabled && 'is-current cursor-not-allowed',
                          isSelected && 'is-selected',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0"><p className="truncate font-black">{kelas.nama_kelas}</p><Badge variant="outline" className="mt-2">Sesi {kelas.sesi || '-'}</Badge></div>
                          {isSelected && <span className="guru-transfer-glass__selected-mark inline-flex shrink-0 items-center gap-1 text-[10px] font-black uppercase"><CheckCircle2 className="h-4 w-4" />Dipilih</span>}
                          {isDisabled && <Badge variant="secondary" className="shrink-0">Kelas asal</Badge>}
                        </div>
                        <p className="mt-3 flex items-center gap-1.5 truncate text-xs text-muted-foreground"><User className="h-3.5 w-3.5" />{kelas.guru_name || 'Guru belum ditentukan'}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="guru-transfer-glass__footer px-4 py-4 sm:px-7">
          {isConfirmation ? (
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="guru-transfer-glass__secondary" onClick={() => { setIsConfirmation(false); setStatus('ready'); setErrorMessage(''); }} disabled={status === 'submitting'}>Kembali</Button>
              <Button type="button" onClick={submitTransfer} disabled={status === 'submitting'} className="guru-transfer-glass__primary min-w-[168px]">
                {status === 'submitting' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memindahkan...</> : <><ArrowRightLeft className="mr-2 h-4 w-4" />Konfirmasi transfer</>}
              </Button>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className={cn('guru-transfer-glass__selection-summary min-w-0', selectedClass && 'is-visible')} aria-live="polite">
                <span className="block text-[10px] font-black uppercase tracking-[0.16em]">Tujuan dipilih</span>
                <strong className="mt-0.5 block truncate text-sm">{selectedClass ? `${selectedClass.nama_kelas} · Sesi ${selectedClass.sesi || '-'}` : 'Pilih salah satu kelas tujuan'}</strong>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="guru-transfer-glass__secondary" onClick={closeModal}>Batal</Button>
                <Button type="button" onClick={() => setIsConfirmation(true)} disabled={!selectedClassId || status !== 'ready'} className="guru-transfer-glass__primary min-w-[148px]">
                  Lanjutkan <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudentTransferModal;
