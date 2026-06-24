
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, Search, Upload, ArrowUpDown, FileCheck, Download, CheckCircle, XCircle, Trophy, Users, Filter, FileSpreadsheet, ArrowRightLeft, User, Phone, GraduationCap, FileText, Lock, Star, Bell, Cake, Copy, BookOpen } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/customSupabaseClient';
import { enableEdgeFunctions, edgeFunctionDisabledMessage } from '@/lib/featureFlags';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { validatePassword } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import BirthdayNotificationModal from '@/components/dashboard/shared/BirthdayNotificationModal';
import { motion } from 'framer-motion';
import { getSessionName, getSessionNumber, getAllSessions } from '@/utils/sessionMapping';
import { mapSantriForLegacyUi, normalizeNomorIndukQiroati, pickSantriProfileFields } from '@/lib/dataMasterAdapters';
import { getStorageErrorMessage, uploadAvatar } from '@/lib/storageAdapters';

const jilidOptions = [
    'Pra TK A', 'Pra TK B', 'Pra TK C', 
    'Jilid 1A', 'Jilid 1B', 'Jilid 1C',
    'Jilid 2A', 'Jilid 2B',
    'Jilid 3A', 'Jilid 3B',
    'Jilid 4A', 'Jilid 4B',
    'Jilid 5A', 'Jilid 5B',
    'Jilid Juz 27',
    'Jilid 6A', 'Jilid 6B',
    'Al-Qur\'an', 'Ghorib Tajwid', 'Finishing'
];

