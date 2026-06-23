
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';

const AnnouncementPage = () => {
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data, error } = await supabase
        .from('website_content')
        .select('content')
        .eq('key', 'announcements')
        .single();
      
      if (error && error.code !== 'PGRST116') { //PGRST116 is '0 rows'
        console.error("Error fetching announcements:", error);
      } else {
        setAnnouncements(data?.content || []);
      }
    };
    
    fetchAnnouncements();
  }, []);

  return (
    <>
      <Helmet>
        <title>Pengumuman - LPQ Al-Muhajirun</title>
        <meta name="description" content="Pengumuman resmi terbaru dari LPQ Al-Muhajirun." />
      </Helmet>
      <div className="py-20 bg-gray-50 dark:bg-[#0a1929]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-[#112D4E] dark:text-white mb-4">Papan Pengumuman</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">Informasi penting untuk seluruh warga LPQ Al-Muhajirun.</p>
          </motion.div>

          <div className="space-y-8">
            {announcements.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white dark:bg-[#112D4E] rounded-2xl shadow-lg p-8 flex items-start space-x-6"
              >
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-[#3F72AF] to-[#112D4E] rounded-full flex items-center justify-center">
                  <Megaphone className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{new Date(item.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <h2 className="text-2xl font-bold text-[#112D4E] dark:text-white mb-3">{item.title}</h2>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{item.content.substring(0, 150)}...</p>
                  <Link to={`/pengumuman/${item.id}`} className="font-bold text-[#3F72AF] hover:underline mt-4 inline-block">Baca Selengkapnya →</Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default AnnouncementPage;
