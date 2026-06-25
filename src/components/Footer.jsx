import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Youtube, Mail, Phone, MapPin, ArrowUpRight } from 'lucide-react';
const Footer = () => {
  const [isDesktopView, setIsDesktopView] = useState(false);
  useEffect(() => {
    const desktopView = localStorage.getItem('desktopView') === 'true';
    setIsDesktopView(desktopView);
    updateViewport(desktopView);
  }, []);
  const updateViewport = isDesktop => {
    let viewport = document.querySelector("meta[name=viewport]");
    if (viewport) {
      if (isDesktop) {
        viewport.setAttribute('content', 'width=1024');
      } else {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }
    }
  };
  const toggleDesktopView = e => {
    e.preventDefault();
    const newDesktopView = !isDesktopView;
    localStorage.setItem('desktopView', newDesktopView);
    setIsDesktopView(newDesktopView);
    updateViewport(newDesktopView);
  };
  return <footer className="bg-[#060914] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.7fr_1.1fr] gap-10">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
              Portal LPQ
            </div>
            <h3 className="text-2xl font-black mb-4 text-white">LPQ Al-Muhajirun Metode Qiroati Baturaja</h3>
            <p className="text-white/60 mb-6 leading-7">
              Lembaga Pendidikan Al-Qur'an yang membimbing bacaan, adab, dan kebiasaan belajar santri dengan metode Qiroati.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="rounded-full border border-white/10 bg-white/10 p-3 text-white/75 transition-colors hover:text-cyan-200">
                <Facebook className="w-6 h-6" />
              </a>
              <a href="#" className="rounded-full border border-white/10 bg-white/10 p-3 text-white/75 transition-colors hover:text-cyan-200">
                <Instagram className="w-6 h-6" />
              </a>
              <a href="#" className="rounded-full border border-white/10 bg-white/10 p-3 text-white/75 transition-colors hover:text-cyan-200">
                <Youtube className="w-6 h-6" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-4 text-cyan-100">Link Cepat</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/pendaftaran/informasi" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                  Informasi Pendaftaran
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </li>
              <li>
                <Link to="/profil" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                  Tentang Lembaga
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </li>
              <li>
                <Link to="/kontak" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                  Kontak Kami
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-4 text-cyan-100">Kontak</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 mt-1 flex-shrink-0 text-cyan-200" />
                <a href="#" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors">
                  Jl. R. Suprapto No 195 Kel. Kemala Raja (Depan Masjid Imam Bonjol)
                </a>
              </li>
              <li className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-cyan-200" />
                <a href="tel:081234567890" className="text-white/60 hover:text-white transition-colors">0856-0902-5238</a>
              </li>
              <li className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-cyan-200" />
                <a href="mailto:admin@lpqalmuhajirun.id" className="text-white/60 hover:text-white transition-colors">admin@lpqalmuhajirun.id</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-8 text-center text-white/50">
          <p>&copy; {new Date().getFullYear()} LPQ Al-Muhajirun. All rights reserved.</p>
          <a href="#" onClick={toggleDesktopView} className="text-sm text-white/50 hover:text-white mt-2 inline-block transition-colors">
            {isDesktopView ? 'Tampilan Mobile' : 'Tampilan Desktop'}
          </a>
        </div>
      </div>
    </footer>;
};
export default Footer;
