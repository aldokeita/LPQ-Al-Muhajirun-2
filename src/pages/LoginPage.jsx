
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase, isSupabaseConfigured } from '@/lib/customSupabaseClient';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [logoUrl, setLogoUrl] = useState('/logo.png');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    signInWithUsername,
    user,
    loading
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  useEffect(() => {
    if (user && !loading) {
      console.log('[LoginPage] User already authenticated, redirecting to dashboard');
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    const fetchLogo = async () => {
      const {
        data
      } = await supabase.from('website_content').select('content').eq('key', 'logoUrl').maybeSingle();
      if (data?.content) setLogoUrl(data.content);
    };
    fetchLogo();
    const channel = supabase.channel('website_content_login_logo').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'website_content',
      filter: 'key=eq.logoUrl'
    }, payload => setLogoUrl(payload.new?.content || '/logo.png')).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);
  const handleSubmit = async e => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        variant: "destructive",
        title: "Input Tidak Lengkap",
        description: "Mohon masukkan kredensial Anda."
      });
      return;
    }
    setIsSubmitting(true);

    // Trim inputs to remove invisible whitespace that causes exact match failures
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    console.log('[LoginPage] Attempting login');
    try {
      const {
        user: loggedInUser,
        error
      } = await signInWithUsername(trimmedUsername, trimmedPassword);
      if (error) {
        console.error('[LoginPage] Login error caught in component:', error);
        let errorMsg = "Terjadi kesalahan, silakan coba lagi";
        const errMsgLower = error.message?.toLowerCase() || '';

        // User-friendly error translations based on caught errors
        if (errMsgLower.includes('supabase belum dikonfigurasi')) {
          errorMsg = error.message;
        } else if (errMsgLower.includes('fetch') || errMsgLower.includes('network')) {
          errorMsg = "Koneksi ke server gagal";
        } else if (errMsgLower.includes('invalid') || errMsgLower.includes('salah') || errMsgLower.includes('format') || errMsgLower.includes('credentials')) {
          errorMsg = "Email/Username atau Password salah";
        } else if (errMsgLower.includes('not found') || errMsgLower.includes('tidak ditemukan')) {
          errorMsg = "User tidak ditemukan";
        }
        toast({
          variant: "destructive",
          title: "Login Gagal",
          description: errorMsg
        });
      } else if (loggedInUser) {
        console.log('[LoginPage] Login successful', { userId: loggedInUser.id });
        toast({
          title: "Login berhasil!",
          description: "Mengalihkan ke dashboard...",
          className: "bg-green-600 text-white border-none"
        });
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('[LoginPage] Unexpected error during login:', err);
      toast({
        variant: "destructive",
        title: "Kesalahan Sistem",
        description: "Terjadi kesalahan, silakan coba lagi"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return <>
      <Helmet>
        <title>Login - LPQ Al-Muhajirun Metode Qiroati Baturaja</title>
        <meta name="description" content="Login ke sistem LPQ Al-Muhajirun Metode Qiroati Baturaja untuk mengakses dashboard" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-secondary/20 to-background dark:from-primary/20 dark:to-background">
        <motion.div initial={{
        opacity: 0,
        y: -30,
        scale: 0.95
      }} animate={{
        opacity: 1,
        y: 0,
        scale: 1
      }} transition={{
        duration: 0.5,
        ease: "easeOut"
      }} className="max-w-sm w-full space-y-8 bg-card/80 dark:bg-card/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-border">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4">
              <img src={logoUrl} alt="Logo LPQ Al-Muhajirun" className="w-full h-full object-contain drop-shadow-md" />
            </div>
            <h2 className="text-3xl font-bold text-foreground font-montserrat">Selamat Datang</h2>
            <p className="text-sm text-muted-foreground mt-2">Pada sistem login LPQ Al-Muhajirun Metode Qiroati Baturaja, silahkan masukkan data untuk masuk ke dashboard.</p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input id="username" type="text" placeholder="Email Admin/Guru atau Nama Panggilan Santri" value={username} onChange={e => setUsername(e.target.value)} disabled={isSubmitting} className="w-full pl-12 pr-4 py-3 rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition disabled:opacity-50" required />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input id="password" type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} disabled={isSubmitting} className="w-full pl-12 pr-12 py-3 rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition disabled:opacity-50" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={isSubmitting} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:transform-none" disabled={isSubmitting}>
              {isSubmitting ? <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
                  Memproses...
                </div> : 'Login'}
            </Button>
          </form>
        </motion.div>
      </div>
    </>;
};
export default LoginPage;
