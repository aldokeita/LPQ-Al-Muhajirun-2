
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Database, Download, Upload, FileJson, FileSpreadsheet, FileText, AlertTriangle, Loader2, Save, Lock, Eye, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { enableEdgeFunctions, edgeFunctionDisabledMessage } from '@/lib/featureFlags';

const BackupRestoreManagement = () => {
    const { toast } = useToast();
    const { role, user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [restoreFile, setRestoreFile] = useState(null);
    const [restoreData, setRestoreData] = useState(null);
    const [showConfirmRestore, setShowConfirmRestore] = useState(false);
    const [progress, setProgress] = useState('');
    const [activeTab, setActiveTab] = useState("backup");
    
    // Password Protection States
    const [passwordDialog, setPasswordDialog] = useState({ isOpen: false, action: null, format: null }); // action: 'backup' or 'restore'
    const [passwordInput, setPasswordInput] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    if (role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Akses Ditolak</h2>
                <p className="text-slate-600 dark:text-slate-400 mt-2">Anda tidak memiliki akses ke fitur ini. Hanya admin yang dapat mengakses backup/restore.</p>
            </div>
        );
    }

    if (!enableEdgeFunctions) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg"><Database className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
                        <div><CardTitle className="text-2xl font-bold">Backup & Restore Database</CardTitle><CardDescription>{edgeFunctionDisabledMessage}</CardDescription></div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Fitur belum aktif</AlertTitle>
                        <AlertDescription>{edgeFunctionDisabledMessage}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    const generateFilename = (type, ext) => {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
        return `backup-lpq-${type}-${dateStr}-${timeStr}.${ext}`;
    };

    // Initiate Backup with Password Check
    const initiateBackup = (format) => {
        setPasswordInput('');
        setPasswordDialog({ isOpen: true, action: 'backup', format });
    };

    // Initiate Restore with Password Check
    const initiateRestore = () => {
        setPasswordInput('');
        setPasswordDialog({ isOpen: true, action: 'restore', format: null });
    };

    const verifyAndProceed = async () => {
        if (!passwordInput) {
            toast({ title: "Gagal", description: "Password wajib diisi.", variant: "destructive" });
            return;
        }
        
        setIsVerifying(true);
        try {
            console.log("Verifying admin password via Supabase Auth...");
            const { data, error } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: passwordInput
            });

            if (error) {
                console.error("Password verification error:", error.message);
                throw new Error("Password salah atau verifikasi gagal.");
            }
            if (!data?.user) {
                console.error("Password Verification Failed: Empty data returned");
                throw new Error("Password salah atau akun tidak ditemukan.");
            }

            // If verified
            toast({ title: "Verifikasi Berhasil", description: "Password benar. Melanjutkan proses...", className: "bg-green-50 text-green-800 border-green-200" });
            setPasswordDialog({ isOpen: false, action: null, format: null });
            
            if (passwordDialog.action === 'backup') {
                executeBackup(passwordDialog.format);
            } else if (passwordDialog.action === 'restore') {
                parseFile();
            }

        } catch (err) {
            console.error("Verification Exception:", err);
            toast({ title: "Verifikasi Gagal", description: err.message || "Terjadi kesalahan saat memverifikasi password.", variant: "destructive" });
        } finally {
            setIsVerifying(false);
        }
    };

    const executeBackup = async (format) => {
        setIsLoading(true);
        setProgress('Mengambil data dari server...');
        try {
            console.log("Invoking 'backup-database' edge function...");
            const { data, error } = await supabase.functions.invoke('backup-database');
            
            if (error) {
                console.error("Backup Edge Function Invoke Error:", error);
                throw new Error(error.message || "Gagal menghubungi fungsi backup di server.");
            }
            
            if (!data) {
                throw new Error("Data tidak diterima dari server.");
            }

            // If the edge function returns an error object inside the data response
            if (data.error) {
                console.error("Backup Edge Function Runtime Error:", data.error);
                throw new Error(data.error);
            }

            setProgress('Memproses file...');

            if (format === 'json') {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = generateFilename('full', 'json');
                a.click();
            } else if (format === 'xlsx') {
                const wb = XLSX.utils.book_new();
                Object.keys(data).forEach(tableName => {
                    if (data[tableName] && data[tableName].length > 0) {
                        const ws = XLSX.utils.json_to_sheet(data[tableName]);
                        XLSX.utils.book_append_sheet(wb, ws, tableName.substring(0, 31)); 
                    }
                });
                XLSX.writeFile(wb, generateFilename('full', 'xlsx'));
            } else if (format === 'csv') {
                const santriData = data['santri'] || [];
                if (santriData.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(santriData);
                    const csv = XLSX.utils.sheet_to_csv(ws);
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = generateFilename('santri', 'csv');
                    a.click();
                    toast({ title: "Info CSV", description: "Format CSV hanya mengunduh data Santri. Gunakan XLSX/JSON untuk backup penuh." });
                } else {
                    toast({ title: "Data Kosong", description: "Tidak ada data santri untuk diexport ke CSV.", variant: "warning" });
                }
            }

            console.log("Backup file successfully generated and downloaded.");
            toast({ title: "Backup Berhasil", description: "File backup telah berhasil dibuat dan diunduh.", className: "bg-green-50 dark:bg-green-900 border-green-200" });
        } catch (error) {
            console.error('Execute Backup Full Error:', error);
            toast({ variant: "destructive", title: "Backup Gagal", description: error.message || "Terjadi kesalahan sistem saat membuat backup." });
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) setRestoreFile(file);
    };

    const parseFile = async () => {
        if (!restoreFile) return;
        setIsLoading(true);
        setProgress('Menganalisis file...');

        try {
            console.log(`Parsing file: ${restoreFile.name}`);
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                const content = e.target.result;
                let parsedData = {};

                try {
                    if (restoreFile.name.endsWith('.json')) {
                        parsedData = JSON.parse(content);
                    } else if (restoreFile.name.endsWith('.xlsx')) {
                        const workbook = XLSX.read(content, { type: 'binary' });
                        workbook.SheetNames.forEach(sheetName => {
                            const rowData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                            parsedData[sheetName] = rowData;
                        });
                    } else if (restoreFile.name.endsWith('.csv')) {
                        const workbook = XLSX.read(content, { type: 'binary' });
                        const sheetName = workbook.SheetNames[0];
                        parsedData['santri'] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                    }

                    if (Object.keys(parsedData).length === 0) {
                        throw new Error("File kosong atau format data tidak dapat diekstrak.");
                    }

                    setRestoreData(parsedData);
                    setShowConfirmRestore(true);
                } catch (parseErr) {
                    console.error("File parsing logic error:", parseErr);
                    toast({ variant: "destructive", title: "Format File Salah", description: parseErr.message || "Gagal mengurai isi file backup." });
                } finally {
                    setIsLoading(false);
                }
            };

            reader.onerror = (e) => {
                console.error("FileReader error:", e);
                toast({ variant: "destructive", title: "Gagal Membaca File", description: "Terjadi kesalahan saat membaca file dari perangkat Anda." });
                setIsLoading(false);
            };

            if (restoreFile.name.endsWith('.json')) reader.readAsText(restoreFile);
            else reader.readAsBinaryString(restoreFile);

        } catch (error) {
            console.error("Parse Setup Error:", error);
            toast({ variant: "destructive", title: "Gagal Setup File", description: error.message || "Gagal memproses file." });
            setIsLoading(false);
        }
    };

    const executeRestore = async () => {
        setIsLoading(true);
        setShowConfirmRestore(false);
        setProgress('Merestore database... (Mohon jangan tutup halaman)');

        try {
            console.log("Invoking 'restore-database' edge function with parsed data...");
            const { data, error } = await supabase.functions.invoke('restore-database', { 
                body: { data: restoreData } 
            });
            
            if (error) {
                console.error("Restore Edge Function Invoke Error:", error);
                throw new Error(error.message || "Gagal memanggil fungsi restore.");
            }

            if (data?.error) {
                console.error("Restore Edge Function Runtime Error:", data.error);
                throw new Error(data.error);
            }

            console.log("Restore successful. Server response:", data);
            toast({ title: "Restore Berhasil", description: "Database telah berhasil dipulihkan dari file backup.", className: "bg-green-50 dark:bg-green-900 border-green-200" });
            
            setRestoreFile(null);
            setRestoreData(null);
        } catch (error) {
            console.error("Execute Restore Full Error:", error);
            toast({ variant: "destructive", title: "Restore Gagal", description: error.message || "Terjadi kesalahan saat memulihkan database." });
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    const tabs = [
        { id: 'backup', label: 'Backup Data', icon: Download },
        { id: 'restore', label: 'Restore Data', icon: Upload },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 shadow-lg">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg"><Database className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
                        <div><CardTitle className="text-2xl font-bold text-slate-800 dark:text-white">Backup & Restore Database</CardTitle><CardDescription>Kelola cadangan data sistem untuk keamanan dan pemulihan bencana.</CardDescription></div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="flex justify-center mb-8">
                            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full gap-1">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            relative px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-out flex items-center gap-2
                                            ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}
                                        `}
                                    >
                                        {activeTab === tab.id && (
                                            <motion.div
                                                layoutId="backup-pill"
                                                className="absolute inset-0 bg-blue-600 dark:bg-blue-500 shadow-sm rounded-full"
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

                        <TabsContent value="backup" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Button variant="outline" className="h-32 flex flex-col items-center justify-center gap-3 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group" onClick={() => initiateBackup('json')} disabled={isLoading}>
                                    <FileJson className="w-10 h-10 text-yellow-500 group-hover:scale-110 transition-transform" />
                                    <div className="text-center"><div className="font-bold text-slate-700 dark:text-slate-200">Format JSON</div><div className="text-xs text-muted-foreground mt-1">Lengkap & Terstruktur</div></div>
                                </Button>
                                <Button variant="outline" className="h-32 flex flex-col items-center justify-center gap-3 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group" onClick={() => initiateBackup('xlsx')} disabled={isLoading}>
                                    <FileSpreadsheet className="w-10 h-10 text-green-600 group-hover:scale-110 transition-transform" />
                                    <div className="text-center"><div className="font-bold text-slate-700 dark:text-slate-200">Format Excel (XLSX)</div><div className="text-xs text-muted-foreground mt-1">Mudah Dibaca & Edit</div></div>
                                </Button>
                                <Button variant="outline" className="h-32 flex flex-col items-center justify-center gap-3 hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group" onClick={() => initiateBackup('csv')} disabled={isLoading}>
                                    <FileText className="w-10 h-10 text-slate-500 group-hover:scale-110 transition-transform" />
                                    <div className="text-center"><div className="font-bold text-slate-700 dark:text-slate-200">Format CSV</div><div className="text-xs text-muted-foreground mt-1">Data Santri Saja</div></div>
                                </Button>
                            </div>
                            
                            {isLoading && (
                                <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-4 rounded-xl flex items-center justify-center gap-3 animate-pulse">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="font-medium">{progress || 'Sedang memproses...'}</span>
                                </div>
                            )}

                            <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                <AlertTitle className="text-amber-800 dark:text-amber-300">Informasi Penting</AlertTitle>
                                <AlertDescription className="text-amber-700 dark:text-amber-400">Backup mencakup seluruh data tabel sistem (Santri, Guru, Kelas, Keuangan, dll). Pastikan simpan file di tempat yang aman karena berisi data sensitif.</AlertDescription>
                            </Alert>
                        </TabsContent>

                        <TabsContent value="restore" className="space-y-6">
                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-sm"><Upload className="w-8 h-8 text-blue-500" /></div>
                                    <div><h3 className="font-semibold text-lg text-slate-700 dark:text-slate-200">Upload File Backup</h3><p className="text-sm text-muted-foreground mt-1">Seret file ke sini atau klik untuk memilih file (JSON, XLSX, CSV)</p></div>
                                    <input type="file" accept=".json,.xlsx,.csv" onChange={handleFileSelect} className="hidden" id="file-upload" disabled={isLoading} />
                                    <label htmlFor="file-upload"><Button variant="outline" className="cursor-pointer" asChild><span>Pilih File</span></Button></label>
                                    {restoreFile && (<div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg mt-2"><FileText className="w-4 h-4" /><span className="font-mono text-sm">{restoreFile.name}</span></div>)}
                                </div>
                            </div>

                            <Button className="w-full h-12 text-lg font-semibold shadow-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" onClick={initiateRestore} disabled={!restoreFile || isLoading}>{isLoading ? <><Loader2 className="w-5 h-5 animate-spin mr-2"/> {progress || 'Memproses...'}</> : 'Mulai Proses Restore'}</Button>

                            <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50">
                                <AlertTriangle className="h-4 w-4" /><AlertTitle>Perhatian Ekstra</AlertTitle><AlertDescription>Proses restore akan menimpa data yang ada jika ditemukan ID yang sama (Upsert). Pastikan file backup valid. Tindakan ini tidak dapat dibatalkan secara otomatis.</AlertDescription>
                            </Alert>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Password Verification Dialog */}
            <Dialog open={passwordDialog.isOpen} onOpenChange={(open) => !open && setPasswordDialog({ ...passwordDialog, isOpen: false })}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-primary">
                            <Lock className="w-5 h-5" /> Verifikasi Keamanan
                        </DialogTitle>
                        <DialogDescription>
                            Masukkan password admin Anda untuk melanjutkan proses <strong>{passwordDialog.action === 'backup' ? 'Backup' : 'Restore'}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="verification-password">Password Admin</Label>
                            <div className="relative">
                                <Input 
                                    id="verification-password" 
                                    type={showPassword ? "text" : "password"} 
                                    value={passwordInput} 
                                    onChange={(e) => setPasswordInput(e.target.value)} 
                                    placeholder="Masukkan password..."
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                </button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPasswordDialog({ ...passwordDialog, isOpen: false })} disabled={isVerifying}>Batal</Button>
                        <Button onClick={verifyAndProceed} disabled={isVerifying || !passwordInput} className="bg-primary">
                            {isVerifying ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Verifikasi'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Restore Dialog */}
            <Dialog open={showConfirmRestore} onOpenChange={setShowConfirmRestore}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5"/> Konfirmasi Restore Database</DialogTitle>
                        <DialogDescription>
                            Anda akan melakukan restore data dari file <strong>{restoreFile?.name}</strong>.
                            <br/><br/>
                            Total Tabel Terdeteksi: <strong>{restoreData ? Object.keys(restoreData).length : 0}</strong>
                            <br/>
                            Data yang ada dengan ID yang sama akan diperbarui. Data baru akan ditambahkan.
                            <br/><br/>
                            Apakah Anda yakin ingin melanjutkan?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter><Button variant="outline" onClick={() => setShowConfirmRestore(false)}>Batal</Button><Button variant="destructive" onClick={executeRestore}>Ya, Lakukan Restore</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BackupRestoreManagement;
