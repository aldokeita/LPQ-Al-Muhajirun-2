
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Calendar, ArrowLeft } from 'lucide-react';
import { fetchAnnouncementDetail } from '@/lib/publicContentAdapters';

const AnnouncementDetailPage = () => {
  const { id } = useParams();
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        setAnnouncement(await fetchAnnouncementDetail(id));
      } catch {
        setAnnouncement(null);
      }
    };
    
    fetchAnnouncement();
  }, [id]);

  if (!announcement) {
    return <div className="text-center py-20">Pengumuman tidak ditemukan.</div>;
  }

  return (
    <>
      <Helmet>
        <title>{announcement.title} - LPQ Al-Muhajirun</title>
        <meta name="description" content={(announcement.content || '').substring(0, 160)} />
      </Helmet>
      <div className="py-20 bg-gray-50 dark:bg-[#0a1929]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Link to="/pengumuman" className="flex items-center text-gray-500 hover:text-[#3F72AF] dark:hover:text-white mb-8">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke Semua Pengumuman
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold text-[#112D4E] dark:text-white mb-4">{announcement.title}</h1>
            <div className="flex items-center text-gray-500 dark:text-gray-400 mb-8">
              <Calendar className="w-5 h-5 mr-2" />
              <span>{new Date(announcement.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="prose dark:prose-invert max-w-none text-lg leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {announcement.content}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default AnnouncementDetailPage;
