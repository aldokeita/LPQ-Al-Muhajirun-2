import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Newspaper,
  Quote,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { supabase, isSupabaseConfigured } from '@/lib/customSupabaseClient';
import {
  fetchPublishedAnnouncements,
  fetchPublishedNews,
  getPublicContentErrorMessage,
  submitPublicFeedback,
} from '@/lib/publicContentAdapters';

const BRAND_NAME = 'LPQ Al-Muhajirun Metode Qiroati Baturaja';
const LOCAL_LOGO = '/logo.png';

const defaultContent = {
  logoUrl: LOCAL_LOGO,
  heroSlides: [],
  slideshowTimer: 7000,
  heroOverlayOpacity: 0.55,
  quotas: { pagi: 0, siang: 0, sore: 0, dewasaPagi: 0, dewasaSiang: 0, dewasaMalam: 0 },
  facilities: [],
  testimonials: [],
  schedules: [
    { title: 'Sesi Pagi', time: '08:00 - 09:15 WIB', type: 'TPQ' },
    { title: 'Sesi Siang', time: '14:00 - 15:15 WIB', type: 'TPQ' },
    { title: 'Sesi Sore', time: '16:00 - 17:15 WIB', type: 'TPQ' },
  ],
  faqs: [],
  ctaBackgroundUrl: '',
  ctaBackgroundOverlayOpacity: 0.62,
};

const safeArray = (value) => (Array.isArray(value) ? value : []);
const imageOf = (item) => item?.image_url || item?.cover_image_url || item?.url || '';
const compactNumber = (value) => new Intl.NumberFormat('id-ID').format(Number(value || 0));
const friendlyPublicError = (error) => {
  const message = getPublicContentErrorMessage(error);
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Konten publik belum dapat dimuat. Silakan coba beberapa saat lagi.';
  }
  return message;
};

