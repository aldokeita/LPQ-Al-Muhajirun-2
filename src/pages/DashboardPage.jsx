
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import GuruDashboard from '@/components/dashboard/GuruDashboard';
import SantriDashboard from '@/components/dashboard/SantriDashboard';
import PentashihDashboard from '@/components/dashboard/PentashihDashboard';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';

const DashboardPage = () => {
  const { role, user } = useAuth();
  const [guruProfile, setGuruProfile] = useState(null);
  const [santriProfile, setSantriProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [timeoutTriggered, setTimeoutTriggered] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
      console.log('DashboardPage mounted, Context State:', { role, userId: user?.id });

      let timeoutId;
      if (!role && user) {
        // Fallback timeout to prevent infinite loading if role detection delays
        timeoutId = setTimeout(() => {
          console.warn('Dashboard role detection timeout triggered');
          setTimeoutTriggered(true);
        }, 5000);
      }

      const fetchProfile = async () => {
          setIsLoadingProfile(true);
          try {
            if (role === 'guru' && user) {
                const { data, error } = await supabase.from('guru').select('roles').eq('id', user.id).single();
                if (error) throw error;
                setGuruProfile(data);
            } else if (role === 'santri' && user) {
                const { data, error } = await supabase.from('santri').select('kategori').eq('id', user.id).single();
                if (error) throw error;
                setSantriProfile(data);
            }
          } catch (err) {
            console.error('Error fetching dashboard profile info:', err);
          } finally {
            setIsLoadingProfile(false);
          }
      };
      
      if (user && role) {
        fetchProfile();
      }

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
  }, [role, user]);

  const renderDashboard = () => {
    console.log('Rendering dashboard based on role:', role);
    
    if (isLoadingProfile) {
        return (
          <div className="flex justify-center items-center h-[60vh]">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-2xl font-semibold">Memuat Profil...</h2>
            </div>
          </div>
        );
    }

    if (role === 'admin') {
      return <AdminDashboard />;
    } else if (role === 'guru') {
      if (guruProfile?.roles?.includes('Pentashih')) {
          return <PentashihDashboard />;
      }
      return <GuruDashboard />;
    } else if (role === 'santri') {
      return <SantriDashboard isAdult={santriProfile?.kategori === 'Dewasa'} />;
    } else if (timeoutTriggered && !role) {
      // Fallback if role somehow isn't resolved within timeout but user is logged in
      return (
        <div className="flex justify-center items-center h-[60vh] flex-col max-w-md mx-auto text-center">
           <div className="bg-destructive/10 text-destructive p-6 rounded-xl border border-destructive/20 mb-4">
              <h2 className="text-xl font-bold mb-2">Role Tidak Terdeteksi</h2>
              <p>Gagal mengidentifikasi role pengguna Anda. Silakan coba login ulang atau hubungi administrator.</p>
           </div>
           <button 
             onClick={() => window.location.href = '/login'} 
             className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
           >
             Kembali ke Login
           </button>
        </div>
      );
    }

    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold">Menyiapkan Dashboard...</h2>
          <p className="text-muted-foreground mt-2">Mendeteksi hak akses Anda.</p>
        </div>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Dashboard - LPQ Al-Muhajirun</title>
        <meta name="description" content="Dashboard sistem manajemen LPQ Al-Muhajirun" />
      </Helmet>

      <div className="min-h-screen py-8">
        {renderDashboard()}
      </div>
    </>
  );
};

export default DashboardPage;
