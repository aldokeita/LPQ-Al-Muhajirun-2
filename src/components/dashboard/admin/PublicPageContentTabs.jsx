import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Building2,
  ClipboardList,
  FileText,
  Home,
  Image as ImageIcon,
  Library,
  Mail,
  Megaphone,
  MessageSquare,
  MonitorPlay,
  Newspaper,
  Trophy,
  Users,
} from 'lucide-react';

const PAGE_GROUPS = [
  {
    key: 'home',
    label: 'Beranda',
    description: 'Identitas, hero, apresiasi, jadwal, dan ajakan utama.',
    pages: ['home', 'apresiasi'],
  },
  {
    key: 'registration',
    label: 'Pendaftaran',
    description: 'Biaya, syarat, brosur, dan alur pendaftaran.',
    pages: ['registration', 'registration-brochure', 'registration-system'],
  },
  {
    key: 'learning',
    label: 'Pembelajaran',
    description: 'Sistem mengaji dan media pembelajaran.',
    pages: ['learning-system', 'educational-media'],
  },
  {
    key: 'parenting',
    label: 'Parenting',
    description: 'Artikel, media, dan ruang diskusi wali santri.',
    pages: ['parenting', 'parenting-media', 'parenting-article', 'wali-discussion'],
  },
  {
    key: 'institution',
    label: 'Profil & Kontak',
    description: 'Profil lembaga, fasilitas, galeri, dan kontak.',
    pages: ['profile', 'facilities', 'gallery', 'contact'],
  },
  {
    key: 'publication',
    label: 'Publikasi',
    description: 'Berita dan pengumuman beserta halaman detailnya.',
    pages: ['news', 'news-detail', 'announcements', 'announcement-detail'],
  },
  {
    key: 'display',
    label: 'TV Display',
    description: 'Pengaturan tampilan layar publik.',
    pages: ['tv-display'],
  },
];

const PAGE_DEFINITIONS = {
  home: { label: 'Beranda', description: 'Konten utama halaman depan.', icon: Home },
  apresiasi: { label: 'Apresiasi', description: 'Papan peringkat dan apresiasi lembaga.', icon: Trophy },
  registration: { label: 'Informasi Pendaftaran', description: 'Biaya, syarat, dan catatan pendaftaran.', icon: ClipboardList },
  'registration-brochure': { label: 'Brosur Pendaftaran', description: 'Brosur dan dokumen yang tampil pada halaman pendaftaran.', icon: FileText },
  'registration-system': { label: 'Sistem Pendaftaran', description: 'Halaman alur pendaftaran yang tersedia untuk publik.', icon: ClipboardList },
  'learning-system': { label: 'Sistem Mengaji', description: 'Video dan media yang mendukung penjelasan sistem mengaji.', icon: BookOpen },
  'educational-media': { label: 'Media Edukatif', description: 'Pustaka, latar permainan, dan media pembelajaran.', icon: Library },
  parenting: { label: 'Artikel Parenting', description: 'Artikel pendampingan wali santri.', icon: Users },
  'parenting-media': { label: 'Media Parenting', description: 'Media edukatif untuk wali santri.', icon: ImageIcon },
  'parenting-article': { label: 'Detail Artikel Parenting', description: 'Data artikel yang dipakai halaman detail.', icon: FileText },
  'wali-discussion': { label: 'Diskusi Wali', description: 'Agenda dan informasi diskusi wali santri.', icon: MessageSquare },
  profile: { label: 'Profil', description: 'Konten profil lembaga yang sudah tersedia.', icon: Building2 },
  facilities: { label: 'Fasilitas', description: 'Fasilitas yang tampil pada halaman profil.', icon: Building2 },
  gallery: { label: 'Galeri', description: 'Dokumentasi kegiatan dan suasana belajar.', icon: ImageIcon },
  contact: { label: 'Kontak', description: 'Nomor, alamat, peta, dan kanal publik.', icon: Mail },
  news: { label: 'Berita', description: 'Berita yang dikelola untuk halaman publik.', icon: Newspaper },
  'news-detail': { label: 'Detail Berita', description: 'Data berita yang dipakai halaman detail.', icon: Newspaper },
  announcements: { label: 'Pengumuman', description: 'Pengumuman dan informasi penting.', icon: Megaphone },
  'announcement-detail': { label: 'Detail Pengumuman', description: 'Data pengumuman yang dipakai halaman detail.', icon: Megaphone },
  'tv-display': { label: 'TV Display', description: 'Pengaturan tampilan TV dikelola pada menu TV Display.', icon: MonitorPlay },
};

