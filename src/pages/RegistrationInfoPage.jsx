
import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RegistrationInfoPage = () => {
  const [openRequirement, setOpenRequirement] = useState(false);

  return (
    <>
      <Helmet>
        <title>Informasi Pendaftaran 2025-2026 - LPQ Al-Muhajirun</title>
        <meta name="description" content="Informasi lengkap pendaftaran santri baru LPQ Al-Muhajirun tahun ajaran 2025-2026" />
      </Helmet>

      <div className="min-h-screen py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Pendaftaran Santri Baru
            </h1>
            <p className="text-xl text-muted-foreground">
              Tahun Ajaran 2025-2026
            </p>
          </motion.div>

          <Tabs defaultValue="tpq" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 h-auto p-1 bg-secondary/20 dark:bg-primary/10 rounded-xl">
              <TabsTrigger 
                value="tpq" 
                className="py-3 text-lg font-semibold rounded-lg text-foreground/70 data-[state=active]:bg-card data-[state=active]:text-primary dark:text-foreground/70 dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground transition-all shadow-sm data-[state=inactive]:hover:bg-card/50"
              >
                Santri TPQ (Anak)
              </TabsTrigger>
              <TabsTrigger 
                value="dewasa" 
                className="py-3 text-lg font-semibold rounded-lg text-foreground/70 data-[state=active]:bg-card data-[state=active]:text-primary dark:text-foreground/70 dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground transition-all shadow-sm data-[state=inactive]:hover:bg-card/50"
              >
                Santri Dewasa
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tpq">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-card p-8 rounded-2xl shadow-xl border border-border"
                >
                  <h2 className="text-2xl font-bold text-primary mb-6">Biaya Pendaftaran (TPQ)</h2>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700">
                      <span className="text-card-foreground/80">Sarpras</span>
                      <span className="font-bold text-card-foreground">Rp 115.000</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700">
                      <span className="text-card-foreground/80">Seragam</span>
                      <span className="font-bold text-card-foreground">Rp 175.000</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700">
                      <span className="text-card-foreground/80">Buku Prestasi</span>
                      <span className="font-bold text-card-foreground">Rp 10.000</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700">
                      <span className="text-card-foreground/80">ID Card</span>
                      <span className="font-bold text-card-foreground">Rp 25.000</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700">
                      <span className="text-card-foreground/80">Buku Jilid</span>
                      <span className="font-bold text-card-foreground">Rp 25.000</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700">
                      <span className="text-card-foreground/80">SPP Awal</span>
                      <span className="font-bold text-card-foreground">Rp 100.000</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 text-lg">
                      <span className="font-bold text-primary">Total</span>
                      <span className="font-bold text-primary">Rp 450.000</span>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-primary to-green-800 p-8 rounded-2xl shadow-xl text-primary-foreground"
                >
                  <h2 className="text-2xl font-bold mb-6">Catatan Penting</h2>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <span className="mr-3 text-2xl">💰</span>
                      <span>Biaya pendaftaran dapat dicicil selama 1 bulan</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-2xl">👨‍👩‍👧‍👦</span>
                      <span>Tersedia paket khusus untuk keluarga dengan lebih dari 1 santri</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-2xl">📚</span>
                      <span>TPQ baru dimulai setelah semua syarat administrasi terpenuhi</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-2xl">👥</span>
                      <span>Wajib didampingi kedua orang tua saat pendaftaran</span>
                    </li>
                  </ul>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-card rounded-2xl shadow-xl overflow-hidden border border-border"
              >
                <div className="p-8">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    Syarat Pendaftaran (TPQ)
                  </h2>
                  <ul className="space-y-4 text-card-foreground/80">
                    <li className="flex items-start">
                      <span className="mr-3 text-primary font-bold">✓</span>
                      <span>Kedua wali dan calon santri wajib hadir saat mengisi formulir pendaftaran</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-primary font-bold">✓</span>
                      <span>Mengisi formulir pendaftaran dengan lengkap dan benar</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-primary font-bold">✓</span>
                      <span>Fotokopi Akta Kelahiran (1 lembar)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-primary font-bold">✓</span>
                      <span>Fotokopi Kartu Keluarga (1 lembar)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-primary font-bold">✓</span>
                      <span>Pas foto ukuran 3x4 (2 lembar)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-primary font-bold">✓</span>
                      <span>Materai Rp 10.000</span>
                    </li>
                  </ul>
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="dewasa">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-card p-8 rounded-2xl shadow-xl border border-border"
                >
                  <h2 className="text-2xl font-bold text-primary mb-6">Biaya Pendaftaran (Dewasa)</h2>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700">
                      <span className="text-card-foreground/80">Sarpras</span>
                      <span className="font-bold text-card-foreground">Rp 115.000</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700 opacity-50">
                      <span className="text-card-foreground/80 line-through">Seragam</span>
                      <span className="font-bold text-card-foreground">-</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700">
                      <span className="text-card-foreground/80">Buku Prestasi</span>
                      <span className="font-bold text-card-foreground">Rp 10.000</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700 opacity-50">
                      <span className="text-card-foreground/80 line-through">ID Card</span>
                      <span className="font-bold text-card-foreground">-</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700">
                      <span className="text-card-foreground/80">Buku Jilid</span>
                      <span className="font-bold text-card-foreground">Rp 25.000</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700">
                      <span className="text-card-foreground/80">SPP Awal</span>
                      <span className="font-bold text-card-foreground">Rp 100.000</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 text-lg">
                      <span className="font-bold text-primary">Total</span>
                      <span className="font-bold text-primary">Rp 250.000</span>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-primary to-green-800 p-8 rounded-2xl shadow-xl text-primary-foreground"
                >
                  <h2 className="text-2xl font-bold mb-6">Catatan Penting (Dewasa)</h2>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <span className="mr-3 text-2xl">🎓</span>
                      <span>Usia minimal 17 tahun ke atas</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-2xl">🤝</span>
                      <span>Berkomitmen untuk mengikuti pembelajaran secara rutin</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-2xl">📅</span>
                      <span>Jadwal fleksibel (Pagi/Siang/Malam) sesuai kesepakatan</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-2xl">💰</span>
                      <span>Pembayaran pendaftaran dilakukan di awal masuk</span>
                    </li>
                  </ul>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-card rounded-2xl shadow-xl overflow-hidden border border-border"
              >
                <div className="p-8">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    Syarat Pendaftaran (Dewasa)
                  </h2>
                  <ul className="space-y-4 text-card-foreground/80">
                    <li className="flex items-start">
                      <span className="mr-3 text-primary font-bold">✓</span>
                      <span>Mengisi formulir pendaftaran</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-primary font-bold">✓</span>
                      <span>Menyerahkan 1 lembar fotokopi KTP</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 text-primary font-bold">✓</span>
                      <span>Membayar biaya administrasi pendaftaran</span>
                    </li>
                  </ul>
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default RegistrationInfoPage;
