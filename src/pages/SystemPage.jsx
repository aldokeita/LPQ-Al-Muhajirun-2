import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Clock,
  Users,
  BookOpen,
  Edit,
  AlertTriangle,
  HeartHandshake as Handshake,
  ArrowRight,
  CheckCircle2,
  Sunrise,
  Sun,
  Sunset,
  GraduationCap,
  Star,
  ClipboardCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import '@/styles/public-learning-system.css';

/* ---------- Animation Variants ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/* ---------- Data (All original data preserved) ---------- */
const systemPoints = [
  {
    icon: Clock,
    title: "Jadwal & Sesi Mengaji",
    short: "Tiga sesi fleksibel, Senin-Jumat.",
    details: [
      "Kami menyediakan 3 sesi belajar setiap hari (Senin-Jumat) untuk mengakomodasi berbagai jadwal: Sesi Pagi, Sesi Siang, dan Sesi Sore.",
      "Setiap sesi berlangsung selama 1 jam 15 menit, dirancang untuk pembelajaran yang efektif dan fokus.",
      "Hari Jumat dikhususkan untuk kegiatan hafalan (doa, bacaan sholat, surat pendek) dan diakhiri dengan praktik sholat berjamaah pada akhir bulan."
    ]
  },
  {
    icon: Users,
    title: "Struktur Kelas Efektif",
    short: "Kelas kecil, perhatian maksimal.",
    details: [
      "Untuk menjaga kualitas, setiap kelas dibatasi maksimal hanya 15 santri.",
      "Struktur ini memungkinkan guru untuk memberikan perhatian yang lebih personal kepada setiap santri.",
      "Santri dikelompokkan berdasarkan jilid atau tingkat kemampuan mereka untuk memastikan materi yang disampaikan sesuai."
    ]
  },
  {
    icon: BookOpen,
    title: "Alur Pembelajaran Harian",
    short: "Drilling, klasikal, dan setoran individual.",
    details: [
      "<strong>15 Menit Awal (Drilling):</strong> Santri berbaris dan membaca hafalan secara klasikal dan berulang-ulang. Senin & Selasa untuk surat pendek, Rabu & Kamis untuk doa harian. Jumat untuk muraja'ah (mengulang hafalan).",
      "<strong>30 Menit Berikutnya (Klasikal):</strong> Guru mengajar menggunakan peraga (tunjuk atau kartu) untuk menjelaskan materi jilid secara bersama-sama.",
      "<strong>30 Menit Selanjutnya (Individual):</strong> Santri maju satu per satu untuk menyetorkan bacaan kepada guru. Progres dicatat di buku prestasi.",
      "<strong>15 Menit Akhir (Evaluasi):</strong> Digunakan untuk evaluasi, melanjutkan setoran yang belum selesai, atau pendekatan personal oleh guru."
    ]
  },
  {
    icon: Edit,
    title: "Buku Prestasi & Penilaian",
    short: "Pemantauan progres yang transparan.",
    details: [
      "Setiap santri memiliki buku prestasi untuk mencatat kemajuan bacaan.",
      "Guru akan menulis 'L' (Lulus) jika bacaan sudah benar, atau 'L-' (Lulus dengan catatan) beserta keterangan jika masih ada yang perlu diperbaiki.",
      "Kami sangat mengharapkan wali santri untuk memberikan paraf setiap hari sebagai bentuk dukungan dan pengawasan bersama."
    ]
  },
  {
    icon: AlertTriangle,
    title: "Prinsip Kedisiplinan Qiroati",
    short: "Kualitas di atas kuantitas.",
    details: [
      "Kami menerapkan standar kelulusan yang disiplin. Santri belum akan diluluskan ke halaman berikutnya jika masih terdapat 2-3 kesalahan fatal.",
      "Prinsip ini bertujuan agar santri tidak terbeban dengan materi baru sementara materi sebelumnya belum tuntas.",
      "Ini adalah bentuk tanggung jawab kami untuk memastikan setiap santri memiliki fondasi bacaan yang kokoh."
    ]
  },
  {
    icon: Handshake,
    title: "Sinergi dengan Wali Santri",
    short: "Kerja sama untuk kesuksesan santri.",
    details: [
      "Kami mewajibkan salah satu orang tua untuk ikut mengaji (di kelas dewasa) jika mendaftarkan anak usia 5 tahun ke bawah. Biaya pendaftaran untuk orang tua dibebaskan.",
      "Kerja sama aktif antara lembaga dan orang tua adalah kunci keberhasilan pendidikan Al-Qur'an dan pembentukan akhlak santri.",
      "Mari bersama-sama menjaga adab dan perilaku santri sesuai dengan nilai-nilai yang disepakati di LPQ Al-Muhajirun."
    ]
  }
];

