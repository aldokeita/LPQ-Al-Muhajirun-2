
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';

const FacilitiesPage = () => {
  const [facilities, setFacilities] = useState([]);

  useEffect(() => {
    const fetchFacilities = async () => {
      const { data, error } = await supabase.from('website_content').select('content').eq('key', 'facilities').single();
      
      const defaultFacilities = [
        { name: 'Ruang Kelas Nyaman', description: 'Dilengkapi AC dan pencahayaan yang baik untuk mendukung konsentrasi belajar.', image_url: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80' },
        { name: 'Perpustakaan Mini', description: 'Koleksi buku-buku Islam dan Al-Qur\'an untuk menambah wawasan santri.', image_url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80' },
        { name: 'Musholla', description: 'Tempat praktik shalat berjamaah dan kegiatan keagamaan lainnya.', image_url: 'https://images.unsplash.com/photo-1598300230903-73a3d344423e?w=800&q=80' },
      ];

      if (error || !data?.content || data.content.length === 0) {
        setFacilities(defaultFacilities);
      } else {
        setFacilities(data.content);
      }
    };
    
    fetchFacilities();
  }, []);

  return (
    <>
      <Helmet>
        <title>Fasilitas - LPQ Al-Muhajirun</title>
        <meta name="description" content="Lihat fasilitas lengkap yang kami sediakan di LPQ Al-Muhajirun." />
      </Helmet>
      <div className="py-20 bg-gray-50 dark:bg-[#0a1929]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-[#112D4E] dark:text-white mb-4">Fasilitas Lembaga</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">Kami menyediakan lingkungan belajar yang terbaik untuk santri.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {facilities.map((facility, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white dark:bg-[#112D4E] rounded-2xl shadow-lg overflow-hidden card-hover"
              >
                <div className="relative h-64">
                  <img alt={facility.name} className="w-full h-full object-cover" src={facility.image_url || "https://images.unsplash.com/photo-1672432508137-49e907939dee?w=800"} />
                </div>
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-[#112D4E] dark:text-white mb-2">{facility.name}</h2>
                  <p className="text-gray-600 dark:text-gray-300">{facility.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default FacilitiesPage;
