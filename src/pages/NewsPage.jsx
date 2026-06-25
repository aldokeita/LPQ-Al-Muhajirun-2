
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { fetchPublishedNews, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';

const NewsPage = () => {
  const [newsItems, setNewsItems] = useState([]);

  useEffect(() => {
    const fetchNews = async () => {
      const defaultNews = [
        { id: 1, title: 'Wisuda Akbar Santri LPQ Al-Muhajirun Angkatan ke-5', date: '2025-10-12', content: 'Alhamdulillah, sebanyak 50 santri telah berhasil menyelesaikan pendidikannya...', image_url: 'https://images.unsplash.com/photo-1617925995364-725da13756c7?w=800&q=80', category: 'Acara' },
        { id: 2, title: 'LPQ Al-Muhajirun Raih Juara Umum MTQ Tingkat Kabupaten', date: '2025-09-25', content: 'Santri-santri kami kembali menorehkan prestasi gemilang...', image_url: 'https://images.unsplash.com/photo-1584486188544-dc57f26ded33?w=800&q=80', category: 'Prestasi' },
      ];
      try {
        const items = await fetchPublishedNews();
        setNewsItems(items.length > 0 ? items : defaultNews);
      } catch (error) {
        getPublicContentErrorMessage(error);
        setNewsItems(defaultNews);
      }
    };
    fetchNews();
  }, []);

  return (
    <>
      <Helmet>
        <title>Berita - LPQ Al-Muhajirun</title>
        <meta name="description" content="Berita dan kegiatan terbaru dari LPQ Al-Muhajirun." />
      </Helmet>
      <div className="py-20 bg-gray-50 dark:bg-[#0a1929]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-[#112D4E] dark:text-white mb-4">Berita Lembaga</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">Ikuti kegiatan dan prestasi terbaru kami.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {newsItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white dark:bg-[#112D4E] rounded-2xl shadow-lg overflow-hidden card-hover flex flex-col"
              >
                <div className="relative h-56">
                  <img alt={item.title} className="w-full h-full object-cover" src={item.image_url || "https://images.unsplash.com/photo-1652086939922-9582b3367e61?w=800"} />
                  {item.category && <span className="absolute top-4 left-4 bg-[#3F72AF] text-white px-3 py-1 rounded-full text-sm font-semibold">{item.category}</span>}
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{new Date(item.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <h2 className="text-xl font-bold text-[#112D4E] dark:text-white mb-3 flex-grow">{item.title}</h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-4 whitespace-pre-wrap">{(item.content || '').substring(0, 100)}...</p>
                  <Link to={`/berita/${item.slug || item.id}`} className="font-bold text-[#3F72AF] hover:underline mt-auto">Baca Selengkapnya →</Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default NewsPage;
