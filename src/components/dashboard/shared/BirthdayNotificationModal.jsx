import React from 'react';
import { Cake, MessageCircle, PartyPopper } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildBirthdayWhatsappUrl } from '@/lib/birthdayUtils';

const BirthdayNotificationModal = ({ isOpen, onClose, students = [] }) => {
  const openWhatsappGreeting = (student) => {
    const url = buildBirthdayWhatsappUrl(student);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
        <DialogHeader className="border-b border-slate-200 pb-4 text-left dark:border-white/10">
          <DialogTitle className="flex items-center gap-2 text-2xl font-black text-slate-900 dark:text-white">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
              <Cake className="h-5 w-5" />
            </span>
            Ulang Tahun Hari Ini
          </DialogTitle>
          <DialogDescription>
            Kirim ucapan hangat kepada wali santri dari kelas yang Anda ampu.
          </DialogDescription>
        </DialogHeader>

        {students.length > 0 ? (
          <div className="space-y-3 py-2">
            {students.map((student) => {
              const hasWhatsapp = Boolean(buildBirthdayWhatsappUrl(student));
              return (
                <article key={student.id} className="flex flex-col gap-4 rounded-lg border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-400/20 dark:bg-slate-900 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12 border-2 border-rose-300">
                        <AvatarImage src={student.foto_url} className="object-cover" />
                        <AvatarFallback>{student.nama_lengkap?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-white">
                        <PartyPopper className="h-3 w-3" />
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900 dark:text-white">{student.nama_lengkap}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{student.age} tahun</Badge>
                        <Badge variant="outline">{student.class?.nama_kelas || 'Kelas LPQ'}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openWhatsappGreeting(student)}
                    disabled={!hasWhatsapp}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    title={hasWhatsapp ? `Kirim ucapan untuk ${student.nama_lengkap}` : 'Nomor WhatsApp wali belum tersedia'}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" /> Ucapkan
                  </Button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <Cake className="mb-3 h-9 w-9 opacity-30" />
            <p className="font-semibold text-foreground">Belum ada ulang tahun hari ini</p>
            <p className="mt-1 text-sm">Ucapan WhatsApp akan tersedia saat ada santri yang berulang tahun.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BirthdayNotificationModal;
