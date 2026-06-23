
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { PlayCircle, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const QiroatiMethodPage = () => {
  const [videos, setVideos] = useState([]);
  const [playingVideo, setPlayingVideo] = useState(null);

  useEffect(() => {
    const fetchVideos = async () => {
      const { data, error } = await supabase.from('website_content').select('content').eq('key', 'qiroatiVideos').maybeSingle();
      const defaultVideos = [
        { id: 1, title: 'Pengenalan Metode Qiroati untuk Pemula', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
        { id: 2, title: 'Praktik Makharijul Huruf yang Benar', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
        { id: 3, title: 'Tips Cepat Menguasai Bacaan Gharib', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' }
      ];

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching videos:", error);
        setVideos(defaultVideos);
      } else {
        setVideos(data?.content || defaultVideos);
      }
    };

    fetchVideos();
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
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "";
  };

  const getEmbedUrl = (url) => {
    const videoId = getYoutubeVideoId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };
  
  const dawuhContent = [
    { title: "Niat yang Ikhlas", content: "“Mengajarlah dengan niat ikhlas karena Allah SWT, jangan mengharap apapun dari manusia.”" },
    { title: "Sabar dan Telaten", content: "“Sabar dalam mengajar adalah kunci keberhasilan. Setiap anak memiliki kecepatan belajar yang berbeda.”" },
    { title: "Metode yang Tepat", content: "“Metode hanyalah cara, yang terpenting adalah sampainya ilmu kepada santri dengan benar.”" },
    { title: "Doa Orang Tua", content: "“Jangan pernah meremehkan kekuatan doa. Mintalah kepada Allah agar anak-anak kita dijadikan ahlul Qur’an.”" },
    { title: "Keteladanan Guru", content: "“Guru adalah cermin bagi santrinya. Tunjukkan akhlak Al-Qur’an dalam setiap perbuatan.”" },
    { title: "Cinta Al-Qur'an", content: "“Tanamkan rasa cinta kepada Al-Qur’an, bukan sekadar kemampuan membacanya.”" },
  ];

  return (
    <>
      <Helmet>
        <title>Metode Qiroati - LPQ Al-Muhajirun</title>
        <meta name="description" content="Pelajari lebih dalam tentang metode Qiroati yang kami gunakan di LPQ Al-Muhajirun." />
      </Helmet>
      <div className="py-20 bg-gray-50 dark:bg-[#0a1929]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-[#112D4E] dark:text-white mb-4">Metode Qiroati</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">Sistem pembelajaran Al-Qur'an yang praktis, efektif, dan sesuai kaidah tajwid.</p>
          </motion.div>
          
          <Card className="mb-12 bg-white dark:bg-card shadow-lg">
            <CardHeader><CardTitle className="text-primary">Tentang Qiroati</CardTitle></CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
                <p>Metode Qiroati adalah salah satu metode praktis belajar membaca Al-Qur’an yang disusun oleh KH. Dachlan Salim Zarkasyi di Semarang. Beliau adalah seorang ulama yang mendedikasikan hidupnya untuk memudahkan umat Islam dalam mempelajari kitab sucinya. Metode ini lahir dari keprihatinan beliau melihat kesulitan yang dialami banyak orang dalam belajar membaca Al-Qur’an dengan metode konvensional pada masanya.</p>
                <p>Prinsip dasar Qiroati adalah “Tartil, Lancar, dan Benar”. Metode ini mengajarkan santri untuk tidak hanya bisa membaca, tetapi membaca dengan baik dan benar sesuai kaidah ilmu tajwid sejak dari tingkat dasar (jilid). Materi disajikan secara bertahap, dari pengenalan huruf, harakat, bacaan panjang-pendek, hingga hukum-hukum tajwid yang kompleks, yang dikemas dalam buku-buku jilid yang sistematis.</p>
                <h4>Visi & Misi Qiroati</h4>
                <ul>
                    <li><strong>Visi:</strong> Menjaga kemurnian bacaan Al-Qur’an sebagaimana yang diajarkan oleh Rasulullah SAW kepada para sahabatnya.</li>
                    <li><strong>Misi:</strong> Menyebarluaskan cara belajar membaca Al-Qur’an yang mudah, cepat, dan benar ke seluruh lapisan masyarakat.</li>
                </ul>
            </CardContent>
          </Card>

          <div className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8 text-accent-foreground">Dawuh KH. Dachlan Salim Zarkasyi</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dawuhContent.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-card p-6 rounded-lg shadow-md border-l-4 border-primary"
                >
                  <h3 className="font-semibold text-lg text-primary mb-2">{item.title}</h3>
                  <p className="italic text-card-foreground/80">"{item.content}"</p>
                </motion.div>
              ))}
            </div>
          </div>
          
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-accent-foreground">Video Pembelajaran</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">Lihat bagaimana metode Qiroati diterapkan dalam praktik.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {videos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white dark:bg-[#112D4E] rounded-2xl shadow-lg overflow-hidden card-hover group cursor-pointer"
                onClick={() => setPlayingVideo(video)}
              >
                <div className="relative aspect-video">
                  <img src={getYoutubeThumbnail(video.url)} alt={video.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <PlayCircle className="w-20 h-20 text-white/80" />
                  </div>
                </div>
                <div className="p-6">
                  <h2 className="text-xl font-bold text-[#112D4E] dark:text-white">{video.title}</h2>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      
      {playingVideo && (
        <Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}>
          <DialogContent className="max-w-3xl p-0">
            <div className="aspect-video">
              <iframe
                className="w-full h-full"
                src={getEmbedUrl(playingVideo.url)}
                title={playingVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default QiroatiMethodPage;