/* ---------- Daily Learning Flow Data ---------- */
const dailyFlow = [
  {
    time: '15 Menit',
    label: 'Drilling',
    variant: 'start',
    icon: Sparkles,
    text: 'Santri berbaris dan membaca hafalan secara klasikal dan berulang-ulang. Senin & Selasa untuk surat pendek, Rabu & Kamis untuk doa harian. Jumat untuk <strong>muraja\'ah</strong> (mengulang hafalan).',
  },
  {
    time: '30 Menit',
    label: 'Pembelajaran Klasikal',
    variant: 'mid',
    icon: BookOpen,
    text: 'Guru mengajar menggunakan peraga (tunjuk atau kartu) untuk menjelaskan materi jilid secara <strong>bersama-sama</strong>.',
  },
  {
    time: '30 Menit',
    label: 'Setoran Individual',
    variant: 'late',
    icon: Users,
    text: 'Santri maju satu per satu untuk menyetorkan bacaan kepada guru. Progres <strong>dicatat di buku prestasi</strong>.',
  },
  {
    time: '15 Menit',
    label: 'Evaluasi & Penutup',
    variant: 'end',
    icon: ClipboardCheck,
    text: 'Digunakan untuk evaluasi, melanjutkan setoran yang belum selesai, atau <strong>pendekatan personal</strong> oleh guru.',
  },
];

/* ---------- Schedule Sessions ---------- */
const scheduleSessions = [
  {
    name: 'Sesi Pagi',
    time: 'Senin — Jumat',
    detail: 'Untuk santri yang lebih aktif di pagi hari. Pembelajaran dimulai saat suasana masih segar dan fokus optimal.',
    variant: 'pagi',
    icon: Sunrise,
    emoji: '🌅',
  },
  {
    name: 'Sesi Siang',
    time: 'Senin — Jumat',
    detail: 'Pilihan ideal untuk santri dengan jadwal pagi yang terisi. Tetap efektif dengan durasi 1 jam 15 menit.',
    variant: 'siang',
    icon: Sun,
    emoji: '☀️',
  },
  {
    name: 'Sesi Sore',
    time: 'Senin — Jumat',
    detail: 'Cocok untuk santri yang baru pulang sekolah. suasana belajar yang lebih santai namun tetap terstruktur.',
    variant: 'sore',
    icon: Sunset,
    emoji: '🌇',
  },
];

/* ---------- Assessment Cards ---------- */
const assessmentItems = [
  {
    icon: Star,
    title: 'Buku Prestasi',
    text: 'Setiap santri memiliki buku prestasi untuk mencatat kemajuan bacaan. Guru menulis \'L\' (Lulus) jika bacaan sudah benar, atau \'L-\' (Lulus dengan catatan) beserta keterangan.',
    color: 'emerald',
  },
  {
    icon: Edit,
    title: 'Paraf Wali Santri',
    text: 'Kami sangat mengharapkan wali santri untuk memberikan paraf setiap hari sebagai bentuk dukungan dan pengawasan bersama.',
    color: 'violet',
  },
  {
    icon: ShieldCheck,
    title: 'Standar Kelulusan',
    text: 'Santri belum akan diluluskan ke halaman berikutnya jika masih terdapat 2-3 kesalahan fatal. Kualitas di atas kuantitas.',
    color: 'rose',
  },
  {
    icon: GraduationCap,
    title: 'Kenaikan Jilid',
    text: 'Progres kenaikan jilid dilakukan berdasarkan penguasaan materi yang tuntas, bukan semata berdasarkan waktu. Setiap santri memiliki ritme belajar yang berbeda.',
    color: 'amber',
  },
];

