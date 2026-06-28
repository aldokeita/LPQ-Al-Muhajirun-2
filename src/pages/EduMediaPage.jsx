import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Check,
  X,
  BookOpen,
  Gamepad2,
  ChevronRight,
  Library,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import '@/styles/public-edumedia.css';

/* ---------- Animation Variants ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

/* ---------- Tajwid Data ---------- */
const tajwidTerms = [
  { id: 1, term: 'Ikhfa', definition: 'Menyamarkan atau membunyikan antara Izhar dan Idgham, siap untuk didengungkan.' },
  { id: 2, term: 'Idgham', definition: 'Menggabungkan atau memasukkan huruf pertama ke huruf kedua.' },
  { id: 3, term: 'Iqlab', definition: 'Mengganti bunyi huruf Nun Sukun atau Tanwin menjadi Mim.' },
  { id: 4, term: 'Izhar', definition: 'Membaca huruf Nun Sukun atau Tanwin dengan jelas tanpa dengung.' },
  { id: 5, term: 'Qalqalah', definition: 'Memantulkan bunyi huruf pada huruf-huruf tertentu saat sukun.' },
];

/* ---------- Hijaiyah Letters ---------- */
const letters = [
  { char: 'ا', name: 'Alif' }, { char: 'ب', name: 'Ba' }, { char: 'ت', name: 'Ta' }, { char: 'ث', name: 'Tsa' },
  { char: 'ج', name: 'Jim' }, { char: 'ح', name: 'Ha' }, { char: 'خ', name: 'Kho' }, { char: 'د', name: 'Dal' },
  { char: 'ذ', name: 'Dzal' }, { char: 'ر', name: 'Ro' }, { char: 'ز', name: 'Zay' }, { char: 'س', name: 'Sin' },
  { char: 'ش', name: 'Syin' }, { char: 'ص', name: 'Shod' }, { char: 'ض', name: 'Dhod' }, { char: 'ط', name: 'Tho' },
  { char: 'ظ', name: 'Zho' }, { char: 'ع', name: 'Ain' }, { char: 'غ', name: 'Ghoin' }, { char: 'ف', name: 'Fa' },
  { char: 'ق', name: 'Qof' }, { char: 'ك', name: 'Kaf' }, { char: 'ل', name: 'Lam' }, { char: 'م', name: 'Mim' },
  { char: 'ن', name: 'Nun' }, { char: 'ه', name: 'Ha' }, { char: 'و', name: 'Waw' }, { char: 'ي', name: 'Ya' },
];

