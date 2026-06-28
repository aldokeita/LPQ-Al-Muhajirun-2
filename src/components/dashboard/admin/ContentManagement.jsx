import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Edit, Trophy, Star, Sun, Moon, Video, Users, BookCopy, MessageSquare, FileText, Library, Building, Mail, Info, Image as ImageIcon, CalendarClock, Quote, HelpCircle, Home, Heart } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import HafalanDisplay from '@/components/dashboard/shared/HafalanDisplay';
import { createHafalanItem, deactivateHafalanItem, fetchHafalanItems, getAcademicErrorMessage, updateHafalanItem } from '@/lib/academicAdapters';
import { getStorageErrorMessage, uploadWebsiteAsset } from '@/lib/storageAdapters';
import {
  archiveAnnouncement,
  archiveNews,
  deleteFeedback,
  fetchAdminAnnouncements,
  fetchAdminFeedbacks,
  fetchAdminNews,
  getPublicContentErrorMessage,
  assertNonEmptyWebsiteContentString,
  saveAnnouncement,
  saveNews,
  saveWebsiteContentItem,
  saveWebsiteContentItems,
  slugify
} from '@/lib/publicContentAdapters';

const HafalanItemManager = ({ category }) => {
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [targetJilid, setTargetJilid] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [category]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const data = await fetchHafalanItems(category);
      setItems(data || []);
    } catch (error) {
      toast({ title: "Gagal memuat item hafalan", description: getAcademicErrorMessage(error), variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    try {
      await createHafalanItem({
        category,
        itemName: newItemName,
        itemOrder: items.length + 1,
        jilid: targetJilid
      });
      setNewItemName('');
      fetchItems();
      toast({ title: "Berhasil", description: "Item hafalan baru ditambahkan." });
    } catch (error) {
      toast({ title: "Gagal menambah item", description: getAcademicErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Yakin ingin menghapus item ini?')) return;
    try {
      await deactivateHafalanItem(id);
      fetchItems();
      toast({ title: "Berhasil", description: "Item hafalan telah dinonaktifkan." });
    } catch (error) {
      toast({ title: "Gagal menghapus item", description: getAcademicErrorMessage(error), variant: "destructive" });
    }
  };

  const handleItemDrop = async (itemId, newJilid) => {
    // Optimistic update
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, jilid: newJilid } : item));

    try {
        await updateHafalanItem(itemId, { jilid: newJilid });
        toast({ title: "Berhasil", description: `Item dipindahkan ke Jilid ${newJilid}` });
    } catch (error) {
        toast({ title: "Gagal memindahkan item", description: getAcademicErrorMessage(error), variant: "destructive" });
        fetchItems(); // Revert on error
    }
  };

  // Group items by Jilid for display
  const itemsByJilid = {
      1: items.filter(i => !i.jilid || String(i.jilid) === '1'), // Default to 1 if null
      2: items.filter(i => String(i.jilid) === '2'),
      3: items.filter(i => String(i.jilid) === '3'),
      4: items.filter(i => String(i.jilid) === '4'),
      5: items.filter(i => String(i.jilid) === '5'),
      6: items.filter(i => String(i.jilid) === '6'),
  };

  return (
    <div className="space-y-6 p-6 border rounded-xl bg-slate-50 dark:bg-slate-900/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
          <h4 className="font-bold text-2xl text-primary">{category}</h4>
          <div className="flex gap-2 w-full md:w-auto">
            <Select value={targetJilid.toString()} onValueChange={(val) => setTargetJilid(parseInt(val))}>
                <SelectTrigger className="w-[100px] bg-white"><SelectValue placeholder="Jilid" /></SelectTrigger>
                <SelectContent>
                    {[1,2,3,4,5,6].map(j => <SelectItem key={j} value={j.toString()}>Jilid {j}</SelectItem>)}
                </SelectContent>
            </Select>
            <Input placeholder="Nama hafalan baru..." value={newItemName} onChange={e => setNewItemName(e.target.value)} className="bg-white dark:bg-slate-950 flex-1 min-w-[200px]" />
            <Button onClick={handleAddItem}><Plus className="w-4 h-4 mr-2"/> Tambah</Button>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(jilid => (
              <HafalanDisplay
                  key={jilid}
                  jilid={jilid}
                  items={itemsByJilid[jilid]}
                  isDraggable={true}
                  onItemDrop={handleItemDrop}
                  onDeleteItem={handleDeleteItem}
                  isLoading={isLoading}
              />
          ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
          Tip: Tarik dan lepas item hafalan untuk memindahkan antar Jilid.
      </p>
    </div>
  );
};

const ContentManagement = () => {
  const [content, setContent] = useState({
    heroSlides: [], slideshowTimer: 5000, heroOverlayOpacity: 0.6, brochures: [], pustaka: [], news: [], announcements: [], facilities: [], qiroatiVideos: [], hafalanVideos: [], waliDiscussions: [], logoUrl: '', ctaBackgroundUrl: '', ctaBackgroundOverlayOpacity: 0.5, santriOfTheMonth: [], guruOfTheMonth: null, leaderboard: [], parentingArticles: [], galleryPhotos: [], testimonials: [], schedules: [], quotas: { pagi: 0, siang: 0, sore: 0, dewasaPagi: 0, dewasaSiang: 0, dewasaMalam: 0 }, faqs: [], model3dSettings: { autoRotate: false, autoRotateSpeed: 0.34, rotationX: 0, rotationY: 0, rotationZ: 0 }
  });

  const [feedbacks, setFeedbacks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalType, setModalType] = useState('');
  const [formState, setFormState] = useState({});
  const [santriList, setSantriList] = useState([]);
  const [guruList, setGuruList] = useState([]);
  const [activeTab, setActiveTab] = useState("homepage");

  useEffect(() => { fetchContent(); fetchSantriAndGuru(); fetchFeedbacks(); }, []);

  const fetchFeedbacks = async () => {
    try {
      setFeedbacks(await fetchAdminFeedbacks());
    } catch (error) {
      toast({ title: "Gagal Memuat Pesan", description: getPublicContentErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDeleteFeedback = async (id) => {
    if (!window.confirm('Yakin ingin menghapus pesan ini?')) return;
    try {
      await deleteFeedback(id);
      toast({ title: "Pesan dihapus!" });
      fetchFeedbacks();
    } catch (error) {
      toast({ title: "Gagal Menghapus Pesan", description: getPublicContentErrorMessage(error), variant: "destructive" });
    }
  }

  const fetchSantriAndGuru = async () => {
    const { data: santriData } = await supabase.from('santri').select('id, nama_lengkap, foto_url').eq('status', 'Aktif').order('nama_lengkap', { ascending: true });
    const { data: guruData } = await supabase.from('guru').select('id, nama, foto_url').order('nama', { ascending: true });
    setSantriList(santriData || []);
    setGuruList(guruData || []);
  };

  const fetchContent = async () => {
    const { data, error } = await supabase.from('website_content').select('key, content');
    if (error) return;
    const newContent = data.reduce((acc, item) => { acc[item.key] = item.content; return acc; }, {});
    const arrayKeys = ['heroSlides', 'brochures', 'pustaka', 'facilities', 'qiroatiVideos', 'hafalanVideos', 'waliDiscussions', 'santriOfTheMonth', 'leaderboard', 'parentingArticles', 'galleryPhotos', 'testimonials', 'schedules', 'faqs'];
    arrayKeys.forEach(key => { if (!newContent[key] || !Array.isArray(newContent[key])) newContent[key] = []; });
    if(!newContent.quotas) newContent.quotas = { pagi: 0, siang: 0, sore: 0, dewasaPagi: 0, dewasaSiang: 0, dewasaMalam: 0 };
    if(!newContent.model3dSettings || typeof newContent.model3dSettings !== 'object' || Array.isArray(newContent.model3dSettings)) {
      newContent.model3dSettings = { autoRotate: false, autoRotateSpeed: 0.34, rotationX: 0, rotationY: 0, rotationZ: 0 };
    }
    try {
      const [news, announcements] = await Promise.all([fetchAdminNews(), fetchAdminAnnouncements()]);
      setContent(prev => ({ ...prev, ...newContent, news, announcements }));
    } catch (contentError) {
      toast({ title: "Gagal Memuat Berita/Pengumuman", description: getPublicContentErrorMessage(contentError), variant: "destructive" });
      setContent(prev => ({ ...prev, ...newContent, news: [], announcements: [] }));
    }
  };

  const handleSaveAll = async () => {
    const excludedKeys = new Set(['news', 'announcements']);
    const dataToUpsert = Object.keys(content)
      .filter(key => !excludedKeys.has(key))
      .map(key => ({ key, content: content[key], is_public: true }));
    try {
      await saveWebsiteContentItems(dataToUpsert);
      toast({ title: "Konten Disimpan!", description: `Semua perubahan telah berhasil disimpan.` });
    } catch (error) {
      toast({ title: "Gagal Menyimpan!", description: getPublicContentErrorMessage(error), variant: "destructive" });
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    let folder = 'general';
    if (['news', 'announcements', 'parentingArticles'].includes(type)) folder = 'article-images';
    else if (type === 'facilities') folder = 'facilities-images';
    else if (['brochures', 'pustaka'].includes(type)) folder = type;
    else if (type === 'logoUrl') folder = 'logos';
    else if (type === 'ctaBackgroundUrl') folder = 'backgrounds';
    else if (type === 'heroSlides') folder = 'hero-slides';
    else if (type === 'galleryPhotos') folder = 'gallery';
    else if (type === 'testimonials') folder = 'testimonials';

    const assetKey = type === 'logoUrl' ? 'logo' : (type === 'ctaBackgroundUrl' ? 'cta-background' : null);
    let publicUrl = '';
    try {
      const result = await uploadWebsiteAsset({ folder, key: assetKey, file });
      publicUrl = result.publicUrl;
      if (!publicUrl || !String(publicUrl).trim()) {
        throw new Error('Upload berhasil, tetapi URL aset tidak tersedia.');
      }
    } catch (error) {
      toast({ title: "Upload Gagal!", description: getStorageErrorMessage(error), variant: "destructive" });
      return;
    }

    if (type === 'logoUrl') {
      try {
        const logoUrl = assertNonEmptyWebsiteContentString('logoUrl', publicUrl);
        const saved = await saveWebsiteContentItem({ key: 'logoUrl', content: logoUrl, isPublic: true });
        setContent(prev => ({ ...prev, logoUrl: saved.content || logoUrl }));
        toast({ title: "Logo Disimpan!", description: "Logo berhasil diunggah dan disimpan ke database." });
      } catch (error) {
        toast({ title: "Logo Gagal Disimpan", description: getPublicContentErrorMessage(error), variant: "destructive" });
      }
      return;
    }
    if (type === 'ctaBackgroundUrl') { setContent(prev => ({ ...prev, [type]: publicUrl })); }
    else if (['brochures', 'pustaka'].includes(type)) { const newFile = { id: Date.now(), name: file.name, url: publicUrl }; setContent(prev => ({...prev, [type]: [...(prev[type] || []), newFile]})); }
    else if (type === 'galleryPhotos') { setFormState(prev => ({ ...prev, url: publicUrl })); }
    else if (type === 'testimonials') { setFormState(prev => ({ ...prev, photo_url: publicUrl })); }
    else { setFormState(prev => ({ ...prev, image_url: publicUrl })); }
    toast({ title: "Upload Berhasil!", description: `${file.name} berhasil diunggah.` });
  };

  const handleHeroImageUpload = async (e, slideId) => {
    const file = e.target.files[0];
    if (!file) return;
    const folder = 'hero-slides';
    let publicUrl = '';
    try {
      const result = await uploadWebsiteAsset({ folder, key: `slide-${slideId}`, file });
      publicUrl = result.publicUrl;
    } catch (error) {
      return toast({ title: "Upload Gagal!", description: getStorageErrorMessage(error), variant: "destructive" });
    }
    setContent(prev => ({ ...prev, heroSlides: prev.heroSlides.map(slide => slide.id === slideId ? { ...slide, url: publicUrl } : slide) }));
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    if (item) { setEditingItem(item); setFormState(item); }
    else { setEditingItem(null); setFormState({}); }
    setIsModalOpen(true);
  };

  const handleModalSubmit = async () => {
    if (modalType === 'news' || modalType === 'announcements') {
      try {
        if (!formState.slug) setFormState(prev => ({ ...prev, slug: slugify(prev.title) }));
        if (modalType === 'news') await saveNews({ ...formState, slug: formState.slug || slugify(formState.title) });
        else await saveAnnouncement({ ...formState, slug: formState.slug || slugify(formState.title) });
        toast({ title: "Konten Disimpan", description: modalType === 'news' ? "Berita telah diperbarui." : "Pengumuman telah diperbarui." });
        setIsModalOpen(false);
        fetchContent();
      } catch (error) {
        toast({ title: "Gagal Menyimpan Konten", description: getPublicContentErrorMessage(error), variant: "destructive" });
      }
      return;
    }
    let updatedList;
    if (editingItem) updatedList = content[modalType].map(item => item.id === editingItem.id ? formState : item);
    else updatedList = [...(content[modalType] || []), { ...formState, id: Date.now() }];
    setContent(prev => ({ ...prev, [modalType]: updatedList }));
    setIsModalOpen(false);
  };

  const handleDeleteItem = async (type, id) => {
    if (window.confirm('Anda yakin ingin menghapus item ini?')) {
      if (type === 'news' || type === 'announcements') {
        try {
          if (type === 'news') await archiveNews(id);
          else await archiveAnnouncement(id);
          toast({ title: "Konten Dinonaktifkan", description: "Konten tidak lagi tampil di halaman publik." });
          fetchContent();
        } catch (error) {
          toast({ title: "Gagal Menonaktifkan Konten", description: getPublicContentErrorMessage(error), variant: "destructive" });
        }
        return;
      }
      const updatedList = content[type].filter(item => item.id !== id);
      setContent(prev => ({ ...prev, [type]: updatedList }));
    }
  };

  const handleHeroSlideChange = (id, field, value) => { setContent(prev => ({ ...prev, heroSlides: prev.heroSlides.map(slide => slide.id === id ? { ...slide, [field]: value } : slide) })); };
  const addHeroSlide = () => { if (content.heroSlides?.length >= 5) return; setContent(prev => ({ ...prev, heroSlides: [...(prev.heroSlides || []), { id: Date.now(), url: 'https://images.unsplash.com/photo-1484201927383-f03f6583b837?q=80&w=800', text: "Teks Baru", author: "Author Baru" }] })); };
  const handleSantriOfTheMonthChange = (index, personId, alasan) => { const person = santriList.find(p => p.id === personId); if (person) { const newSantriOTM = [...content.santriOfTheMonth]; newSantriOTM[index] = { ...person, alasan }; setContent(prev => ({ ...prev, santriOfTheMonth: newSantriOTM })); } };
  const handleGuruOfTheMonthChange = (personId, alasan) => { const person = guruList.find(p => p.id === personId); if (person) setContent(prev => ({ ...prev, guruOfTheMonth: { ...person, alasan } })); };
  const handleLeaderboardChange = (index, personId, achievement) => { const person = santriList.find(p => p.id === personId); if (person) { const newLeaderboard = [...content.leaderboard]; newLeaderboard[index] = { ...person, achievement }; setContent(prev => ({ ...prev, leaderboard: newLeaderboard })); } };
  const handleOpacityChange = (key, value) => { setContent(prev => ({...prev, [key]: value[0]})); };

  const tabs = [
      { id: 'homepage', label: 'Halaman Depan', icon: Home },
      { id: 'apresiasi', label: 'Apresiasi', icon: Heart },
      { id: 'media', label: 'Media & Galeri', icon: ImageIcon },
      { id: 'pesan', label: 'Pesan Masuk', icon: Mail },
      { id: 'hafalan', label: 'Hafalan', icon: BookCopy },
  ];

  const renderModalContent = () => {
    if (!modalType) return null;
    return (
      <>
        <div className="space-y-4">
          {modalType === 'news' && (<><Input placeholder="Judul" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value, slug: p.slug || slugify(e.target.value)}))} /><Input placeholder="Slug" value={formState.slug || ''} onChange={e => setFormState(p => ({...p, slug: slugify(e.target.value)}))} /><Select value={formState.status || 'draft'} onValueChange={val => setFormState(p => ({...p, status: val}))}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Nonaktif</SelectItem></SelectContent></Select><Textarea placeholder="Ringkasan" value={formState.summary || ''} onChange={e => setFormState(p => ({...p, summary: e.target.value}))} /><Textarea placeholder="Konten Lengkap" rows={10} value={formState.content || ''} onChange={e => setFormState(p => ({...p, content: e.target.value}))} /><Input placeholder="URL Gambar" value={formState.image_url || ''} onChange={e => setFormState(p => ({...p, image_url: e.target.value}))} /><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'news')} /></>)}
          {modalType === 'parentingArticles' && (<><Input placeholder="Judul" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value}))} /><Input placeholder="Penulis" value={formState.author || ''} onChange={e => setFormState(p => ({...p, author: e.target.value}))} /><Textarea placeholder="Ringkasan" value={formState.summary || ''} onChange={e => setFormState(p => ({...p, summary: e.target.value}))} /><Textarea placeholder="Konten Lengkap" rows={10} value={formState.content || ''} onChange={e => setFormState(p => ({...p, content: e.target.value}))} /><Input placeholder="URL Gambar" value={formState.image_url || ''} onChange={e => setFormState(p => ({...p, image_url: e.target.value}))} /></>)}
          {modalType === 'announcements' && (<><Input placeholder="Judul" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value, slug: p.slug || slugify(e.target.value)}))} /><Input placeholder="Slug" value={formState.slug || ''} onChange={e => setFormState(p => ({...p, slug: slugify(e.target.value)}))} /><Select value={formState.status || 'draft'} onValueChange={val => setFormState(p => ({...p, status: val}))}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Nonaktif</SelectItem></SelectContent></Select><Select value={formState.priority || 'normal'} onValueChange={val => setFormState(p => ({...p, priority: val}))}><SelectTrigger><SelectValue placeholder="Prioritas" /></SelectTrigger><SelectContent><SelectItem value="low">Rendah</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">Tinggi</SelectItem></SelectContent></Select><Input type="date" value={formState.valid_until || ''} onChange={e => setFormState(p => ({...p, valid_until: e.target.value}))} /><Textarea placeholder="Ringkasan" value={formState.summary || ''} onChange={e => setFormState(p => ({...p, summary: e.target.value}))} /><Textarea placeholder="Konten" rows={8} value={formState.content || ''} onChange={e => setFormState(p => ({...p, content: e.target.value}))} /><Input placeholder="URL Gambar" value={formState.image_url || ''} onChange={e => setFormState(p => ({...p, image_url: e.target.value}))} /><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'announcements')} /></>)}
          {modalType === 'facilities' && (<><Input placeholder="Nama Fasilitas" value={formState.name || ''} onChange={e => setFormState(p => ({...p, name: e.target.value}))} /><Textarea placeholder="Deskripsi" value={formState.description || ''} onChange={e => setFormState(p => ({...p, description: e.target.value}))} /><Input placeholder="URL Gambar" value={formState.image_url || ''} onChange={e => setFormState(p => ({...p, image_url: e.target.value}))} /></>)}
          {['qiroatiVideos', 'hafalanVideos'].includes(modalType) && (<><Input placeholder="Judul Video" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value}))} /><Input placeholder="URL Embed Video Youtube" value={formState.url || ''} onChange={e => setFormState(p => ({...p, url: e.target.value}))} />{modalType === 'hafalanVideos' && (<div className="space-y-2"><Textarea placeholder='Google Drive Embed Code' value={formState.google_drive_embed || ''} onChange={e => setFormState(p => ({...p, google_drive_embed: e.target.value}))} className="font-mono text-xs" rows={3}/><p className="text-[10px] text-muted-foreground">Isi salah satu: YouTube URL atau Google Drive Embed.</p></div>)}{modalType === 'hafalanVideos' && (<Select value={formState.jilid} onValueChange={val => setFormState(p => ({...p, jilid: val}))}><SelectTrigger><SelectValue placeholder="Pilih Jilid" /></SelectTrigger><SelectContent>{['Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6', 'Lainnya'].map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent></Select>)}</>)}
          {modalType === 'waliDiscussions' && (<><Input placeholder="Judul Diskusi" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value}))} /><div className="grid grid-cols-2 gap-4"><Input type="date" value={formState.date || ''} onChange={e => setFormState(p => ({...p, date: e.target.value}))} /><Input type="time" value={formState.time || ''} onChange={e => setFormState(p => ({...p, time: e.target.value}))} /></div><Select value={formState.platform} onValueChange={val => setFormState(p => ({...p, platform: val}))}><SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger><SelectContent><SelectItem value="Google Meet">Google Meet</SelectItem><SelectItem value="Zoom">Zoom</SelectItem></SelectContent></Select><Input placeholder="Link Meeting" value={formState.link || ''} onChange={e => setFormState(p => ({...p, link: e.target.value}))} /><Textarea placeholder="Deskripsi Topik" value={formState.description || ''} onChange={e => setFormState(p => ({...p, description: e.target.value}))} /></>)}
          {modalType === 'galleryPhotos' && (<><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'galleryPhotos')} /><Input placeholder="Caption Foto" value={formState.caption || ''} onChange={e => setFormState(p => ({...p, caption: e.target.value}))} />{formState.url && <img src={formState.url} alt="Preview" className="w-full h-40 object-cover rounded-md mt-2" />}</>)}
          {modalType === 'testimonials' && (<><Input placeholder="Nama Lengkap" value={formState.name || ''} onChange={e => setFormState(p => ({...p, name: e.target.value}))} /><Select value={formState.role} onValueChange={val => setFormState(p => ({...p, role: val}))}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="Wali Santri">Wali Santri</SelectItem><SelectItem value="Alumni">Alumni</SelectItem></SelectContent></Select><Textarea placeholder="Isi Testimoni" value={formState.text || ''} onChange={e => setFormState(p => ({...p, text: e.target.value}))} /><div className="border p-2 rounded-md"><label className="text-xs">Foto</label><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'testimonials')} />{formState.photo_url && <img src={formState.photo_url} className="w-16 h-16 object-cover rounded-full mt-2"/>}</div></>)}
          {modalType === 'schedules' && (<><Input placeholder="Judul" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value}))} /><Input placeholder="Waktu" value={formState.time || ''} onChange={e => setFormState(p => ({...p, time: e.target.value}))} /><Input placeholder="Keterangan" value={formState.type || ''} onChange={e => setFormState(p => ({...p, type: e.target.value}))} /></>)}
          {modalType === 'faqs' && (<><Input placeholder="Pertanyaan" value={formState.question || ''} onChange={e => setFormState(p => ({...p, question: e.target.value}))} /><Textarea placeholder="Jawaban" value={formState.answer || ''} onChange={e => setFormState(p => ({...p, answer: e.target.value}))} /></>)}
        </div>
        <div className="flex justify-end mt-4"><Button onClick={handleModalSubmit}>Simpan</Button></div>
      </>
    );
  };

  const ContentSection = ({ title, modalType, data, icon, renderItem }) => (
    <div className="p-4 border rounded-lg">
      <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-xl flex items-center gap-2">{icon} {title}</h3><Button onClick={() => openModal(modalType)}><Plus className="w-4 h-4 mr-2" />Tambah</Button></div>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
        {data.map(item => (<div key={item.id} className="flex justify-between items-center p-2 border rounded-lg bg-background">{renderItem(item)}<div className="flex-shrink-0"><Button variant="ghost" size="icon" onClick={() => openModal(modalType, item)}><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteItem(modalType, item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div></div>))}
      </div>
    </div>
  );

  return (
    <div className="bg-card p-6 rounded-2xl shadow-xl space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-accent-foreground">Manajemen Konten Website</h2>
        <Button onClick={handleSaveAll}>Simpan Semua Perubahan</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-center mb-6">
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full gap-1">
                {tabs.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-out flex items-center gap-2 ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>
                        {activeTab === tab.id && (<motion.div layoutId="content-pill" className="absolute inset-0 bg-blue-600 dark:bg-blue-500 shadow-sm rounded-full" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />)}
                        <span className="relative z-10 flex items-center gap-2"><tab.icon className="w-4 h-4" />{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>

        <TabsContent value="homepage" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="p-4 border rounded-lg"><h3 className="font-bold text-xl mb-4">Logo Website</h3><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'logoUrl')} />{content.logoUrl && <img src={content.logoUrl} alt="Logo Preview" className="w-24 h-24 mt-2 bg-gray-200 p-2 rounded-md" />}</div>
            <div className="p-4 border rounded-lg">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-xl">Slideshow</h3><Button onClick={addHeroSlide} size="sm"><Plus className="w-4 h-4 mr-2" /> Tambah Slide</Button></div>
                <div className="mb-4"><label className="block text-sm font-medium mb-1">Timer Slideshow (ms)</label><Input type="number" value={content.slideshowTimer} onChange={e => setContent(p => ({...p, slideshowTimer: parseInt(e.target.value, 10)}))} /></div>
                 <div className="space-y-2 mb-4"><label className="font-medium">Kegelapan Overlay Slideshow</label><div className="flex items-center gap-4"><Sun className="w-5 h-5"/><Slider value={[content.heroOverlayOpacity || 0.6]} max={1} step={0.1} onValueChange={(val) => handleOpacityChange('heroOverlayOpacity', val)} /><Moon className="w-5 h-5"/></div></div>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">{content.heroSlides.map((slide) => (<div key={slide.id} className="p-4 border rounded-lg space-y-3 bg-background"><div className="flex flex-col md:flex-row items-start gap-4"><img alt="Slide Preview" className="w-24 h-16 object-cover rounded-md bg-secondary" src={slide.url} /><div className="flex-grow space-y-2"><Textarea placeholder="Teks Utama" value={slide.text || ''} onChange={e => handleHeroSlideChange(slide.id, 'text', e.target.value)} /><Input placeholder="Author" value={slide.author || ''} onChange={(e) => handleHeroSlideChange(slide.id, 'author', e.target.value)} /></div></div><div className="flex gap-2"><Input type="file" accept="image/*" onChange={(e) => handleHeroImageUpload(e, slide.id)} className="w-full" /><Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteItem('heroSlides', slide.id)}><Trash2 className="w-4 h-4" /></Button></div></div>))}</div>
            </div>
             <div className="p-4 border rounded-lg">
              <h3 className="font-bold text-xl mb-4">Background CTA</h3><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'ctaBackgroundUrl')} />{content.ctaBackgroundUrl && <img src={content.ctaBackgroundUrl} alt="CTA Background Preview" className="w-48 h-auto mt-2 bg-gray-200 p-2 rounded-md" />}
              <div className="mt-4 space-y-2"><label className="font-medium">Tingkat Kegelapan Overlay</label><div className="flex items-center gap-4"><Sun className="w-5 h-5"/><Slider value={[content.ctaBackgroundOverlayOpacity]} max={1} step={0.1} onValueChange={(val) => handleOpacityChange('ctaBackgroundOverlayOpacity', val)} /><Moon className="w-5 h-5"/></div></div>
            </div>
            <ContentSection title="Jadwal Pembelajaran" modalType="schedules" data={content.schedules} icon={<CalendarClock/>} renderItem={item => <div className="text-sm"><p className="font-bold">{item.title}</p><p>{item.time}</p></div>} />
            <ContentSection title="FAQ (Tanya Jawab)" modalType="faqs" data={content.faqs} icon={<HelpCircle/>} renderItem={item => <div className="text-sm"><p className="font-bold">{item.question}</p></div>} />
            <div className="p-4 border rounded-lg"><h3 className="font-bold text-xl mb-4">Kuota Santri</h3><div className="grid grid-cols-2 md:grid-cols-3 gap-4">{Object.keys(content.quotas).map(k => <div key={k}><label className="text-sm capitalize">{k.replace(/([A-Z])/g, ' $1')}</label><Input type="number" value={content.quotas[k] || 0} onChange={e => setContent(p => ({...p, quotas: {...p.quotas, [k]: parseInt(e.target.value)}}))} /></div>)}</div></div>
            <ContentSection title="Testimoni" modalType="testimonials" data={content.testimonials} icon={<Quote/>} renderItem={item => <div className="text-sm flex items-center gap-2"><Avatar className="w-8 h-8"><AvatarImage src={item.photo_url}/></Avatar><div><p className="font-bold">{item.name} <span className="text-xs font-normal text-muted-foreground">({item.role})</span></p><p className="truncate w-40">{item.text}</p></div></div>} />

            <div className="p-4 border rounded-lg space-y-4">
              <h3 className="font-bold text-xl flex items-center gap-2"><RotateCcw className="w-5 h-5" /> Model 3D</h3>
              <p className="text-sm text-muted-foreground">Atur rotasi model 3D yang tampil di bagian hero halaman depan.</p>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">Auto-Rotate</p>
                  <p className="text-sm text-muted-foreground">Putar model secara otomatis</p>
                </div>
                <Switch
                  checked={content.model3dSettings?.autoRotate || false}
                  onCheckedChange={(checked) => setContent(prev => ({
                    ...prev,
                    model3dSettings: { ...prev.model3dSettings, autoRotate: checked }
                  }))}
                />
              </div>
              {content.model3dSettings?.autoRotate && (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-sm">Kecepatan Putar</label>
                    <span className="text-xs text-muted-foreground">{(content.model3dSettings?.autoRotateSpeed || 0.34).toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[content.model3dSettings?.autoRotateSpeed || 0.34]}
                    min={0.05}
                    max={2.0}
                    step={0.05}
                    onValueChange={(val) => setContent(prev => ({
                      ...prev,
                      model3dSettings: { ...prev.model3dSettings, autoRotateSpeed: val[0] }
                    }))}
                  />
                </div>
              )}
              <div className="space-y-3 rounded-lg border p-3">
                <label className="font-medium text-sm">Rotasi Awal (derajat)</label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { axis: 'rotationX', label: 'Sumbu X' },
                    { axis: 'rotationY', label: 'Sumbu Y' },
                    { axis: 'rotationZ', label: 'Sumbu Z' },
                  ].map(({ axis, label }) => (
                    <div key={axis} className="space-y-1">
                      <label className="text-xs text-muted-foreground">{label}</label>
                      <Input
                        type="number"
                        min={-180}
                        max={180}
                        step={1}
                        value={content.model3dSettings?.[axis] ?? 0}
                        onChange={(e) => setContent(prev => ({
                          ...prev,
                          model3dSettings: { ...prev.model3dSettings, [axis]: parseFloat(e.target.value) || 0 }
                        }))}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setContent(prev => ({
                    ...prev,
                    model3dSettings: { ...prev.model3dSettings, rotationX: 0, rotationY: 0, rotationZ: 0 }
                  }))}
                >
                  <RotateCcw className="w-3 h-3 mr-2" /> Reset ke Default
                </Button>
              </div>
            </div>
        </TabsContent>

        <TabsContent value="apresiasi" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 flex gap-3 mb-4"><Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" /><div className="text-sm text-blue-700 dark:text-blue-300"><p className="font-bold mb-1">Info Pindah Lokasi</p><p>Pengaturan <strong>TV Leaderboard</strong> telah dipindahkan ke menu <strong>Pengaturan TV</strong> sesuai permintaan.</p></div></div>
          <div className="p-4 border rounded-lg"><h3 className="font-bold text-xl mb-4 flex items-center"><Star className="w-6 h-6 mr-2 text-blue-500" /> Papan Peringkat (Website)</h3>{[0, 1, 2].map(index => (<div key={index} className="p-4 border rounded-lg space-y-3 mb-4 bg-background"><h4 className="font-semibold">Peringkat #{index + 1}</h4><Select onValueChange={val => handleLeaderboardChange(index, val, content.leaderboard?.[index]?.achievement || '')} value={content.leaderboard?.[index]?.id}><SelectTrigger><SelectValue placeholder="Pilih Santri" /></SelectTrigger><SelectContent>{santriList.map(s => <SelectItem key={s.id} value={s.id}>{s.nama_lengkap}</SelectItem>)}</SelectContent></Select><Input placeholder="Deskripsi Prestasi" value={content.leaderboard?.[index]?.achievement || ''} onChange={e => handleLeaderboardChange(index, content.leaderboard?.[index]?.id, e.target.value)} /></div>))}</div>
          <div className="p-4 border rounded-lg"><h3 className="font-bold text-xl mb-4 flex items-center"><Trophy className="w-6 h-6 mr-2 text-amber-500" /> Santri of the Month</h3>{[0, 1, 2].map(index => (<div key={index} className="p-4 border rounded-lg space-y-3 mb-4 bg-background"><h4 className="font-semibold">Pilihan Santri #{index + 1}</h4><Select onValueChange={val => handleSantriOfTheMonthChange(index, val, content.santriOfTheMonth?.[index]?.alasan || '')} value={content.santriOfTheMonth?.[index]?.id}><SelectTrigger><SelectValue placeholder="Pilih Santri" /></SelectTrigger><SelectContent>{santriList.map(s => <SelectItem key={s.id} value={s.id}>{s.nama_lengkap}</SelectItem>)}</SelectContent></Select><Input placeholder="Alasan apresiasi..." value={content.santriOfTheMonth?.[index]?.alasan || ''} onChange={e => handleSantriOfTheMonthChange(index, content.santriOfTheMonth?.[index]?.id, e.target.value)} /></div>))}</div>
          <div className="p-4 border rounded-lg"><h3 className="font-bold text-xl mb-4 flex items-center"><Trophy className="w-6 h-6 mr-2 text-amber-500" /> Guru of the Month</h3><div className="p-4 border rounded-lg space-y-3 bg-background"><Select onValueChange={val => handleGuruOfTheMonthChange(val, content.guruOfTheMonth?.alasan || '')} value={content.guruOfTheMonth?.id}><SelectTrigger><SelectValue placeholder="Pilih Guru" /></SelectTrigger><SelectContent>{guruList.map(g => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}</SelectContent></Select><Input placeholder="Alasan apresiasi..." value={content.guruOfTheMonth?.alasan || ''} onChange={e => handleGuruOfTheMonthChange(content.guruOfTheMonth?.id, e.target.value)} /></div></div>
        </TabsContent>

        <TabsContent value="media" className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="col-span-full"><ContentSection title="Galeri Kegiatan" modalType="galleryPhotos" data={content.galleryPhotos} icon={<ImageIcon/>} renderItem={item => <div className="flex items-center gap-2"><img src={item.url} className="w-12 h-12 object-cover rounded-md" /><p className="truncate">{item.caption}</p></div>} /></div>
            <div className="p-4 border rounded-lg space-y-4"><h3 className="font-bold text-xl flex items-center gap-2"><FileText/> Brosur Pendaftaran</h3><Input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'brochures')} /><div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">{content.brochures.map(file => (<div key={file.id} className="flex justify-between items-center p-2 border rounded-lg bg-background"><span>{file.name}</span><Button variant="ghost" size="icon" onClick={() => handleDeleteItem('brochures', file.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div>))}</div></div>
            <div className="p-4 border rounded-lg space-y-4"><h3 className="font-bold text-xl flex items-center gap-2"><Library/> Pustaka Digital</h3><Input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'pustaka')} /><div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">{content.pustaka.map(file => (<div key={file.id} className="flex justify-between items-center p-2 border rounded-lg bg-background"><span>{file.name}</span><Button variant="ghost" size="icon" onClick={() => handleDeleteItem('pustaka', file.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div>))}</div></div>
            <ContentSection title="Berita" modalType="news" data={content.news} icon={<BookCopy/>} renderItem={item => <p className="truncate">{item.title}</p>} />
            <ContentSection title="Pengumuman" modalType="announcements" data={content.announcements} icon={<MessageSquare/>} renderItem={item => <p className="truncate">{item.title}</p>} />
            <ContentSection title="Artikel Parenting" modalType="parentingArticles" data={content.parentingArticles} icon={<Users/>} renderItem={item => <p className="truncate">{item.title}</p>} />
            <ContentSection title="Diskusi Wali Santri" modalType="waliDiscussions" data={content.waliDiscussions} icon={<Users/>} renderItem={item => <p className="truncate">{item.title} - {item.date}</p>} />
            <ContentSection title="Video Qiroati" modalType="qiroatiVideos" data={content.qiroatiVideos} icon={<Video/>} renderItem={item => <p className="truncate">{item.title}</p>} />
            <ContentSection title="Video Hafalan" modalType="hafalanVideos" data={content.hafalanVideos} icon={<Video/>} renderItem={item => <p className="truncate">{item.title}</p>} />
            <ContentSection title="Fasilitas" modalType="facilities" data={content.facilities} icon={<Building/>} renderItem={item => <p className="truncate">{item.name}</p>} />
        </TabsContent>
        <TabsContent value="pesan" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <h3 className="font-bold text-xl flex items-center gap-2"><Mail />Pesan dari Pengunjung</h3>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {feedbacks.length > 0 ? feedbacks.map(fb => (<div key={fb.id} className="p-4 border rounded-lg bg-background relative"><Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleDeleteFeedback(fb.id)}><Trash2 className="h-4 w-4" /></Button><p className="font-semibold text-lg">{fb.nama || 'Anonim'}</p><div className="text-sm text-muted-foreground mb-2"><span>{fb.email || '-'}</span> | <span>{fb.phone || '-'}</span> | <span>{new Date(fb.created_at).toLocaleString('id-ID')}</span></div><p className="whitespace-pre-wrap">{fb.message}</p></div>)) : (<p className="text-center text-muted-foreground py-4">Tidak ada pesan masuk.</p>)}
            </div>
        </TabsContent>
        <TabsContent value="hafalan" className="grid md:grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-2">
          <HafalanItemManager category="Doa" />
          <HafalanItemManager category="Sholat" />
          <HafalanItemManager category="Surat" />
        </TabsContent>
      </Tabs>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{editingItem ? 'Edit' : 'Tambah'} {modalType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</DialogTitle><DialogDescription>Pastikan untuk menyimpan semua perubahan setelah selesai mengedit.</DialogDescription></DialogHeader>{renderModalContent()}</DialogContent></Dialog>
    </div>
  );
};

export default ContentManagement;
