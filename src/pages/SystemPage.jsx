
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, BookOpen, Edit, UserCheck, AlertTriangle, HeartHandshake as Handshake, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const systemPoints = [
  {
    icon: Clock,
    title: "Jadwal & Sesi Mengaji",
    short: "Tiga sesi fleksibel, Senin-Jumat.",
    details: [
      "Kami menyediakan 3 sesi belajar setiap hari (Senin-Jumat) untuk mengakomodasi berbagai jadwal: Sesi Pagi, Sesi Siang, dan Sesi Sore.",
      "Setiap sesi berlangsung selama 1 jam 15 menit, dirancang untuk pembelajaran yang efektif dan fokus.",
      "Hari Jumat dikhususkan untuk kegiatan hafalan (doa, bacaan sholat, surat pendek) dan diakhiri dengan praktik sholat berjamaah pada akhir bulan."
    ]
  },
  {
    icon: Users,
    title: "Struktur Kelas Efektif",
    short: "Kelas kecil, perhatian maksimal.",
    details: [
      "Untuk menjaga kualitas, setiap kelas dibatasi maksimal hanya 15 santri.",
      "Struktur ini memungkinkan guru untuk memberikan perhatian yang lebih personal kepada setiap santri.",
      "Santri dikelompokkan berdasarkan jilid atau tingkat kemampuan mereka untuk memastikan materi yang disampaikan sesuai."
    ]
  },
  {
    icon: BookOpen,
    title: "Alur Pembelajaran Harian",
    short: "Drilling, klasikal, dan setoran individual.",
    details: [
      "<strong>15 Menit Awal (Drilling):</strong> Santri berbaris dan membaca hafalan secara klasikal dan berulang-ulang. Senin & Selasa untuk surat pendek, Rabu & Kamis untuk doa harian. Jumat untuk muraja'ah (mengulang hafalan).",
      "<strong>30 Menit Berikutnya (Klasikal):</strong> Guru mengajar menggunakan peraga (tunjuk atau kartu) untuk menjelaskan materi jilid secara bersama-sama.",
      "<strong>30 Menit Selanjutnya (Individual):</strong> Santri maju satu per satu untuk menyetorkan bacaan kepada guru. Progres dicatat di buku prestasi.",
      "<strong>15 Menit Akhir (Evaluasi):</strong> Digunakan untuk evaluasi, melanjutkan setoran yang belum selesai, atau pendekatan personal oleh guru."
    ]
  },
  {
    icon: Edit,
    title: "Buku Prestasi & Penilaian",
    short: "Pemantauan progres yang transparan.",
    details: [
      "Setiap santri memiliki buku prestasi untuk mencatat kemajuan bacaan.",
      "Guru akan menulis 'L' (Lulus) jika bacaan sudah benar, atau 'L-' (Lulus dengan catatan) beserta keterangan jika masih ada yang perlu diperbaiki.",
      "Kami sangat mengharapkan wali santri untuk memberikan paraf setiap hari sebagai bentuk dukungan dan pengawasan bersama."
    ]
  },
  {
    icon: AlertTriangle,
    title: "Prinsip Kedisiplinan Qiroati",
    short: "Kualitas di atas kuantitas.",
    details: [
      "Kami menerapkan standar kelulusan yang disiplin. Santri belum akan diluluskan ke halaman berikutnya jika masih terdapat 2-3 kesalahan fatal.",
      "Prinsip ini bertujuan agar santri tidak terbeban dengan materi baru sementara materi sebelumnya belum tuntas.",
      "Ini adalah bentuk tanggung jawab kami untuk memastikan setiap santri memiliki fondasi bacaan yang kokoh."
    ]
  },
  {
    icon: Handshake,
    title: "Sinergi dengan Wali Santri",
    short: "Kerja sama untuk kesuksesan santri.",
    details: [
      "Kami mewajibkan salah satu orang tua untuk ikut mengaji (di kelas dewasa) jika mendaftarkan anak usia 5 tahun ke bawah. Biaya pendaftaran untuk orang tua dibebaskan.",
      "Kerja sama aktif antara lembaga dan orang tua adalah kunci keberhasilan pendidikan Al-Qur'an dan pembentukan akhlak santri.",
      "Mari bersama-sama menjaga adab dan perilaku santri sesuai dengan nilai-nilai yang disepakati di LPQ Al-Muhajirun."
    ]
  }
];

const SystemPage = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleItem = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <>
      <Helmet>
        <title>Sistem Mengaji - LPQ Al-Muhajirun</title>
        <meta name="description" content="Pelajari alur dan sistem pembelajaran mengaji dengan metode Qiroati di LPQ Al-Muhajirun." />
      </Helmet>
      <div className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">Sistem Mengaji di LPQ</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Memahami alur pembelajaran yang terstruktur, efektif, dan berorientasi pada kualitas untuk membentuk generasi Qur'ani.
            </p>
          </motion.div>

          <div className="space-y-6">
            {systemPoints.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <div className="flex items-center gap-6">
                    <div className="flex-shrink-0 w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                      <item.icon className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{item.title}</h2>
                      <p className="text-gray-500 dark:text-gray-400">{item.short}</p>
                    </div>
                  </div>
                  <ChevronRight className={cn("w-6 h-6 text-gray-400 transition-transform duration-300", openIndex === index && "rotate-90 text-primary")} />
                </button>
                <AnimatePresence>
                  {openIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <ul className="space-y-3 list-disc list-inside text-gray-600 dark:text-gray-300 pl-2">
                          {item.details.map((detail, i) => (
                            <li key={i} dangerouslySetInnerHTML={{ __html: detail }}></li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default SystemPage;
