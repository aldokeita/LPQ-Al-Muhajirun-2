import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';

const quickLinks = [
  { label: 'Informasi Pendaftaran', to: '/pendaftaran/informasi' },
  { label: 'Berita Lembaga', to: '/berita' },
  { label: 'Pengumuman', to: '/pengumuman' },
  { label: 'Tentang Lembaga', to: '/profil' },
  { label: 'Kontak Kami', to: '/kontak' },
];

const Footer = () => (
  <footer className="bg-[#060914] text-white">
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-10 md:grid-cols-[1.2fr_0.75fr_1.05fr]">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
            Portal LPQ
          </div>
          <h2 className="mb-4 text-2xl font-black text-white">LPQ Al-Muhajirun Metode Qiroati Baturaja</h2>
          <p className="max-w-md leading-7 text-white/62">
            Lembaga Pendidikan Al-Qur’an yang membimbing bacaan, adab, dan kebiasaan belajar santri dengan metode Qiroati.
          </p>
        </div>

        <nav aria-label="Link cepat footer">
          <h3 className="mb-4 text-xl font-bold text-cyan-100">Link Cepat</h3>
          <ul className="space-y-2">
            {quickLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="inline-flex items-center gap-2 text-white/62 transition-colors hover:text-white">
                  {item.label}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <address className="not-italic">
          <h3 className="mb-4 text-xl font-bold text-cyan-100">Kontak</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 flex-shrink-0 text-cyan-200" />
              <span className="text-white/62">Jl. R. Suprapto No 195 Kel. Kemala Raja (Depan Masjid Imam Bonjol)</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-cyan-200" />
              <a href="tel:085609025238" className="text-white/62 transition-colors hover:text-white">0856-0902-5238</a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-cyan-200" />
              <a href="mailto:admin@lpqalmuhajirun.id" className="text-white/62 transition-colors hover:text-white">admin@lpqalmuhajirun.id</a>
            </li>
          </ul>
        </address>
      </div>

      <div className="mt-10 border-t border-white/10 pt-8 text-center text-white/50">
        <p>&copy; {new Date().getFullYear()} LPQ Al-Muhajirun. All rights reserved.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
