
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, Search, Upload, Eye, EyeOff, UserCheck, Filter, Mail, Key, XCircle, CreditCard, Calendar, Cake, Loader2, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { enableEdgeFunctions, edgeFunctionDisabledMessage } from '@/lib/featureFlags';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from '@/components/ui/card';
import BirthdayNotificationModal from '@/components/dashboard/shared/BirthdayNotificationModal';
import * as XLSX from 'xlsx';
import { getOperationalRoleFromGuruForm, pickGuruProfileFields } from '@/lib/dataMasterAdapters';

const AVAILABLE_ROLES = ['Pengajar', 'Pentashih', 'Staff Operasional', 'Admin'];

const GuruManagement = () => {
  const [guruList, setGuruList] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGuru, setEditingGuru] = useState(null);
  const [formData, setFormData] = useState({});
  const [filters, setFilters] = useState({ search: '', isNotulen: 'all', rfidStatus: 'all' });
  const photoInputRef = React.useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  
  // Birthday Notification
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [birthdayCount, setBirthdayCount] = useState(0);

  const fetchGuru = useCallback(async () => {
    try {
        console.log("Fetching guru data from database...");
        const { data, error } = await supabase
          .from('guru')
          .select('id, nama, email, no_hp, alamat, foto_url, rfid_tag, jabatan, roles, is_notulen, jenis_kelamin, tanggal_lahir, status_guru, status, created_at')
          .order('nama');
        if (error) {
            console.error("Database Error fetching guru:", error);
            throw new Error(error.message);
        }
        setGuruList(data || []);
    } catch (err) {
        console.error("Full fetchGuru Error:", err);
        toast({ title: "Gagal memuat data guru", description: err.message, variant: "destructive" });
    }
  }, []);

  useEffect(() => { 
      fetchGuru(); 
  }, [fetchGuru]);

  const calculateBirthdayCount = useCallback(() => {
      try {
          const currentMonth = new Date().getMonth() + 1;
          let count = 0;
          guruList.forEach(g => {
              if (g.tanggal_lahir && new Date(g.tanggal_lahir).getMonth() + 1 === currentMonth) count++;
          });
          setBirthdayCount(count);
      } catch (err) {
          console.error("Error calculating birthdays:", err);
      }
  }, [guruList]);

  useEffect(() => {
      if (guruList.length > 0) calculateBirthdayCount();
  }, [guruList, calculateBirthdayCount]);

  const resetForm = () => {
    setFormData({
      nama: '', jabatan: '', email: '', no_hp: '', alamat: '', rfid_tag: '', is_notulen: false, foto_url: '', password: '',
      roles: [], jenis_kelamin: 'Laki-laki', status_guru: 'Non-Syahadah', nomor_induk_qiroati: '', tanggal_lahir: ''
    });
    setEditingGuru(null);
  };

  const handleAdd = () => { resetForm(); setIsDialogOpen(true); };
  
  const handleEdit = (guru) => { 
    setEditingGuru(guru); 
    setFormData({
        ...guru, 
        password: guru.password || '', 
        roles: guru.roles || [], 
        jenis_kelamin: guru.jenis_kelamin || 'Laki-laki',
        status_guru: guru.status_guru || 'Non-Syahadah',
        nomor_induk_qiroati: guru.nomor_induk_qiroati || '',
        tanggal_lahir: guru.tanggal_lahir || ''
    }); 
    setIsDialogOpen(true); 
  };

  const handleDelete = async (guruToDelete) => {
    if (!enableEdgeFunctions) {
      toast({ title: "Fitur belum aktif", description: edgeFunctionDisabledMessage, variant: "destructive" });
      return;
    }

    if (window.confirm(`Yakin ingin menonaktifkan ${guruToDelete.nama}? Akun login akan dinonaktifkan tanpa hard delete.`)) {
      try {
          const operationalRole = (guruToDelete.roles || []).includes('Pentashih') ? 'pentashih' : 'guru';
          const { data, error: edgeError } = await supabase.functions.invoke('manage-user', {
            body: { action: 'deactivate', role: operationalRole, target_user_id: guruToDelete.id }
          });
          if (edgeError || !data?.ok) {
            toast({ title: "Gagal Hapus User Login", description: edgeError?.message || data?.error?.message || 'Akun gagal dinonaktifkan.', variant: "destructive" });
            return;
          }
          
          const { error: profileError } = await supabase.from('guru').update({ status: 'inactive' }).eq('id', guruToDelete.id);
          if (profileError) {
              console.error("Database Delete Error:", profileError);
              throw new Error(profileError.message);
          }
          
          toast({ title: "Berhasil!", description: "Akun guru/pentashih telah dinonaktifkan." });
          fetchGuru();
      } catch (err) {
          console.error("Full handleDelete Error:", err);
          toast({ title: "Gagal Hapus Data Guru", description: err.message, variant: "destructive" });
      }
    }
  };

  const handleBackupToExcel = async () => {
    try {
        toast({ title: "Memproses Backup", description: "Sedang menyiapkan data untuk diekspor..." });
        console.log("Starting Backup to Excel for Guru...");
        
        const { data: allGuru, error } = await supabase.from('guru').select('*').order('nama');
        if (error) {
            console.error("Backup DB Fetch Error:", error);
            throw new Error(error.message);
        }
        
        if (!allGuru || allGuru.length === 0) {
            toast({ title: "Data Kosong", description: "Tidak ada data guru untuk diekspor.", variant: "destructive" });
            return;
        }

        const exportData = allGuru.map((guru, index) => ({
            'No': index + 1,
            'Nama Guru': guru.nama || '-',
            'Email': guru.email || '-',
            'No Telepon': guru.no_hp || '-',
            'Alamat': guru.alamat || '-',
            'Tanggal Bergabung': guru.created_at ? new Date(guru.created_at).toLocaleDateString('id-ID') : '-',
            'Status': guru.status_guru || 'Non-Syahadah',
            'Jabatan': guru.jabatan || '-',
            'Role': guru.roles && guru.roles.length > 0 ? guru.roles.join(', ') : '-',
            'No Induk Qiroati': guru.nomor_induk_qiroati || '-',
            'Jenis Kelamin': guru.jenis_kelamin || '-',
            'Tanggal Lahir': guru.tanggal_lahir ? new Date(guru.tanggal_lahir).toLocaleDateString('id-ID') : '-',
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wscols = [
            {wch: 5}, {wch: 30}, {wch: 25}, {wch: 15}, {wch: 40}, {wch: 20}, 
            {wch: 15}, {wch: 20}, {wch: 25}, {wch: 20}, {wch: 15}, {wch: 15},
        ];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data Guru");
        
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Data_Guru_${dateStr}.xlsx`);
        
        toast({ title: "Backup Berhasil", description: "File Excel berhasil diunduh." });
    } catch (err) {
        console.error("Backup error:", err);
        toast({ title: "Gagal Backup", description: err.message || "Terjadi kesalahan saat memproses data.", variant: "destructive" });
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        toast({ title: "Format Salah", description: "Hanya file JPG, PNG, atau WebP yang diperbolehkan.", variant: "destructive" });
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File Terlalu Besar", description: "Maksimal ukuran file adalah 5MB.", variant: "destructive" });
        return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = async () => {
        if (img.width < 200 || img.height < 200) {
            toast({ title: "Resolusi Rendah", description: "Minimal resolusi gambar adalah 200x200px.", variant: "destructive" });
            URL.revokeObjectURL(objectUrl);
            return;
        }
        
        setIsUploading(true);
        const guruId = editingGuru?.id || `new-${Date.now()}`;
        const fileExt = file.name.split('.').pop();
        const fileName = `${guruId}/${Date.now()}.${fileExt}`;
        const filePath = `guru/${fileName}`;
        
        try {
          console.log(`Uploading photo to: ${filePath}`);
          const { data, error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
          if (uploadError) {
              console.error("Storage Upload Error:", uploadError);
              throw new Error(uploadError.message);
          }
          
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
          const finalUrl = `${publicUrl}?t=${Date.now()}`;
          
          setFormData(prev => ({...prev, foto_url: finalUrl }));
          setPreviewImage(finalUrl);

          if (editingGuru) {
              const { error: updateError } = await supabase.from('guru').update({ foto_url: finalUrl }).eq('id', editingGuru.id);
              if (updateError) {
                  console.error("DB Photo Update Error:", updateError);
                  throw new Error("Gagal menyimpan URL foto ke database.");
              }
              toast({ title: "Foto Tersimpan", description: "Foto profil berhasil diperbarui secara otomatis." });
              fetchGuru();
          } else {
              toast({ title: "Upload Berhasil", description: "Foto siap disimpan bersama data guru baru." });
          }

        } catch (error) { 
            console.error("Full Photo Upload Error:", error);
            toast({ title: 'Upload Gagal', description: error.message, variant: 'destructive' }); 
        } finally { 
            setIsUploading(false); 
            URL.revokeObjectURL(objectUrl);
        }
    };
    img.src = objectUrl;
  };

  const triggerPhotoUpload = () => photoInputRef.current?.click();

  const validatePassword = (password) => {
    if (!password) return null;
    if (password.length < 6) return "Password minimal 6 karakter.";
    if (!/[a-z]/.test(password)) return "Password harus mengandung minimal satu huruf kecil.";
    if (!/[A-Z]/.test(password)) return "Password harus mengandung minimal satu huruf besar.";
    if (!/[0-9]/.test(password)) return "Password harus mengandung minimal satu angka.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Password harus mengandung minimal satu karakter spesial.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const operationalRole = getOperationalRoleFromGuruForm(formData);

    if (editingGuru && formData.password) {
        toast({
            title: "Reset password ditunda",
            description: "Perubahan password akun existing perlu menggunakan reset-user-password agar Auth tetap konsisten.",
            variant: "destructive"
        });
        return;
    }

    if (formData.password) {
        const passwordError = validatePassword(formData.password);
        if (passwordError) {
            toast({ title: "Validasi Password Gagal", description: passwordError, variant: "destructive" });
            return;
        }
    } else if (!editingGuru) {
        toast({ title: "Validasi Gagal", description: "Password wajib diisi untuk guru baru.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    let userId = editingGuru?.id;
    const requiresAuthEdgeFunction = !editingGuru;
    if (requiresAuthEdgeFunction && !enableEdgeFunctions) {
        toast({ title: "Fitur belum aktif", description: edgeFunctionDisabledMessage, variant: "destructive" });
        setIsSubmitting(false);
        return;
    }
    
    try {
        if (!editingGuru) {
          const { data, error } = await supabase.functions.invoke('manage-user', {
            body: {
              action: 'create',
              role: operationalRole,
              profile: pickGuruProfileFields(formData, operationalRole),
              initial_password: formData.password,
            },
          });
          if (error) throw error;
          if (!data?.ok || !data?.data?.user_id) {
            throw new Error(data?.error?.message || 'Akun guru/pentashih gagal dibuat.');
          }
          userId = data.data.user_id;
        }
        
        if (!userId) { 
            throw new Error("ID Pengguna tidak valid setelah operasi otentikasi.");
        }
        
        const dataToSubmit = { ...pickGuruProfileFields(formData, operationalRole), id: userId };
        
        const { error: profileError } = await supabase.from('guru').upsert(dataToSubmit);
        
        if (profileError) {
            console.error("Database Upsert Error:", profileError);
            throw new Error(profileError.message);
        }
        
        toast({ title: "Berhasil!", description: "Data guru berhasil disimpan." }); 
        setIsDialogOpen(false); 
        fetchGuru();
    } catch (err) {
        console.error("Full handleSubmit Error:", err);
        toast({ title: "Gagal menyimpan data", description: err.message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  const handleCheckboxChange = (checked) => setFormData(prev => ({ ...prev, is_notulen: checked }));
  
  const handleRoleChange = (role, checked) => {
      setFormData(prev => {
          const currentRoles = prev.roles || [];
          if (checked) return { ...prev, roles: [...currentRoles, role] };
          return { ...prev, roles: currentRoles.filter(r => r !== role) };
      });
  };

  const filteredGuru = useMemo(() => {
    return guruList.filter(guru => {
        const searchMatch = filters.search === '' ||
            guru.nama.toLowerCase().includes(filters.search.toLowerCase()) ||
            (guru.email && guru.email.toLowerCase().includes(filters.search.toLowerCase())) ||
            (guru.rfid_tag && guru.rfid_tag.includes(filters.search)) ||
            (guru.nomor_induk_qiroati && guru.nomor_induk_qiroati.includes(filters.search));
            
        const notulenMatch = filters.isNotulen === 'all' || (filters.isNotulen === 'yes' && guru.is_notulen) || (filters.isNotulen === 'no' && !guru.is_notulen);
        const rfidMatch = filters.rfidStatus === 'all' || (filters.rfidStatus === 'assigned' && guru.rfid_tag) || (filters.rfidStatus === 'unassigned' && !guru.rfid_tag);
        
        return searchMatch && notulenMatch && rfidMatch;
    });
  }, [guruList, filters]);

  return (
    <div className="bg-card p-6 rounded-2xl shadow-xl">
      {/* Modern Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3">
             <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                <UserCheck className="w-8 h-8" />
             </div>
             <div>
                <h2 className="text-2xl font-bold text-foreground">Manajemen Data Guru</h2>
                <p className="text-muted-foreground text-sm">Kelola data pengajar, staff, dan akses login.</p>
             </div>
        </div>
        
        <div className="flex items-center gap-2">
            <div className="relative mr-2">
                <Button variant="outline" size="icon" onClick={() => setIsBirthdayModalOpen(true)} className="relative border-pink-200 hover:bg-pink-50 text-pink-500">
                    <Cake className="w-5 h-5" />
                    {birthdayCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-bounce">
                            {birthdayCount}
                        </span>
                    )}
                </Button>
            </div>

            <Button onClick={handleBackupToExcel} variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 shadow-sm" title="Backup data guru ke Excel">
                <Download className="w-4 h-4 mr-2" /> Backup ke Excel
            </Button>
            <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 shadow-md"><Plus className="w-4 h-4 mr-2" /> Tambah Guru</Button>
        </div>
      </div>

       <Card className="bg-slate-50 dark:bg-slate-900/50 border-none shadow-sm mb-6">
            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                 <div className="relative flex-grow w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                    <Input 
                        placeholder="Cari nama, email, RFID, atau No. Induk..." 
                        value={filters.search} 
                        onChange={e => setFilters(f => ({...f, search: e.target.value}))} 
                        className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-2 w-full md:w-auto min-w-[400px]">
                    <Select value={filters.isNotulen} onValueChange={val => setFilters(f => ({...f, isNotulen: val}))}>
                        <SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue placeholder="Status Notulen" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Semua</SelectItem><SelectItem value="yes">Notulen</SelectItem><SelectItem value="no">Bukan Notulen</SelectItem></SelectContent>
                    </Select>
                    <Select value={filters.rfidStatus} onValueChange={val => setFilters(f => ({...f, rfidStatus: val}))}>
                        <SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue placeholder="Status RFID" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Semua</SelectItem><SelectItem value="assigned">Ada RFID</SelectItem><SelectItem value="unassigned">Tanpa RFID</SelectItem></SelectContent>
                    </Select>
                 </div>
            </CardContent>
        </Card>

      <div className="overflow-auto max-h-[60vh] border rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10"><tr className="border-b">
              <th className="py-3 px-4 text-left">No.</th>
              <th className="py-3 px-4 text-left">Nama</th>
              <th className="py-3 px-4 text-left">No. Induk</th>
              <th className="py-3 px-4 text-left">Status Guru</th>
              <th className="py-3 px-4 text-left">Role</th>
              <th className="py-3 px-4 text-left">Kontak</th>
              <th className="py-3 px-4 text-left">RFID</th>
              <th className="py-3 px-4 text-left">Aksi</th>
          </tr></thead>
          <tbody>{filteredGuru.map((guru, index) => (
            <tr key={guru.id} className="border-b hover:bg-accent/50 transition-colors">
                <td className="py-2 px-4 text-muted-foreground">{index + 1}</td>
                <td className="py-2 px-4">
                    <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPreviewImage(guru.foto_url)}>
                            <AvatarImage src={guru.foto_url} />
                            <AvatarFallback>{guru.nama.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{guru.nama}</span>
                    </div>
                </td>
                <td className="py-2 px-4">{guru.nomor_induk_qiroati || '-'}</td>
                <td className="py-2 px-4">
                    <Badge variant={guru.status_guru === 'Syahadah' ? 'default' : 'secondary'} className={guru.status_guru === 'Syahadah' ? 'bg-green-600 hover:bg-green-700' : ''}>
                        {guru.status_guru || 'Non-Syahadah'}
                    </Badge>
                </td>
                <td className="py-2 px-4">
                    <div className="flex flex-wrap gap-1">
                        {(guru.roles && guru.roles.length > 0) ? guru.roles.map(role => <Badge key={role} variant="outline" className="text-xs">{role}</Badge>) : <span className="text-muted-foreground">-</span>}
                    </div>
                </td>
                <td className="py-2 px-4"><div className="flex flex-col"><span className="text-xs">{guru.email}</span><span className="text-xs text-muted-foreground">{guru.no_hp}</span></div></td>
                <td className="py-2 px-4">{guru.rfid_tag || 'N/A'}</td>
                <td className="py-2 px-4"><div className="flex space-x-2"><Button onClick={() => handleEdit(guru)} size="sm" variant="outline"><Edit className="w-4 h-4" /></Button><Button onClick={() => handleDelete(guru)} size="sm" variant="destructive" disabled={!enableEdgeFunctions} title={!enableEdgeFunctions ? edgeFunctionDisabledMessage : undefined}><Trash2 className="w-4 h-4" /></Button></div></td>
            </tr>
          ))}</tbody>
        </table>
        {filteredGuru.length === 0 && <p className="text-center text-muted-foreground p-8">Tidak ada data guru yang cocok.</p>}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingGuru ? 'Edit Data Guru' : 'Tambah Guru Baru'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <Avatar className="w-28 h-28 border-4 border-white dark:border-slate-800 shadow-lg cursor-pointer hover:opacity-80 transition-opacity" onClick={() => formData.foto_url && setPreviewImage(formData.foto_url)}>
                      <AvatarImage src={formData.foto_url} /><AvatarFallback><Upload /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1 w-full space-y-3">
                      <div className="flex items-center gap-3">
                           <Button type="button" onClick={triggerPhotoUpload} variant="secondary" className="bg-white dark:bg-slate-800 shadow-sm" disabled={isUploading}>
                               {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Mengunggah...</> : <><Upload className="w-4 h-4 mr-2"/> Upload Foto Profil</>}
                           </Button>
                           <span className="text-xs text-muted-foreground">JPG, PNG, WebP (Max 5MB)</span>
                           <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" />
                      </div>
                      <div className="relative">
                          <Input type="text" placeholder="https://example.com/foto.jpg" value={formData.foto_url || ''} onChange={handleInputChange} id="foto_url" className="pl-9 text-xs bg-white dark:bg-slate-950" />
                          <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground"/>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">Foto akan otomatis disimpan ke sistem setelah upload selesai.</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div className="col-span-full font-semibold text-lg border-b pb-2 text-primary">Informasi Pribadi</div>
                 
                 <div className="space-y-1.5"><label htmlFor="nama" className="text-xs font-medium uppercase text-muted-foreground">Nama Lengkap</label><Input id="nama" value={formData.nama || ''} onChange={handleInputChange} required /></div>
                 <div className="space-y-1.5"><label htmlFor="nomor_induk_qiroati" className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3"/> No. Induk Qiroati</label><Input id="nomor_induk_qiroati" value={formData.nomor_induk_qiroati || ''} onChange={handleInputChange} placeholder="Contoh: 123456789" /></div>
                 <div className="space-y-1.5"><label htmlFor="jabatan" className="text-xs font-medium uppercase text-muted-foreground">Jabatan Utama (Display)</label><Input id="jabatan" value={formData.jabatan || ''} onChange={handleInputChange} /></div>
                 
                 <div className="space-y-1.5"><label htmlFor="no_hp" className="text-xs font-medium uppercase text-muted-foreground">No. HP</label><Input id="no_hp" value={formData.no_hp || ''} onChange={handleInputChange} /></div>
                 <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Jenis Kelamin</label>
                    <Select value={formData.jenis_kelamin} onValueChange={val => setFormData(prev => ({...prev, jenis_kelamin: val}))}>
                        <SelectTrigger><SelectValue placeholder="Pilih Gender" /></SelectTrigger>
                        <SelectContent><SelectItem value="Laki-laki">Laki-laki</SelectItem><SelectItem value="Perempuan">Perempuan</SelectItem></SelectContent>
                    </Select>
                 </div>
                 
                 <div className="space-y-1.5"><label htmlFor="tanggal_lahir" className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3"/> Tanggal Lahir</label><Input id="tanggal_lahir" type="date" value={formData.tanggal_lahir || ''} onChange={handleInputChange} /></div>

                 <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Status Sertifikasi</label>
                    <Select value={formData.status_guru || 'Non-Syahadah'} onValueChange={val => setFormData(prev => ({...prev, status_guru: val}))}>
                        <SelectTrigger><SelectValue placeholder="Pilih Status" /></SelectTrigger>
                        <SelectContent><SelectItem value="Syahadah">Syahadah</SelectItem><SelectItem value="Non-Syahadah">Non-Syahadah</SelectItem></SelectContent>
                    </Select>
                 </div>

                 <div className="col-span-full space-y-1.5"><label htmlFor="alamat" className="text-xs font-medium uppercase text-muted-foreground">Alamat</label><Textarea id="alamat" value={formData.alamat || ''} onChange={handleInputChange} /></div>
                 
                 <div className="col-span-full font-semibold text-lg border-b pb-2 mt-2 text-primary">Akses & Sistem</div>
                 
                 <div className="space-y-1.5"><label htmlFor="email" className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3"/> Email (Login)</label><Input id="email" type="email" value={formData.email || ''} onChange={handleInputChange} required/></div>
                 <div className="space-y-1.5 relative">
                  <label htmlFor="password" className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1"><Key className="w-3 h-3"/> Password</label>
                  <div className="relative">
                      <Input 
                        id="password" 
                        type={showPassword ? "text" : "password"} 
                        placeholder={editingGuru ? "Kosongkan jika tidak ganti" : "Wajib diisi"}
                        value={formData.password || ''} 
                        onChange={handleInputChange}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Syarat: Min 6 karakter, 1 huruf besar, 1 huruf kecil, 1 angka, 1 simbol.
                  </p>
                </div>
                
                <div className="space-y-1.5"><label htmlFor="rfid_tag" className="text-xs font-medium uppercase text-muted-foreground">RFID Tag</label><Input id="rfid_tag" value={formData.rfid_tag || ''} onChange={handleInputChange} /></div>
              </div>
              
              <div className="border p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                  <label className="text-sm font-semibold mb-3 block uppercase text-muted-foreground">Roles / Jabatan (Fungsional)</label>
                  <div className="flex flex-wrap gap-4">
                      {AVAILABLE_ROLES.map(role => (
                          <div key={role} className="flex items-center space-x-2">
                              <Checkbox id={`role-${role}`} checked={(formData.roles || []).includes(role)} onCheckedChange={(checked) => handleRoleChange(role, checked)} />
                              <label htmlFor={`role-${role}`} className="text-sm cursor-pointer select-none">{role}</label>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="flex items-center space-x-2 pt-2"><Checkbox id="is_notulen" checked={formData.is_notulen} onCheckedChange={handleCheckboxChange} /><label htmlFor="is_notulen" className="text-sm font-medium cursor-pointer">Jadikan sebagai Notulen MMQ</label></div>
              <DialogFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : (editingGuru ? 'Simpan Perubahan' : 'Tambah Guru')}</Button></DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <BirthdayNotificationModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} />

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-transparent border-none shadow-none">
            <div className="relative w-full h-[80vh] flex items-center justify-center">
                <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full"
                    onClick={() => setPreviewImage(null)}
                >
                    <XCircle className="w-6 h-6" />
                </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GuruManagement;
