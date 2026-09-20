import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight, Loader2, Star, Trophy } from 'lucide-react';
import { LEADERBOARD_PAGE_SIZE, fetchSantriLeaderboardPage } from '@/lib/santriLeaderboardAdapters';
import { resolveAvatarUrl } from '@/lib/storageAdapters';

/**
 * Papan peringkat poin seluruh santri, sepuluh per halaman.
 *
 * Dipakai bersama oleh kios absensi dan dasbor guru. Dibuat sebagai dialog, bukan
 * halaman tersendiri, supaya kios tidak perlu meninggalkan layar pindai hanya untuk
 * melihat peringkat lalu kembali lagi.
 */
const SantriLeaderboardDialog = ({ open, onOpenChange }) => {
  const [halaman, setHalaman] = useState(1);
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(null);

  const muat = useCallback(async (nomor) => {
    setMemuat(true);
    setGalat(null);
    try {
      const hasil = await fetchSantriLeaderboardPage({ page: nomor, pageSize: LEADERBOARD_PAGE_SIZE });
      // Avatar diresolusi per halaman, jadi yang dihitung hanya sepuluh baris
      // yang benar-benar tampil.
      const baris = await Promise.all(hasil.rows.map(async (santri) => ({
        ...santri,
        foto: await resolveAvatarUrl({
          ownerType: 'santri',
          ownerId: santri.id,
          avatarPath: santri.avatar_path,
          fallbackUrl: santri.foto_url,
        }),
      })));
      setData({ ...hasil, rows: baris });
    } catch (error) {
      setGalat(error?.message || 'Papan peringkat gagal dimuat.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    muat(halaman);
  }, [open, halaman, muat]);

  // Dibuka kembali selalu dari halaman pertama; peringkat teratas yang paling
  // sering ingin dilihat, bukan halaman terakhir yang kebetulan tersisa.
  useEffect(() => {
    if (open) setHalaman(1);
  }, [open]);

  const totalHalaman = data?.totalPages ?? 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Papan Peringkat Poin
          </DialogTitle>
          <DialogDescription>
            {data
              ? `${data.total} santri aktif, diurutkan dari poin terbanyak.`
              : 'Seluruh santri aktif, diurutkan dari poin terbanyak.'}
          </DialogDescription>
        </DialogHeader>

        {galat ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-destructive">{galat}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => muat(halaman)}>
              Coba lagi
            </Button>
          </div>
        ) : (
          <>
            {/* Tinggi daftar dikunci setinggi sepuluh baris supaya dialognya tidak
                melonjak-lonjak saat berpindah halaman atau saat memuat. */}
            <div className="relative min-h-[26rem]">
              {memuat && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {data?.rows?.length === 0 && !memuat ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Belum ada santri aktif yang bisa diperingkat.
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {(data?.rows || []).map((santri, index) => {
                    const peringkat = (data?.startRank ?? 1) + index;
                    const tigaTeratas = peringkat <= 3;
                    return (
                      <li
                        key={santri.id}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                          tigaTeratas
                            ? 'border-amber-300/70 bg-amber-50 dark:border-amber-400/25 dark:bg-amber-950/25'
                            : 'border-border/60 bg-muted/30'
                        }`}
                      >
                        <span
                          className={`w-7 shrink-0 text-center text-sm font-black tabular-nums ${
                            tigaTeratas ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                          }`}
                        >
                          {peringkat}
                        </span>
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={santri.foto} alt="" className="object-cover" />
                          <AvatarFallback className="text-xs font-bold">
                            {santri.nama_lengkap?.charAt(0)?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold leading-tight">{santri.nama_lengkap}</p>
                          <p className="truncate text-xs text-muted-foreground">{santri.jilid || '-'}</p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-black tabular-nums">
                          <Star className="h-3.5 w-3.5 text-amber-500" />
                          {santri.points ?? 0}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHalaman((n) => Math.max(1, n - 1))}
                disabled={memuat || halaman <= 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Sebelumnya
              </Button>
              <span className="text-xs font-semibold text-muted-foreground">
                Halaman {data?.page ?? halaman} dari {totalHalaman}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHalaman((n) => Math.min(totalHalaman, n + 1))}
                disabled={memuat || halaman >= totalHalaman}
              >
                Berikutnya <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SantriLeaderboardDialog;
