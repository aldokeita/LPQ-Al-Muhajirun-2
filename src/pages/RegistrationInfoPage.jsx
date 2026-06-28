import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Users,
  Banknote,
  ClipboardCheck,
  ChevronRight,
  Loader2,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';
import { fetchWebsiteContentMap, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import '@/styles/public-enrollment.css';

/* ---------- Default Data (Hardcoded Fallback) ---------- */
const DEFAULT_ENROLLMENT_DATA = {
  categories: [
    {
      id: 'tpq',
      name: 'Santri TPQ (Anak)',
      description: 'Program pembelajaran Al-Qur\'an untuk anak usia dini dengan kurikulum terstruktur dan lingkungan belajar yang menyenangkan.',
      icon: '📚',
      fees: [
        { id: 'f1', name: 'Sarpras', amount: 'Rp 115.000', order: 1 },
        { id: 'f2', name: 'Seragam', amount: 'Rp 175.000', order: 2 },
        { id: 'f3', name: 'Buku Prestasi', amount: 'Rp 10.000', order: 3 },
        { id: 'f4', name: 'ID Card', amount: 'Rp 25.000', order: 4 },
        { id: 'f5', name: 'Buku Jilid', amount: 'Rp 25.000', order: 5 },
        { id: 'f6', name: 'SPP Awal', amount: 'Rp 100.000', order: 6 },
      ],
      totalFee: 'Rp 450.000',
      notes: [
        { id: 'n1', icon: '💰', text: 'Biaya pendaftaran dapat dicicil selama 1 bulan' },
        { id: 'n2', icon: '👨‍👩‍👧‍👦', text: 'Tersedia paket khusus untuk keluarga dengan lebih dari 1 santri' },
        { id: 'n3', icon: '📚', text: 'TPQ baru dimulai setelah semua syarat administrasi terpenuhi' },
        { id: 'n4', icon: '👥', text: 'Wajib didampingi kedua orang tua saat pendaftaran' },
      ],
      requirements: [
        { id: 'r1', text: 'Kedua wali dan calon santri wajib hadir saat mengisi formulir pendaftaran' },
        { id: 'r2', text: 'Mengisi formulir pendaftaran dengan lengkap dan benar' },
        { id: 'r3', text: 'Fotokopi Akta Kelahiran (1 lembar)' },
        { id: 'r4', text: 'Fotokopi Kartu Keluarga (1 lembar)' },
        { id: 'r5', text: 'Pas foto ukuran 3x4 (2 lembar)' },
        { id: 'r6', text: 'Materai Rp 10.000' },
      ],
      order: 1,
    },
    {
      id: 'dewasa',
      name: 'Santri Dewasa',
      description: 'Program pembelajaran Al-Qur\'an untuk usia dewasa dengan jadwal fleksibel dan pendekatan personal.',
      icon: '🎓',
      fees: [
        { id: 'f7', name: 'Sarpras', amount: 'Rp 115.000', order: 1 },
        { id: 'f8', name: 'Seragam', amount: '-', disabled: true, order: 2 },
        { id: 'f9', name: 'Buku Prestasi', amount: 'Rp 10.000', order: 3 },
        { id: 'f10', name: 'ID Card', amount: '-', disabled: true, order: 4 },
        { id: 'f11', name: 'Buku Jilid', amount: 'Rp 25.000', order: 5 },
        { id: 'f12', name: 'SPP Awal', amount: 'Rp 100.000', order: 6 },
      ],
      totalFee: 'Rp 250.000',
      notes: [
        { id: 'n5', icon: '🎓', text: 'Usia minimal 17 tahun ke atas' },
        { id: 'n6', icon: '🤝', text: 'Berkomitmen untuk mengikuti pembelajaran secara rutin' },
        { id: 'n7', icon: '📅', text: 'Jadwal fleksibel (Pagi/Siang/Malam) sesuai kesepakatan' },
        { id: 'n8', icon: '💰', text: 'Pembayaran pendaftaran dilakukan di awal masuk' },
      ],
      requirements: [
        { id: 'r7', text: 'Mengisi formulir pendaftaran' },
        { id: 'r8', text: 'Menyerahkan 1 lembar fotokopi KTP' },
        { id: 'r9', text: 'Membayar biaya administrasi pendaftaran' },
      ],
      order: 2,
    },
  ],
};

/* ---------- Animation Variants ---------- */
const heroVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] },
  }),
};