const reveal = {
  initial: { opacity: 1, y: 0 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-90px' },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
};

const BrandGlyph = ({ className = '' }) => (
  <div className={`lpq-brand-glyph ${className}`} aria-hidden="true">
    <span>LPQ</span>
    <small>Qiroati</small>
  </div>
);

const SectionKicker = ({ children, dark = false }) => (
  <div className={`lpq-kicker ${dark ? 'lpq-kicker-dark' : ''}`}>
    <Sparkles className="h-4 w-4" />
    {children}
  </div>
);

const ImmersivePortal = ({ logoUrl }) => {
  const portalRef = useRef(null);

  useEffect(() => {
    const element = portalRef.current;
    if (!element) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return undefined;

    let rafId = 0;
    const updateScroll = () => {
      const progress = Math.min(1, Math.max(0, window.scrollY / 520));
      element.style.setProperty('--gate-open', progress.toFixed(3));
      element.style.setProperty('--gate-lift', `${progress * -34}px`);
      rafId = 0;
    };
    const onScroll = () => {
      if (!rafId) rafId = window.requestAnimationFrame(updateScroll);
    };
    const onPointerMove = (event) => {
      const rect = element.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      element.style.setProperty('--pointer-x', x.toFixed(3));
      element.style.setProperty('--pointer-y', y.toFixed(3));
    };

    updateScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    element.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      element.removeEventListener('pointermove', onPointerMove);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={portalRef} className="lpq-portal" aria-label="Gerbang Cahaya Ilmu">
      <div className="lpq-portal-aura" />
      <div className="lpq-portal-core">
        <div className="lpq-portal-page page-back" />
        <div className="lpq-portal-page page-mid" />
        <div className="lpq-portal-page page-front">
          <div className="lpq-portal-window">
            {logoUrl ? (
              <img src={logoUrl} alt="" loading="eager" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
            ) : null}
            <BrandGlyph />
          </div>
        </div>
        <div className="lpq-portal-ring ring-one" />
        <div className="lpq-portal-ring ring-two" />
        <div className="lpq-orbit-dot dot-a" />
        <div className="lpq-orbit-dot dot-b" />
        <div className="lpq-orbit-dot dot-c" />
      </div>
      <div className="lpq-portal-caption">
        <span>Gerbang Cahaya Ilmu</span>
        <p>Lapisan belajar, adab, dan pendampingan keluarga dalam satu perjalanan.</p>
      </div>
    </div>
  );
};

const HeroSection = ({ content, currentSlide, setCurrentSlide, stats }) => {
  const slides = safeArray(content.heroSlides);
  const activeSlide = slides[currentSlide] || slides[0] || {};
  const heroText = activeSlide.text || 'Masuki ruang belajar Al-Quran yang lebih hidup, tertata, dan dekat dengan keluarga.';
  const heroSubtext = activeSlide.author || 'LPQ Al-Muhajirun menghadirkan Metode Qiroati dalam pengalaman belajar yang hangat, disiplin, dan mudah dipantau.';
  const hasStats = stats.santri > 0 || stats.guru > 0;

  return (
    <section className="lpq-immersive-hero">
      <div className="lpq-hero-mesh" />
      <div className="lpq-hero-grain" />
      <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8 lg:py-20">
        <motion.div initial={{ opacity: 0, y: 34 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75 }} className="relative z-10">
          <SectionKicker dark>Immersive Learning Portal</SectionKicker>
          <h1 className="mt-7 max-w-5xl text-[clamp(3.25rem,9vw,7.8rem)] font-black leading-[0.88] tracking-[-0.055em] text-white">
            <span className="lpq-line-mask">Belajar Al-Quran</span>
            <span className="lpq-line-mask lpq-gradient-text">terasa hidup.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-white/75 md:text-xl">{heroText}</p>
          <p className="mt-4 max-w-2xl text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200/80">{heroSubtext}</p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Button asChild size="lg" className="lpq-magnetic-cta h-14 rounded-full bg-white px-7 text-base font-black text-slate-950 hover:bg-cyan-50">
              <Link to="/pendaftaran/informasi">Mulai pendaftaran <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-white/20 bg-white/10 px-7 text-base font-bold text-white hover:bg-white/20">
              <Link to="/profil">Lihat perjalanan LPQ</Link>
            </Button>
          </div>

          <div className="lpq-trust-ribbon mt-12">
            {hasStats && stats.santri > 0 && (
              <div>
                <strong>{compactNumber(stats.santri)}</strong>
                <span>santri aktif</span>
              </div>
            )}
            {hasStats && stats.guru > 0 && (
              <div>
                <strong>{compactNumber(stats.guru)}</strong>
                <span>guru pengajar</span>
              </div>
            )}
            <div>
              <strong>Qiroati</strong>
              <span>metode belajar</span>
            </div>
            <div>
              <strong>RFID</strong>
              <span>absensi digital</span>
            </div>
          </div>

          {slides.length > 1 && (
            <div className="mt-8 flex gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.id || index}
                  type="button"
                  aria-label={`Tampilkan cerita hero ${index + 1}`}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all ${currentSlide === index ? 'w-10 bg-cyan-300' : 'w-2 bg-white/35 hover:bg-white/70'}`}
                />
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.85, delay: 0.12 }} className="relative z-10 hidden min-h-[650px] lg:block">
          <ImmersivePortal logoUrl={content.logoUrl || LOCAL_LOGO} />
        </motion.div>
      </div>
      <div className="lpq-scroll-cue">
        <span />
        Scroll
      </div>
    </section>
  );
};

const StorySection = ({ content }) => {
  const heroImage = imageOf(safeArray(content.heroSlides)[0]);
  const facilityImage = imageOf(safeArray(content.facilities)[0]);
  const storyImage = facilityImage || heroImage;
  const storySteps = [
    {
      title: 'Dari pintu kelas ke kebiasaan harian',
      text: 'Santri tidak hanya datang untuk membaca. Mereka masuk ke ritme belajar yang mengulang, menguatkan, dan membentuk adab.',
    },
    {
      title: 'Metode yang terasa personal',
      text: 'Qiroati membantu guru memetakan bacaan secara bertahap, sehingga setiap santri punya perjalanan yang dapat dipahami wali.',
    },
    {
      title: 'Teknologi sebagai pendamping, bukan pusat perhatian',
      text: 'Absensi RFID, dashboard, pembayaran, dan konten publik mendukung operasional agar guru dapat fokus membimbing.',
    },
  ];

  return (
    <section className="bg-[#f6f1e7] px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div {...reveal} className="lg:sticky lg:top-28 lg:self-start">
          <SectionKicker>Story layer</SectionKicker>
          <h2 className="mt-6 max-w-2xl text-[clamp(2.35rem,5vw,5.3rem)] font-black leading-[0.95] tracking-[-0.045em] text-slate-950">
            Belajar yang terasa dekat, bukan sekadar jadwal.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Homepage ini tetap membawa konteks LPQ lama, tetapi disusun sebagai perjalanan: masuk, melihat bukti, memahami program, lalu mengambil tindakan.
          </p>
        </motion.div>
        <div className="space-y-6">
          <motion.div {...reveal} className="lpq-cinematic-frame">
            {storyImage ? (
              <img src={storyImage} alt="Kegiatan pembelajaran LPQ Al-Muhajirun" loading="lazy" />
            ) : (
              <div className="lpq-photo-fallback">
                <Layers3 className="h-16 w-16" />
                <span>Foto kegiatan akan tampil dari konten website</span>
              </div>
            )}
          </motion.div>
          {storySteps.map((step, index) => (
            <motion.article key={step.title} {...reveal} className="lpq-story-card">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

const ProgramConstellation = ({ schedules, quotas }) => {
  const scheduleItems = safeArray(schedules).slice(0, 5);
  const quotaItems = [
    { label: 'Pagi', value: quotas?.pagi || 0 },
    { label: 'Siang', value: quotas?.siang || 0 },
    { label: 'Sore', value: quotas?.sore || 0 },
  ];

  return (
    <section className="bg-[#101827] px-4 py-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <motion.div {...reveal}>
            <SectionKicker dark>Learning constellation</SectionKicker>
            <h2 className="mt-6 text-[clamp(2.4rem,6vw,5.8rem)] font-black leading-[0.92] tracking-[-0.05em]">
              Program tersusun seperti peta perjalanan.
            </h2>
            <p className="mt-6 text-lg leading-8 text-white/70">
              Jadwal dan kuota tetap dibaca dari konten admin. Penyajiannya dibuat seperti rasi belajar, bukan grid kartu biasa.
            </p>
          </motion.div>
          <motion.div {...reveal} className="lpq-quota-panel">
            <p>Kuota sesi</p>
            <div>
              {quotaItems.map((item) => (
                <span key={item.label}>
                  <strong>{compactNumber(item.value)}</strong>
                  {item.label}
                </span>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div {...reveal} className="lpq-constellation">
          <div className="lpq-constellation-core">
            <Compass className="h-10 w-10 text-cyan-200" />
            <span>Qiroati Pathway</span>
          </div>
          {scheduleItems.length > 0 ? scheduleItems.map((schedule, index) => (
            <Link
              key={`${schedule.title}-${index}`}
              to="/pendaftaran/informasi"
              className={`lpq-orbit-card orbit-${index + 1}`}
            >
              <Clock className="h-5 w-5 text-cyan-200" />
              <strong>{schedule.title || 'Sesi belajar'}</strong>
              <span>{schedule.time || 'Waktu menyesuaikan'}</span>
              <em>{schedule.type || 'Kelas'}</em>
            </Link>
          )) : (
            <div className="lpq-empty-dark">
              <CalendarClock className="h-8 w-8" />
              Jadwal akan tampil setelah diisi admin.
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
};

const GallerySection = ({ facilities }) => {
  const images = safeArray(facilities).filter((item) => imageOf(item)).slice(0, 6);
  return (
    <section className="overflow-hidden bg-[#f6f1e7] px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div {...reveal} className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionKicker>Activity gallery</SectionKicker>
            <h2 className="mt-6 max-w-4xl text-[clamp(2.4rem,5vw,5.4rem)] font-black leading-[0.95] tracking-[-0.045em] text-slate-950">
              Potongan suasana yang membuat wali merasa yakin.
            </h2>
          </div>
          <Button asChild variant="outline" className="w-fit rounded-full border-slate-300 bg-white px-6">
            <Link to="/profil/galeri">Lihat galeri <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </motion.div>
        {images.length > 0 ? (
          <div className="lpq-gallery-track mt-12">
            {images.map((item, index) => (
              <Link key={item.id || index} to="/profil/galeri" className={`lpq-gallery-frame gallery-${index % 3}`}>
                <img src={imageOf(item)} alt={item.name || 'Aktivitas LPQ Al-Muhajirun'} loading="lazy" />
                <span>{item.name || 'Kegiatan LPQ'}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-12">
            <EmptyState title="Galeri kegiatan belum tersedia" description="Foto fasilitas atau kegiatan akan tampil otomatis dari Content Management." />
          </div>
        )}
      </div>
    </section>
  );
};

const EmptyState = ({ title, description }) => (
  <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/75 p-8 text-center text-slate-600">
    <ImageIcon className="mx-auto mb-4 h-10 w-10 text-emerald-700" />
    <p className="font-black text-slate-950">{title}</p>
    <p className="mt-2 text-sm leading-6">{description}</p>
  </div>
);

const EditorialNews = ({ news, announcements, loading, error }) => {
  const newsItems = safeArray(news);
  const featured = newsItems[0];
  const supporting = newsItems.slice(1, 4);
  const announcementItems = safeArray(announcements);

  return (
    <section className="bg-[#0b1020] px-4 py-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div {...reveal} className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionKicker dark>Editorial board</SectionKicker>
            <h2 className="mt-6 max-w-4xl text-[clamp(2.4rem,5vw,5.2rem)] font-black leading-[0.95] tracking-[-0.045em]">
              Kabar lembaga tampil seperti majalah, tetap dari Supabase.
            </h2>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20">
              <Link to="/berita">Berita</Link>
            </Button>
            <Button asChild className="rounded-full bg-cyan-200 text-slate-950 hover:bg-cyan-100">
              <Link to="/pengumuman">Pengumuman</Link>
            </Button>
          </div>
        </motion.div>

        {loading ? (
          <div className="mt-12 flex items-center justify-center rounded-[2rem] border border-white/10 bg-white/10 p-12 text-cyan-100">
            <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Memuat berita dan pengumuman...
          </div>
        ) : error ? (
          <div className="mt-12 rounded-[2rem] border border-red-300/30 bg-red-500/10 p-6 text-red-100">{error}</div>
        ) : (
          <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            {featured ? (
              <Link to={`/berita/${featured.slug || featured.id}`} className="lpq-feature-story group">
                {imageOf(featured) ? (
                  <img src={imageOf(featured)} alt={featured.title} loading="lazy" />
                ) : (
                  <div className="lpq-story-image-fallback"><Newspaper className="h-14 w-14" /></div>
                )}
                <div className="lpq-feature-copy">
                  <span>{featured.date || 'Berita'}</span>
                  <h3>{featured.title}</h3>
                  <p>{featured.summary || featured.excerpt || 'Baca kabar terbaru dari LPQ Al-Muhajirun.'}</p>
                </div>
              </Link>
            ) : (
              <div className="lpq-empty-dark"><Newspaper className="h-8 w-8" /> Belum ada berita published.</div>
            )}

            <div className="space-y-5">
              <div className="lpq-announcement-panel">
                <div className="mb-5 flex items-center gap-3">
                  <Megaphone className="h-6 w-6 text-amber-200" />
                  <h3>Pengumuman</h3>
                </div>
                {announcementItems.length > 0 ? announcementItems.slice(0, 3).map((item) => (
                  <Link key={item.id} to={`/pengumuman/${item.slug || item.id}`} className="lpq-announcement-row">
                    <span>{item.priority || 'normal'}</span>
                    <strong>{item.title}</strong>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )) : <p className="text-white/60">Belum ada pengumuman published.</p>}
              </div>
              {supporting.map((item) => (
                <Link key={item.id} to={`/berita/${item.slug || item.id}`} className="lpq-support-story">
                  <span>{item.date || 'Berita'}</span>
                  <strong>{item.title}</strong>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const TestimonialsFaq = ({ testimonials, faqs }) => (
  <section className="bg-[#f6f1e7] px-4 py-24 sm:px-6 lg:px-8">
    <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <motion.div {...reveal} className="lpq-human-panel">
        <SectionKicker>Human-centered</SectionKicker>
        <h2>Suara keluarga, pertanyaan nyata.</h2>
        <div className="mt-8 space-y-4">
          {safeArray(testimonials).length > 0 ? safeArray(testimonials).slice(0, 3).map((item, index) => (
            <blockquote key={item.id || index}>
              <Quote className="h-5 w-5 text-amber-600" />
              <p>"{item.text}"</p>
              <footer>{item.name} · {item.role}</footer>
            </blockquote>
          )) : (
            <EmptyState title="Testimoni belum tersedia" description="Testimoni akan muncul dari data konten ketika admin mengisinya." />
          )}
        </div>
      </motion.div>
      <motion.div {...reveal} className="lpq-faq-panel">
        {safeArray(faqs).length > 0 ? safeArray(faqs).slice(0, 5).map((faq, index) => (
          <details key={faq.id || index}>
            <summary>{faq.question}<ArrowRight className="h-4 w-4" /></summary>
            <p>{faq.answer}</p>
          </details>
        )) : (
          <EmptyState title="FAQ belum tersedia" description="Pertanyaan umum akan tampil setelah dikelola admin." />
        )}
      </motion.div>
    </div>
  </section>
);

const FinalCta = ({ content, formData, setFormData, onSubmit, sending }) => {
  const background = content.ctaBackgroundUrl || imageOf(safeArray(content.heroSlides)[0]);
  return (
    <section className="lpq-final-cta">
      {background && <img src={background} alt="" loading="lazy" />}
      <div className="lpq-final-glow" />
      <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <motion.div {...reveal}>
          <SectionKicker dark>Portal berikutnya</SectionKicker>
          <h2>Mulai dari satu langkah kecil: datang, bertanya, lalu belajar.</h2>
          <p>CTA akhir ini bukan kartu biasa; ia menutup perjalanan homepage dengan rasa tenang dan jelas: wali tahu harus ke mana, admin tetap menerima feedback melalui kontrak lama.</p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-white text-slate-950 hover:bg-cyan-50">
              <Link to="/pendaftaran/informasi">Informasi pendaftaran</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20">
              <Link to="/kontak">Kontak lengkap</Link>
            </Button>
          </div>
        </motion.div>
        <motion.form {...reveal} onSubmit={onSubmit} className="lpq-feedback-form">
          <h3>Kirim pesan ke LPQ</h3>
          <Input placeholder="Nama lengkap" value={formData.nama} onChange={(event) => setFormData({ ...formData, nama: event.target.value })} required />
          <Input type="email" placeholder="Email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} required />
          <Input type="tel" placeholder="Nomor WhatsApp" value={formData.no_hp} onChange={(event) => setFormData({ ...formData, no_hp: event.target.value })} required />
          <Textarea placeholder="Pesan atau pertanyaan" rows={5} value={formData.pesan} onChange={(event) => setFormData({ ...formData, pesan: event.target.value })} required />
          <Button type="submit" disabled={sending} className="h-12 rounded-full bg-cyan-200 font-black text-slate-950 hover:bg-cyan-100">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Kirim pesan
          </Button>
        </motion.form>
      </div>
    </section>
  );
};

const HomePage = () => {
  const [content, setContent] = useState(defaultContent);
  const [news, setNews] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({ santri: 0, guru: 0 });
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [contentError, setContentError] = useState('');
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({ nama: '', email: '', no_hp: '', pesan: '' });

  const heroSlides = useMemo(() => safeArray(content.heroSlides), [content.heroSlides]);

  useEffect(() => {
    let mounted = true;

    const fetchHomepageData = async () => {
      setLoading(true);
      setContentError('');
      try {
        if (!isSupabaseConfigured) {
          setContent(defaultContent);
          setLoading(false);
          return;
        }

        const [santriResult, guruResult, contentResult, newsResult, announcementResult] = await Promise.all([
          supabase.from('santri').select('id', { count: 'exact', head: true }).eq('status', 'Aktif'),
          supabase.from('guru').select('id', { count: 'exact', head: true }),
          supabase.from('website_content').select('key, content').eq('is_public', true),
          fetchPublishedNews({ limit: 4 }),
          fetchPublishedAnnouncements({ limit: 4 }),
        ]);

        if (!mounted) return;
        if (contentResult.error) throw contentResult.error;

        const contentMap = (contentResult.data || []).reduce((acc, item) => {
          acc[item.key] = item.content;
          return acc;
        }, {});

        setStats({ santri: santriResult.count || 0, guru: guruResult.count || 0 });
        setContent({ ...defaultContent, ...contentMap });
        setNews(newsResult);
        setAnnouncements(announcementResult);
      } catch (error) {
        if (!mounted) return;
        setContentError(friendlyPublicError(error));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchHomepageData();

    let channel;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel('website_content_homepage_immersive')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'website_content' }, (payload) => {
          if (payload.new?.key && payload.new.is_public !== false) {
            setContent((previous) => ({ ...previous, [payload.new.key]: payload.new.content }));
          }
        })
        .subscribe();
    }

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (heroSlides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setCurrentSlide((previous) => (previous + 1) % heroSlides.length);
    }, content.slideshowTimer || 7000);
    return () => window.clearInterval(timer);
  }, [content.slideshowTimer, heroSlides.length]);

  const handleSubmitQuestion = async (event) => {
    event.preventDefault();
    setSending(true);
    try {
      await submitPublicFeedback(formData);
      toast({ title: 'Pesan terkirim', description: 'Terima kasih, pesan Anda sudah kami terima.' });
      setFormData({ nama: '', email: '', no_hp: '', pesan: '' });
    } catch (error) {
      toast({ title: 'Gagal mengirim', description: getPublicContentErrorMessage(error), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{BRAND_NAME}</title>
        <meta name="description" content="Website resmi LPQ Al-Muhajirun Metode Qiroati Baturaja: pendaftaran, berita, pengumuman, feedback, dan portal pendidikan Al-Quran." />
        <link rel="icon" type="image/png" href={content.logoUrl || LOCAL_LOGO} sizes="any" />
      </Helmet>

      <main className="bg-[#f6f1e7] text-slate-950">
        <HeroSection content={content} currentSlide={currentSlide} setCurrentSlide={setCurrentSlide} stats={stats} />
        <StorySection content={content} />
        <ProgramConstellation schedules={content.schedules} quotas={content.quotas} />
        <GallerySection facilities={content.facilities} />
        <EditorialNews news={news} announcements={announcements} loading={loading} error={contentError} />
        <TestimonialsFaq testimonials={content.testimonials} faqs={content.faqs} />
        <FinalCta content={content} formData={formData} setFormData={setFormData} onSubmit={handleSubmitQuestion} sending={sending} />
      </main>
    </>
  );
};

export default HomePage;
