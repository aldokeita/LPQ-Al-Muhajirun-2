
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Calendar, Tag, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const NewsDetailPage = () => {
  const { id } = useParams();
  const [newsItem, setNewsItem] = useState(null);

  useEffect(() => {
    const fetchNews = async () => {
      const { data, error } = await supabase.from('website_content').select('content').eq('key', 'news').single();
      if (error) {
        console.error("Error fetching news:", error);
      } else {
        const news = data.content || [];
        const foundNews = news.find(item => item.id.toString() === id);
        setNewsItem(foundNews);
      }
    };
    fetchNews();
  }, [id]);

  if (!newsItem) {
    return <div className="text-center py-20">Berita tidak ditemukan.</div>;
  }

  return (
    <>
      <Helmet>
        <title>{newsItem.title} - LPQ Al-Muhajirun</title>
        <meta name="description" content={newsItem.content.substring(0, 160)} />
      </Helmet>
      <div className="py-20 bg-gray-50 dark:bg-[#0a1929]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Link to="/berita" className="flex items-center text-gray-500 hover:text-[#3F72AF] dark:hover:text-white mb-8">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke Semua Berita
            </Link>
            <div className="relative h-96 rounded-2xl overflow-hidden mb-8">
              <img src={newsItem.image_url} alt={newsItem.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40"></div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#112D4E] dark:text-white mb-4">{newsItem.title}</h1>
            <div className="flex items-center space-x-6 text-gray-500 dark:text-gray-400 mb-8">
              <div className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                <span>{new Date(newsItem.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="flex items-center">
                <Tag className="w-5 h-5 mr-2" />
                <span>{newsItem.category}</span>
              </div>
            </div>
            <div className="prose dark:prose-invert max-w-none text-lg leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {newsItem.content}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default NewsDetailPage;