/* ---------- Tajwid Dictionary Component ---------- */
const TajwidDictionary = () => {
  return (
    <section className="edu-section" aria-labelledby="edu-tajwid-heading">
      <div className="edu-section__header">
        <p className="edu-section__kicker">
          <BookOpen className="w-3.5 h-3.5" />
          Referensi
        </p>
        <h2 id="edu-tajwid-heading" className="edu-section__title">Kamus Tajwid Mini</h2>
        <p className="edu-section__desc">
          Istilah-istilah penting dalam ilmu tajwid yang perlu dipahami oleh setiap pembaca Al-Qur'an.
        </p>
      </div>

      <div className="edu-tajwid">
        <div className="edu-tajwid__header">
          <h3 className="edu-tajwid__title">
            <BookOpen className="w-5 h-5" />
            Istilah Tajwid
          </h3>
        </div>
        <div className="edu-tajwid__body">
          <div className="edu-tajwid__grid" role="list">
            {tajwidTerms.map((item) => (
              <div
                key={item.id}
                className="edu-tajwid-card"
                role="listitem"
              >
                <h4 className="edu-tajwid-card__term">{item.term}</h4>
                <p className="edu-tajwid-card__def">{item.definition}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ---------- Hijaiyah Game Component ---------- */
const HijaiyahGame = () => {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [clickedOption, setClickedOption] = useState(null);

  const generateQuestion = useCallback(() => {
    setFeedback(null);
    const correctLetter = letters[Math.floor(Math.random() * letters.length)];
    let tempOptions = [correctLetter.name];

    while (tempOptions.length < 4) {
      const randomLetter = letters[Math.floor(Math.random() * letters.length)];
      if (!tempOptions.includes(randomLetter.name)) {
        tempOptions.push(randomLetter.name);
      }
    }

    setCurrentQuestion(correctLetter);
    setOptions(tempOptions.sort(() => Math.random() - 0.5));
  }, []);

  useEffect(() => {
    generateQuestion();
  }, [generateQuestion]);

  const handleAnswer = (option) => {
    if (feedback) return;
    setClickedOption(option);

    if (option === currentQuestion.name) {
      setFeedback('correct');
      toast({ title: "Benar!", description: "Jawaban Anda benar!", className: "bg-green-500 text-white" });
      setTimeout(generateQuestion, 1500);
    } else {
      setFeedback('incorrect');
      toast({ title: "Salah!", description: "Coba lagi ya!", variant: "destructive" });
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  if (!currentQuestion) {
    return (
      <section className="edu-section" aria-labelledby="edu-game-heading">
        <div className="edu-section__header">
          <p className="edu-section__kicker">
            <Gamepad2 className="w-3.5 h-3.5" />
            Interaktif
          </p>
          <h2 id="edu-game-heading" className="edu-section__title">Game Tebak Huruf Hijaiyah</h2>
          <p className="edu-section__desc">Uji kemampuan mengenal huruf hijaiyah dengan permainan yang menyenangkan.</p>
        </div>
        <div className="edu-game">
          <div className="edu-game__body">
            <div className="edu-loading" role="status" aria-label="Memuat permainan">
              <div className="edu-loading__spinner" aria-hidden="true" />
              <span style={{ fontSize: '0.9rem', color: 'var(--edu-muted)' }}>Memuat permainan...</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <section className="edu-section" aria-labelledby="edu-game-heading">
      <div className="edu-section__header">
        <p className="edu-section__kicker">
          <Gamepad2 className="w-3.5 h-3.5" />
          Interaktif
        </p>
        <h2 id="edu-game-heading" className="edu-section__title">Game Tebak Huruf Hijaiyah</h2>
        <p className="edu-section__desc">
          Lihat huruf hijaiyah di bawah ini, lalu pilih nama huruf yang benar!
        </p>
      </div>

      <div className="edu-game" role="group" aria-label="Permainan tebak huruf hijaiyah">
        <div className="edu-game__header">
          <h3 className="edu-game__title">
            <Gamepad2 className="w-5 h-5" />
            Tebak Huruf
          </h3>
        </div>
        <div className="edu-game__body">
          <div className="edu-game__letter" aria-label={`Huruf: ${currentQuestion.name}`}>
            {currentQuestion.char}
          </div>
          <p className="edu-game__question">Huruf apakah ini?</p>
          <div className="edu-game__options" role="radiogroup" aria-label="Pilihan jawaban">
            {options.map((option, index) => {
              let className = 'edu-game__option';
              if (feedback) {
                if (option === currentQuestion.name) {
                  className += ' edu-game__option--correct';
                } else if (feedback === 'incorrect' && option === clickedOption) {
                  className += ' edu-game__option--wrong';
                }
              }
              return (
                <button
                  key={option}
                  className={className}
                  onClick={() => handleAnswer(option)}
                  disabled={!!feedback}
                  aria-label={`${optionLabels[index]}. ${option}`}
                >
                  <span className="edu-game__option-label">{optionLabels[index]}.</span>
                  {option}
                </button>
              );
            })}
          </div>
          <div className="edu-game__feedback" aria-live="polite">
            {feedback === 'correct' && <Check className="edu-game__feedback-icon text-green-500" />}
            {feedback === 'incorrect' && <X className="edu-game__feedback-icon text-red-500" />}
          </div>
          <button className="edu-game__next-btn" onClick={generateQuestion}>
            <RefreshCw className="w-4 h-4" />
            Soal Berikutnya
          </button>
        </div>
      </div>
    </section>
  );
};

/* ---------- Main Component ---------- */
const EduMediaPage = () => {
  return (
    <>
      <Helmet>
        <title>Media Edukatif - LPQ Al-Muhajirun</title>
        <meta name="description" content="Jelajahi media edukatif Islami, termasuk game tebak huruf hijaiyah dan kamus tajwid mini, untuk pembelajaran yang menyenangkan." />
        <meta property="og:title" content="Media Edukatif - LPQ Al-Muhajirun" />
        <meta property="og:description" content="Media pembelajaran interaktif untuk santri dan keluarga: huruf hijaiyah, tajwid, dan lebih banyak lagi." />
        <link rel="canonical" href={`${window.location.origin}/parenting/media-edukatif`} />
      </Helmet>

      <div className="edu-page">
        {/* ---- Breadcrumb ---- */}
        <nav className="edu-breadcrumb" aria-label="Breadcrumb">
          <Link to="/parenting" className="edu-breadcrumb__link">Parenting</Link>
          <ChevronRight className="w-3 h-3 edu-breadcrumb__sep" aria-hidden="true" />
          <span className="edu-breadcrumb__current" aria-current="page">Media Edukatif</span>
        </nav>

        {/* ---- HERO ---- */}
        <section className="edu-hero" aria-labelledby="edu-hero-title">
          <motion.div
            className="edu-hero__inner"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <span className="edu-hero__badge">
              <Library className="w-3.5 h-3.5" />
              Perpustakaan Media
            </span>
            <h1 id="edu-hero-title" className="edu-hero__title">
              Media <span className="edu-hero__title-accent">Edukatif</span>
            </h1>
            <p className="edu-hero__desc">
              Jelajahi media pembelajaran interaktif untuk santri dan keluarga — dari mengenal huruf hijaiyah hingga memahami ilmu tajwid.
            </p>
          </motion.div>
        </section>

        <div className="edu-container">
          {/* ---- Hijaiyah Game (Primary/Featured) ---- */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <HijaiyahGame />
          </motion.div>

          {/* ---- Tajwid Dictionary (Secondary) ---- */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={fadeUp}
          >
            <TajwidDictionary />
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default EduMediaPage;