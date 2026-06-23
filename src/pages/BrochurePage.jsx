
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FileCard = ({ file }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className="bg-card p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 flex flex-col justify-between"
  >
    <div>
      <p className="font-bold text-lg mb-2 text-primary">{file.name}</p>
      <p className="text-sm text-muted-foreground mb-4">Klik untuk mengunduh</p>
    </div>
    <a href={file.url} download target="_blank" rel="noopener noreferrer">
      <Button className="w-full">
        <Download className="w-4 h-4 mr-2" />
        Unduh File
      </Button>
    </a>
  </motion.div>
);


const BrochurePage = () => {
  const [brochures, setBrochures] = useState([]);
  const [pustaka, setPustaka] = useState([]);

  useEffect(() => {
    const fetchFiles = async () => {
      const { data, error } = await supabase.from('website_content').select('key, content').in('key', ['brochures', 'pustaka']);
      if (error) {
        console.error("Error fetching files:", error);
      } else {
        const brochureData = data.find(d => d.key === 'brochures')?.content || [];
        const pustakaData = data.find(d => d.key === 'pustaka')?.content || [];
        setBrochures(Array.isArray(brochureData) ? brochureData : []);
        setPustaka(Array.isArray(pustakaData) ? pustakaData : []);
      }
    };
    fetchFiles();
  }, []);

  return (
    <>
      <Helmet>
        <title>Brosur & Pustaka - LPQ Al-Muhajirun</title>
        <meta name="description" content="Unduh brosur pendaftaran resmi dan materi pustaka dari LPQ Al-Muhajirun. Dapatkan informasi lengkap mengenai program kami." />
      </Helmet>
      <div className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl md:text-5xl font-extrabold text-center mb-12 text-primary font-serif"
          >
            Brosur & Pustaka
          </motion.h1>

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8 text-foreground font-serif">Brosur Pendaftaran</h2>
            {brochures.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {brochures.map((file) => (
                  <FileCard key={file.id} file={file} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Brosur belum tersedia.</p>
            )}
          </section>

          <section>
            <h2 className="text-3xl font-bold text-center mb-8 text-foreground font-serif">Pustaka Digital</h2>
            {pustaka.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {pustaka.map((file) => (
                  <FileCard key={file.id} file={file} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Materi pustaka belum tersedia.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default BrochurePage;
