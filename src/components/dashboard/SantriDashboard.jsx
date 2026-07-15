
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlayCircle, Mic, Send, AlertCircle, Users, CheckCircle as CheckCircleFull, Star, Edit, Upload, Video, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BirthdayGreeting from '@/components/BirthdayGreeting';
import HafalanDisplay from '@/components/dashboard/shared/HafalanDisplay';
import SantriAbsensiRecap from '@/components/dashboard/santri/SantriAbsensiRecap';
import SantriPaymentHistory from '@/components/dashboard/santri/SantriPaymentHistory';
import AttendanceDetailsModal from '@/components/dashboard/shared/AttendanceDetailsModal';
import AttendanceStatusIcon from '@/components/dashboard/shared/AttendanceStatusIcon';
import { determineAttendanceStatus, calculateTimeDifference } from '@/utils/AttendanceStatusLogic';
import { createMurojaahSubmission, fetchHafalanItems, getAcademicErrorMessage, groupHafalanItemsByJilid, progressStatusToComplete } from '@/lib/academicAdapters';
import { deleteAvatar, getStorageErrorMessage, resolveAvatarUrl, uploadAvatar } from '@/lib/storageAdapters';

/**
 * SANTRI AUTHENTICATION FLOW DOCUMENTATION:
 *
 * 1. Login Trigger: Santri inputs `nama_panggilan` (as username) and `nomor_induk_qiroati` (as password) in LoginPage.jsx.
 * 2. Auth Context: LoginPage calls `signInWithUsername(username, password)` from SupabaseAuthContext.jsx.
 * 3. Auth Call: The context invokes the `signin-with-nomor-induk` Edge Function.
 * 4. Database Logic:
 *    - The function checks the `santri` table.
 *    - It first tries email + password (for Santri Dewasa).
 *    - It falls back to `nama_panggilan` + `nomor_induk_qiroati` (for Santri Anak/TPQ).
 *    - If successful, it generates and returns a custom JWT containing `user_metadata` (role: 'santri', kategori: 'Anak'/'Dewasa').
 * 5. Session Set: SupabaseAuthContext receives the tokens and calls `supabase.auth.setSession()`.
 * 6. Dashboard Access: SantriDashboard reads `user.id` from `useAuth()` to load their profile, attendance, and progress.
 */

// Helper functions for Youtube
const getYoutubeVideoId = (url) => {
  if (!url) return null; let videoId = null;
  try { const urlObj = new URL(url); if (urlObj.hostname === 'youtu.be') videoId = urlObj.pathname.slice(1); else if (urlObj.hostname.includes('youtube.com')) { if (urlObj.pathname.includes('/embed/')) videoId = urlObj.pathname.split('/embed/')[1].split('?')[0]; else videoId = urlObj.searchParams.get('v'); }
  } catch (e) { const embedMatch = url.match(/embed\/([^?&/\s]+)/); if (embedMatch) videoId = embedMatch[1]; }
  return videoId;
};
const getYoutubeThumbnail = (url) => getYoutubeVideoId(url) ? `https://img.youtube.com/vi/${getYoutubeVideoId(url)}/mqdefault.jpg` : "";
const getEmbedUrl = (url) => getYoutubeVideoId(url) ? `https://www.youtube.com/embed/${getYoutubeVideoId(url)}` : null;

