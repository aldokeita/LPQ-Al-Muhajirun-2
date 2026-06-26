import React, { Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import CardSwap, { Card } from '@/components/reactbits/CardSwap/CardSwap';
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
  const quality = useMemo(getQuality, []);
  const heroCards = useMemo(() => {
    const heroItems = slides.map((slide, index) => ({
      id: slide.id || `hero-${index}`,
      source: 'Cerita utama',
      title: slide.text || 'Kegiatan belajar LPQ',
      description: slide.author || 'Dokumentasi yang dikelola dari konten website.',
      image: imageOf(slide),
      slideIndex: index,
    }));
    const supportingItems = [
      ...safeArray(content.galleryPhotos),
      ...safeArray(content.facilities),
    ].map((item, index) => ({
      id: item.id || `support-${index}`,
      source: 'Kegiatan LPQ',
      title: item.title || item.name || 'Suasana belajar',
      description: item.description || 'Foto kegiatan yang dikelola dari konten website.',
      image: imageOf(item),
      slideIndex: null,
    }));
    const usedImages = new Set();
    const cards = [...heroItems, ...supportingItems]
      .filter((item) => item.image)
      .filter((item) => {
        if (usedImages.has(item.image)) return false;
        usedImages.add(item.image);
        return true;
      })
      .slice(0, 4);

    if (cards.length) return cards;

    return [{
      id: 'logo-fallback',
      source: 'LPQ Al-Muhajirun',
      title: 'Ruang belajar Al-Qur’an',
      description: 'Gambar hero akan tampil setelah admin mengunggah konten.',
      image: logoUrl,
      slideIndex: null,
      isLogo: true,
    }];
  }, [content.facilities, content.galleryPhotos, logoUrl, slides]);

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
            <SplitText
              text="Belajar Al-Qur’an"
              tag="span"
              className="home-hero__split-line"
              delay={70}
              duration={0.9}
              ease="power3.out"
              splitType="words"
              from={{ opacity: 0, y: 46, filter: 'blur(10px)' }}
              to={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              textAlign="left"
            />
            <GradientText
              colors={['#8af5cb', '#66d9ff', '#c6b8ff', '#f5c76a']}
              animationSpeed={6.5}
              direction="horizontal"
              className="home-hero__gradient-line"
            >
              <SplitText
                text="terasa lebih hidup."
                tag="span"
                className="home-hero__split-line"
                delay={58}
                duration={0.92}
                ease="power3.out"
                splitType="words"
                from={{ opacity: 0, y: 42, filter: 'blur(10px)' }}
                to={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                textAlign="left"
              />
            </GradientText>
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
          <div className="home-hero__swap-stage" aria-label="Dokumentasi kegiatan LPQ">
            <CardSwap
              width="min(78vw, 34rem)"
              height="min(70vw, 28rem)"
              cardDistance={48}
              verticalDistance={52}
              delay={content.slideshowTimer || 7000}
              skewAmount={3.5}
              easing="elastic"
              onCardClick={(index) => {
                const slideIndex = heroCards[index]?.slideIndex;
                if (typeof slideIndex === 'number') setCurrentSlide(slideIndex);
              }}
            >
              {heroCards.map((card, index) => (
                <Card key={card.id} className={`home-hero-swap-card ${card.isLogo ? 'home-hero-swap-card--logo' : ''}`}>
                  <img
                    src={card.image}
                    alt={card.isLogo ? 'Logo LPQ Al-Muhajirun' : `Dokumentasi ${card.title}`}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    onError={(event) => {
                      if (event.currentTarget.src.endsWith(logoUrl)) {
                        event.currentTarget.style.display = 'none';
                        return;
                      }
                      event.currentTarget.src = logoUrl;
                    }}
                  />
                  <div className="home-hero-swap-card__veil" />
                  <div className="home-hero-swap-card__content">
                    <span>{card.source}</span>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </div>
                </Card>
              ))}
            </CardSwap>
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