const BulkUploadModal = ({ isOpen, onClose, onUpload, category = 'Anak' }) => {
  const [file, setFile] = useState(null);
  const [textData, setTextData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('excel');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) setFile(selectedFile);
  };

  const downloadTemplate = () => {
    const headers = [
      "Nama Lengkap", 
      "Nama Panggilan", 
      "Jilid", 
      "Tempat Lahir", 
      "Tgl Lahir (MM-DD-YYYY)", 
      "Jenis Kelamin (Laki-laki/Perempuan)", 
      "Alamat", 
      "Sesi", 
      "Tgl Masuk (MM-DD-YYYY)", 
      "Nama Ibu", 
      "Nama Ayah", 
      "No HP Ortu", 
      "No KK", 
      "No NIK", 
      "No Induk Qiroati", 
      "RFID"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Santri");
    XLSX.writeFile(wb, "Template_Import_Santri_V2.xlsx");
  };

  const processExcel = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          resolve(json);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleProcess = async () => {
    setIsLoading(true);
    let rawData = [];

    try {
      if (activeTab === 'excel' && file) {
        rawData = await processExcel(file);
      } else if (activeTab === 'text' && textData) {
        if (textData.includes('|') && !textData.includes('\t')) {
            throw new Error("Format data salah. Mohon gunakan format tab-separated (copy dari Excel). Karakter '|' tidak lagi didukung.");
        }
        rawData = textData.trim().split('\n').map(line => line.split('\t').map(v => v.trim()));
      }

      if (!rawData || rawData.length === 0) throw new Error("Data kosong.");

      onUpload(rawData, activeTab === 'excel');
      onClose();
      setFile(null);
      setTextData('');
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Data Santri Massal</DialogTitle>
          <DialogDescription>Pilih metode import data santri (Wajib sesuai template terbaru).</DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-4 mb-4 border-b">
            <Button variant={activeTab === 'excel' ? 'default' : 'ghost'} onClick={() => setActiveTab('excel')} className="rounded-b-none">File Excel/CSV</Button>
            <Button variant={activeTab === 'text' ? 'default' : 'ghost'} onClick={() => setActiveTab('text')} className="rounded-b-none">Copy-Paste Teks (Excel)</Button>
        </div>

        {activeTab === 'excel' ? (
            <div className="space-y-6 py-4">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet className="w-12 h-12 text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700">{file ? file.name : "Klik untuk upload file Excel (.xlsx, .xls) atau CSV"}</p>
                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                </div>
                <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-blue-800">Perhatian: Format Kolom Baru</p>
                        <p className="text-xs text-blue-700">Pastikan file Anda memiliki 16 kolom yang sesuai dengan urutan template.</p>
                        <p className="text-xs text-blue-700">Tanggal gunakan format: <strong>MM-DD-YYYY</strong>. Gender: <strong>Laki-laki / Perempuan</strong>.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadTemplate} className="border-blue-200 text-blue-700 hover:bg-blue-100 shrink-0 ml-4">
                        <Download className="w-4 h-4 mr-2"/> Download Template
                    </Button>
                </div>
            </div>
        ) : (
            <div className="space-y-2">
                <p className="text-xs font-semibold text-blue-800 mb-1">Perhatian: Format Kolom (Tab Separated):</p>
                <div className="bg-slate-100 p-2 rounded text-[10px] text-slate-700 font-mono overflow-x-auto whitespace-nowrap border border-slate-200">
                    1. Nama Lengkap | 2. Nama Panggilan | 3. Jilid | 4. Tempat Lahir | 5. Tgl Lahir (MM-DD-YYYY) | 6. Jenis Kelamin (Laki-laki/Perempuan) | 7. Alamat | 8. Sesi | 9. Tgl Masuk (MM-DD-YYYY) | 10. Nama Ibu | 11. Nama Ayah | 12. No HP Ortu | 13. No KK | 14. No NIK | 15. No Induk Qiroati | 16. RFID
                </div>
                <p className="text-xs text-muted-foreground mt-2">Pastikan data dicopy langsung dari Excel atau Google Sheets yang sesuai template di atas.</p>
                <Textarea 
                    placeholder="Paste data dari Excel di sini..." 
                    className="min-h-[300px] font-mono text-xs whitespace-pre"
                    value={textData}
                    onChange={e => setTextData(e.target.value)}
                />
            </div>
        )}

        <DialogFooter>
          <Button onClick={handleProcess} disabled={isLoading || (activeTab === 'excel' && !file) || (activeTab === 'text' && !textData)}>
            {isLoading ? 'Memproses...' : 'Proses Data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const UploadReportModal = ({ isOpen, onClose, report, onConfirm }) => {
  if (!report) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Laporan Validasi Data</DialogTitle>
          <DialogDescription>Tinjau data sebelum disimpan ke database.</DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-sm text-green-600 font-medium">Data Valid</p>
                <p className="text-2xl font-bold text-green-700">{report.validCount}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <p className="text-sm text-red-600 font-medium">Data Error</p>
                <p className="text-2xl font-bold text-red-700">{report.errorCount}</p>
            </div>
        </div>

        {report.errors.length > 0 && (
            <div className="space-y-2 mb-4">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-red-600"><XCircle className="w-4 h-4"/> Detail Error:</h4>
                <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 text-xs max-h-48 overflow-y-auto">
                    <ul className="space-y-1.5 text-red-700 font-medium">
                        {report.errors.map((err, idx) => (
                            <li key={idx}><strong>Baris {err.row}:</strong> [{err.name}] {err.reason}</li>
                        ))}
                    </ul>
                </div>
            </div>
        )}

        {report.validData.length > 0 && (
             <div className="space-y-2">
                <h4 className="font-semibold text-sm">Preview Data Valid (5 Teratas):</h4>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 border-b">
                            <tr>
                                <th className="p-2">Nama Lengkap</th>
                                <th className="p-2">Jilid</th>
                                <th className="p-2">Jenis Kelamin</th>
                                <th className="p-2">Sesi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.validData.slice(0, 5).map((d, i) => (
                                <tr key={i} className="border-b last:border-0">
                                    <td className="p-2">{d.nama_lengkap}</td>
                                    <td className="p-2">{d.jilid}</td>
                                    <td className="p-2">{d.jenis_kelamin}</td>
                                    <td className="p-2">{getSessionName(d.sesi_mengaji)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={onClose}>Batal</Button>
            <Button onClick={onConfirm} disabled={report.validCount === 0} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2"/> Simpan {report.validCount} Data Valid
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SantriManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("tpq");
  const [santriList, setSantriList] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  
  const subTabs = [
      { id: 'tpq', label: 'Santri TPQ', icon: GraduationCap },
      { id: 'ptpt', label: 'Santri PTPT', icon: BookOpen },
  ];

  // Helper for Date Parsing (MM-DD-YYYY or Excel Number)
  const parseDateInput = (val) => {
    if (!val) return null;
    if (typeof val === 'number') { 
        const date = new Date((val - (25567 + 2)) * 86400 * 1000); 
        return date.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
        const parts = val.trim().split(/[-/]/);
        if (parts.length === 3) {
            // Assume format is MM-DD-YYYY or MM/DD/YYYY
            const m = parts[0].padStart(2, '0');
            const d = parts[1].padStart(2, '0');
            let y = parts[2];
            if (y.length === 2) y = '20' + y;
            return `${y}-${m}-${d}`;
        }
        // Fallback for standard parsable string
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    return null;
  };

  // Helper for Gender Parsing
  const parseGenderInput = (val) => {
      if (!val) return null;
      const s = String(val).toLowerCase().trim();
      if (s === 'laki-laki' || s === 'l' || s === 'laki') return 'Laki-laki';
      if (s === 'perempuan' || s === 'p' || s === 'pr') return 'Perempuan';
      return null;
  };

  const handleDataProcessing = (rawData, isExcel) => {
    const firstRow = rawData[0];
    const isHeader = firstRow && (
        String(firstRow[0]).toLowerCase().includes('nama') || 
        String(firstRow[0]).toLowerCase().includes('full name')
    );
    
    const dataRows = isHeader ? rawData.slice(1) : rawData;
    const validData = [];
    const errors = [];
    
    dataRows.forEach((row, idx) => {
        if (!row || row.length === 0 || row.every(c => !c)) return; 

        const santri = { kategori: activeTab === 'ptpt' ? 'PTPT' : 'Anak', status: 'Aktif', points: 0 };
        const rowName = row[0] || 'Baris Tidak Bernama';
        
        try {
            // 1. Nama Lengkap
            if (!row[0]) throw new Error("Nama Lengkap wajib diisi");
            santri.nama_lengkap = row[0];
            
            // 2. Nama Panggilan
            santri.nama_panggilan = row[1] || santri.nama_lengkap.split(' ')[0];
            
            // 3. Jilid
            santri.jilid = row[2] || 'Pra TK A';
            
            // 4. Tempat Lahir
            santri.tempat_lahir = row[3];
            
            // 5. Tgl Lahir (MM-DD-YYYY)
            if (row[4]) {
                const parsedDate = parseDateInput(row[4]);
                if (!parsedDate) throw new Error(`Format Tgl Lahir tidak valid: "${row[4]}". Gunakan format MM-DD-YYYY`);
                santri.tanggal_lahir = parsedDate;
            }
            
            // 6. Jenis Kelamin (Laki-laki/Perempuan)
            if (row[5]) {
                const parsedGender = parseGenderInput(row[5]);
                if (!parsedGender) throw new Error(`Jenis Kelamin tidak valid: "${row[5]}". Gunakan "Laki-laki" atau "Perempuan"`);
                santri.jenis_kelamin = parsedGender;
            } else {
                santri.jenis_kelamin = 'Laki-laki'; // default if empty but not missing completely
            }
            
            // 7. Alamat
            santri.alamat = row[6];
            
            // 8. Sesi
            santri.sesi_mengaji = row[7] ? getSessionNumber(row[7]) : getSessionNumber('Pagi');
            
            // 9. Tgl Masuk (MM-DD-YYYY)
            if (row[8]) {
                const parsedEntryDate = parseDateInput(row[8]);
                if (!parsedEntryDate) throw new Error(`Format Tgl Masuk tidak valid: "${row[8]}". Gunakan format MM-DD-YYYY`);
                santri.tanggal_pendaftaran = parsedEntryDate;
            } else {
                santri.tanggal_pendaftaran = new Date().toISOString().split('T')[0];
            }

            // 10. Nama Ibu
            santri.nama_ibu = row[9];
            
            // 11. Nama Ayah
            santri.nama_ayah = row[10];
            
            // 12. No HP Ortu
            santri.no_hp_ortu = row[11];
            
            // 13. No KK
            santri.no_kk = row[12];
            
            // 14. No NIK
            santri.no_nik = row[13];
            
            // 15. No Induk Qiroati
            santri.nomor_induk_qiroati = normalizeNomorIndukQiroati(row[14]);
            
            // 16. RFID
            santri.rfid_tag = row[15];

            // Setup Default Password based on Priority
            if (!santri.password) {
                 santri.password = santri.nomor_induk_qiroati || santri.nama_panggilan || '1234';
            }

            validData.push(santri);
        } catch (e) {
            errors.push({ row: isHeader ? idx + 2 : idx + 1, name: rowName, reason: e.message });
        }
    });

    setUploadReport({ validData, errors, validCount: validData.length, errorCount: errors.length });
    setIsReportOpen(true);
  };
  
  const [classesList, setClassesList] = useState([]);
  const [sessionOptions, setSessionOptions] = useState([]);
  
  const [filters, setFilters] = useState({ search: '', sesi: 'all', jilid: 'all', rfid: 'all' });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [uploadReport, setUploadReport] = useState(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [editingSantri, setEditingSantri] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'nama_lengkap', direction: 'ascending' });
  const [selectedSantri, setSelectedSantri] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const photoInputRef = React.useRef(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', description: '', onConfirm: () => {} });
  const [previewImage, setPreviewImage] = useState(null);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [birthdayCount, setBirthdayCount] = useState(0);
  const [formData, setFormData] = useState({
    nama_lengkap: '', nama_panggilan: '', nomor_induk_qiroati: '', jenis_kelamin: 'Laki-laki', tempat_lahir: '', tanggal_lahir: '', tanggal_pendaftaran: '',
    nama_ayah: '', nama_ibu: '', no_hp_ortu: '', alamat: '', status: 'Aktif', foto_url: '', password: '', sesi_mengaji: '', rfid_tag: '',
    jilid: 'Pra TK A', no_kk: '', no_nik: '', berkas_foto: false, berkas_akta: false, berkas_kk: false, berkas_form: false, link_qiroati: '', id_kelas: null, points: 0, kategori: 'Anak'
  });

  useEffect(() => { 
      loadData(activeTab); 
  }, [activeTab]);

  useEffect(() => {
      if (santriList.length > 0) calculateBirthdayCount();
  }, [santriList]);

  const loadData = async (currentTab = activeTab) => {
    setIsLoadingData(true);
    setFetchError(null);
    try {
      const [santriRes, classesRes, configRes] = await Promise.all([
        supabase
          .from('santri')
          .select('id, nomor_induk_qiroati, nama_lengkap, nama_panggilan, kategori, jenis_kelamin, tanggal_lahir, tempat_lahir, alamat, no_hp_ortu, foto_url, avatar_path, rfid_tag, current_class_id, sesi_mengaji, jilid, status, points, order_in_class, created_at, updated_at')
          .order('nama_lengkap'),
        supabase.from('classes').select('id, nama_kelas, guru:id_guru(nama)'),
        supabase.from('website_content').select('content').eq('key', 'anakSessionConfig').maybeSingle()
      ]);

      if (santriRes.error) {
          console.error("Query execution error for santri:", santriRes.error);
          setFetchError(santriRes.error.message);
          toast({ title: "Gagal Memuat Data Santri", description: santriRes.error.message, variant: "destructive" });
      } else {
          const filteredSantri = (santriRes.data || []).map(mapSantriForLegacyUi).filter(s => {
              const cat = (s.kategori || 'anak').toLowerCase();
              const isActive = !s.status || s.status.toLowerCase() === 'aktif' || s.status.toLowerCase() === 'active';
              if (currentTab === 'tpq') return (cat === 'anak' || cat === 'tpq') && isActive;
              if (currentTab === 'ptpt') return cat === 'ptpt' && isActive;
              return false;
          });
          setSantriList(filteredSantri);
      }

      if (classesRes.error) {
          toast({ title: "Error", description: "Gagal memuat data kelas.", variant: "destructive" });
      } else {
          const tpqClasses = (classesRes.data || []).filter(c => !c.kategori || c.kategori.toLowerCase() === 'anak' || c.kategori.toLowerCase() === 'ptpt');
          setClassesList(tpqClasses);
      }
      
      const mappedSessions = getAllSessions().map(s => s.name);
      setSessionOptions(mappedSessions);
      setFormData(prev => ({...prev, sesi_mengaji: mappedSessions[0] || ''}));
      
    } catch (err) {
      console.error('Unexpected error during loadData:', err);
      setFetchError(err.message);
      toast({ title: "Error Sistem", description: "Terjadi kesalahan tidak terduga saat mengambil data.", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  };
  
  const calculateBirthdayCount = async () => {
      const currentMonth = new Date().getMonth() + 1;
      let count = 0;
      santriList.forEach(s => {
          if (s.tanggal_lahir) {
              if (new Date(s.tanggal_lahir).getMonth() + 1 === currentMonth) count++;
          }
      });
      const { data: guruData } = await supabase.from('guru').select('tanggal_lahir');
      if (guruData) {
          guruData.forEach(g => {
              if (g.tanggal_lahir && new Date(g.tanggal_lahir).getMonth() + 1 === currentMonth) count++;
          });
      }
      setBirthdayCount(count);
  };

  const classGuruMap = useMemo(() => {
    return classesList.reduce((acc, cls) => {
      acc[cls.id] = cls.guru?.nama || 'Belum ada guru';
      return acc;
    }, {});
  }, [classesList]);
  
  const confirmBulkUpload = async () => {
      if (!uploadReport?.validData) return;
      toast({
          title: "Import massal ditunda",
          description: "Pembuatan akun santri massal perlu operasi backend atomik agar Auth, profil, alias login, dan membership tetap konsisten.",
          variant: "destructive"
      });
  };

  const handleDownloadData = () => {
    const dataToExport = santriList.map(s => ({
        'Nama Lengkap': s.nama_lengkap, 'Nama Panggilan': s.nama_panggilan, 'Jilid': s.jilid, 'Tempat Lahir': s.tempat_lahir,
        'Tanggal Lahir': s.tanggal_lahir, 'Jenis Kelamin': s.jenis_kelamin, 'Alamat': s.alamat, 'Sesi': getSessionName(s.sesi_mengaji),
        'Tanggal Masuk': s.tanggal_pendaftaran, 'Nama Ibu': s.nama_ibu, 'Nama Ayah': s.nama_ayah, 'No. HP Wali': s.no_hp_ortu,
        'No. KK': s.no_kk, 'No. NIK': s.no_nik, 'No. Induk Qiroati': s.nomor_induk_qiroati, 'Status': s.status, 'RFID': s.rfid_tag, 'Kategori': s.kategori
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Data Santri ${activeTab.toUpperCase()}`);
    XLSX.writeFile(workbook, `Data_Santri_${activeTab.toUpperCase()}.xlsx`);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!editingSantri?.id) {
        toast({ title: "Simpan Akun Terlebih Dahulu", description: "Avatar memakai path berdasarkan UUID akun. Simpan data santri sebelum upload foto.", variant: "destructive" });
        e.target.value = '';
        return;
    }

    setIsUploading(true);

    try {
        const { path, signedUrl } = await uploadAvatar({ ownerType: 'santri', ownerId: editingSantri.id, file });
        setFormData(prev => ({ ...prev, avatar_path: path, foto_url: signedUrl || prev.foto_url }));
        toast({ title: "Upload Berhasil" });
    } catch (error) {
        toast({ title: "Upload Gagal", description: getStorageErrorMessage(error), variant: "destructive" });
    } finally {
        setIsUploading(false);
        e.target.value = '';
    }
  };

  const triggerPhotoUpload = () => photoInputRef.current?.click();

  const handleNicknameChange = (e) => {
    const nickname = e.target.value.replace(/\s/g, '');
    const capitalized = nickname.charAt(0).toUpperCase() + nickname.slice(1);
    setFormData(prev => ({ ...prev, nama_panggilan: capitalized }));
  };

  const handleQiroatiIdChange = (e) => {
    const qiroatiId = e.target.value;
    setFormData(prev => ({ ...prev, nomor_induk_qiroati: qiroatiId, password: qiroatiId }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalFormData = { ...formData, kategori: activeTab === 'ptpt' ? 'PTPT' : 'Anak' };
    finalFormData.nomor_induk_qiroati = normalizeNomorIndukQiroati(finalFormData.nomor_induk_qiroati);
    
    // Ensure we save the numeric equivalent for sesi to match backend constraints
    if (finalFormData.sesi_mengaji) {
        finalFormData.sesi_mengaji = getSessionNumber(finalFormData.sesi_mengaji);
    }

    if (!finalFormData.nama_panggilan) {
        toast({ title: "Gagal", description: "Nama panggilan (username) tidak boleh kosong.", variant: "destructive"});
        return;
    }
    if (!finalFormData.password) finalFormData.password = finalFormData.nomor_induk_qiroati;

    if (finalFormData.password && finalFormData.password.length < 4) {
        toast({ title: "Validasi Password Gagal", description: "Password minimal 4 karakter.", variant: "destructive" });
        return;
    }

    if (editingSantri && finalFormData.nomor_induk_qiroati !== editingSantri.nomor_induk_qiroati) {
        toast({
            title: "Nomor Induk belum dapat diubah",
            description: "Perubahan Nomor Induk Qiroati perlu operasi backend agar alias login Supabase Auth tetap konsisten.",
            variant: "destructive"
        });
        return;
    }

    if (!editingSantri && !enableEdgeFunctions) {
      toast({ title: "Fitur belum aktif", description: edgeFunctionDisabledMessage, variant: "destructive" });
      return;
    }

    try {
      let targetId = editingSantri?.id;

      if (!editingSantri) {
        const { data, error } = await supabase.functions.invoke('manage-user', {
          body: {
            action: 'create',
            role: 'santri',
            profile: pickSantriProfileFields(finalFormData),
            initial_password: finalFormData.password,
          },
        });

        if (error) throw error;
        if (!data?.ok || !data?.data?.user_id) {
          throw new Error(data?.error?.message || 'Akun santri gagal dibuat.');
        }
        targetId = data.data.user_id;
      }

      const { error } = await supabase
        .from('santri')
        .update(pickSantriProfileFields(finalFormData))
        .eq('id', targetId);

      if (error) throw error;

      toast({ title: "Berhasil!", description: editingSantri ? "Data santri berhasil diperbarui" : "Santri baru berhasil ditambahkan" });
      loadData(activeTab);
      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      toast({ title: "Gagal!", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (santri) => {
    setEditingSantri(santri);
    setFormData({...santri, points: santri.points || 0, sesi_mengaji: getSessionName(santri.sesi_mengaji)});
    setIsFormOpen(true);
  };
  
  const handleDelete = async () => {
    if (selectedSantri.size === 0) return;

    setIsLoadingData(true);
    let hasReferences = false;
    let errorTables = [];
    const idsToDelete = Array.from(selectedSantri);

    const checkRef = async (table, label, foreignKey = 'santri_id') => {
        try {
            const { data, error } = await supabase.from(table).select('id').in(foreignKey, idsToDelete).limit(1);
            if (data && data.length > 0) {
                hasReferences = true;
                errorTables.push(label);
            }
        } catch (e) {
            console.error(`Error checking reference in ${table}:`, e);
        }
    };

    await checkRef('payments', 'Pembayaran');
    await checkRef('hafalan_progress', 'Hafalan Progress');
    await checkRef('murojaah_submissions', 'Setoran Murojaah');
    await checkRef('santri_notes', 'Catatan Santri');
    await checkRef('jilid_history', 'Riwayat Jilid');
    await checkRef('class_mutations', 'Mutasi Kelas');

    setIsLoadingData(false);

    if (hasReferences) {
        toast({ 
            title: "Gagal Menghapus", 
            description: `Tidak bisa menghapus santri karena masih ada data yang terhubung. Hapus data di tabel berikut terlebih dahulu: ${errorTables.join(', ')}.`, 
            variant: "destructive" 
        });
        return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Santri',
      description: `Yakin ingin menghapus ${selectedSantri.size} data santri terpilih? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        if (!enableEdgeFunctions) {
          toast({ title: "Fitur belum aktif", description: edgeFunctionDisabledMessage, variant: "destructive" });
          return;
        }

        try {
          for (const id of idsToDelete) {
            const { data, error } = await supabase.functions.invoke('manage-user', {
              body: { action: 'deactivate', role: 'santri', target_user_id: id },
            });
            if (error) throw error;
            if (!data?.ok) throw new Error(data?.error?.message || 'Akun santri gagal dinonaktifkan.');
          }

          const { error } = await supabase.from('santri').update({ status: 'Nonaktif' }).in('id', idsToDelete);
          if (error) throw error;

          loadData(activeTab);
          setSelectedSantri(new Set());
          toast({ title: "Berhasil!", description: "Akun santri terpilih berhasil dinonaktifkan" });
        } catch (error) {
          toast({ title: "Gagal!", description: error.message, variant: "destructive" });
        }
      }
    });
  };

  const handleBulkStatusChange = async (status) => {
    if (selectedSantri.size === 0) return;
    const confirmationText = status === 'Aktif' ? 'mengaktifkan' : 'menonaktifkan';
    setConfirmDialog({
      isOpen: true,
      title: 'Ubah Status Santri',
      description: `Yakin ingin ${confirmationText} ${selectedSantri.size} data santri terpilih?`,
      onConfirm: async () => {
        const idsToUpdate = Array.from(selectedSantri);
        if (status === 'Aktif') {
          toast({
            title: "Aktivasi massal ditunda",
            description: "Mengaktifkan kembali akun perlu operasi backend resmi agar status Supabase Auth dan tabel santri tetap konsisten.",
            variant: "destructive"
          });
          return;
        }

        if (!enableEdgeFunctions) {
          toast({ title: "Fitur belum aktif", description: edgeFunctionDisabledMessage, variant: "destructive" });
          return;
        }

        try {
          for (const id of idsToUpdate) {
            const { data, error } = await supabase.functions.invoke('manage-user', {
              body: { action: 'deactivate', role: 'santri', target_user_id: id },
            });
            if (error) throw error;
            if (!data?.ok) throw new Error(data?.error?.message || 'Akun santri gagal dinonaktifkan.');
          }

          const { error } = await supabase.from('santri').update({ status }).in('id', idsToUpdate);
          if (error) throw error;

          loadData(activeTab);
          setSelectedSantri(new Set());
          toast({ title: "Berhasil!", description: `Status santri terpilih berhasil diubah menjadi ${status}.` });
        } catch (error) {
          toast({ title: "Gagal!", description: error.message, variant: "destructive" });
        }
      }
    });
  };

  const handleMigration = async () => {
      if (!editingSantri) return;
      
      setConfirmDialog({
          isOpen: true,
          title: 'Migrasi ke Dewasa',
          description: `Yakin ingin memindahkan ${editingSantri.nama_lengkap} ke kategori DEWASA? Santri akan dikeluarkan dari kelas saat ini.`,
          onConfirm: async () => {
              toast({
                  title: "Migrasi ditunda",
                  description: "Migrasi kategori/kelas perlu operasi backend atomik agar current_class_id dan class_memberships tetap konsisten.",
                  variant: "destructive"
              });
          }
      });
  };

  const toggleSelect = (id) => {
    const newSelection = new Set(selectedSantri);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedSantri(newSelection);
  };
  
  const toggleSelectAll = (isChecked) => {
    if (isChecked) setSelectedSantri(new Set(sortedAndFilteredSantri.map(s => s.id)));
    else setSelectedSantri(new Set());
  };

  const resetForm = () => {
    setFormData({
      nama_lengkap: '', nama_panggilan: '', nomor_induk_qiroati: '', jenis_kelamin: 'Laki-laki', tempat_lahir: '', tanggal_lahir: '', tanggal_pendaftaran: '',
      nama_ayah: '', nama_ibu: '', no_hp_ortu: '', alamat: '', status: 'Aktif', foto_url: '', password: '', sesi_mengaji: sessionOptions[0] || 'Pagi', rfid_tag: '',
      jilid: 'Pra TK A', no_kk: '', no_nik: '', berkas_foto: false, berkas_akta: false, berkas_kk: false, berkas_form: false, link_qiroati: '', id_kelas: null, points: 0, kategori: activeTab === 'ptpt' ? 'PTPT' : 'Anak'
    });
    setEditingSantri(null);
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
  };

  const handleCopyRFID = (rfid) => {
    if (!rfid) {
        toast({ title: "Gagal", description: "Tidak ada RFID tag untuk disalin.", variant: "destructive" });
        return;
    }
    navigator.clipboard.writeText(rfid).then(() => {
        toast({ 
            title: "RFID Copied!", 
            description: "RFID tag disalin ke clipboard.", 
            className: "bg-green-50 border-green-200 text-green-700",
            action: <CheckCircle className="w-5 h-5 text-green-600"/>
        });
    }).catch(err => {
        console.error('Failed to copy RFID: ', err);
        toast({ title: "Gagal Copy", description: "Tidak bisa menyalin RFID.", variant: "destructive" });
    });
  };

  const handleCopyIndukQiroati = (induk) => {
    if (!induk) {
        toast({ title: "Gagal", description: "Nomor Induk Qiroati tidak tersedia.", variant: "destructive" });
        return;
    }
    navigator.clipboard.writeText(induk).then(() => {
        toast({ 
            title: "No Induk Qiroati Copied!", 
            description: "Nomor induk disalin ke clipboard.", 
            className: "bg-green-50 border-green-200 text-green-700",
            action: <CheckCircle className="w-5 h-5 text-green-600"/>
        });
    }).catch(err => {
        console.error('Failed to copy Induk: ', err);
        toast({ title: "Gagal Copy", description: "Tidak bisa menyalin Nomor Induk.", variant: "destructive" });
    });
  };
  
  const sortedAndFilteredSantri = useMemo(() => {
    let sortableItems = [...santriList];
    if (filters.sesi !== 'all') sortableItems = sortableItems.filter(s => getSessionName(s.sesi_mengaji) === filters.sesi);
    if (filters.jilid !== 'all') sortableItems = sortableItems.filter(s => s.jilid === filters.jilid);
    if (filters.rfid !== 'all') {
        sortableItems = sortableItems.filter(s => filters.rfid === 'assigned' ? !!s.rfid_tag : !s.rfid_tag);
    }
    if (filters.search) {
      const lowercasedFilter = filters.search.toLowerCase();
      sortableItems = sortableItems.filter(s => 
        s.nama_lengkap.toLowerCase().includes(lowercasedFilter) || 
        (s.nama_panggilan && s.nama_panggilan.toLowerCase().includes(lowercasedFilter)) ||
        (s.nama_ayah && s.nama_ayah.toLowerCase().includes(lowercasedFilter)) ||
        (s.rfid_tag && s.rfid_tag.toLowerCase().includes(lowercasedFilter))
      );
    }
    sortableItems.sort((a, b) => {
      if (sortConfig.key === 'guru_pengampu') {
        const nameA = classGuruMap[a.current_class_id || a.id_kelas] || 'zzzz';
        const nameB = classGuruMap[b.current_class_id || b.id_kelas] || 'zzzz';
        if (nameA < nameB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (nameA > nameB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      }
      if (!a[sortConfig.key] || !b[sortConfig.key]) return 0;
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [santriList, filters, sortConfig, classGuruMap]);

  return (
    <div className="bg-card p-6 rounded-2xl shadow-xl">
      <div className="flex justify-center mb-6 mt-2">
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full gap-1">
              {subTabs.map((tab) => (
                  <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                          relative px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-out flex items-center gap-2
                          ${activeTab === tab.id ? 'text-primary' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}
                      `}
                  >
                      {activeTab === tab.id && (
                          <motion.div
                              layoutId="santri-subtab-pill"
                              className="absolute inset-0 bg-white dark:bg-slate-700 shadow-sm rounded-full"
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                      )}
                      <span className="relative z-10 flex items-center gap-2">
                          <tab.icon className="w-4 h-4" />
                          {tab.label}
                      </span>
                  </button>
              ))}
          </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                <Users className="w-8 h-8" />
             </div>
             <div>
                <h2 className="text-2xl font-bold text-foreground">Manajemen Santri ({activeTab.toUpperCase()})</h2>
                <p className="text-muted-foreground text-sm">Kelola data santri, jilid, dan status aktif.</p>
             </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
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

            {selectedSantri.size > 0 && (
                <div className="flex bg-muted/50 p-1 rounded-lg border border-border mr-2">
                    <Button variant="ghost" size="sm" onClick={() => handleBulkStatusChange('Aktif')} className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50">
                        <CheckCircle className="w-4 h-4 mr-1"/> Aktifkan
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleBulkStatusChange('Nonaktif')} className="h-8 px-2 text-orange-500 hover:text-orange-600 hover:bg-orange-50">
                        <XCircle className="w-4 h-4 mr-1"/> Non-Aktif
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDelete} className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="w-4 h-4 mr-1"/> Hapus ({selectedSantri.size})
                    </Button>
                </div>
            )}
            <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
                 <Button variant="ghost" size="sm" onClick={() => setIsBulkUploadOpen(true)} className="h-8 px-2 hover:bg-background shadow-none">
                    <Upload className="w-4 h-4 mr-2 text-blue-600"/> Import
                 </Button>
                 <Button variant="ghost" size="sm" onClick={handleDownloadData} className="h-8 px-2 hover:bg-background shadow-none">
                    <Download className="w-4 h-4 mr-2 text-green-600"/> Export
                 </Button>
            </div>
            <Button onClick={() => { resetForm(); setIsFormOpen(true); }} className="bg-primary hover:bg-primary/90 shadow-md">
                <Plus className="w-4 h-4 mr-2"/> Tambah Santri
            </Button>
          </div>
      </div>

       <Card className="bg-slate-50 dark:bg-slate-900/50 border-none shadow-sm mb-6 mt-6">
            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                 <div className="relative flex-grow w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                    <Input 
                        placeholder="Cari santri berdasarkan nama, wali, atau RFID..." 
                        value={filters.search} 
                        onChange={e => setFilters(f => ({...f, search: e.target.value}))} 
                        className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                 </div>
                 <div className="grid grid-cols-3 gap-2 w-full md:w-auto min-w-[400px]">
                    <Select value={filters.sesi} onValueChange={val => setFilters(f => ({...f, sesi: val}))}>
                        <SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue placeholder="Sesi" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Semua Sesi</SelectItem>{sessionOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filters.jilid} onValueChange={val => setFilters(f => ({...f, jilid: val}))}>
                        <SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue placeholder="Jilid" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Semua Jilid</SelectItem>{jilidOptions.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filters.rfid} onValueChange={val => setFilters(f => ({...f, rfid: val}))}>
                        <SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue placeholder="RFID" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Semua RFID</SelectItem><SelectItem value="assigned">Ada RFID</SelectItem><SelectItem value="unassigned">Tanpa RFID</SelectItem></SelectContent>
                    </Select>
                 </div>
            </CardContent>
        </Card>

      {fetchError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl mb-4 flex items-center justify-between">
          <p className="font-medium">Gagal memuat data santri: <span className="font-normal">{fetchError}</span></p>
          <Button variant="outline" size="sm" onClick={() => loadData(activeTab)}>Coba Lagi</Button>
        </div>
      )}

      <div className="overflow-auto max-h-[65vh] border rounded-lg shadow-sm relative">
        {isLoadingData && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-muted-foreground font-medium">Sedang memproses data...</p>
            </div>
        )}
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card z-10 shadow-sm backdrop-blur-md">
            <tr className="border-b bg-muted/30">
              <th className="p-3 w-10"><Checkbox onCheckedChange={toggleSelectAll} checked={sortedAndFilteredSantri.length > 0 && selectedSantri.size === sortedAndFilteredSantri.length} /></th>
              <th className="p-3 text-left w-12 text-xs font-semibold text-muted-foreground uppercase tracking-wider">No.</th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('nama_lengkap')}><div className="flex items-center">Nama <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('tanggal_pendaftaran')}><div className="flex items-center">Tgl Masuk <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('jenis_kelamin')}><div className="flex items-center">L/P <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('guru_pengampu')}><div className="flex items-center">Guru Pengampu <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('jilid')}><div className="flex items-center">Jilid <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('sesi_mengaji')}><div className="flex items-center">Sesi <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Berkas</th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800">
            {sortedAndFilteredSantri.map((santri, index) => (
              <tr key={santri.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group">
                <td className="p-3"><Checkbox onCheckedChange={() => toggleSelect(santri.id)} checked={selectedSantri.has(santri.id)} /></td>
                <td className="p-3 text-muted-foreground font-mono text-xs">{index + 1}</td>
                <td className="p-3">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-105 transition-transform" onClick={() => setPreviewImage(santri.foto_url)}>
                            <AvatarImage src={santri.foto_url} />
                            <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-xs">{santri.nama_lengkap.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <div 
                                className="font-medium text-foreground cursor-pointer hover:text-blue-600 hover:underline flex items-center gap-1 group/name" 
                                onClick={() => handleCopyRFID(santri.rfid_tag)}
                                title="Klik untuk menyalin RFID"
                            >
                                {santri.nama_lengkap}
                                <Copy className="w-3 h-3 opacity-0 group-hover/name:opacity-50" />
                            </div>
                            <div 
                                className="text-xs text-muted-foreground font-mono cursor-pointer hover:text-green-600 hover:underline flex items-center gap-1 group/nick" 
                                onClick={() => handleCopyIndukQiroati(santri.nomor_induk_qiroati)}
                                title="Klik untuk menyalin No Induk Qiroati"
                            >
                                {santri.nama_panggilan}
                                <Copy className="w-3 h-3 opacity-0 group-hover/nick:opacity-50" />
                            </div>
                        </div>
                    </div>
                </td>
                <td className="p-3 text-sm text-muted-foreground">{new Date(santri.tanggal_pendaftaran).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: '2-digit'})}</td>
                <td className="p-3"><Badge variant="outline" className={santri.jenis_kelamin === 'Laki-laki' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-pink-50 text-pink-700 border-pink-200"}>{santri.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'}</Badge></td>
                <td className="p-3 text-sm font-medium text-foreground">{classGuruMap[santri.current_class_id || santri.id_kelas] || <span className="text-muted-foreground italic text-xs">Belum ada</span>}</td>
                <td className="p-3"><Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">{santri.jilid}</Badge></td>
                <td className="p-3"><span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{getSessionName(santri.sesi_mengaji)}</span></td>
                <td className="p-3"><div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 border"><FileCheck className={`w-4 h-4 ${santri.berkas_foto && santri.berkas_akta && santri.berkas_kk && santri.berkas_form ? 'text-green-500' : 'text-slate-300'}`} /></div></td>
                <td className="p-3"><Button onClick={() => handleEdit(santri)} size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 rounded-full"><Edit className="w-4 h-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoadingData && sortedAndFilteredSantri.length === 0 && !fetchError && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mb-2 opacity-20"/>
                <p>Tidak ada data santri ditemukan.</p>
            </div>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>{editingSantri ? `Edit Data Santri ${activeTab.toUpperCase()}` : `Tambah Santri ${activeTab.toUpperCase()} Baru`}</DialogTitle></DialogHeader>
          
          <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            <div className="space-y-6 overflow-y-auto flex-1 pr-2">
            
                {/* 1. Header & Photo Section */}
                <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-muted/20 rounded-xl border">
                    <Avatar className="w-24 h-24 border-4 border-background shadow-md cursor-pointer hover:opacity-80 transition-opacity" onClick={() => formData.foto_url && setPreviewImage(formData.foto_url)}>
                        <AvatarImage src={formData.foto_url} />
                        <AvatarFallback><Upload /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 w-full space-y-2">
                        <div className="flex gap-2">
                             <Button type="button" onClick={triggerPhotoUpload} variant="outline" disabled={isUploading || !enableEdgeFunctions || !editingSantri?.id} title={!enableEdgeFunctions ? edgeFunctionDisabledMessage : (!editingSantri?.id ? 'Simpan akun sebelum upload avatar.' : undefined)}>{isUploading ? 'Mengunggah...' : 'Upload Foto'}</Button>
                             <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" />
                        </div>
                        <p className="text-[10px] text-muted-foreground">JPG, PNG, WebP (Max 2 MB). Simpan akun baru sebelum upload.</p>
                        <div className="relative">
                            <Input type="text" placeholder="https://example.com/foto.jpg" value={formData.foto_url || ''} onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })} className="pl-9 text-xs" />
                            <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground"/>
                        </div>
                    </div>
                </div>

                {/* 2. Personal Information Section */}
                <div>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2"><User className="w-5 h-5"/> Informasi Pribadi</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Nama Lengkap</label><Input type="text" value={formData.nama_lengkap || ''} onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })} required /></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Nama Panggilan</label><Input type="text" value={formData.nama_panggilan || ''} onChange={handleNicknameChange} required /></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Jenis Kelamin</label><Select value={formData.jenis_kelamin} onValueChange={val => setFormData({ ...formData, jenis_kelamin: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Laki-laki">Laki-laki</SelectItem><SelectItem value="Perempuan">Perempuan</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Tempat Lahir</label><Input type="text" value={formData.tempat_lahir || ''} onChange={(e) => setFormData({ ...formData, tempat_lahir: e.target.value })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Tanggal Lahir</label><Input type="date" value={formData.tanggal_lahir || ''} onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })} required /></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Tanggal Masuk</label><Input type="date" value={formData.tanggal_pendaftaran || ''} onChange={(e) => setFormData({ ...formData, tanggal_pendaftaran: e.target.value })} required /></div>
                    </div>
                </div>

                {/* 3. Family & Contact Section */}
                <div>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2"><Users className="w-5 h-5"/> Keluarga & Kontak</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Nama Ayah</label><Input type="text" value={formData.nama_ayah || ''} onChange={(e) => setFormData({ ...formData, nama_ayah: e.target.value })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Nama Ibu</label><Input type="text" value={formData.nama_ibu || ''} onChange={(e) => setFormData({ ...formData, nama_ibu: e.target.value })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">No. HP Wali</label><Input type="tel" value={formData.no_hp_ortu || ''} onChange={(e) => setFormData({ ...formData, no_hp_ortu: e.target.value })} required /></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">No. KK</label><Input type="text" value={formData.no_kk || ''} onChange={(e) => setFormData({ ...formData, no_kk: e.target.value })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">No. NIK</label><Input type="text" value={formData.no_nik || ''} onChange={(e) => setFormData({ ...formData, no_nik: e.target.value })} /></div>
                        <div className="col-span-full space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Alamat</label><Textarea value={formData.alamat || ''} onChange={(e) => setFormData({ ...formData, alamat: e.target.value })} className="min-h-[60px]" required /></div>
                    </div>
                </div>

                {/* 4. Academic Section */}
                <div>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2"><GraduationCap className="w-5 h-5"/> Akademik & Sistem</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">No. Induk Qiroati</label><Input type="text" value={formData.nomor_induk_qiroati || ''} onChange={handleQiroatiIdChange} required /></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">RFID Tag</label><Input type="text" value={formData.rfid_tag || ''} onChange={(e) => setFormData({ ...formData, rfid_tag: e.target.value })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Status</label><Select value={formData.status} onValueChange={val => setFormData({ ...formData, status: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Aktif">Aktif</SelectItem><SelectItem value="Nonaktif">Non-Aktif</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Sesi Mengaji</label><Select value={formData.sesi_mengaji} onValueChange={val => setFormData({ ...formData, sesi_mengaji: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sessionOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Jilid</label><Select value={formData.jilid} onValueChange={val => setFormData({ ...formData, jilid: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{jilidOptions.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Link Qiroati</label><Input type="text" value={formData.link_qiroati || ''} onChange={(e) => setFormData({ ...formData, link_qiroati: e.target.value })} /></div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500"/> Poin Gamifikasi</label>
                            <Input type="number" min="0" value={formData.points || 0} onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>

                    <div className="mt-4 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-yellow-700 dark:text-yellow-500"><Lock className="w-4 h-4"/> Akses Login</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Username</label><Input type="text" value={formData.nama_panggilan || ''} className="bg-white/50" readOnly /></div>
                            <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Password</label><Input type="text" value={formData.password || ''} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required /></div>
                        </div>
                    </div>
                </div>

                {/* 5. Document Section */}
                <div>
                     <h3 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center gap-2"><FileText className="w-5 h-5"/> Kelengkapan Berkas</h3>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2"><Checkbox id="berkas_foto" checked={formData.berkas_foto} onCheckedChange={c => setFormData({...formData, berkas_foto: c})} /><label htmlFor="berkas_foto" className="text-sm cursor-pointer">Foto</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="berkas_akta" checked={formData.berkas_akta} onCheckedChange={c => setFormData({...formData, berkas_akta: c})} /><label htmlFor="berkas_akta" className="text-sm cursor-pointer">Akta Kelahiran</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="berkas_kk" checked={formData.berkas_kk} onCheckedChange={c => setFormData({...formData, berkas_kk: c})} /><label htmlFor="berkas_kk" className="text-sm cursor-pointer">Kartu Keluarga</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="berkas_form" checked={formData.berkas_form} onCheckedChange={c => setFormData({...formData, berkas_form: c})} /><label htmlFor="berkas_form" className="text-sm cursor-pointer">Formulir</label></div>
                    </div>
                </div>

            </div>

            <DialogFooter className="pt-4 mt-auto border-t">
                {editingSantri && (
                    <Button type="button" variant="outline" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200 mr-auto" onClick={handleMigration}>
                        <ArrowRightLeft className="w-4 h-4 mr-2"/> Migrasi ke Dewasa
                    </Button>
                )}
                <div className="flex gap-2 ml-auto">
                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
                    <Button type="submit">{editingSantri ? 'Simpan Perubahan' : 'Tambah Santri'}</Button>
                </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BulkUploadModal isOpen={isBulkUploadOpen} onClose={() => setIsBulkUploadOpen(false)} onUpload={handleDataProcessing} category={activeTab === 'ptpt' ? 'PTPT' : 'Anak'} />
      <UploadReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} report={uploadReport} onConfirm={confirmBulkUpload} />
      <BirthdayNotificationModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} />
      
      <ConfirmationDialog 
        isOpen={confirmDialog.isOpen} 
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} 
        onConfirm={confirmDialog.onConfirm} 
        title={confirmDialog.title} 
        description={confirmDialog.description} 
      />

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-transparent border-none shadow-none">
            {previewImage && <img src={previewImage} alt="Preview" className="w-full h-auto rounded-lg shadow-2xl" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SantriManagement;
