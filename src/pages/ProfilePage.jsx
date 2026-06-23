
import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';

const ProfilePage = () => {
  return (
    <>
      <Helmet>
        <title>Profil Lembaga - LPQ Al-Muhajirun</title>
        <meta name="description" content="Profil lengkap LPQ Al-Muhajirun, lembaga pendidikan Al-Qur'an dengan metode Qiroati di Baturaja" />
      </Helmet>

      <div className="min-h-screen py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#112D4E] rounded-2xl shadow-2xl p-8 md:p-12"
          >
            <h1 className="text-4xl font-bold text-[#112D4E] dark:text-white mb-8 text-center">
              Profil LPQ Al-Muhajirun
            </h1>

            <div className="space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed">
              <p className="text-lg">
                LPQ Al-Muhajirun adalah lembaga pendidikan Al-Qur'an yang menerapkan metode Qiroati, sebuah sistem pembelajaran yang telah terbukti efektif dalam mengajarkan bacaan Al-Qur'an dengan tartil dan sesuai kaidah tajwid. Berlokasi di Lrg. Kemang Kampung Baru Kanio Lama, Kelurahan Kemalaraja, Pasar Baru Baturaja, Sumatera Selatan, kami berkomitmen untuk mencetak generasi Qur'ani yang tidak hanya mampu membaca Al-Qur'an dengan benar, tetapi juga memahami dan mengamalkan nilai-nilai luhur yang terkandung di dalamnya.
              </p>

              <p className="text-lg">
                Metode Qiroati yang kami terapkan menekankan pada kejelasan tahsin (perbaikan bacaan), tahqiq (pembacaan yang jelas dan terukur), serta pembinaan adab dalam belajar Al-Qur'an. Dengan tenaga pengajar yang bersertifikat dan berpengalaman, kami memastikan setiap santri mendapatkan bimbingan yang optimal sesuai dengan tingkat kemampuan masing-masing. Fasilitas yang lengkap dan nyaman, jadwal yang fleksibel, serta lingkungan belajar yang kondusif menjadikan LPQ Al-Muhajirun sebagai pilihan terbaik bagi keluarga yang ingin memberikan pendidikan Al-Qur'an berkualitas untuk putra-putri mereka.
              </p>

              <div className="mt-8 p-6 bg-gradient-to-r from-[#DBE2EF] to-[#F9F7F7] dark:from-[#3F72AF] dark:to-[#112D4E] rounded-xl">
                <h2 className="text-2xl font-bold text-[#112D4E] dark:text-white mb-4">
                  Visi & Misi
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-[#3F72AF] dark:text-[#DBE2EF] mb-2">Visi:</h3>
                    <p>Menjadi lembaga pendidikan Al-Qur'an terdepan yang mencetak generasi Qur'ani berakhlak mulia</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-[#3F72AF] dark:text-[#DBE2EF] mb-2">Misi:</h3>
                    <ul className="list-disc list-inside space-y-2">
                      <li>Mengajarkan Al-Qur'an dengan metode Qiroati yang terstruktur dan efektif</li>
                      <li>Membina akhlak santri sesuai dengan nilai-nilai Islam</li>
                      <li>Menyediakan lingkungan belajar yang kondusif dan menyenangkan</li>
                      <li>Mengembangkan potensi santri secara optimal</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ProfilePage;