// Detail routes share the same records and editor as their list pages.
const PAGE_EDITOR_ALIASES = {
  'registration-brochure': 'educational-media',
  'registration-system': 'registration',
  'parenting-media': 'educational-media',
  'parenting-article': 'parenting',
  'wali-discussion': 'educational-media',
  facilities: 'profile',
  gallery: 'educational-media',
  'news-detail': 'news',
  'announcement-detail': 'announcements',
};

const getDefinition = (pageKey) => PAGE_DEFINITIONS[pageKey] || {
  label: 'Halaman Publik',
  description: 'Kelola konten yang sudah tersedia pada halaman publik.',
  icon: FileText,
};

const PublicPageContentTabs = ({ sections = {} }) => {
  const [activeGroupKey, setActiveGroupKey] = useState(PAGE_GROUPS[0].key);
  const [activePageKey, setActivePageKey] = useState(PAGE_GROUPS[0].pages[0]);

  const activeGroup = useMemo(
    () => PAGE_GROUPS.find((group) => group.key === activeGroupKey) || PAGE_GROUPS[0],
    [activeGroupKey],
  );
  const activePage = getDefinition(activePageKey);
  const ActiveIcon = activePage.icon;
  const editorKey = PAGE_EDITOR_ALIASES[activePageKey] || activePageKey;
  const editor = sections[editorKey];

  const selectGroup = (group) => {
    setActiveGroupKey(group.key);
    setActivePageKey(group.pages[0]);
  };

  return (
    <section className="space-y-5" aria-label="Pengelolaan halaman publik">
      <div className="admin-card space-y-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Halaman Publik</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Kelola isi website per halaman</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Pilih halaman untuk mengubah teks, media, panel, dan informasi yang memang tampil pada website.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kelompok halaman publik">
          {PAGE_GROUPS.map((group) => (
            <button
              key={group.key}
              type="button"
              role="tab"
              aria-selected={activeGroupKey === group.key}
              onClick={() => selectGroup(group)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                activeGroupKey === group.key
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-background/70 text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/30 p-2">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={`Halaman dalam ${activeGroup.label}`}>
            {activeGroup.pages.map((pageKey) => {
              const page = getDefinition(pageKey);
              const Icon = page.icon;
              return (
                <button
                  key={pageKey}
                  type="button"
                  role="tab"
                  aria-selected={activePageKey === pageKey}
                  onClick={() => setActivePageKey(pageKey)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                    activePageKey === pageKey
                      ? 'border-primary/60 bg-background text-foreground shadow-sm'
                      : 'border-transparent text-muted-foreground hover:border-border hover:bg-background/70 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {page.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div role="tabpanel" aria-label={activePage.label} className="space-y-4">
        <div className="flex items-start gap-3 px-1">
          <div className="mt-0.5 rounded-xl border border-primary/20 bg-primary/10 p-2 text-primary">
            <ActiveIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl font-bold">{activePage.label}</h3>
            <p className="text-sm text-muted-foreground">{activePage.description}</p>
          </div>
        </div>

        {editor || (
          <div className="admin-card p-8 text-center text-sm text-muted-foreground">
            Belum ada pengaturan yang dapat diedit untuk halaman ini.
          </div>
        )}
      </div>
    </section>
  );
};

export default PublicPageContentTabs;