/* ---------- Sub-components ---------- */
const LoadingSkeleton = () => (
  <div aria-hidden="true">
    <div className="ep-skeleton ep-skeleton-hero" />
    <div className="ep-skeleton-tabs">
      <div className="ep-skeleton ep-skeleton-tab" />
      <div className="ep-skeleton ep-skeleton-tab" />
    </div>
    <div className="ep-skeleton ep-skeleton-card" />
    <div className="ep-skeleton ep-skeleton-card" />
    <div className="ep-skeleton ep-skeleton-card" />
  </div>
);

const LoadingIndicator = () => (
  <div className="ep-loading" aria-live="polite">
    <Loader2 className="h-5 w-5" />
    <p>Memuat informasi pendaftaran…</p>
  </div>
);

const EmptyState = () => (
  <div className="ep-empty">
    <ClipboardList />
    <h3>Belum ada informasi pendaftaran</h3>
    <p>Informasi pendaftaran akan tampil di sini setelah tersedia.</p>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="ep-error">
    <ClipboardList />
    <h3>Gagal memuat informasi pendaftaran</h3>
    <p>{message}</p>
    {onRetry && (
      <button className="ep-retry-btn" onClick={onRetry} type="button">
        <RefreshCw className="inline h-4 w-4 mr-1" />
        Coba lagi
      </button>
    )}
  </div>
);

const FeeBreakdown = ({ fees, totalFee }) => (
  <div className="ep-fees-card">
    <h3 className="ep-fees-card__title">
      <Banknote className="h-4 w-4" />
      Rincian Biaya
    </h3>
    {fees.map((fee) => (
      <div key={fee.id} className="ep-fee-row">
        <span className={`ep-fee-row__name${fee.disabled ? ' ep-fee-row__name--disabled' : ''}`}>
          {fee.name}
        </span>
        <span className={`ep-fee-row__amount${fee.disabled ? ' ep-fee-row__amount--disabled' : ''}`}>
          {fee.amount}
        </span>
      </div>
    ))}
    {totalFee && (
      <div className="ep-fee-total">
        <span className="ep-fee-total__label">Total</span>
        <span className="ep-fee-total__amount">{totalFee}</span>
      </div>
    )}
  </div>
);

const NotesPanel = ({ notes, title = 'Catatan Penting' }) => (
  <div className="ep-notes-card">
    <h3 className="ep-notes-card__title">{title}</h3>
    {notes.map((note) => (
      <div key={note.id} className="ep-note-item">
        <span className="ep-note-item__icon" aria-hidden="true">{note.icon}</span>
        <span className="ep-note-item__text">{note.text}</span>
      </div>
    ))}
  </div>
);

const RequirementsList = ({ requirements }) => (
  <div className="ep-req-card">
    <h3 className="ep-req-card__title">
      <ClipboardCheck className="h-4 w-4" />
      Syarat Pendaftaran
    </h3>
    <ul className="ep-req-list" role="list">
      {requirements.map((req) => (
        <li key={req.id} className="ep-req-item">
          <span className="ep-req-item__check" aria-hidden="true">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2.5 6 5 8.5 9.5 3.5" />
            </svg>
          </span>
          <span className="ep-req-item__text">{req.text}</span>
        </li>
      ))}
    </ul>
  </div>
);

const CategoryContent = ({ category }) => (
  <motion.section
    className="ep-section"
    variants={sectionVariants}
    initial="hidden"
    animate="visible"
    custom={0}
    aria-labelledby={`cat-${category.id}`}
  >
    {/* Category Header */}
    <div className="ep-category-header">
      <div className="ep-category-header__icon" aria-hidden="true">
        {category.icon}
      </div>
      <div className="ep-category-header__text">
        <h2 id={`cat-${category.id}`}>{category.name}</h2>
        {category.description && <p>{category.description}</p>}
      </div>
    </div>

    {/* Fees + Notes Grid */}
    <div className="ep-duo-grid" style={{ marginBottom: 'clamp(1.25rem, 2.5vw, 1.75rem)' }}>
      <FeeBreakdown fees={category.fees} totalFee={category.totalFee} />
      {category.notes && category.notes.length > 0 && (
        <NotesPanel
          notes={category.notes}
          title={`Catatan ${category.name.includes('Dewasa') ? '(Dewasa)' : ''}`}
        />
      )}
    </div>

    {/* Requirements */}
    {category.requirements && category.requirements.length > 0 && (
      <RequirementsList requirements={category.requirements} />
    )}
  </motion.section>
);

