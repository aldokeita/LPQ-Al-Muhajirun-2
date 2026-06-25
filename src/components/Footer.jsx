import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Youtube, Mail, Phone, MapPin } from 'lucide-react';
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
  return <footer className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4 font-cinzel text-accent">LPQ Al-Muhajirun</h3>
            <p className="text-primary-foreground/80 mb-4">
              Lembaga Pendidikan Al-Qur'an dengan metode Qiroati yang terpercaya. Membentuk generasi Qur'ani yang berakhlak mulia.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-primary-foreground/80 hover:text-accent transition-colors">
                <Facebook className="w-6 h-6" />
              </a>
              <a href="#" className="text-primary-foreground/80 hover:text-accent transition-colors">
                <Instagram className="w-6 h-6" />
              </a>
              <a href="#" className="text-primary-foreground/80 hover:text-accent transition-colors">
                <Youtube className="w-6 h-6" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-4 text-accent">Link Cepat</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/pendaftaran/informasi" className="text-primary-foreground/80 hover:text-white transition-colors">
                  Informasi Pendaftaran
                </Link>
              </li>
              <li>
                <Link to="/profil" className="text-primary-foreground/80 hover:text-white transition-colors">
                  Tentang Lembaga
                </Link>
              </li>
              <li>
                <Link to="/kontak" className="text-primary-foreground/80 hover:text-white transition-colors">
                  Kontak Kami
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-4 text-accent">Kontak</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 mt-1 flex-shrink-0 text-accent" />
                <a href="#" target="_blank" rel="noopener noreferrer" className="text-primary-foreground/80 hover:text-white transition-colors">
                  Jl. R. Suprapto No 195 Kel. Kemala Raja (Depan Masjid Imam Bonjol)
                </a>
              </li>
              <li className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-accent" />
                <a href="tel:081234567890" className="text-primary-foreground/80 hover:text-white transition-colors">0856-0902-5238</a>
              </li>
              <li className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-accent" />
                <a href="mailto:admin@lpqalmuhajirun.id" className="text-primary-foreground/80 hover:text-white transition-colors">admin@lpqalmuhajirun.id</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center text-primary-foreground/60">
          <p>&copy; {new Date().getFullYear()} LPQ Al-Muhajirun. All rights reserved.</p>
          <a href="#" onClick={toggleDesktopView} className="text-sm text-primary-foreground/50 hover:text-white mt-2 inline-block transition-colors">
            {isDesktopView ? 'Tampilan Mobile' : 'Tampilan Desktop'}
          </a>
        </div>
      </div>
    </footer>;
};
export default Footer;
