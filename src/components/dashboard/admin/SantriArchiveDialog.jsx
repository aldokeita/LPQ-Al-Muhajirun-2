import React, { useEffect, useMemo, useState } from 'react';
import { Archive, GraduationCap, Loader2, RotateCcw, Search, Trash2, UserCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { getArchivedSantri, setSantriArchived, deleteSantriPermanent } from '@/lib/santriArchiveAdapters';
import { getSessionName } from '@/utils/sessionMapping';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';

const SantriArchiveDialog = ({ open, onOpenChange, categories, title = 'Arsip Santri', onRestored }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, ids: [] });
  const categoriesKey = categories.join('|');

  const loadArchive = async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      setRows(await getArchivedSantri(categories));
    } catch (error) {
      toast({ title: 'Gagal memuat arsip', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadArchive();
  }, [open, categoriesKey]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((item) => [
      item.nama_lengkap,
      item.nama_panggilan,
      item.nomor_induk_qiroati,
      item.class_name,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [rows, search]);

  const restore = async (item) => {
    setRestoringId(item.id);
    try {
      await setSantriArchived({ santriId: item.id, archived: false });
      setRows((current) => current.filter((row) => row.id !== item.id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
      await onRestored?.();
      window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));
      toast({
        title: 'Santri dipulihkan',
        description: `${item.nama_lengkap} kembali aktif beserta kelas dan seluruh riwayatnya.`,
      });
    } catch (error) {
      toast({ title: 'Gagal memulihkan santri', description: error.message, variant: 'destructive' });
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeletePermanent = async (ids) => {
    setIsDeleting(true);
    let successCount = 0;
    let failedCount = 0;
    const failedNames = [];

    for (const id of ids) {
      const item = rows.find((r) => r.id === id);
      try {
        await deleteSantriPermanent(id);
        successCount++;
        setRows((current) => current.filter((row) => row.id !== id));
        setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      } catch (err) {
        failedCount++;
        failedNames.push(item?.nama_lengkap || id);
      }
    }

    setIsDeleting(false);
    setConfirmDelete({ open: false, ids: [] });

    if (successCount > 0) {
      window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));
      toast({
        title: failedCount > 0 ? 'Penghapusan Parsial' : 'Berhasil dihapus',
        description: failedCount > 0
          ? `${successCount} berhasil dihapus, ${failedCount} gagal: ${failedNames.join(', ')}`
          : `${successCount} data santri telah dihapus secara permanen.`,
        variant: failedCount > 0 ? 'destructive' : 'default',
      });
    } else {
      toast({
        title: 'Penghapusan Gagal',
        description: failedNames.join(', ') || 'Data gagal dihapus.',
        variant: 'destructive',
      });
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRows.length && filteredRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.id)));
    }
  };

  const allSelected = filteredRows.length > 0 && selectedIds.size === filteredRows.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const selectedCount = selectedIds.size;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[86vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                <Archive className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                  Data akademik, kelas, hafalan, karakter, absensi, dan transaksi tetap tersimpan.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, nomor induk, atau kelas..."
              className="pl-9"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Memuat arsip santri...</p>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center text-muted-foreground">
                <UserCheck className="h-8 w-8" />
                <div>
                  <p className="font-medium text-foreground">Arsip masih kosong</p>
                  <p className="text-sm">Santri yang dinonaktifkan atau dihapus akan muncul di sini.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Select all header */}
                <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
                  <Checkbox
                    id="select-all-archive"
                    checked={allSelected}
                    data-state={someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Pilih semua santri di arsip"
                  />
                  <label htmlFor="select-all-archive" className="text-sm font-medium cursor-pointer select-none">
                    {allSelected ? 'Batalkan semua' : 'Pilih semua'} ({filteredRows.length} santri)
                  </label>
                </div>

                {filteredRows.map((item) => (
                  <article
                    key={item.id}
                    className={`flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center transition-colors ${selectedIds.has(item.id) ? 'border-rose-300 bg-rose-50/30 dark:bg-rose-950/10' : ''}`}
                  >
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                      aria-label={`Pilih ${item.nama_lengkap}`}
                      className="shrink-0 mt-0.5"
                    />
                    <Avatar className="h-11 w-11 border shrink-0">
                      <AvatarImage src={item.foto_url} alt={`Avatar ${item.nama_lengkap}`} />
                      <AvatarFallback>{item.nama_lengkap?.charAt(0) || 'S'}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{item.nama_lengkap}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{item.class_name}</span>
                        <span>{item.jilid || 'Jilid belum diatur'}</span>
                        <span>{getSessionName(item.sesi_mengaji) || 'Sesi belum diatur'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={restoringId === item.id || isDeleting}
                        onClick={() => restore(item)}
                      >
                        {restoringId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                        Pulihkan
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={restoringId === item.id || isDeleting}
                        onClick={() => setConfirmDelete({ open: true, ids: [item.id] })}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 hover:border-rose-300"
                        aria-label={`Hapus permanen ${item.nama_lengkap}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Footer bulk delete */}
          {selectedCount > 0 && (
            <div className="border-t pt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-rose-600">{selectedCount}</span> santri dipilih
              </p>
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={() => setConfirmDelete({ open: true, ids: Array.from(selectedIds) })}
                className="gap-2"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Hapus Permanen ({selectedCount})
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, ids: [] })}
        onConfirm={() => handleDeletePermanent(confirmDelete.ids)}
        title="Hapus Permanen Santri?"
        description={
          confirmDelete.ids.length === 1
            ? `Data santri ini akan dihapus secara permanen termasuk akun login, riwayat hafalan, absensi, pembayaran, dan semua data terkait. Tindakan ini tidak dapat dibatalkan.`
            : `${confirmDelete.ids.length} data santri yang dipilih akan dihapus secara permanen termasuk semua riwayat terkait. Tindakan ini tidak dapat dibatalkan.`
        }
        confirmText={isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
        variant="destructive"
      />
    </>
  );
};

export default SantriArchiveDialog;
