import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Moon, Sun, ChevronDown, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '@/lib/customSupabaseClient';

const NavLink = ({ to, children }) => (
  <Link to={to} className="text-sm font-black text-slate-800 transition-colors hover:text-emerald-900">
    {children}
  </Link>
);

const DropdownMenu = ({ title, children }) => {
  return (
    <div className="relative group">
      <button className="flex items-center space-x-1 text-sm font-black text-slate-800 transition-colors hover:text-emerald-900">
        <span>{title}</span>
        <ChevronDown className="w-4 h-4" />
      </button>
      <div className="absolute top-full left-1/2 z-50 mt-3 w-64 -translate-x-1/2 rounded-2xl border border-white/60 bg-white/90 p-2 opacity-0 shadow-2xl shadow-slate-950/10 backdrop-blur-2xl transition-all duration-300 invisible group-hover:visible group-hover:opacity-100">
        {children}
      </div>
    </div>
  );
};

const DropdownLink = ({ to, children }) => (
  <Link
    to={to}
    className="block rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-950"
  >
    {children}
  </Link>
);

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mobileDropdown, setMobileDropdown] = useState('');
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState('/logo.png');
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    const fetchLogo = async () => {
      const { data } = await supabase.from('website_content').select('content').eq('key', 'logoUrl').maybeSingle();
      if (data?.content) {
        setLogoFailed(false);
        setLogoUrl(data.content);
      }
    };
    fetchLogo();
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const toggleMobileDropdown = (menu) => {
    setMobileDropdown(mobileDropdown === menu ? '' : menu);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/70 bg-[#f6f1e7]/95 shadow-sm shadow-slate-950/5 backdrop-blur-2xl transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-3">
             <Link to="/" className="flex items-center space-x-3">
              {logoFailed ? (
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/70 bg-white text-xs font-black text-emerald-950 shadow-inner">
                  LPQ
                </span>
              ) : (
                <img src={logoUrl} alt="Logo LPQ Al-Muhajirun" className="w-12 h-12 object-contain" onError={() => setLogoFailed(true)} />
              )}
              <span className="hidden text-base font-black leading-tight text-emerald-950 sm:block">
                LPQ Al-Muhajirun
                <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">Metode Qiroati</span>
              </span>
            </Link>
          </div>
          
          <div className="hidden lg:flex items-center space-x-8">
            <NavLink to="/">Beranda</NavLink>
            <DropdownMenu title="Berita">
              <DropdownLink to="/berita">Berita Lembaga</DropdownLink>
              <DropdownLink to="/pengumuman">Pengumuman</DropdownLink>
            </DropdownMenu>
            <DropdownMenu title="Pendaftaran">
              <DropdownLink to="/pendaftaran/informasi">Informasi</DropdownLink>
              <DropdownLink to="/pendaftaran/brosur">Brosur</DropdownLink>
              <DropdownLink to="/pendaftaran/sistem">Sistem Mengaji</DropdownLink>
            </DropdownMenu>
            <DropdownMenu title="Parenting">
              <DropdownLink to="/parenting">Artikel Parenting</DropdownLink>
              <DropdownLink to="/parenting/media-edukatif">Media Edukatif</DropdownLink>
              <DropdownLink to="/parenting/diskusi-wali">Diskusi Wali Santri</DropdownLink>
            </DropdownMenu>
            <DropdownMenu title="Profil">
              <DropdownLink to="/profil">Tentang Kami</DropdownLink>
              <DropdownLink to="/profil/galeri">Galeri</DropdownLink>
              <DropdownLink to="/metode-qiroati">Metode Qiroati</DropdownLink>
              <DropdownLink to="/fasilitas">Fasilitas</DropdownLink>
            </DropdownMenu>
            <NavLink to="/kontak">Kontak</NavLink>
          </div>

          <div className="hidden lg:flex items-center space-x-2">
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" size="icon" className="text-emerald-900 hover:bg-emerald-100 hover:text-emerald-950"><LayoutDashboard className="w-5 h-5"/></Button>
                </Link>
                <Button onClick={handleLogout} variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <LogOut className="w-5 h-5" />
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button className="rounded-full bg-slate-950 px-5 font-black text-white hover:bg-emerald-950">Login</Button>
              </Link>
            )}
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="icon"
              className="text-slate-700 hover:bg-white hover:text-emerald-950"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>

          <div className="lg:hidden flex items-center space-x-2">
            <Button
              onClick={toggleTheme}
              variant="outline"
              size="icon"
              className="rounded-full border-slate-300/70 bg-white/80"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            <Button
              onClick={() => setIsOpen(!isOpen)}
              variant="outline"
              size="icon"
              className="rounded-full border-slate-300/70 bg-white/80"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-white/70 bg-[#f6f1e7]/96 backdrop-blur-xl"
          >
            <div className="px-4 py-4 space-y-3">
              <Link to="/" className="block py-2 text-foreground" onClick={() => setIsOpen(false)}>Beranda</Link>
              
              <div>
                <button onClick={() => toggleMobileDropdown('berita')} className="flex items-center justify-between w-full py-2 text-foreground">
                  <span>Berita</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileDropdown === 'berita' ? 'rotate-180' : ''}`} />
                </button>
                {mobileDropdown === 'berita' && (
                  <div className="pl-4 space-y-2 mt-2">
                    <Link to="/berita" className="block py-2 text-foreground/70" onClick={() => setIsOpen(false)}>Berita Lembaga</Link>
                    <Link to="/pengumuman" className="block py-2 text-foreground/70" onClick={() => setIsOpen(false)}>Pengumuman</Link>
                  </div>
                )}
              </div>

              <div>
                <button onClick={() => toggleMobileDropdown('pendaftaran')} className="flex items-center justify-between w-full py-2 text-foreground">
                  <span>Pendaftaran</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileDropdown === 'pendaftaran' ? 'rotate-180' : ''}`} />
                </button>
                {mobileDropdown === 'pendaftaran' && (
                  <div className="pl-4 space-y-2 mt-2">
                    <Link to="/pendaftaran/informasi" className="block py-2 text-foreground/70" onClick={() => setIsOpen(false)}>Informasi</Link>
                    <Link to="/pendaftaran/brosur" className="block py-2 text-foreground/70" onClick={() => setIsOpen(false)}>Brosur</Link>
                    <Link to="/pendaftaran/sistem" className="block py-2 text-foreground/70" onClick={() => setIsOpen(false)}>Sistem Mengaji</Link>
                  </div>
                )}
              </div>
              
              <div>
                <button onClick={() => toggleMobileDropdown('parenting')} className="flex items-center justify-between w-full py-2 text-foreground">
                  <span>Parenting</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileDropdown === 'parenting' ? 'rotate-180' : ''}`} />
                </button>
                {mobileDropdown === 'parenting' && (
                  <div className="pl-4 space-y-2 mt-2">
                    <Link to="/parenting" className="block py-2 text-foreground/70" onClick={() => setIsOpen(false)}>Artikel Parenting</Link>
                    <Link to="/parenting/media-edukatif" className="block py-2 text-foreground/70" onClick={() => setIsOpen(false)}>Media Edukatif</Link>
                    <Link to="/parenting/diskusi-wali" className="block py-2 text-foreground/70" onClick={() => setIsOpen(false)}>Diskusi Wali Santri</Link>
                  </div>
                )}
              </div>

              <div>
                <button onClick={() => toggleMobileDropdown('profil')} className="flex items-center justify-between w-full py-2 text-foreground">
                  <span>Profil</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileDropdown === 'profil' ? 'rotate-180' : ''}`} />
                </button>
                {mobileDropdown === 'profil' && (
                  <div className="pl-4 space-y-2 mt-2">
                    <Link to="/profil" className="block py-2 text-foreground/70" onClick={() => setIsOpen(false)}>Tentang Kami</Link>
                    <Link to="/profil/galeri" className="block py-2 text-foreground/70" onClick={() => setIsOpen(false)}>Galeri</Link>
                    <Link to="/metode-qiroati" className="block py-2 text-foreground/70" onClick={() => setIsOpen(false)}>Metode Qiroati</Link>
                    <Link to="/fasilitas" className="block py-2 text-foreground/70" onClick={() => setIsOpen(false)}>Fasilitas</Link>
                  </div>
                )}
              </div>

              <Link to="/kontak" className="block py-2 text-foreground" onClick={() => setIsOpen(false)}>Kontak</Link>

              {user ? (
                <div className="border-t border-border pt-4 space-y-3">
                  <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                    <Button className="w-full">Dashboard</Button>
                  </Link>
                  <Button onClick={() => { handleLogout(); setIsOpen(false); }} variant="outline" className="w-full text-destructive border-destructive/50 hover:bg-destructive hover:text-destructive-foreground">Logout</Button>
                </div>
              ) : (
                <div className="border-t border-border pt-4">
                  <Link to="/login" onClick={() => setIsOpen(false)}>
                    <Button className="w-full">Login</Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
