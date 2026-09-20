import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from '@/components/ui/use-toast';
import { count, query } from '@/lib/dataClient';
import {
  fetchPublishedAnnouncements,
  fetchPublishedNews,
  getPublicContentErrorMessage,
  submitPublicFeedback,
} from '@/lib/publicContentAdapters';
import ActivityGallery from '@/components/public/home/ActivityGallery';
import EditorialNews from '@/components/public/home/EditorialNews';
import FinalCTA from '@/components/public/home/FinalCTA';
import HeroSection from '@/components/public/home/HeroSection';
import InstitutionalValues from '@/components/public/home/InstitutionalValues';
import ProgramBento from '@/components/public/home/ProgramBento';
import TestimonialsFaq from '@/components/public/home/TestimonialsFaq';
import { BRAND_NAME, defaultContent, safeArray } from '@/components/public/home/homeUtils';
import '@/styles/homepage.css';

const friendlyPublicError = (error) => {
  const message = getPublicContentErrorMessage(error);
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Konten publik belum dapat dimuat. Silakan coba beberapa saat lagi.';
  }
  return message;
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
        // Halaman ini dibuka pengunjung tanpa login. Tabel santri dan guru tidak punya
        // kebijakan publik, jadi hitungannya nol untuk mereka — sama seperti sebelumnya
        // di bawah RLS.
        const [santriResult, guruResult, contentResult, newsResult, announcementResult] = await Promise.all([
          count({ table: 'santri', filters: [{ column: 'status', op: 'eq', value: 'Aktif' }] }),
          count({ table: 'guru' }),
          query({
            table: 'website_content',
            columns: ['key', 'content'],
            filters: [{ column: 'is_public', op: 'eq', value: 1 }],
            limit: 1000,
          }),
          fetchPublishedNews({ limit: 4 }),
          fetchPublishedAnnouncements({ limit: 4 }),
        ]);

        if (!mounted) return;
        if (contentResult.error) throw contentResult.error;

        const contentMap = (contentResult.data || []).reduce((acc, item) => {
          acc[item.key] = item.content;
          return acc;
        }, {});

        setStats({ santri: santriResult.data || 0, guru: guruResult.data || 0 });
        setContent({ ...defaultContent, ...contentMap });
        setNews(newsResult);
        setAnnouncements(announcementResult);
      } catch (error) {
        if (mounted) setContentError(friendlyPublicError(error));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchHomepageData();

    // Dulu ada subscription realtime yang memperbarui konten tanpa memuat ulang halaman.
    // Backend baru belum punya padanannya, dan subscription itu sendiri tidak pernah
    // benar-benar bekerja di produksi: tabel publik tidak terdaftar di publication
    // supabase_realtime sampai 2026-09-20. Jadi menghapusnya mengembalikan perilaku yang
    // memang dialami pengguna selama ini — konten menyegar saat halaman dimuat.
    return () => {
      mounted = false;
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
        <meta name="description" content="Website resmi LPQ Al-Muhajirun Metode Qiroati Baturaja: pendaftaran, berita, pengumuman, feedback, dan portal pendidikan Al-Qur'an." />
      </Helmet>

      <main className="home-page">
        <HeroSection content={content} currentSlide={currentSlide} setCurrentSlide={setCurrentSlide} stats={stats} />
        <InstitutionalValues content={content} />
        <ProgramBento schedules={content.schedules} quotas={content.quotas} />
        <ActivityGallery facilities={content.galleryPhotos?.length ? content.galleryPhotos : content.facilities} />
        <EditorialNews news={news} announcements={announcements} loading={loading} error={contentError} />
        <TestimonialsFaq testimonials={content.testimonials} faqs={content.faqs} />
        <FinalCTA content={content} formData={formData} setFormData={setFormData} onSubmit={handleSubmitQuestion} sending={sending} />
      </main>
    </>
  );
};

export default HomePage;