/* ---------- Main Page ---------- */
const RegistrationInfoPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('tpq');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const contentMap = await fetchWebsiteContentMap({
        keys: ['enrollmentInfo'],
        publicOnly: true,
      });
      const raw = contentMap.enrollmentInfo;
      if (raw && typeof raw === 'object' && Array.isArray(raw.categories) && raw.categories.length > 0) {
        // Sort by order
        const sorted = {
          ...raw,
          categories: [...raw.categories].sort((a, b) => (a.order || 0) - (b.order || 0)),
        };
        setData(sorted);
      } else {
        // Use default hardcoded data when no admin data exists
        setData(DEFAULT_ENROLLMENT_DATA);
      }
    } catch (err) {
      // On error, fall back to default data rather than showing error
      // This ensures the page always works even if Supabase is down
      setData(DEFAULT_ENROLLMENT_DATA);
      // But still log the error for debugging
      console.warn('Enrollment data fetch failed, using defaults:', getPublicContentErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categories = data?.categories || [];
  const currentCategory = categories.find((c) => c.id === activeCategory) || categories[0];

  return (
    <div className="enrollment-page">
      <Helmet>
        <title>Informasi Pendaftaran — LPQ Al-Muhajirun</title>
        <meta
          name="description"
          content="Informasi lengkap pendaftaran santri baru LPQ Al-Muhajirun — biaya, syarat, dan prosedur untuk program TPQ anak maupun dewasa."
        />
        <link rel="canonical" href="https://lpq-al-muhajirun.vercel.app/pendaftaran/informasi" />
        <meta property="og:title" content="Informasi Pendaftaran — LPQ Al-Muhajirun" />
        <meta property="og:description" content="Informasi lengkap pendaftaran santri baru LPQ Al-Muhajirun — biaya, syarat, dan prosedur untuk program TPQ anak maupun dewasa." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://lpq-al-muhajirun.vercel.app/pendaftaran/informasi" />
      </Helmet>

      {/* ---- Hero ---- */}
      <section className="ep-hero" aria-labelledby="ep-hero-title">
        <div className="ep-container ep-hero__inner">
          <motion.div variants={heroVariants} initial="hidden" animate="visible">
            {/* Breadcrumb */}
            <nav className="ep-breadcrumb" aria-label="Breadcrumb">
              <Link to="/">Beranda</Link>
              <span className="ep-breadcrumb__sep" aria-hidden="true">/</span>
              <span className="ep-breadcrumb__current" aria-current="page">Informasi Pendaftaran</span>
            </nav>

            <span className="ep-hero__eyebrow">
              <ClipboardList className="h-3.5 w-3.5" />
              Pendaftaran Terbuka
            </span>
            <h1 id="ep-hero-title" className="ep-hero__title">
              Informasi <em>Pendaftaran</em>
            </h1>
            <p className="ep-hero__lead">
              Panduan lengkap untuk mendaftarkan diri atau buah hati Anda di LPQ Al-Muhajirun.
              Temukan biaya, syarat, dan prosedur pendaftaran untuk setiap program.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ---- Category Navigation + Content ---- */}
      <section className="ep-container" style={{ paddingTop: 0, paddingBottom: 'clamp(3rem, 6vw, 5rem)' }} aria-label="Informasi pendaftaran per program">
        {loading ? (
          <>
            <LoadingSkeleton />
            <LoadingIndicator />
          </>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : categories.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Segmented Control */}
            <div className="ep-category-nav">
              <div
                className="ep-segmented"
                role="tablist"
                aria-label="Kategori pendaftaran"
              >
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    role="tab"
                    id={`tab-${cat.id}`}
                    aria-selected={activeCategory === cat.id}
                    aria-controls={`panel-${cat.id}`}
                    className="ep-segmented__btn"
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {activeCategory === cat.id && (
                      <motion.span
                        className="ep-segmented__pill"
                        layoutId="ep-tab-pill"
                        transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <span aria-hidden="true">{cat.icon}</span>
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content Panel */}
            <div
              className="ep-content"
              role="tabpanel"
              id={`panel-${activeCategory}`}
              aria-labelledby={`tab-${activeCategory}`}
            >
              {currentCategory && <CategoryContent category={currentCategory} key={currentCategory.id} />}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default RegistrationInfoPage;