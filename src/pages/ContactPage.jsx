import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, Facebook, Instagram, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const handleSubmit = e => {
    e.preventDefault();
    const feedbacks = JSON.parse(localStorage.getItem('feedbacks') || '[]');
    const newFeedback = {
      id: `feedback-${Date.now()}`,
      ...formData,
      date: new Date().toISOString()
    };
    feedbacks.push(newFeedback);
    localStorage.setItem('feedbacks', JSON.stringify(feedbacks));
    toast({
      title: "Pesan Terkirim!",
      description: "Terima kasih atas masukan Anda."
    });
    setFormData({
      name: '',
      email: '',
      phone: '',
      message: ''
    });
  };
  return <>
      <Helmet>
        <title>Kontak - LPQ Al-Muhajirun</title>
        <meta name="description" content="Hubungi LPQ Al-Muhajirun untuk informasi lebih lanjut" />
      </Helmet>

      <div className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 font-serif">Hubungi Kami</h1>
            <p className="text-xl text-foreground/80">Kami siap membantu Anda</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <motion.div initial={{
            opacity: 0,
            x: -20
          }} animate={{
            opacity: 1,
            x: 0
          }} transition={{
            delay: 0.2
          }}>
              <div className="bg-card p-8 rounded-2xl shadow-xl mb-8 border border-border">
                <h2 className="text-2xl font-bold text-primary mb-6 font-serif">Informasi Kontak</h2>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <MapPin className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-card-foreground mb-1">Alamat</h3>
                      <a href="#" target="_blank" rel="noopener noreferrer" className="text-card-foreground/80 hover:text-primary transition-colors">
                        Jl. R. Suprapto No 195 Kel. Kemala Raja<br />(Depan Masjid Imam Bonjol)
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <Phone className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-card-foreground mb-1">Telepon</h3>
                      <a href="tel:081234567890" className="text-card-foreground/80 hover:text-primary transition-colors">0856-0902-5238</a>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <Mail className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-card-foreground mb-1">Email</h3>
                      <a href="mailto:admin@lpqalmuhajirun.id" className="text-card-foreground/80 hover:text-primary transition-colors">admin@lpqalmuhajirun.id</a>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-border">
                    <h3 className="font-bold text-card-foreground mb-4">Media Sosial</h3>
                    <div className="flex space-x-4">
                        <a href="#" className="w-12 h-12 bg-primary hover:bg-primary/90 rounded-full flex items-center justify-center text-primary-foreground transition-colors"><Facebook className="w-6 h-6" /></a>
                        <a href="#" className="w-12 h-12 bg-primary hover:bg-primary/90 rounded-full flex items-center justify-center text-primary-foreground transition-colors"><Instagram className="w-6 h-6" /></a>
                        <a href="#" className="w-12 h-12 bg-primary hover:bg-primary/90 rounded-full flex items-center justify-center text-primary-foreground transition-colors"><Youtube className="w-6 h-6" /></a>
                    </div>
                </div>
              </div>

              <div className="bg-card p-4 rounded-2xl shadow-xl border border-border">
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1507.950540742548!2d104.17345737504412!3d-4.1204841258880505!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e39afc61f68c737%3A0x81c3bbf753bbe64a!2sLembaga%20Pendidikan%20Quran%20Al%20Muhajirun!5e0!3m2!1sid!2sid!4v1782219186348!5m2!1sid!2sid" width="100%" height="300" style={{
                border: 0,
                borderRadius: '12px'
              }} loading="lazy" title="Peta Lokasi LPQ Al-Muhajirun" referrerPolicy="no-referrer-when-downgrade"></iframe>
              </div>
            </motion.div>

            <motion.div initial={{
            opacity: 0,
            x: 20
          }} animate={{
            opacity: 1,
            x: 0
          }} transition={{
            delay: 0.3
          }}>
              <div className="bg-card p-8 rounded-2xl shadow-xl border border-border">
                <h2 className="text-2xl font-bold text-primary mb-6 font-serif">Kirim Pesan</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div><label className="block text-card-foreground/80 mb-2 font-medium">Nama Lengkap</label><Input type="text" value={formData.name} onChange={e => setFormData({
                    ...formData,
                    name: e.target.value
                  })} required /></div>
                    <div><label className="block text-card-foreground/80 mb-2 font-medium">Email</label><Input type="email" value={formData.email} onChange={e => setFormData({
                    ...formData,
                    email: e.target.value
                  })} required /></div>
                    <div><label className="block text-card-foreground/80 mb-2 font-medium">No. Telepon / WhatsApp</label><Input type="tel" value={formData.phone} onChange={e => setFormData({
                    ...formData,
                    phone: e.target.value
                  })} required /></div>
                    <div><label className="block text-card-foreground/80 mb-2 font-medium">Pesan</label><Textarea value={formData.message} onChange={e => setFormData({
                    ...formData,
                    message: e.target.value
                  })} rows={6} required /></div>
                    <Button type="submit" className="w-full py-3 text-lg">Kirim Pesan</Button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>;
};
export default ContactPage;