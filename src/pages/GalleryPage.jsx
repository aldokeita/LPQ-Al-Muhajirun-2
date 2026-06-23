import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { motion } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Image as ImageIcon } from 'lucide-react';

const GalleryPage = () => {
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGallery = async () => {
      const { data } = await supabase.from('website_content').select('content').eq('key', 'galleryPhotos').maybeSingle();
      if (data?.content && Array.isArray(data.content)) {
        setGalleryPhotos(data.content);
      }
      setLoading(false);
    };
    fetchGallery();
  }, []);

  return (
    <>
      <Helmet>
        <title>Galeri Kegiatan - LPQ Al-Muhajirun Metode Qiroati Baturaja</title>
        <meta name="description" content="Dokumentasi kegiatan santri LPQ Al-Muhajirun Metode Qiroati Baturaja." />
      </Helmet>

      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl font-bold text-primary mb-4 font-serif">Galeri Kegiatan</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Momen-momen berharga dan kegiatan sehari-hari santri dalam menuntut ilmu di LPQ Al-Muhajirun Metode Qiroati Baturaja.
            </p>
          </motion.div>

          {loading ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
               {[1,2,3,4,5,6,7,8].map(i => (
                 <div key={i} className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"></div>
               ))}
             </div>
          ) : galleryPhotos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {galleryPhotos.map((photo, index) => (
                <motion.div 
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <img 
                    src={photo.url} 
                    alt={photo.caption || "Gallery Photo"} 
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <p className="text-white font-medium text-sm line-clamp-2">
                        {photo.caption || "Kegiatan Santri"}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 flex flex-col items-center justify-center text-muted-foreground">
                <ImageIcon className="w-16 h-16 mb-4 opacity-20"/>
                <p>Belum ada foto di galeri.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none">
          <div className="relative">
            <img 
                src={selectedPhoto?.url} 
                alt={selectedPhoto?.caption} 
                className="w-full max-h-[85vh] object-contain rounded-lg shadow-2xl bg-black/50 backdrop-blur-sm"
            />
            {selectedPhoto?.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-4 rounded-b-lg text-center backdrop-blur-md">
                    <p className="text-lg">{selectedPhoto.caption}</p>
                </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GalleryPage;