// Helper function for Google Drive Embed extraction
const extractSrc = (iframeString) => {
    if (!iframeString) return null;
    const match = iframeString.match(/src=["'](.*?)["']/);
    return match ? match[1] : null;
};

const getGoogleDriveId = (embedCode) => {
    const src = extractSrc(embedCode);
    if (!src) return null;
    const match = src.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
};

const getGoogleDriveThumbnail = (embedCode) => {
    const id = getGoogleDriveId(embedCode);
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w640` : null;
};

const sessionTimes = {
  'Pagi': { start: '08:00' },
  'Siang': { start: '13:00' },
  'Sore': { start: '16:00' },
  'Malam': { start: '18:30' },
};

const getSessionStartTimestamp = (dateStr, sesiName) => {
    if (!sesiName || !sessionTimes[sesiName]) return null;
    const { start } = sessionTimes[sesiName];
    return new Date(`${dateStr}T${start}:00`).toISOString();
};

const HafalanSection = ({ title, items, hafalanData, isAdult }) => {
  const progressData = {};
  items.forEach(i => {
      progressData[i.item_name] = hafalanData.some(h =>
          (h.item_id === i.id || h.category === title) &&
          h.item_name === i.item_name &&
          progressStatusToComplete(h.status)
      );
  });

  const itemsByJilid = groupHafalanItemsByJilid(items);

  return (
    <Card className={cn("transition-all col-span-full", isAdult ? "bg-white/80 dark:bg-black/40 border-purple-500/30 backdrop-blur-sm text-gray-800 dark:text-white" : "bg-white dark:bg-[#112D4E] shadow-xl border-none")}>
        <CardHeader>
            <CardTitle className={cn("text-xl", isAdult ? "text-purple-700 dark:text-purple-300" : "text-[#3F72AF]")}>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                 {[1,2,3,4,5,6].map(jilid => (
                     <HafalanDisplay
                        key={jilid}
                        jilid={jilid}
                        items={itemsByJilid[jilid]}
                        isDraggable={false}
                        progressData={progressData}
                     />
                 ))}
             </div>
        </CardContent>
    </Card>
  );
};

const MurojaahRecorder = ({ santriId, hafalanItems, onSubmissionSuccess, isAdult }) => {
    const [selectedCategory, setSelectedCategory] = useState('Surat');
    const [selectedItem, setSelectedItem] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const categories = [...new Set(hafalanItems.map(i => i.category))];
    const filteredItems = hafalanItems.filter(i => i.category === selectedCategory).map(i => i.item_name);

    const handleSend = () => {
        if(!selectedItem) return;
        setIsUploading(true);
        setTimeout(async () => {
            let error = null;
            try {
                await createMurojaahSubmission({
                    santriId,
                    type: selectedCategory,
                    content: selectedItem,
                    userId: santriId
                });
            } catch (err) {
                error = err;
            }
            setIsUploading(false);
            if (error) {
                toast({ title: 'Gagal', description: getAcademicErrorMessage(error), variant: 'destructive'});
            } else {
                setSelectedItem('');
                toast({ title: 'Berhasil', description: 'Setoran hafalan berhasil dikirim!'});
                if (onSubmissionSuccess) onSubmissionSuccess();
            }
        }, 1000);
    };

    return (<Card className={cn("lg:col-span-1", isAdult ? "bg-white/80 dark:bg-black/40 border-purple-500/30 backdrop-blur-sm text-gray-800 dark:text-white" : "")}><CardHeader><CardTitle className={cn("flex items-center gap-2", isAdult ? "text-purple-700 dark:text-purple-300" : "text-primary")}><Mic className="w-6 h-6"/> Pojok Muroja'ah</CardTitle></CardHeader><CardContent className="space-y-4"><Select value={selectedCategory} onValueChange={setSelectedCategory}><SelectTrigger className={isAdult ? "bg-white dark:bg-black/50 border-gray-300 dark:border-purple-500/30 text-gray-900 dark:text-white" : ""}><SelectValue placeholder="Pilih Kategori" /></SelectTrigger><SelectContent>{categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select><Select value={selectedItem} onValueChange={setSelectedItem}><SelectTrigger className={isAdult ? "bg-white dark:bg-black/50 border-gray-300 dark:border-purple-500/30 text-gray-900 dark:text-white" : ""}><SelectValue placeholder="Pilih Hafalan" /></SelectTrigger><SelectContent>{filteredItems.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><div className="flex justify-center gap-4"><Button onClick={handleSend} size="lg" disabled={isUploading || !selectedItem} className={isAdult ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}>{isUploading ? 'Mengirim...' : <><Send className="w-4 h-4 mr-2"/> Kirim Setoran</>}</Button></div></CardContent></Card>);
};

const ClassmatesList = ({ classmates, todayAttendance }) => {
    return (
        <Card className="bg-white dark:bg-[#112D4E] shadow-xl border-none">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-[#112D4E] dark:text-white text-lg">
                    <Users className="w-5 h-5 text-blue-500" />
                    Manajemen Kelas & Absensi Hari Ini
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {classmates.length > 0 ? classmates.map(friend => {
                        const attendance = todayAttendance.find(a => a.user_id === friend.id);
                        const isPresent = !!attendance;
                        return (
                            <div key={friend.id} className={cn("flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-sm", isPresent ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700")}>
                                <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                                    <AvatarImage src={friend.foto_url} />
                                    <AvatarFallback>{friend.nama_lengkap.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate text-gray-800 dark:text-gray-200">{friend.nama_lengkap}</p>
                                    <p className="text-xs text-muted-foreground truncate">{friend.jilid}</p>
                                </div>
                                {isPresent ? (
                                    <div className="flex flex-col items-center text-green-600">
                                        <CheckCircleFull className="w-5 h-5" />
                                        <span className="text-[10px] font-bold">Hadir</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-gray-400">
                                        <div className="w-5 h-5 rounded-full border-2 border-dashed border-gray-300"></div>
                                        <span className="text-[10px]">Alpha</span>
                                    </div>
                                )}
                            </div>
                        );
                    }) : (
                        <p className="col-span-full text-center py-4 text-muted-foreground">Belum ada teman sekelas.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

const EditProfileDialog = ({ isOpen, onOpenChange, santri, onUpdate }) => {
    const [formData, setFormData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const photoInputRef = React.useRef(null);

    useEffect(() => {
        if (santri) setFormData(santri);
    }, [santri]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { path, signedUrl } = await uploadAvatar({ ownerType: 'santri', ownerId: santri.id, file });
            setFormData(prev => ({ ...prev, avatar_path: path, foto_url: signedUrl || prev.foto_url }));
            toast({ title: "Foto Berhasil Diupload", description: "Foto profil tersimpan di Storage dan tetap tampil setelah refresh." });
        } catch (error) {
            toast({ title: "Gagal Upload Foto", description: getStorageErrorMessage(error), variant: "destructive" });
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleDeletePhoto = async () => {
        setIsUploading(true);
        try {
            await deleteAvatar({ ownerType: 'santri', ownerId: santri.id });
            setFormData(prev => ({ ...prev, avatar_path: null, foto_url: '' }));
            toast({ title: "Foto Dihapus", description: "Foto profil Anda telah dihapus dari Storage." });
        } catch (error) {
            toast({ title: "Gagal Hapus Foto", description: getStorageErrorMessage(error), variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        const { nama_panggilan, password, points, jilid, sesi_mengaji, nomor_induk_qiroati, class: classObj, id_kelas, ...allowedData } = formData;
        const { error } = await supabase.from('santri').update(allowedData).eq('id', santri.id);
        setIsSaving(false);
        if (error) toast({ title: "Gagal", description: error.message, variant: "destructive" });
        else { toast({ title: "Berhasil", description: "Profil berhasil diperbarui." }); onUpdate(); onOpenChange(false); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Edit Profil Santri</DialogTitle><DialogDescription>Perbarui data detail santri.</DialogDescription></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <div className="col-span-full bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <Avatar className="w-24 h-24 border-4 border-white shadow-md"><AvatarImage src={formData.foto_url} /><AvatarFallback>{formData.nama_lengkap?.charAt(0)}</AvatarFallback></Avatar>
                            <div className="space-y-2 flex-1">
                                <h4 className="fontsemibold text-sm text-blue-800 dark:text-blue-300">Ganti Foto Profil</h4>
                                <div className="text-xs text-muted-foreground space-y-1"><p>Pastikan wajah Anda terlihat jelas.</p><p className="font-semibold text-orange-600">Maksimal ukuran file: 2 MB.</p></div>
                                <div className="flex flex-wrap gap-2 mt-2"><Button type="button" size="sm" variant="outline" onClick={() => photoInputRef.current?.click()} disabled={isUploading}><Upload className="w-4 h-4 mr-2" /> {isUploading ? 'Mengupload...' : 'Pilih Foto'}</Button><Button type="button" size="sm" variant="outline" onClick={handleDeletePhoto} disabled={isUploading || !formData.foto_url}>Hapus Foto</Button><input type="file" ref={photoInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} /></div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Nama Lengkap</label><Input name="nama_lengkap" value={formData.nama_lengkap || ''} onChange={handleChange} /></div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Nama Panggilan (Username)</label><Input value={formData.nama_panggilan || ''} disabled className="bg-muted" /></div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Tempat Lahir</label><Input name="tempat_lahir" value={formData.tempat_lahir || ''} onChange={handleChange} /></div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Tanggal Lahir</label><Input type="date" name="tanggal_lahir" value={formData.tanggal_lahir || ''} onChange={handleChange} /></div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Nama Ayah</label><Input name="nama_ayah" value={formData.nama_ayah || ''} onChange={handleChange} /></div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Nama Ibu</label><Input name="nama_ibu" value={formData.nama_ibu || ''} onChange={handleChange} /></div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">No. HP Wali</label><Input name="no_hp_ortu" value={formData.no_hp_ortu || ''} onChange={handleChange} /></div>
                    <div className="space-y-2 col-span-full"><label className="text-xs font-medium text-muted-foreground">Alamat</label><Textarea name="alamat" value={formData.alamat || ''} onChange={handleChange} /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SantriDashboard = ({ isAdult = false }) => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [santriData, setSantriData] = useState(null);
  const [hafalan, setHafalan] = useState([]);
  const [murojaahSubmissions, setMurojaahSubmissions] = useState([]);
  const [hafalanItems, setHafalanItems] = useState([]);
  const [videos, setVideos] = useState([]);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [isHafalanModalOpen, setIsHafalanModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [classmates, setClassmates] = useState([]);
  const [classmatesAttendance, setClassmatesAttendance] = useState([]);

  // Own Attendance modal state
  const [myAttendanceRecord, setMyAttendanceRecord] = useState(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  const initializeData = useCallback(async () => {
    if (!user) return;

    const [santriResult, itemsResult, videosResult] = await Promise.all([
        supabase.from('santri').select('*, class:current_class_id(*, guru:id_guru(nama))').eq('id', user.id).single(),
        fetchHafalanItems(),
        supabase.from('website_content').select('content').eq('key', 'hafalanVideos').maybeSingle()
    ]);

        if (santriResult.data) {
        const foto_url = await resolveAvatarUrl({
            ownerType: 'santri',
            ownerId: santriResult.data.id,
            avatarPath: santriResult.data.avatar_path,
            fallbackUrl: santriResult.data.foto_url,
        });
        const santri = { ...santriResult.data, foto_url, id_kelas: santriResult.data.current_class_id };
        setSantriData(santri);

        const todayStr = new Date().toLocaleDateString('en-CA');

        const [hafalanData, submissionsData, attendanceData] = await Promise.all([
            supabase.from('hafalan_progress').select('*').eq('santri_id', santri.id),
            supabase.from('murojaah_submissions').select('id,santri_id,type,content,recording_path,status,feedback,submitted_at,reviewed_at,created_at').eq('santri_id', santri.id).order('created_at', { ascending: false }),
            supabase.from('attendance').select('*').eq('attendance_date', todayStr).eq('user_id', santri.id)
        ]);

        if (hafalanData.data) setHafalan(hafalanData.data);
        if (submissionsData.data) setMurojaahSubmissions(submissionsData.data);
        if (attendanceData.data) {
            setDailyAttendance(attendanceData.data.map(a => a.user_id));
            if (attendanceData.data.length > 0) {
                setMyAttendanceRecord(attendanceData.data[0]);
            } else {
                setMyAttendanceRecord(null);
            }
        }

        if (santri.current_class_id) {
            const { data: classMemberships } = await supabase
                .from('class_memberships')
                .select('santri:santri_id(id,nama_lengkap,foto_url,avatar_path,jilid)')
                .eq('class_id', santri.current_class_id)
                .eq('status', 'active');
            const { data: friendsAttendance } = await supabase.from('attendance').select('*').eq('attendance_date', todayStr).eq('class_id', santri.current_class_id);
            if (classMemberships) {
                const classmatesWithAvatars = await Promise.all(classMemberships.map(async (item) => {
                    if (!item.santri) return null;
                    const friendAvatar = await resolveAvatarUrl({
                        ownerType: 'santri',
                        ownerId: item.santri.id,
                        avatarPath: item.santri.avatar_path,
                        fallbackUrl: item.santri.foto_url,
                    });
                    return { ...item.santri, foto_url: friendAvatar };
                }));
                setClassmates(classmatesWithAvatars.filter(Boolean));
            }
            if (friendsAttendance) setClassmatesAttendance(friendsAttendance);
        }
    }
    if (Array.isArray(itemsResult)) setHafalanItems(itemsResult);
    if (videosResult.data?.content) setVideos(videosResult.data.content);
    else setVideos([{ id: 1, title: 'Hafalan Jilid 1', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', jilid: 'Jilid 1' }]);
  }, [user]);

  useEffect(() => { initializeData(); }, [initializeData]);

  const openMyAttendanceModal = () => {
      setIsAttendanceModalOpen(true);
  };

  if (!santriData) return <div className="p-8 text-center text-muted-foreground">Memuat data santri...</div>;

  const jilidVideos = videos.reduce((acc, video) => { const jilid = video.jilid || 'Lainnya'; if (!acc[jilid]) acc[jilid] = []; acc[jilid].push(video); return acc; }, {});
  const hasAttendedToday = dailyAttendance.includes(santriData.id);

  const myStatus = myAttendanceRecord
    ? determineAttendanceStatus(myAttendanceRecord.check_in_timestamp, getSessionStartTimestamp(new Date().toLocaleDateString('en-CA'), santriData.sesi_mengaji || santriData.class?.sesi))
    : 'Tidak Hadir';

  const myAttendanceDetails = {
      id: myAttendanceRecord?.id,
      user_id: santriData.id,
      user_role: 'santri',
      status: myStatus,
      attendance_date: new Date().toLocaleDateString('en-CA'),
      sesi: santriData.sesi_mengaji || santriData.class?.sesi,
      class_id: santriData.id_kelas,
      checkInTimestamp: myAttendanceRecord?.check_in_timestamp,
      sessionStartTime: getSessionStartTimestamp(new Date().toLocaleDateString('en-CA'), santriData.sesi_mengaji || santriData.class?.sesi),
      lateMinutes: myAttendanceRecord ? calculateTimeDifference(myAttendanceRecord.check_in_timestamp, getSessionStartTimestamp(new Date().toLocaleDateString('en-CA'), santriData.sesi_mengaji || santriData.class?.sesi)) : 0
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <BirthdayGreeting user={santriData} type="Santri" />
        <h1 className="text-3xl md:text-4xl font-bold text-[#112D4E] dark:text-white mb-8 flex items-center justify-between font-cinzel">
            Dashboard Santri
        </h1>
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#112D4E] to-[#3F72AF] shadow-2xl text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>
            <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-center gap-8">
                <div className="relative group"><div className="absolute -inset-1 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-500 bg-white"></div><Avatar className="w-32 h-32 md:w-40 md:h-40 border-4 border-white/20 shadow-xl relative"><AvatarImage src={santriData.foto_url} className="object-cover"/><AvatarFallback className="text-4xl font-bold text-[#112D4E] bg-white">{santriData.nama_lengkap.charAt(0)}</AvatarFallback></Avatar></div>
                <div className="flex-grow text-center md:text-left space-y-2">
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight">{santriData.nama_lengkap}</h2>
                    <p className="text-lg text-blue-100 font-medium flex items-center justify-center md:justify-start gap-2"><Users className="w-5 h-5"/> {santriData.class?.nama_kelas || 'Belum Masuk Kelas'}</p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
                        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10"><p className="text-[10px] uppercase font-bold text-blue-200">Jilid</p><p className="text-xl font-bold">{santriData.jilid || '-'}</p></div>
                        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10"><p className="text-[10px] uppercase font-bold text-blue-200">Poin</p><p className="text-xl font-bold flex items-center justify-center gap-1"><Star className="w-4 h-4 fill-yellow-400 text-yellow-400"/>{santriData.points || 0}</p></div>
                        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10"><p className="text-[10px] uppercase font-bold text-blue-200">Sesi</p><p className="text-xl font-bold">{santriData.sesi_mengaji || '-'}</p></div>
                    </div>
                </div>
                <div className="flex flex-col gap-3 min-w-[160px]">
                    <Button onClick={() => setIsInfoModalOpen(true)} variant="outline" className="bg-white/10 hover:bg-white/20 border-white/20 text-white backdrop-blur-sm border-0"><Edit className="w-4 h-4 mr-2" /> Edit Profil</Button>
                    <div className={cn("px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-3 shadow-md", hasAttendedToday ? "bg-green-500 text-white" : "bg-slate-700 text-white")}>
                       <AttendanceStatusIcon status={myStatus} onClick={openMyAttendanceModal} className="hover:scale-110" />
                       <div className="flex flex-col text-left leading-tight">
                           <span className="text-[10px] uppercase opacity-80">Absen Hari Ini</span>
                           <span>{hasAttendedToday ? myStatus : "Belum Absen"}</span>
                       </div>
                    </div>
                </div>
            </div>
        </div>
        <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-white dark:bg-[#112D4E] p-1 rounded-lg"><TabsTrigger value="overview">Ringkasan</TabsTrigger><TabsTrigger value="attendance">Rekap Absensi</TabsTrigger><TabsTrigger value="payments">Riwayat Pembayaran</TabsTrigger></TabsList>

            <TabsContent value="overview">
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                     <div className="lg:col-span-2 space-y-8">
                         <ClassmatesList classmates={classmates} todayAttendance={classmatesAttendance} />
                         <div className="space-y-6">
                            <HafalanSection title="Doa" items={hafalanItems.filter(i => i.category === 'Doa')} hafalanData={hafalan} isAdult={false} />
                            <HafalanSection title="Sholat" items={hafalanItems.filter(i => i.category === 'Sholat')} hafalanData={hafalan} isAdult={false} />
                            <HafalanSection title="Surat" items={hafalanItems.filter(i => i.category === 'Surat')} hafalanData={hafalan} isAdult={false} />
                         </div>
                     </div>
                     <div className="lg:col-span-1 space-y-8">
                         <MurojaahRecorder santriId={santriData.id} hafalanItems={hafalanItems} onSubmissionSuccess={() => initializeData()} isAdult={false} />
                         <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl border-none text-white overflow-hidden relative group cursor-pointer" onClick={() => setIsHafalanModalOpen(true)}>
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                            <CardContent className="p-8 flex flex-col items-center justify-center text-center relative z-10 h-full min-h-[250px]">
                                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><PlayCircle className="w-8 h-8 text-white" /></div>
                                <h2 className="text-2xl font-bold mb-2">Video Hafalan</h2><p className="text-indigo-100 text-sm">Tonton video panduan hafalan sesuai jilid Anda untuk belajar lebih mudah.</p>
                            </CardContent>
                         </Card>
                     </div>
                </div>
            </TabsContent>

            <TabsContent value="attendance">
                <SantriAbsensiRecap />
            </TabsContent>

            <TabsContent value="payments">
                <SantriPaymentHistory />
            </TabsContent>
        </Tabs>

        <EditProfileDialog isOpen={isInfoModalOpen} onOpenChange={setIsInfoModalOpen} santri={santriData} onUpdate={initializeData} />

        <Dialog open={isHafalanModalOpen} onOpenChange={setIsHafalanModalOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Video Hafalan Santri</DialogTitle><DialogDescription>Pilih kategori video hafalan yang ingin ditonton.</DialogDescription></DialogHeader>
                <Tabs defaultValue="Jilid 1" className="w-full">
                    <div className="overflow-x-auto pb-2"><TabsList>{Object.keys(jilidVideos).sort().map(jilid => (<TabsTrigger key={jilid} value={jilid}>{jilid}</TabsTrigger>))}</TabsList></div>
                    {Object.keys(jilidVideos).sort().map(jilid => (
                        <TabsContent key={jilid} value={jilid}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto p-1">
                                {jilidVideos[jilid].map(video => (
                                    <div key={video.id} onClick={() => setPlayingVideo(video)} className="cursor-pointer group space-y-2">
                                        <div className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                            {video.google_drive_embed ? (<div className="w-full h-full bg-indigo-50 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden"><div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center"><div className="bg-white dark:bg-black/20 p-3 rounded-full mb-2"><Video className="w-8 h-8 text-indigo-500" /></div><span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">Google Drive Video</span></div>{getGoogleDriveThumbnail(video.google_drive_embed) && (<img src={getGoogleDriveThumbnail(video.google_drive_embed)} alt={video.title} className="w-full h-full object-cover relative z-10" onError={(e) => e.target.style.display = 'none'} />)}<div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center z-20 transition-colors"><PlayCircle className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" /></div></div>) : (<><img src={getYoutubeThumbnail(video.url)} alt={video.title} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><PlayCircle className="w-12 h-12 text-white/80" /></div></>)}
                                        </div>
                                        <p className="font-semibold text-center text-sm truncate px-2" title={video.title}>{video.title}</p>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </DialogContent>
        </Dialog>
        {playingVideo && (<Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}><DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none"><div className="aspect-video w-full h-full relative">{playingVideo.google_drive_embed ? (<iframe className="w-full h-full" src={extractSrc(playingVideo.google_drive_embed)} title={playingVideo.title} allow="autoplay" allowFullScreen></iframe>) : (<iframe className="w-full h-full" src={getEmbedUrl(playingVideo.url)} title={playingVideo.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>)}</div></DialogContent></Dialog>)}

        <AttendanceDetailsModal isOpen={isAttendanceModalOpen} onClose={() => setIsAttendanceModalOpen(false)} details={myAttendanceDetails} onSuccess={initializeData} />
    </div>
  );
};
export default SantriDashboard;
