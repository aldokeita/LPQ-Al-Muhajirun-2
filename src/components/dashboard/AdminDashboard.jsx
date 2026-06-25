
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, DollarSign, BookOpen, TrendingDown, BookUser, Fingerprint, LogIn, FileText, CalendarCheck, Tv, Gamepad2, PieChart, Settings, GraduationCap, Briefcase, Calendar, Calculator, Shuffle, Database, Eye, EyeOff, Library } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SantriManagement from './admin/SantriManagement';
import SantriDewasaManagement from './admin/SantriDewasaManagement';
import GuruManagement from './admin/GuruManagement';
import PaymentSystem from './admin/PaymentSystem';
import PaymentRecap from './admin/PaymentRecap';
import PaymentHistory from './admin/PaymentHistory';
import ContentManagement from './admin/ContentManagement';
import LoginLogs from './admin/LoginLogs';
import ExpenseManagement from './admin/ExpenseManagement';
import ClassManagement from './admin/ClassManagement';
import AttendanceRecap from './admin/AttendanceRecap';
import GuruAttendanceRecap from './admin/GuruAttendanceRecap';
import TvDisplaySettings from './admin/TvDisplaySettings';
import GameConfiguration from './admin/GameConfiguration';
import CalendarManagement from './admin/CalendarManagement';
import SalaryCalculation from './admin/SalaryCalculation';
import BackupRestoreManagement from './admin/BackupRestoreManagement';
import MMQManagement from './admin/MMQManagement';
import { supabase } from '@/lib/customSupabaseClient';
import { enableDeferredFeatures } from '@/lib/featureFlags';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import GlobalSearch from './shared/GlobalSearch';
import SantriDetailModal from './shared/SantriDetailModal';
import { toast } from '@/components/ui/use-toast';
import { fetchCashflowSummary } from '@/lib/financeAdapters';