/* ---------- Discipline Principles ---------- */
const principles = [
  'Kami menerapkan <strong>standar kelulusan yang disiplin</strong>. Santri belum akan diluluskan ke halaman berikutnya jika masih terdapat 2-3 kesalahan fatal.',
  'Prinsip ini bertujuan agar santri <strong>tidak terbeban dengan materi baru</strong> sementara materi sebelumnya belum tuntas.',
  'Ini adalah bentuk <strong>tanggung jawab kami</strong> untuk memastikan setiap santri memiliki fondasi bacaan yang kokoh.',
];

/* ---------- Synergy Points ---------- */
const synergyPoints = [
  'Kami mewajibkan salah satu orang tua untuk ikut mengaji (di kelas dewasa) jika mendaftarkan anak usia 5 tahun ke bawah. Biaya pendaftaran untuk orang tua dibebaskan.',
  'Kerja sama aktif antara lembaga dan orang tua adalah kunci keberhasilan pendidikan Al-Qur\'an dan pembentukan akhlak santri.',
  'Mari bersama-sama menjaga adab dan perilaku santri sesuai dengan nilai-nilai yang disepakati di LPQ Al-Muhajirun.',
];

/* ======================================== */
/*            MAIN COMPONENT                */
/* ======================================== */

const SystemPage = () => {
  return (
    <>
      <Helmet>
        <title>Sistem Mengaji - LPQ Al-Muhajirun</title>
        <meta name="description" content="Pelajari alur dan sistem pembelajaran mengaji dengan metode Qiroati di LPQ Al-Muhajirun." />
      </Helmet>

      <div className="ls-page">
        {/* ---- HERO ---- */}
        <section className="ls-hero" aria-labelledby="ls-hero-title">
          <motion.div
            className="ls-hero__inner"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <span className="ls-hero__badge">
              <BookOpen className="w-3.5 h-3.5" />
              Metode Qiroati
            </span>
            <h1 id="ls-hero-title" className="ls-hero__title">
              Sistem <span className="ls-hero__title-accent">Pembelajaran</span> Mengaji
            </h1>
            <p className="ls-hero__desc">
              Memahami alur pembelajaran yang terstruktur, efektif, dan berorientasi pada kualitas untuk membentuk generasi Qur'ani.
            </p>
          </motion.div>
        </section>

        <div className="ls-container">

          {/* ---- OVERVIEW SECTION ---- */}
          <section className="ls-section" aria-labelledby="ls-overview-title">
            <motion.div
              className="ls-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="ls-section__kicker">
                <Sparkles className="w-3.5 h-3.5" />
                Sekilas
              </p>
              <h2 id="ls-overview-title" className="ls-section__title">Sistem yang Terstruktur</h2>
              <p className="ls-section__desc">
                Tiga pilar utama membentuk fondasi pembelajaran di LPQ Al-Muhajirun: jadwal fleksibel, kelas efektif, dan alur harian yang terarah.
              </p>
            </motion.div>

            <motion.div
              className="ls-overview-grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              {[
                { icon: Clock, title: 'Jadwal Fleksibel', text: 'Tiga sesi belajar setiap hari (Senin-Jumat) untuk mengakomodasi berbagai jadwal keluarga.', color: 'emerald' },
                { icon: Users, title: 'Kelas Kecil & Fokus', text: 'Maksimal 15 santri per kelas untuk perhatian personal dan progres optimal.', color: 'amber' },
                { icon: BookOpen, title: 'Alur Harian Terarah', text: 'Drilling, klasikal, setoran individual, dan evaluasi — terstruktur dalam setiap sesi.', color: 'sky' },
              ].map((card) => (
                <motion.div key={card.title} className="ls-overview-card" variants={staggerItem}>
                  <div className={`ls-overview-card__icon ls-overview-card__icon--${card.color}`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <h3 className="ls-overview-card__title">{card.title}</h3>
                  <p className="ls-overview-card__text">{card.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* ---- SCHEDULE SECTION ---- */}
          <section className="ls-section" aria-labelledby="ls-schedule-title">
            <motion.div
              className="ls-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="ls-section__kicker">
                <Clock className="w-3.5 h-3.5" />
                Sesi Belajar
              </p>
              <h2 id="ls-schedule-title" className="ls-section__title">Tiga Sesi Fleksibel</h2>
              <p className="ls-section__desc">
                Setiap sesi berlangsung selama 1 jam 15 menit, dirancang untuk pembelajaran yang efektif dan fokus.
              </p>
            </motion.div>

            <motion.div
              className="ls-schedule-grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              {scheduleSessions.map((session) => (
                <motion.div
                  key={session.name}
                  className={`ls-schedule-card ls-schedule-card--${session.variant}`}
                  variants={staggerItem}
                >
                  <div className="ls-schedule-card__icon">
                    <span role="img" aria-hidden="true">{session.emoji}</span>
                  </div>
                  <h3 className="ls-schedule-card__name">{session.name}</h3>
                  <p className="ls-schedule-card__time">{session.time}</p>
                  <p className="ls-schedule-card__detail">{session.detail}</p>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* ---- DAILY FLOW TIMELINE ---- */}
          <section className="ls-section" aria-labelledby="ls-flow-title">
            <motion.div
              className="ls-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="ls-section__kicker">
                <BookOpen className="w-3.5 h-3.5" />
                Alur Harian
              </p>
              <h2 id="ls-flow-title" className="ls-section__title">Alur Pembelajaran Harian</h2>
              <p className="ls-section__desc">
                Setiap sesi mengaji memiliki ritme yang terstruktur: drilling, klasikal, setoran individual, dan evaluasi.
              </p>
            </motion.div>

            <motion.div
              className="ls-timeline"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
              role="list"
              aria-label="Alur pembelajaran harian"
            >
              {dailyFlow.map((step, i) => (
                <motion.div key={step.label} className="ls-timeline__item" variants={staggerItem} role="listitem">
                  <div className={`ls-timeline__marker ls-timeline__marker--${step.variant}`} aria-hidden="true">
                    {i + 1}
                  </div>
                  <div className="ls-timeline__body">
                    <span className="ls-timeline__time">
                      <Clock className="w-3 h-3" />
                      {step.time}
                    </span>
                    <h3 className="ls-timeline__label">{step.label}</h3>
                    <p
                      className="ls-timeline__text"
                      dangerouslySetInnerHTML={{ __html: step.text }}
                    />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* ---- CLASS STRUCTURE ---- */}
          <section className="ls-section" aria-labelledby="ls-structure-title">
            <motion.div
              className="ls-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="ls-section__kicker">
                <Users className="w-3.5 h-3.5" />
                Struktur Kelas
              </p>
              <h2 id="ls-structure-title" className="ls-section__title">Struktur Kelas Efektif</h2>
              <p className="ls-section__desc">
                Setiap kelas dirancang untuk memberikan perhatian maksimal kepada setiap santri.
              </p>
            </motion.div>

            <motion.div
              className="ls-structure"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <div className="ls-structure__visual">
                <div className="ls-structure__badge">
                  <span className="ls-structure__number">15</span>
                </div>
                <span className="ls-structure__label">Santri per Kelas</span>
              </div>
              <div className="ls-structure__content">
                <h3 className="ls-structure__title">Kelas Kecil, Perhatian Maksimal</h3>
                <p className="ls-structure__text">
                  Untuk menjaga kualitas, setiap kelas dibatasi maksimal hanya 15 santri. Struktur ini memungkinkan guru untuk memberikan perhatian yang lebih personal.
                </p>
                <ul className="ls-structure__list" role="list">
                  <li className="ls-structure__list-item">
                    <CheckCircle2 className="w-4 h-4 ls-structure__list-icon" />
                    <span>Perhatian personal dari guru untuk setiap santri</span>
                  </li>
                  <li className="ls-structure__list-item">
                    <CheckCircle2 className="w-4 h-4 ls-structure__list-icon" />
                    <span>Dikelompokkan berdasarkan jilid atau tingkat kemampuan</span>
                  </li>
                  <li className="ls-structure__list-item">
                    <CheckCircle2 className="w-4 h-4 ls-structure__list-icon" />
                    <span>Materi yang disampaikan sesuai dengan level santri</span>
                  </li>
                </ul>
              </div>
            </motion.div>
          </section>

          {/* ---- ASSESSMENT & EVALUATION ---- */}
          <section className="ls-section" aria-labelledby="ls-assessment-title">
            <motion.div
              className="ls-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="ls-section__kicker">
                <GraduationCap className="w-3.5 h-3.5" />
                Evaluasi & Penilaian
              </p>
              <h2 id="ls-assessment-title" className="ls-section__title">Evaluasi & Kenaikan Jilid</h2>
              <p className="ls-section__desc">
                Pemantauan progres yang transparan dan standar kelulusan yang disiplin untuk memastikan kualitas bacaan.
              </p>
            </motion.div>

            <motion.div
              className="ls-assessment-grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              {assessmentItems.map((item) => (
                <motion.div key={item.title} className="ls-assessment-card" variants={staggerItem}>
                  <div className={`ls-assessment-card__icon ls-assessment-card__icon--${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <h3 className="ls-assessment-card__title">{item.title}</h3>
                  <p className="ls-assessment-card__text">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* ---- DISCIPLINE PRINCIPLES ---- */}
          <section className="ls-section" aria-labelledby="ls-principles-title">
            <motion.div
              className="ls-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="ls-section__kicker">
                <ShieldCheck className="w-3.5 h-3.5" />
                Prinsip
              </p>
              <h2 id="ls-principles-title" className="ls-section__title">Prinsip Kedisiplinan Qiroati</h2>
              <p className="ls-section__desc">
                Kualitas di atas kuantitas — memastikan setiap santri memiliki fondasi bacaan yang kokoh.
              </p>
            </motion.div>

            <motion.div
              className="ls-principles"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
              role="list"
              aria-label="Prinsip kedisiplinan"
            >
              {principles.map((text, i) => (
                <motion.div key={i} className="ls-principle" variants={staggerItem} role="listitem">
                  <div className="ls-principle__marker" aria-hidden="true">{i + 1}</div>
                  <div className="ls-principle__content">
                    <p
                      className="ls-principle__text"
                      dangerouslySetInnerHTML={{ __html: text }}
                    />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* ---- SYNERGY SECTION ---- */}
          <section className="ls-section" aria-labelledby="ls-synergy-title">
            <motion.div
              className="ls-synergy"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <div className="ls-synergy__inner">
                <div>
                  <div className="ls-synergy__icon">
                    <Handshake className="w-7 h-7" />
                  </div>
                  <h2 id="ls-synergy-title" className="ls-synergy__title">Sinergi dengan Wali Santri</h2>
                  <ul className="ls-synergy__list" role="list">
                    {synergyPoints.map((point, i) => (
                      <li key={i} className="ls-synergy__list-item">
                        <CheckCircle2 className="w-4 h-4 ls-synergy__check" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="ls-synergy__visual" aria-hidden="true">
                  <span className="ls-synergy__handshake">🤝</span>
                  <span className="ls-synergy__visual-label">Kerja Sama</span>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ---- CTA ---- */}
          <section className="ls-cta" aria-labelledby="ls-cta-title">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <h2 id="ls-cta-title" className="ls-cta__title">Tertarik Bergabung?</h2>
              <p className="ls-cta__desc">
                Pelajari lebih lanjut tentang sistem pendaftaran dan mulai perjalanan belajar Al-Qur'an anak Anda bersama LPQ Al-Muhajirun.
              </p>
              <div className="ls-cta__actions">
                <Link to="/pendaftaran/informasi" className="ls-cta__btn ls-cta__btn--primary">
                  Informasi Pendaftaran
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/kontak" className="ls-cta__btn ls-cta__btn--secondary">
                  Hubungi Kami
                </Link>
              </div>
            </motion.div>
          </section>

        </div>
      </div>
    </>
  );
};

export default SystemPage;