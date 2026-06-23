
import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Star, Rocket, Users, Book, Phone, PlayCircle, Calendar, Clock, Trophy, Award, Zap, Shield, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import useWindowSize from '@/hooks/useWindowSize';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/customSupabaseClient';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const DailyQuote = () => {
  const quotes = [
    { text: "Sebaik-baik kalian adalah orang yang belajar Al-Qur'an dan mengajarkannya.", source: "HR. Bukhari" },
    { text: "Bacalah Al-Qur'an, karena ia akan datang pada hari kiamat sebagai pemberi syafaat bagi para pembacanya.", source: "HR. Muslim" },
    { text: "Dan sesungguhnya telah Kami mudahkan Al-Qur'an untuk pelajaran, maka adakah orang yang mengambil pelajaran?", source: "QS. Al-Qamar: 17" },
    { text: "Orang yang mahir membaca Al-Qur'an, kelak (di akhirat) akan bersama para malaikat yang mulia lagi taat.", source: "HR. Bukhari & Muslim" },
  ];

  const [dailyQuote, setDailyQuote] = useState({ text: '', source: '' });

  useEffect(() => {
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    setDailyQuote(quotes[dayOfYear % quotes.length]);
  }, []);

  return (
    <section className="py-24 bg-primary/5 dark:bg-primary/10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
        >
          <div className="bg-white/40 dark:bg-black/20 p-8 rounded-3xl backdrop-blur-sm shadow-sm border border-white/20">
            <Quote className="w-16 h-16 mx-auto text-primary mb-6 opacity-30" />
            <p className="text-2xl md:text-4xl font-serif italic text-foreground leading-relaxed">"{dailyQuote.text}"</p>
            <p className="mt-6 text-lg font-semibold text-primary tracking-widest uppercase text-sm">- {dailyQuote.source} -</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const HomePage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedAdvantage, setSelectedAdvantage] = useState(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [formData, setFormData] = useState({ nama: '', email: '', no_hp: '', pesan: '' });
  const [openFaq, setOpenFaq] = useState(null);
  const [stats, setStats] = useState({ santri: 0, guru: 0 });
  const [playingVideo, setPlayingVideo] = useState(null);
  const [content, setContent] = useState({
    heroSlides: [],
    slideshowTimer: 5000,
    heroOverlayOpacity: 0.6,
    quotas: { pagi: 0, siang: 0, sore: 0, dewasaPagi: 0, dewasaSiang: 0, dewasaMalam: 0 },
    news: [],
    qiroatiVideos: [],
    facilities: [],
    ctaBackgroundUrl: 'https://images.unsplash.com/photo-1504221507732-5246c045949b?q=80&w=2070&auto=format&fit=crop',
    ctaBackgroundOverlayOpacity: 0.5,
    testimonials: [],
    schedules: [],
    faqs: []
  });
  const { width } = useWindowSize();
  const isMobile = width < 768;

  const heroRef = useRef(null);
  const { scrollYProgress: heroScroll } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(heroScroll, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(heroScroll, [0, 0.5], [1, 0]);

  const ctaRef = useRef(null);
  const { scrollYProgress: ctaScroll } = useScroll({ target: ctaRef, offset: ["start end", "end start"] });
  
  // Staggered animation container variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 50, damping: 20 }
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const { count: santriCount } = await supabase.from('santri').select('*', { count: 'exact', head: true }).eq('status', 'Aktif');
      const { count: guruCount } = await supabase.from('guru').select('*', { count: 'exact', head: true });
      setStats({ santri: santriCount || 0, guru: guruCount || 0 });

      const { data: contentData, error } = await supabase.from('website_content').select('key, content');
      if (error) return;

      const newContent = contentData.reduce((acc, item) => {
        acc[item.key] = item.content;
        return acc;
      }, {});

      const initialContent = {
        heroSlides: [{ id: 1, url: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?q=80&w=2070&auto=format&fit=crop', text: "Bacalah dengan menyebut nama Tuhanmu yang menciptakan", author: "QS. Al-Alaq: 1", textSize: 'text-6xl', textWeight: 'font-bold', textStyle: 'normal-case'}],
        slideshowTimer: 5000,
        heroOverlayOpacity: 0.6,
        quotas: { pagi: 5, siang: 3, sore: 8, dewasaPagi: 2, dewasaSiang: 4, dewasaMalam: 1 },
        news: [],
        qiroatiVideos: [{id: 1, url: "https://www.youtube.com/embed/dQw4w9WgXcQ", title: "Video Qiroati"}],
        facilities: [{id: 1, image_url: "https://images.unsplash.com/photo-1687600154329-150952c73169?q=80&w=800"}, {id: 2, image_url: "https://images.unsplash.com/photo-1582251872140-7d4fbd39fae2?q=80&w=800"}, {id: 3, image_url: "https://images.unsplash.com/photo-1695615421085-1b3a866b8481?q=80&w=800"}],
        ctaBackgroundUrl: 'https://images.unsplash.com/photo-1504221507732-5246c045949b?q=80&w=2070&auto=format&fit=crop',
        ctaBackgroundOverlayOpacity: 0.5,
        testimonials: [
          { name: "Ibu Siti Aminah", role: "Wali Santri", text: "Alhamdulillah, anak saya sangat senang belajar di LPQ Al-Muhajirun. Dalam 6 bulan sudah bisa membaca Al-Qur'an dengan lancar." },
          { name: "Bapak Ahmad Hidayat", role: "Alumni", text: "Saya belajar di LPQ Al-Muhajirun sejak kecil. Metode Qiroati benar-benar membantu saya memahami tajwid dengan baik." },
          { name: "Ibu Fatimah", role: "Wali Santri", text: "Fasilitas di LPQ Al-Muhajirun sangat bagus dan bersih. Anak-anak nyaman belajar di sini." }
        ],
        schedules: [
          { title: "Sesi Pagi", time: "08:00 - 09:15 WIB", type: "TPQ" },
          { title: "Sesi Siang", time: "14:00 - 15:15 WIB", type: "TPQ" },
          { title: "Sesi Sore", time: "16:00 - 17:15 WIB", type: "TPQ" }
        ],
        faqs: [
          { question: "Berapa biaya pendaftaran?", answer: "Biaya pendaftaran meliputi: Sarpras Rp 115.000, Seragam Rp 175.000, Buku Prestasi Rp 10.000, ID Card Rp 25.000, Buku Jilid Rp 25.000, dan SPP awal Rp 100.000. Total sekitar Rp 450.000 dan bisa dicicil." },
          { question: "Apakah ada kelas untuk orang dewasa?", answer: "Ya, kami menyediakan kelas khusus dewasa (usia ≥17 tahun) dengan jadwal fleksibel: Pagi, Siang, dan Malam." },
          { question: "Apa saja syarat pendaftaran?", answer: "Syarat pendaftaran: Wali dan calon santri hadir saat mengisi formulir, fotokopi Akta & KK, pasfoto 3x4, dan materai Rp 10.000." },
        ]
      };
      
      const mergedContent = { ...initialContent, ...newContent };
      if (!Array.isArray(mergedContent.heroSlides) || mergedContent.heroSlides.length === 0) mergedContent.heroSlides = initialContent.heroSlides;
      if (!Array.isArray(mergedContent.news) || mergedContent.news.length === 0) mergedContent.news = initialContent.news;
      if (!Array.isArray(mergedContent.qiroatiVideos) || mergedContent.qiroatiVideos.length === 0) mergedContent.qiroatiVideos = initialContent.qiroatiVideos;
      if (!Array.isArray(mergedContent.facilities) || mergedContent.facilities.length < 3) mergedContent.facilities = initialContent.facilities;
      if (!Array.isArray(mergedContent.testimonials) || mergedContent.testimonials.length === 0) mergedContent.testimonials = initialContent.testimonials;
      if (!Array.isArray(mergedContent.schedules) || mergedContent.schedules.length === 0) mergedContent.schedules = initialContent.schedules;
      if (!Array.isArray(mergedContent.faqs) || mergedContent.faqs.length === 0) mergedContent.faqs = initialContent.faqs;
      
      setContent(mergedContent);
    };
    fetchData();

    const channel = supabase.channel('website_content_homepage_change')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'website_content' }, payload => {
            if (payload.new && payload.new.key) {
                setContent(prev => ({...prev, [payload.new.key]: payload.new.content}));
            }
        })
        .subscribe();
    
    return () => {
        supabase.removeChannel(channel);
    };

  }, []);

  const getYoutubeVideoId = (url) => {
    if (!url) return null;
    let videoId = null;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === 'youtu.be') {
        videoId = urlObj.pathname.slice(1);
      } else if (urlObj.hostname.includes('youtube.com')) {
        if (urlObj.pathname.includes('/embed/')) {
          videoId = urlObj.pathname.split('/embed/')[1].split('?')[0];
        } else {
          videoId = urlObj.searchParams.get('v');
        }
      }
    } catch (e) {
      const embedMatch = url.match(/embed\/([^?&/\s]+)/);
      if (embedMatch) videoId = embedMatch[1];
    }
    return videoId;
  };

  const getYoutubeThumbnail = (url) => {
    const videoId = getYoutubeVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : "";
  };

  const getEmbedUrl = (url) => {
    const videoId = getYoutubeVideoId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };
  

  const advantages = [
    { title: "Metode Qiroati Terpercaya", short: "Pembelajaran terstruktur dan teruji.", detail: "Metode Qiroati adalah sistem pembelajaran Al-Qur'an yang telah terbukti efektif dalam mengajarkan bacaan Al-Qur'an dengan tartil. Metode ini menggunakan pendekatan yang sistematis, dimulai dari pengenalan huruf hijaiyah hingga mampu membaca Al-Qur'an dengan lancar dan benar sesuai kaidah tajwid." },
    { title: "Guru Bersertifikat", short: "Pengajar profesional dan berpengalaman.", detail: "Semua guru di LPQ Al-Muhajirun telah mengantongi sertifikat resmi metode Qiroati dan memiliki pengalaman mengajar yang mumpuni. Mereka tidak hanya menguasai teknik mengajar, tetapi juga memiliki akhlak yang baik sebagai teladan bagi santri." },
    { title: "Kelas Fleksibel", short: "Jadwal disesuaikan dengan kebutuhan.", detail: "Kami menyediakan berbagai pilihan waktu belajar: pagi, siang, dan sore untuk santri usia dini hingga remaja. Khusus untuk kelas dewasa, tersedia jadwal khusus di pagi, siang, dan malam hari. Fleksibilitas ini memudahkan santri untuk belajar tanpa mengganggu aktivitas sehari-hari." },
    { title: "Fasilitas Lengkap", short: "Ruang belajar nyaman dan kondusif.", detail: "LPQ Al-Muhajirun dilengkapi dengan ruang kelas yang nyaman, ber-AC, perpustakaan mini, area bermain untuk santri cilik, serta musholla untuk praktik ibadah. Semua fasilitas dirancang untuk menciptakan lingkungan belajar yang kondusif dan menyenangkan." },
    { title: "Pembinaan Akhlak", short: "Membentuk karakter islami.", detail: "Selain fokus pada kemampuan membaca Al-Qur'an, kami juga memberikan perhatian khusus pada pembinaan akhlak santri. Melalui pembiasaan adab islami, santri diajarkan untuk memiliki perilaku yang baik, sopan santun, dan berakhlakul karimah dalam kehidupan sehari-hari." },
    { title: "Sinergi Keluarga", short: "Keterlibatan aktif orang tua.", detail: "Kami percaya pendidikan terbaik tercapai melalui kerjasama yang erat antara lembaga dan orang tua. Kami secara rutin mengadakan pertemuan wali santri, menyediakan buku prestasi sebagai media komunikasi, dan selalu terbuka untuk diskusi demi perkembangan santri." }
  ];

  useEffect(() => {
    const slideLength = content.heroSlides?.length || 0;
    const timerDuration = content.slideshowTimer || 10000;
    if (slideLength > 1) {
      const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % slideLength), timerDuration);
      return () => clearInterval(timer);
    }
  }, [content.heroSlides, content.slideshowTimer]);

  useEffect(() => {
    if (content.testimonials.length > 0) {
      const timer = setInterval(() => setCurrentTestimonial((prev) => (prev + 1) % content.testimonials.length), 10000);
      return () => clearInterval(timer);
    }
  }, [content.testimonials]);

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('feedbacks').insert(formData);
    if (error) {
      toast({ title: "Gagal Mengirim", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pesan Terkirim!", description: "Terima kasih atas masukan Anda." });
      setFormData({ nama: '', email: '', no_hp: '', pesan: '' });
    }
  };

  return (
    <>
      <Helmet>
        <title>LPQ Al-Muhajirun - Metode Qiroati</title>
        <meta name="description" content="LPQ Al-Muhajirun adalah lembaga pendidikan Al-Qur'an terpercaya dengan metode Qiroati." />
        <link rel="icon" type="image/png" href={content.logoUrl || "/logo.png"} sizes="any" />
      </Helmet>

      <div className="w-full overflow-hidden">
        {/* Parallax Hero Section */}
        <section ref={heroRef} className="h-screen w-full relative overflow-hidden bg-primary/20">
          <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 z-0">
            {content.heroSlides?.length > 0 && (
              <AnimatePresence initial={false}>
                <motion.div key={currentSlide} initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.5 }} className="absolute inset-0">
                  <div style={{ backgroundColor: `rgba(0,0,0,${content.heroOverlayOpacity || 0.6})`}} className="absolute inset-0 z-10" />
                  <img alt="Hero background" className="w-full h-full object-cover" src={content.heroSlides[currentSlide]?.url} />
                </motion.div>
              </AnimatePresence>
            )}
          </motion.div>
          
          <div className="relative z-20 h-full flex items-center justify-center text-center px-4">
            <div className="max-w-5xl">
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={currentSlide} 
                        initial={{ y: 50, opacity: 0, filter: "blur(10px)" }} 
                        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }} 
                        exit={{ y: -50, opacity: 0, filter: "blur(10px)" }} 
                        transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                    >
                        <h1 className={`mb-6 font-serif leading-tight tracking-tight drop-shadow-lg text-white ${isMobile ? 'text-4xl' : content.heroSlides[currentSlide]?.textSize || 'text-6xl'} ${content.heroSlides[currentSlide]?.textWeight || 'font-extrabold'} ${content.heroSlides[currentSlide]?.textStyle || 'normal-case'}`}>
                            {content.heroSlides[currentSlide]?.text}
                        </h1>
                        <p className="text-xl md:text-3xl text-white/90 font-light tracking-wide drop-shadow-md">- {content.heroSlides[currentSlide]?.author} -</p>
                    </motion.div>
                </AnimatePresence>
            </div>
            
            {/* Navigation Controls */}
            <div className="absolute bottom-12 left-0 right-0 z-30 flex justify-center space-x-3">
                 {content.heroSlides?.map((_, i) => (
                     <button 
                        key={`slide-${i}`} 
                        onClick={() => setCurrentSlide(i)} 
                        className={`h-1.5 rounded-full transition-all duration-300 ${currentSlide === i ? 'bg-accent w-8' : 'bg-white/40 w-2 hover:bg-white/60'}`} 
                     />
                 ))}
            </div>
            
            <button onClick={() => setCurrentSlide((p) => (p - 1 + (content.heroSlides?.length || 1)) % (content.heroSlides?.length || 1))} className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-30 p-4 rounded-full text-white/50 hover:text-accent hover:bg-white/10 transition-all"><ChevronLeft className="w-8 h-8" /></button>
            <button onClick={() => setCurrentSlide((p) => (p + 1) % (content.heroSlides?.length || 1))} className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-30 p-4 rounded-full text-white/50 hover:text-accent hover:bg-white/10 transition-all"><ChevronRight className="w-8 h-8" /></button>
          </div>
        </section>

        <div className="bg-background relative z-10">
          <DailyQuote />

          <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
            {/* Decorative Floating Elements */}
            <motion.div animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <motion.div animate={{ y: [0, 30, 0], rotate: [0, -5, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-7xl mx-auto relative z-10">
              <motion.div 
                initial={{ opacity: 0, y: 30 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }} 
                transition={{ duration: 0.8 }} 
                className="text-center mb-20"
              >
                <h2 className="text-4xl md:text-5xl font-bold mb-6 font-serif text-foreground">Tentang Qiroati & LPQ Al-Muhajirun</h2>
                <div className="w-32 h-1.5 bg-gradient-to-r from-primary to-accent mx-auto mb-8 rounded-full"></div>
                <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">Metode Qiroati adalah sistem pembelajaran Al-Qur'an yang efektif untuk mengajarkan bacaan tartil sesuai kaidah tajwid. Di LPQ Al-Muhajirun, kami mendedikasikan diri untuk memastikan setiap santri dapat membaca Al-Qur'an dengan benar, lancar, dan penuh pemahaman.</p>
              </motion.div>

              <motion.div 
                variants={container}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-100px" }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16"
              >
                {advantages.map((adv, i) => (
                    <motion.div 
                        key={`advantage-${i}`} 
                        variants={item}
                        whileHover={{ y: -10, transition: { duration: 0.3 } }}
                        onClick={() => setSelectedAdvantage(adv)} 
                        className="bg-card p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all cursor-pointer border border-border/50 relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>
                        <div className="w-14 h-14 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mb-6 text-2xl font-bold shadow-lg relative z-10">{i + 1}</div>
                        <h3 className="text-2xl font-bold text-card-foreground mb-3 relative z-10">{adv.title}</h3>
                        <p className="text-muted-foreground relative z-10">{adv.short}</p>
                        <div className="mt-6 flex items-center text-primary font-semibold group-hover:translate-x-2 transition-transform">
                            Selengkapnya <ChevronRight className="w-4 h-4 ml-1" />
                        </div>
                    </motion.div>
                ))}
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mt-20 flex flex-wrap justify-center gap-6"
              >
                 <div className="bg-white dark:bg-slate-800 px-8 py-6 rounded-2xl shadow-lg flex items-center gap-5 border border-slate-100 dark:border-slate-700">
                    <div className="bg-secondary/20 p-3 rounded-xl"><Users className="w-8 h-8 text-primary" /></div>
                    <div><p className="text-3xl font-bold text-foreground">{stats.santri}</p><p className="text-muted-foreground">Santri Aktif</p></div>
                 </div>
                 <div className="bg-white dark:bg-slate-800 px-8 py-6 rounded-2xl shadow-lg flex items-center gap-5 border border-slate-100 dark:border-slate-700">
                    <div className="bg-accent/20 p-3 rounded-xl"><Book className="w-8 h-8 text-accent" /></div>
                    <div><p className="text-3xl font-bold text-foreground">{stats.guru}</p><p className="text-muted-foreground">Guru Pengajar</p></div>
                 </div>
              </motion.div>
            </div>
          </section>

          <section className="py-24 bg-secondary/10 relative overflow-hidden px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto relative z-10">
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl font-bold text-center mb-16 font-serif text-foreground">Pusat Informasi</motion.h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="space-y-8">
                  <motion.div variants={item}>
                    <Link to="/pengumuman" className="block group">
                        <div className="bg-card rounded-3xl shadow-lg overflow-hidden border border-border/50 transition-all duration-300 hover:shadow-2xl">
                            <div className="relative h-64 overflow-hidden">
                                <img alt="Pengumuman" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src="https://images.unsplash.com/photo-1472324001482-257916e4f814?q=80&w=800" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                <div className="absolute bottom-4 left-6 text-white">
                                    <span className="bg-accent px-3 py-1 rounded-full text-xs font-bold text-accent-foreground uppercase tracking-wider mb-2 inline-block">Terbaru</span>
                                    <h3 className="text-2xl font-bold">Pengumuman Penting</h3>
                                </div>
                            </div>
                        </div>
                    </Link>
                  </motion.div>
                  <motion.div variants={item}>
                     <Link to="/berita" className="block group">
                        <div className="bg-card rounded-3xl shadow-lg overflow-hidden border border-border/50 transition-all duration-300 hover:shadow-2xl">
                            <div className="relative h-64 overflow-hidden">
                                <img alt="Berita" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src={content.news[0]?.image_url || "https://images.unsplash.com/photo-1618865181016-a80ad83a06d3?q=80&w=800"} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                <div className="absolute bottom-4 left-6 text-white">
                                    <h3 className="text-2xl font-bold">Kabar Lembaga</h3>
                                </div>
                            </div>
                        </div>
                     </Link>
                  </motion.div>
                </motion.div>

                <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="space-y-8">
                  <motion.div variants={item} onClick={() => content.qiroatiVideos.length > 0 && setPlayingVideo(content.qiroatiVideos[0])} className="cursor-pointer group">
                      <div className="bg-card rounded-3xl shadow-lg overflow-hidden border border-border/50 relative h-64">
                         <img alt="Video Thumbnail" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 filter brightness-75 group-hover:brightness-100" src={getYoutubeThumbnail(content.qiroatiVideos[0]?.url)} />
                         <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-white/40">
                                <PlayCircle className="w-8 h-8 text-white fill-white" />
                            </div>
                         </div>
                         <div className="absolute bottom-4 left-6 text-white">
                            <h3 className="text-xl font-bold">Video Metode Qiroati</h3>
                         </div>
                      </div>
                  </motion.div>

                  <motion.div variants={item}>
                     <Link to="/fasilitas" className="block group">
                        <div className="bg-card rounded-3xl shadow-lg overflow-hidden border border-border/50 h-64 relative">
                            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1">
                                <div className="row-span-2 overflow-hidden"><img className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src={content.facilities[0]?.image_url} /></div>
                                <div className="overflow-hidden"><img className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src={content.facilities[1]?.image_url} /></div>
                                <div className="overflow-hidden"><img className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src={content.facilities[2]?.image_url} /></div>
                            </div>
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <span className="text-white font-bold text-xl border border-white px-6 py-2 rounded-full">Lihat Fasilitas</span>
                            </div>
                        </div>
                     </Link>
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </section>

          <section className="py-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl font-bold text-center mb-16 font-serif text-foreground">Jadwal & Kuota</motion.h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <motion.div 
                    initial={{ opacity: 0, x: -30 }} 
                    whileInView={{ opacity: 1, x: 0 }} 
                    viewport={{ once: true }}
                    className="bg-card p-10 rounded-3xl shadow-xl border border-border/50"
                >
                    <h3 className="text-2xl font-bold text-foreground mb-8 flex items-center gap-3"><Clock className="w-6 h-6 text-primary"/> Jadwal Pembelajaran</h3>
                    <div className="space-y-4">
                        {content.schedules.length > 0 ? content.schedules.map((schedule, idx) => (
                            <div key={`schedule-${idx}`} className="flex items-center gap-4 p-4 rounded-xl bg-secondary/10 border border-border/50 hover:bg-secondary/30 transition-colors">
                                <div className="bg-primary/10 p-3 rounded-lg"><Calendar className="w-6 h-6 text-primary" /></div>
                                <div>
                                    <p className="font-bold text-lg text-foreground">{schedule.title}</p>
                                    <p className="text-muted-foreground">{schedule.time}</p>
                                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">{schedule.type}</span>
                                </div>
                            </div>
                        )) : <p>Jadwal belum tersedia.</p>}
                    </div>
                </motion.div>

                <div className="space-y-8">
                     <motion.div 
                        initial={{ opacity: 0, x: 30 }} 
                        whileInView={{ opacity: 1, x: 0 }} 
                        viewport={{ once: true }}
                        className="bg-card p-10 rounded-3xl shadow-xl border border-border/50"
                     >
                        <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3"><Award className="w-6 h-6 text-primary"/> Tingkatan Kelas</h3>
                        <div className="flex flex-wrap gap-3">
                            {["Pra TK (3-4 th)", "Jilid 1-6 (5-16 th)", "Al-Qur'an (Pasca Jilid)", "Gharib & Tajwid", "Finishing"].map((cls, i) => (
                                <span key={i} className="bg-accent/20 text-accent-foreground px-4 py-2 rounded-full text-sm font-medium border border-accent/30">{cls}</span>
                            ))}
                        </div>
                     </motion.div>

                     <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="bg-gradient-to-br from-green-600 to-green-800 p-8 rounded-3xl shadow-2xl text-white relative overflow-hidden"
                     >
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                        <h3 className="text-3xl font-bold mb-6 text-center relative z-10">🚨 Kuota Terbatas!</h3>
                        <div className="grid grid-cols-3 gap-4 text-center relative z-10">
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                <p className="text-sm opacity-80 mb-1">Pagi</p>
                                <p className="text-3xl font-black">{content.quotas?.pagi || 0}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                <p className="text-sm opacity-80 mb-1">Siang</p>
                                <p className="text-3xl font-black">{content.quotas?.siang || 0}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                <p className="text-sm opacity-80 mb-1">Sore</p>
                                <p className="text-3xl font-black">{content.quotas?.sore || 0}</p>
                            </div>
                        </div>
                     </motion.div>
                </div>
              </div>
            </div>
          </section>

          <section ref={ctaRef} className="h-[80vh] w-full flex items-center justify-center text-white overflow-hidden relative">
            <div style={{ opacity: content.ctaBackgroundOverlayOpacity }} className="absolute inset-0 bg-black z-10 transition-opacity duration-300"></div>
            <motion.div style={{ scale: 1.1 }} className="absolute inset-0">
                <img src={content.ctaBackgroundUrl} alt="Background" className="w-full h-full object-cover" />
            </motion.div>
            
            <div className="text-center z-20 px-4 max-w-4xl">
              <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
                <h2 className="text-5xl md:text-7xl font-bold mb-8 font-serif leading-tight text-white">Mulai Perjalanan<br/>Belajar Al-Qur'an</h2>
                <p className="text-xl md:text-2xl mb-10 text-white/90 font-light max-w-2xl mx-auto">Bergabunglah bersama keluarga besar LPQ Al-Muhajirun dan wujudkan generasi Qur'ani.</p>
                <div className="flex flex-col sm:flex-row gap-5 justify-center">
                  <Link to="/pendaftaran/informasi">
                      <Button size="lg" className="bg-white text-primary hover:bg-gray-100 text-lg px-10 py-7 rounded-full shadow-lg font-bold transition-transform hover:scale-105">Daftar Sekarang</Button>
                  </Link>
                  <a href="https://wa.me/6281234567890" target="_blank" rel="noopener noreferrer">
                      <Button size="lg" variant="outline" className="bg-transparent border-2 border-white text-white hover:bg-white/10 text-lg px-10 py-7 rounded-full shadow-lg font-bold transition-transform hover:scale-105">
                          <Phone className="w-5 h-5 mr-2" /> Hubungi Admin
                      </Button>
                  </a>
                </div>
              </motion.div>
            </div>
          </section>

          {content.testimonials?.length > 0 && (
            <section className="py-24 bg-secondary/10 relative">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <Quote className="w-12 h-12 mx-auto text-primary mb-4 opacity-50" />
                    <h2 className="text-4xl font-bold mb-4 font-serif text-foreground">Kata Mereka</h2>
                </div>
                
                <div className="relative h-64 md:h-56">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentTestimonial}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      {content.testimonials[currentTestimonial] && (
                        <div className="text-center max-w-3xl mx-auto">
                          <p className="text-2xl md:text-3xl font-light italic text-foreground mb-8 leading-relaxed">"{content.testimonials[currentTestimonial].text}"</p>
                          <div className="flex flex-col items-center justify-center">
                             <Avatar className="w-16 h-16 mb-3 border-4 border-background shadow-lg">
                                <AvatarImage src={content.testimonials[currentTestimonial].photo_url} />
                                <AvatarFallback>{content.testimonials[currentTestimonial].name.charAt(0)}</AvatarFallback>
                             </Avatar>
                             <h4 className="font-bold text-lg">{content.testimonials[currentTestimonial].name}</h4>
                             <p className="text-muted-foreground text-sm uppercase tracking-widest">{content.testimonials[currentTestimonial].role}</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
                
                <div className="flex justify-center mt-12 gap-2">
                    {content.testimonials.map((_, i) => (
                        <button 
                            key={`dot-${i}`} 
                            onClick={() => setCurrentTestimonial(i)} 
                            className={`h-2 rounded-full transition-all duration-300 ${currentTestimonial === i ? 'bg-primary w-8' : 'bg-primary/20 w-2 hover:bg-primary/40'}`} 
                        />
                    ))}
                </div>
              </div>
            </section>
          )}

          <section className="py-24 px-4 sm:px-6 lg:px-8 bg-background">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                  <h2 className="text-3xl font-bold mb-6 font-serif text-foreground">Kirim Pesan</h2>
                  <p className="text-muted-foreground mb-8">Punya pertanyaan atau saran? Kami siap mendengar dari Anda.</p>
                  <form onSubmit={handleSubmitQuestion} className="space-y-5">
                    <Input type="text" placeholder="Nama Lengkap" value={formData.nama} onChange={(e) => setFormData({ ...formData, nama: e.target.value })} required className="bg-secondary/10 border-border/50 h-12 rounded-xl" />
                    <Input type="email" placeholder="Alamat Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="bg-secondary/10 border-border/50 h-12 rounded-xl" />
                    <Input type="tel" placeholder="Nomor WhatsApp" value={formData.no_hp} onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })} required className="bg-secondary/10 border-border/50 h-12 rounded-xl" />
                    <Textarea placeholder="Tulis pesan Anda di sini..." value={formData.pesan} onChange={(e) => setFormData({ ...formData, pesan: e.target.value })} rows={5} required className="bg-secondary/10 border-border/50 rounded-xl resize-none" />
                    <Button type="submit" size="lg" className="w-full rounded-xl h-12 font-bold shadow-lg">Kirim Pesan</Button>
                  </form>
                </motion.div>
                
                <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                  <h2 className="text-3xl font-bold mb-8 font-serif text-foreground">Sering Ditanyakan (FAQ)</h2>
                  <div className="space-y-4">
                    {content.faqs.length > 0 ? content.faqs.map((faq, i) => (
                        <div key={`faq-${i}`} className="border border-border/50 rounded-2xl overflow-hidden bg-card transition-all duration-300 hover:shadow-md">
                            <button 
                                onClick={() => setOpenFaq(openFaq === i ? null : i)} 
                                className="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-secondary/10 transition-colors"
                            >
                                <span className="font-semibold text-foreground pr-4">{faq.question}</span>
                                <ChevronRight className={`w-5 h-5 text-primary transition-transform duration-300 ${openFaq === i ? 'rotate-90' : ''}`} />
                            </button>
                            <AnimatePresence>
                                {openFaq === i && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }} 
                                        animate={{ height: "auto", opacity: 1 }} 
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-6 pb-6 pt-2 text-muted-foreground leading-relaxed border-t border-dashed border-border/50">
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )) : <p>Belum ada FAQ.</p>}
                  </div>
                </motion.div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Dialog open={!!selectedAdvantage} onOpenChange={() => setSelectedAdvantage(null)}>
        <DialogContent className="max-w-lg rounded-3xl p-8">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold font-serif mb-2">{selectedAdvantage?.title}</DialogTitle>
          </DialogHeader>
          <div className="w-16 h-1 bg-primary mb-4 rounded-full"></div>
          <p className="text-lg text-muted-foreground leading-relaxed">{selectedAdvantage?.detail}</p>
        </DialogContent>
      </Dialog>
      
      {playingVideo && (
        <Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}>
          <DialogContent className="max-w-5xl p-0 bg-black overflow-hidden border-none rounded-2xl">
            <div className="aspect-video w-full">
              <iframe className="w-full h-full" src={getEmbedUrl(playingVideo.url)} title={playingVideo.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default HomePage;