const MaskedValue = ({ value, show, prefix = "Rp " }) => (
    <AnimatePresence mode="wait">
        {show ? (
            <motion.span
                key="value"
                initial={{ opacity: 0, filter: "blur(5px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(5px)" }}
                transition={{ duration: 0.3 }}
            >
                {prefix}{value.toLocaleString('id-ID')}
            </motion.span>
        ) : (
            <motion.span
                key="masked"
                initial={{ opacity: 0, filter: "blur(5px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(5px)" }}
                transition={{ duration: 0.3 }}
                className="font-mono tracking-widest"
            >
                {prefix}••••••
            </motion.span>
        )}
    </AnimatePresence>
);

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Query timeout exceeded')), ms)
  );
  return Promise.race([promise, timeout]);
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("santri");
  const [stats, setStats] = useState({
    totalSantri: 0,
    totalPemasukanBulanIni: 0,
    totalPengeluaranBulanIni: 0
  });

  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  
  // State for global search navigation
  const [selectedSantri, setSelectedSantri] = useState(null);
  const [isSantriModalOpen, setIsSantriModalOpen] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        
        const santriQuery = supabase.from('santri').select('*', { count: 'exact', head: true }).in('status', ['Aktif', 'active']);
        const [santriResult, financeSummary] = await Promise.all([
          withTimeout(santriQuery, 10000),
          fetchCashflowSummary({ year: currentYear, month: currentMonth })
        ]);

        const { count: santriCount, error: santriErr } = santriResult;
        if (santriErr) throw new Error(`Santri query failed: ${santriErr.message}`);

        setStats({
          totalSantri: santriCount || 0,
          totalPemasukanBulanIni: financeSummary.totalPemasukan,
          totalPengeluaranBulanIni: financeSummary.totalPengeluaran
        });
      } catch (err) {
        setError(err.message);
        toast({
          title: "Gagal memuat data",
          description: "Terjadi kesalahan saat memuat statistik dashboard. " + err.message,
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  const handleGlobalSearchNavigate = async (item, category) => {
    try {
      switch (category) {
        case 'santri':
          const { data: fullSantri } = await supabase.from('santri').select('*, class:id_kelas(nama_kelas, id_guru)').eq('id', item.id).single();
          if (fullSantri) {
            setSelectedSantri(fullSantri);
            setIsSantriModalOpen(true);
          } else {
             toast({ title: "Gagal", description: "Data santri tidak ditemukan.", variant: "destructive" });
          }
          break;
        case 'guru':
          setActiveTab('guru');
          toast({ title: "Navigasi", description: `Menuju profil guru: ${item.nama}` });
          break;
        case 'kelas':
          setActiveTab('kelas');
          toast({ title: "Navigasi", description: `Menuju kelas: ${item.nama_kelas}` });
          break;
        case 'pembayaran':
          setActiveTab('history');
          toast({ title: "Navigasi", description: `Menuju riwayat pembayaran ${item.santri?.nama_lengkap || ''}` });
          break;
        case 'hafalan':
          if (item.santri?.id) {
             const { data: santriFromHafalan } = await supabase.from('santri').select('*, class:id_kelas(nama_kelas, id_guru)').eq('id', item.santri.id).single();
             if (santriFromHafalan) {
                setSelectedSantri(santriFromHafalan);
                setIsSantriModalOpen(true);
             }
          } else {
             setActiveTab('santri');
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error("Navigation error:", error);
      toast({ title: "Error", description: "Terjadi kesalahan saat navigasi.", variant: "destructive" });
    }
  };

  const adminTabs = [
    { value: 'santri', label: 'Data Santri', icon: Users },
    { value: 'kelas', label: 'Manajemen Kelas', icon: BookOpen },
    { value: 'guru', label: 'Data Guru', icon: BookUser },
    { value: 'rekap-absensi', label: 'Rekap Santri', icon: CalendarCheck },
    { value: 'rekap-guru', label: 'Rekap Guru', icon: GraduationCap },
    { value: 'mmq', label: 'MMQ', icon: Library },
    { value: 'salary', label: 'Bisyaroh', icon: Calculator },
    { value: 'academic-calendar', label: 'Kalender', icon: Calendar },
    { value: 'payment', label: 'Pembayaran', icon: DollarSign },
    { value: 'recap', label: 'Rekap SPP', icon: PieChart },
    { value: 'history', label: 'Riwayat Bayar', icon: FileText },
    { value: 'expense', label: 'Pengeluaran', icon: TrendingDown },
    { value: 'tv-settings', label: 'Pengaturan TV', icon: Tv },
    { value: 'game-config', label: 'Konfigurasi Game', icon: Settings },
    { value: 'backup', label: 'Backup & Restore', icon: Database },
    { value: 'content', label: 'Konten', icon: FileText },
    { value: 'logs', label: 'Log Login', icon: LogIn },
  ].filter(tab => enableDeferredFeatures || !['game-config', 'backup'].includes(tab.value));
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      
      {/* Global Search Section */}
      <div className="mb-8 relative z-50">
        <GlobalSearch onNavigate={handleGlobalSearchNavigate} />
      </div>

      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-foreground font-serif">Dashboard Administrator</h1>
            <p className="text-muted-foreground">Kelola seluruh sistem LPQ Al-Muhajirun</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate('/tv-display-mode')} className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md group border-none">
                <Tv className="w-4 h-4 mr-2 group-hover:animate-pulse"/> TV Display Mode
            </Button>
            {enableDeferredFeatures && (
                <>
                    <Button onClick={() => navigate('/gatcha-game')} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md border-none">
                        <Gamepad2 className="w-4 h-4 mr-2"/> Play Gatcha
                    </Button>
                    <Button onClick={() => navigate('/quiz-hafalan')} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md border-none">
                        <Gamepad2 className="w-4 h-4 mr-2"/> Play Quiz
                    </Button>
                    <Button onClick={() => navigate('/random-name')} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md border-none">
                        <Shuffle className="w-4 h-4 mr-2"/> Acak Nama
                    </Button>
                </>
            )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl mb-6 flex items-center justify-between">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Coba Lagi</Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 relative z-10">
        {isLoading ? (
            <>
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
            </>
        ) : (
            <>
                <div className="relative overflow-hidden bg-gradient-to-br from-primary to-green-800 p-4 md:p-6 rounded-xl shadow-lg text-primary-foreground transform transition-all duration-200 hover:scale-105 hover:shadow-xl hover:-translate-y-1 cursor-default group border border-primary/20">
                    <div className="absolute -right-6 -top-6 bg-white/10 rounded-full w-24 h-24 blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div><p className="text-primary-foreground/80 text-xs md:text-sm font-medium">Santri Aktif</p><p className="text-2xl md:text-3xl font-bold mt-2">{stats.totalSantri}</p></div>
                        <Users className="w-8 h-8 md:w-10 md:h-10 text-primary-foreground/60" />
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-transparent opacity-50"></div>
                </div>
                <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 md:p-6 rounded-xl shadow-lg text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl hover:-translate-y-1 cursor-default group border border-emerald-500/20">
                    <div className="absolute -right-6 -top-6 bg-white/10 rounded-full w-24 h-24 blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <p className="text-emerald-100 text-xs md:text-sm font-medium">Pemasukan</p>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setShowIncome(!showIncome); }} 
                                    className="text-emerald-200 hover:text-white transition-colors"
                                >
                                    {showIncome ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-xl md:text-2xl font-bold">
                                <MaskedValue value={stats.totalPemasukanBulanIni} show={showIncome} />
                            </p>
                        </div>
                        <DollarSign className="w-8 h-8 md:w-10 md:h-10 text-emerald-200" />
                    </div>
                     <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-300 to-transparent opacity-50"></div>
                </div>
                <div className="relative overflow-hidden bg-gradient-to-br from-teal-500 to-teal-700 p-4 md:p-6 rounded-xl shadow-lg text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl hover:-translate-y-1 cursor-default group border border-teal-500/20">
                    <div className="absolute -right-6 -top-6 bg-white/10 rounded-full w-24 h-24 blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <p className="text-teal-100 text-xs md:text-sm font-medium">Pengeluaran</p>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setShowExpense(!showExpense); }} 
                                    className="text-teal-200 hover:text-white transition-colors"
                                >
                                    {showExpense ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-xl md:text-2xl font-bold">
                                <MaskedValue value={stats.totalPengeluaranBulanIni} show={showExpense} />
                            </p>
                        </div>
                        <TrendingDown className="w-8 h-8 md:w-10 md:h-10 text-teal-200" />
                    </div>
                     <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-teal-300 to-transparent opacity-50"></div>
                </div>
                
                <div 
                    onClick={() => navigate('/absensi-digital')}
                    className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-950 p-4 md:p-6 rounded-xl shadow-lg text-white cursor-pointer transform transition-all duration-200 hover:scale-105 hover:shadow-xl hover:-translate-y-1 border border-accent/30 group"
                >
                    <div className="absolute inset-0 bg-accent/5 group-hover:bg-accent/10 transition-colors"></div>
                    <div className="flex items-center justify-between h-full relative z-10">
                        <div>
                            <p className="text-accent text-xs md:text-sm font-mono mb-1 tracking-wider">MODE KIOSK</p>
                            <p className="text-lg md:text-xl font-bold group-hover:text-accent-foreground transition-colors text-white">Absensi Digital</p>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-accent blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                            <Fingerprint className="w-8 h-8 md:w-10 md:h-10 text-accent relative z-10" />
                        </div>
                    </div>
                </div>
            </>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 relative z-0">
        <div className="relative w-full mb-6">
          <div className="flex overflow-x-auto gap-1 pb-4 md:pb-2 no-scrollbar items-center -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
            {adminTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`
                  relative px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-all duration-300 ease-out flex-shrink-0 group outline-none focus:outline-none border
                  ${activeTab === tab.value 
                    ? 'text-primary-foreground border-primary' 
                    : 'text-foreground/70 hover:text-foreground bg-card hover:bg-secondary/50 border-transparent'}
                `}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {activeTab === tab.value && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 bg-primary rounded-full shadow-md shadow-primary/20"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    style={{ zIndex: 0 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <tab.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeTab === tab.value ? 'text-primary-foreground' : 'group-hover:scale-110 transition-transform'}`} />
                  <span className="whitespace-nowrap">{tab.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            <TabsContent value="rekap-absensi"><AttendanceRecap /></TabsContent>
            <TabsContent value="rekap-guru"><GuruAttendanceRecap /></TabsContent>
            <TabsContent value="mmq"><MMQManagement /></TabsContent>
            <TabsContent value="salary"><SalaryCalculation /></TabsContent>
            <TabsContent value="academic-calendar"><CalendarManagement /></TabsContent>
            
            <TabsContent value="santri">
            <Tabs defaultValue="tpq" className="w-full">
                <div className="flex justify-center mb-6">
                <div className="inline-flex bg-secondary/30 dark:bg-card p-1 rounded-full shadow-inner border border-border">
                    <TabsList className="bg-transparent p-0 h-auto gap-1">
                        {['tpq', 'dewasa'].map(subTab => (
                            <TabsTrigger 
                                key={subTab}
                                value={subTab} 
                                className="rounded-full px-6 py-2 text-sm data-[state=active]:bg-primary dark:data-[state=active]:bg-primary data-[state=active]:shadow-sm data-[state=active]:text-primary-foreground transition-all flex items-center gap-2 text-foreground/70"
                            >
                                {subTab === 'tpq' ? <Users className="w-3.5 h-3.5"/> : <Briefcase className="w-3.5 h-3.5"/>}
                                {subTab === 'tpq' ? 'Santri TPQ' : 'Santri Dewasa'}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>
                </div>
                <TabsContent value="tpq" className="mt-0"><SantriManagement /></TabsContent>
                <TabsContent value="dewasa" className="mt-0"><SantriDewasaManagement /></TabsContent>
            </Tabs>
            </TabsContent>
            
            <TabsContent value="kelas"><ClassManagement /></TabsContent>
            <TabsContent value="guru"><GuruManagement /></TabsContent>
            <TabsContent value="payment"><PaymentSystem /></TabsContent>
            <TabsContent value="expense"><ExpenseManagement /></TabsContent>
            <TabsContent value="tv-settings"><TvDisplaySettings /></TabsContent>
            <TabsContent value="game-config"><GameConfiguration /></TabsContent>
            <TabsContent value="backup"><BackupRestoreManagement /></TabsContent>
            <TabsContent value="history"><PaymentHistory /></TabsContent>
            <TabsContent value="recap"><PaymentRecap /></TabsContent>
            <TabsContent value="content"><ContentManagement /></TabsContent>
            <TabsContent value="logs"><LoginLogs /></TabsContent>
        </div>
      </Tabs>

      {/* Global Modals for Search Navigation */}
      <SantriDetailModal 
        santri={selectedSantri}
        isOpen={isSantriModalOpen}
        onOpenChange={setIsSantriModalOpen}
      />
    </div>
  );
};

export default AdminDashboard;
