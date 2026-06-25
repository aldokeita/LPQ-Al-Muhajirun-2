import React, { Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import GradientText from '@/components/reactbits/GradientText/GradientText';
import SplitText from '@/components/reactbits/SplitText/SplitText';
import StarBorder from '@/components/reactbits/StarBorder/StarBorder';
import SectionKicker from './SectionKicker';
import { compactNumber, imageOf, LOCAL_LOGO, safeArray } from './homeUtils';

const LightPillar = React.lazy(() => import('@/components/reactbits/LightPillar/LightPillar'));

const getQuality = () => {
  if (typeof window === 'undefined') return 'medium';
  if (window.matchMedia('(max-width: 640px)').matches) return 'low';
  if (window.matchMedia('(max-width: 1024px)').matches) return 'medium';
  return 'high';
};

const HeroSection = ({ content, currentSlide, setCurrentSlide, stats }) => {
  const slides = safeArray(content.heroSlides);
  const activeSlide = slides[currentSlide] || slides[0] || {};
  const heroText = activeSlide.text || 'Masuki ruang belajar Al-Qur’an yang hangat, tertata, dan dekat dengan keluarga.';
  const heroSubtext = activeSlide.author || 'Metode Qiroati, pembinaan adab, dan informasi lembaga yang mudah diikuti wali santri.';
  const logoUrl = content.logoUrl || LOCAL_LOGO;
  const visualImage = imageOf(activeSlide);
  const quality = useMemo(getQuality, []);

  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero__backdrop" />
      <Suspense fallback={<div className="home-hero__pillar-fallback" aria-hidden="true" />}>
        <LightPillar
          topColor="#9dc1c7"
          bottomColor="#00eb9d"
          intensity={1}
          rotationSpeed={0.4}
          glowAmount={0.005}
          pillarWidth={3}
          pillarHeight={0.3}
          noiseIntensity={0.3}
          pillarRotation={53}
          interactive={quality === 'high'}
          mixBlendMode="color-dodge"
          quality={quality}
        />
      </Suspense>
      <div className="home-hero__grain" aria-hidden="true" />
      <div className="home-hero__inner">
        <motion.div
          className="home-hero__copy"
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
        >
          <SectionKicker dark>A Living Journey of Learning</SectionKicker>
          <h1 id="home-hero-title" className="home-hero__title">
            <SplitText text="Belajar Al-Qur’an" />
            <span><GradientText>terasa lebih hidup.</GradientText></span>
          </h1>
          <p className="home-hero__lead">{heroText}</p>
          <p className="home-hero__support">{heroSubtext}</p>
          <div className="home-hero__actions">
            <StarBorder as="span">
              <Button asChild size="lg" className="home-primary-cta">
                <Link to="/pendaftaran/informasi">Informasi Pendaftaran <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
            </StarBorder>
            <Button asChild size="lg" variant="outline" className="home-secondary-cta">
              <Link to="/profil">Kenali LPQ</Link>
            </Button>
          </div>
          <div className="home-hero__stats" aria-label="Ringkasan lembaga">
            {stats.santri > 0 && <span><strong>{compactNumber(stats.santri)}</strong> santri aktif</span>}
            {stats.guru > 0 && <span><strong>{compactNumber(stats.guru)}</strong> guru</span>}
            <span><strong>Qiroati</strong> metode belajar</span>
            <span><strong>RFID</strong> absensi digital</span>
          </div>
        </motion.div>
        <motion.div
          className="home-hero__visual"
          initial={{ opacity: 0, x: 38, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="home-hero__orbital">
            <div className="home-hero__logo-card">
              <img src={logoUrl} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
              <span>LPQ</span>
            </div>
            {visualImage && <img className="home-hero__photo" src={visualImage} alt="Kegiatan LPQ Al-Muhajirun" loading="eager" />}
          </div>
        </motion.div>
      </div>
      {slides.length > 1 && (
        <div className="home-hero__dots" aria-label="Pilih slide utama">
          {slides.map((slide, index) => (
            <button
              key={slide.id || index}
              type="button"
              aria-label={`Tampilkan cerita ${index + 1}`}
              aria-current={currentSlide === index}
              onClick={() => setCurrentSlide(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default HeroSection;
