import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { Users, BookOpen, Award, Calendar, CalendarCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ClassManagement from './admin/ClassManagement';
import SantriManagement from './admin/SantriManagement'; 
import GuruAttendanceRecap from '@/components/dashboard/admin/GuruAttendanceRecap';

const PentashihDashboard = () => {
  const { user } = useAuth();
  const [guruData, setGuruData] = useState(null);
  const [activeTab, setActiveTab] = useState("classes");
  const [stats, setStats] = useState({ santri: 0, classes: 0 });
  const [isRecapOpen, setIsRecapOpen] = useState(false);

  // Optimized fetching
  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;

    // Parallel fetch
    const [guruRes, santriCountRes, classCountRes] = await Promise.all([
        supabase.from('guru').select('*').eq('id', user.id).single(),
        supabase.from('santri').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true })
    ]);

    if(guruRes.data) setGuruData(guruRes.data);
    setStats({ 
        santri: santriCountRes.count || 0, 
        classes: classCountRes.count || 0 
    });

  }, [user]);

  useEffect(() => { 
      fetchDashboardData(); 
  }, [fetchDashboardData]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
                <h1 className="text-3xl md:text-4xl font-black uppercase text-purple-700 dark:text-purple-400 font-bold tracking-wide">Dashboard Pentashih</h1>
                <p className="text-muted-foreground">Manajemen Pengujian & Kenaikan Jilid Santri</p>
            </div>
            <div className="flex items-center gap-2">
                 <Button onClick={() => setIsRecapOpen(true)} variant="outline" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                    <CalendarCheck className="w-4 h-4 mr-2"/> Rekap Absensi Guru
                 </Button>
                 <div className="px-3 py-1 bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground"/>
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                 </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
            {/* Stats Cards */}
            <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="bg-white dark:bg-slate-800 border-l-4 border-purple-500 shadow-md hover:shadow-lg transition-all">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full"><Users className="w-8 h-8 text-purple-600"/></div>
                        <div><p className="text-3xl font-black text-slate-800 dark:text-slate-100">{stats.santri}</p><p className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Total Santri</p></div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-slate-800 border-l-4 border-blue-500 shadow-md hover:shadow-lg transition-all">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full"><BookOpen className="w-8 h-8 text-blue-600"/></div>
                        <div><p className="text-3xl font-black text-slate-800 dark:text-slate-100">{stats.classes}</p><p className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Total Kelas</p></div>
                    </CardContent>
                </Card>
            </div>

            {/* Profile Card */}
            <div className="md:col-span-4">
                {guruData ? (
                    <Card className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white h-full shadow-xl relative overflow-hidden border-0">
                         <div className="absolute top-0 right-0 p-4 opacity-10"><Award className="w-32 h-32" /></div>
                         <CardContent className="p-6 flex flex-col justify-center h-full relative z-10">
                            <div className="flex items-center gap-4 mb-2">
                                <Avatar className="w-16 h-16 border-4 border-white/30 shadow-lg">
                                    <AvatarImage src={guruData.foto_url} className="object-cover" />
                                    <AvatarFallback className="text-purple-700 font-bold text-xl bg-white">{guruData.nama?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="text-xl font-bold leading-tight">{guruData.nama}</h2>
                                    <p className="text-purple-200 text-sm font-medium bg-white/20 inline-block px-2 py-0.5 rounded-full mt-1">Pentashih / Penguji</p>
                                </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-white/20 text-sm text-purple-100 flex flex-col gap-1">
                                <span className="opacity-80">NIP / ID: {guruData.rfid_tag || '-'}</span>
                                <span className="opacity-80">{guruData.no_hp}</span>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="h-full bg-slate-200 animate-pulse rounded-xl"></div>
                )}
            </div>
        </div>

        <Tabs defaultValue="classes" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white dark:bg-slate-800 p-1 rounded-lg border shadow-sm inline-flex w-auto">
                <TabsTrigger value="classes" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 px-6"><BookOpen className="w-4 h-4 mr-2"/>Manajemen Per Kelas</TabsTrigger>
                <TabsTrigger value="search" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 px-6"><Users className="w-4 h-4 mr-2"/>Daftar Semua Santri</TabsTrigger>
            </TabsList>

            <TabsContent value="classes" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ClassManagement userRole="pentashih" />
            </TabsContent>

            <TabsContent value="search" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <SantriManagement />
            </TabsContent>
        </Tabs>
        
        {/* Recap Attendance Dialog */}
        <Dialog open={isRecapOpen} onOpenChange={setIsRecapOpen}>
          <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                  <DialogTitle>Rekap Absensi Guru</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                  <GuruAttendanceRecap isReadOnly={true} />
              </div>
          </DialogContent>
        </Dialog>
    </div>
  );
};

export default PentashihDashboard;