import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/customSupabaseClient';
import { Trash2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const MmqSection = ({ open, onOpenChange, guru }) => {
  const { user: currentUser, role: currentUserRole } = useAuth();
  const [rfidInput, setRfidInput] = useState('');
  const [notulenTitle, setNotulenTitle] = useState('');
  const [notulenText, setNotulenText] = useState('');
  const [allGuru, setAllGuru] = useState([]);
  const [history, setHistory] = useState([]);
  const [notulenList, setNotulenList] = useState([]);
  const [selectedNotulen, setSelectedNotulen] = useState(null);
  const rfidInputRef = useRef(null);

  const loadData = useCallback(async () => {
    const { data: historyData } = await supabase.from('mmq_absensi').select('*, guru:guru_id(id, nama)').order('tanggal_absensi', { ascending: false });
    const { data: notulenData } = await supabase.from('mmq_notulensi').select('*, notulen:notulen_id(nama)').order('tanggal', { ascending: false });
    const { data: guruData } = await supabase.from('guru').select('*').order('nama');
    if (historyData) setHistory(historyData);
    if (notulenData) setNotulenList(notulenData);
    if (guruData) setAllGuru(guruData);
  }, []);

  useEffect(() => {
    if (open) { loadData(); setTimeout(() => rfidInputRef.current?.focus(), 100); }
  }, [open, loadData]);

  const handleRfidAbsen = async (e) => {
    e.preventDefault(); if (!rfidInput) return;
    const { data: targetGuru } = await supabase.from('guru').select('id, nama').eq('rfid_tag', rfidInput).single();
    if (!targetGuru) { toast({ title: "Gagal", description: "RFID tidak terdaftar.", variant: "destructive" }); setRfidInput(''); return; }

    const now = new Date();
    const day = now.getDay(); const hours = now.getHours(); const minutes = now.getMinutes();

    if (day !== 5) { toast({ title: "Info", description: "Absensi MMQ hanya dibuka pada hari Jumat.", variant: "default" }); return; }
    if (!((hours === 9 && minutes >= 30) || (hours === 10 && minutes <= 30))) { toast({ title: "Info", description: "Absensi MMQ dibuka dari 09:30 hingga 10:30 WIB.", variant: "default" }); return; }

    const today = now.toISOString().split('T')[0];
    const { data: existingAbsen } = await supabase.from('mmq_absensi').select('id').eq('guru_id', targetGuru.id).eq('tanggal_absensi', today).single();
    if (existingAbsen) { toast({ title: "Info", description: `${targetGuru.nama} sudah absen hari ini.` }); setRfidInput(''); return; }

    const { error } = await supabase.from('mmq_absensi').insert({ guru_id: targetGuru.id, tanggal_absensi: today, status: 'Hadir', dikirim_oleh: currentUser.id });
    if (error) { toast({ title: "Absen Gagal", description: error.message, variant: "destructive" });
    } else { toast({ title: "Absen Berhasil!", description: `Selamat datang, ${targetGuru.nama}!` }); loadData(); }
    setRfidInput('');
  };

  const handleManualAbsen = async (guruId, guruName) => {
    if (!window.confirm(`Konfirmasi kehadiran untuk ${guruName} hari ini?`)) return;
    const today = new Date().toISOString().split('T')[0];
    const { data: existingAbsen } = await supabase.from('mmq_absensi').select('id').eq('guru_id', guruId).eq('tanggal_absensi', today).single();
    if (existingAbsen) { toast({ title: "Info", description: `${guruName} sudah tercatat hadir hari ini.` }); return; }

    const { error } = await supabase.from('mmq_absensi').insert({ guru_id: guruId, tanggal_absensi: today, status: 'Hadir (Manual)', dikirim_oleh: currentUser.id });
    if (error) { toast({ title: "Gagal", description: error.message, variant: "destructive"}); }
    else { toast({ title: "Berhasil", description: `Kehadiran ${guruName} telah dikonfirmasi.`}); loadData(); }
  };

  const handleSaveNotulen = async () => {
    if (!notulenText || !notulenTitle) return toast({ title: "Gagal", description: "Judul dan isi notulensi tidak boleh kosong.", variant: "destructive" });
    const { error } = await supabase.from('mmq_notulensi').insert({ notulen_id: guru.id, tanggal: new Date().toISOString(), judul: notulenTitle, isi: notulenText });
    if (error) { toast({ title: "Gagal Menyimpan", description: error.message, variant: "destructive" });
    } else { toast({ title: "Sukses!", description: "Notulensi berhasil disimpan." }); setNotulenText(''); setNotulenTitle(''); loadData(); }
  };

  const handleDeleteNotulen = async (notulenId) => {
    if (window.confirm('Anda yakin ingin menghapus notulensi ini?')) {
      const { error } = await supabase.from('mmq_notulensi').delete().eq('id', notulenId);
      if (error) { toast({ title: 'Gagal Menghapus', description: error.message, variant: 'destructive' });
      } else { toast({ title: 'Berhasil', description: 'Notulensi telah dihapus.' }); loadData(); setSelectedNotulen(null); }
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = history.filter(h => h.tanggal_absensi === todayStr);
  const absentGuruToday = allGuru.filter(g => !todayAttendance.some(a => a.guru.id === g.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Majelis Mu'allimil Qur'an (MMQ)</DialogTitle><DialogDescription>Sistem absensi dan notulensi untuk guru.</DialogDescription></DialogHeader>
        <Tabs defaultValue="absensi">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="absensi">Absensi</TabsTrigger>
            <TabsTrigger value="notulensi" disabled={!guru?.is_notulen}>Notulensi</TabsTrigger>
            <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
          </TabsList>
          <TabsContent value="absensi" className="mt-4">
            <h3 className="font-semibold mb-2">Absensi via RFID (Jumat, 09:30 - 10:30 WIB)</h3>
            <form onSubmit={handleRfidAbsen} className="flex gap-2">
              <Input ref={rfidInputRef} value={rfidInput} onChange={e => setRfidInput(e.target.value)} placeholder="Scan kartu RFID Anda..." />
              <Button type="submit">Absen</Button>
            </form>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><h3 className="font-semibold">Hadir Hari Ini</h3><div className="max-h-60 overflow-y-auto space-y-2">{todayAttendance.map(h => (<div key={h.id} className="p-2 border rounded-lg"><p className="font-bold">{h.guru.nama} - <span className="font-normal text-sm">{h.status}</span></p></div>))}{todayAttendance.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada.</p>}</div></div>
              {currentUserRole === 'admin' && <div className="space-y-2"><h3 className="font-semibold">Belum Hadir Hari Ini</h3><div className="max-h-60 overflow-y-auto space-y-2">{absentGuruToday.map(g => (<div key={g.id} className="p-2 border rounded-lg flex justify-between items-center"><span>{g.nama}</span><Button size="sm" onClick={() => handleManualAbsen(g.id, g.nama)}><CheckCircle className="w-4 h-4 mr-2"/>Hadir</Button></div>))}{absentGuruToday.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Semua sudah hadir.</p>}</div></div>}
            </div>
          </TabsContent>
          <TabsContent value="notulensi" className="mt-4">
            <h3 className="font-semibold mb-2">Buat Notulensi MMQ Hari Ini</h3>
            <Input value={notulenTitle} onChange={e => setNotulenTitle(e.target.value)} placeholder="Judul notulensi..." className="mb-2" />
            <Textarea value={notulenText} onChange={e => setNotulenText(e.target.value)} placeholder="Tulis hasil pertemuan MMQ hari ini..." rows={8} />
            <Button onClick={handleSaveNotulen} className="mt-2">Simpan Notulensi</Button>
          </TabsContent>
          <TabsContent value="riwayat" className="mt-4">
            <h3 className="font-semibold mb-2">Riwayat Notulensi</h3><div className="max-h-80 overflow-y-auto space-y-2">{notulenList.map(n => (<div key={n.id} className="p-3 border rounded-lg flex justify-between items-center"><div><p className="font-bold">{n.judul}</p><p className="text-xs text-gray-500">{new Date(n.tanggal).toLocaleDateString('id-ID')} oleh {n.notulen?.nama || 'N/A'}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSelectedNotulen(n)}>Lihat</Button>{currentUserRole === 'admin' && <Button size="icon" variant="destructive" onClick={() => handleDeleteNotulen(n.id)}><Trash2 className="w-4 h-4" /></Button>}</div></div>))}</div>
          </TabsContent>
        </Tabs>
        {selectedNotulen && (<Dialog open={!!selectedNotulen} onOpenChange={() => setSelectedNotulen(null)}><DialogContent><DialogHeader><DialogTitle>{selectedNotulen.judul}</DialogTitle><DialogDescription>{new Date(selectedNotulen.tanggal).toLocaleDateString('id-ID')} oleh {selectedNotulen.notulen?.nama || 'N/A'}</DialogDescription></DialogHeader><div className="prose dark:prose-invert max-h-80 overflow-y-auto whitespace-pre-wrap">{selectedNotulen.isi}</div></DialogContent></Dialog>)}
      </DialogContent>
    </Dialog>
  );
};
export default MmqSection;