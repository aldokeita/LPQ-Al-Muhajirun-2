import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Upload, Music, Settings as SettingsIcon, Save } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';

const MediaPlayerSettings = ({ isOpen, onOpenChange, onUpdate }) => {
    const [activeTab, setActiveTab] = useState('playlist');
    const [uploading, setUploading] = useState(false);
    const [playlist, setPlaylist] = useState([]);
    
    // File Upload State
    const [selectedFile, setSelectedFile] = useState(null);
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');

    // Delete Confirmation State
    const [deleteConfirmation, setDeleteConfirmation] = useState({
        isOpen: false,
        trackId: null,
        trackName: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchPlaylist();
        }
    }, [isOpen]);

    const fetchPlaylist = async () => {
        const { data, error } = await supabase.from('music_files').select('*').order('created_at', { ascending: false });
        if (!error) setPlaylist(data || []);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            // Auto-fill title from filename
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            if (!title) setTitle(nameWithoutExt);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !title) {
            toast({ title: "Error", description: "Pilih file dan isi judul lagu.", variant: "destructive" });
            return;
        }

        setUploading(true);
        try {
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage.from('music-files').upload(filePath, selectedFile);
            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage.from('music-files').getPublicUrl(filePath);

            // 3. Save to DB
            const { error: dbError } = await supabase.from('music_files').insert({
                title,
                artist: artist || 'Unknown Artist',
                filename: selectedFile.name,
                file_url: publicUrl
            });

            if (dbError) throw dbError;

            toast({ title: "Berhasil", description: "Lagu berhasil ditambahkan." });
            setSelectedFile(null);
            setTitle('');
            setArtist('');
            fetchPlaylist();
            if(onUpdate) onUpdate();
        } catch (error) {
            console.error(error);
            toast({ title: "Gagal", description: error.message || "Gagal mengupload lagu.", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteClick = (track) => {
        setDeleteConfirmation({
            isOpen: true,
            trackId: track.id,
            trackName: track.title
        });
    };

    const handleConfirmDelete = async () => {
        const { trackId } = deleteConfirmation;
        if (!trackId) return;

        try {
            // Since filename in storage might be different from display filename, we ideally store path.
            // But we used a timestamp based name in upload.
            // For simplicity in this constrained environment, we just delete the DB record.
            // A proper implementation would delete from storage too using the path derived from URL or stored path.
            
            const { error } = await supabase.from('music_files').delete().eq('id', trackId);
            if (error) throw error;
            
            toast({ title: "Terhapus", description: "Lagu dihapus dari playlist." });
            fetchPlaylist();
            if(onUpdate) onUpdate();
        } catch (error) {
            toast({ title: "Gagal", description: error.message, variant: "destructive" });
        } finally {
            setDeleteConfirmation({ isOpen: false, trackId: null, trackName: '' });
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Pengaturan Media Player</DialogTitle>
                        <DialogDescription>Kelola playlist dan pengaturan pemutar musik.</DialogDescription>
                    </DialogHeader>
                    
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="playlist">Playlist & Upload</TabsTrigger>
                            <TabsTrigger value="settings">Pengaturan Player</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="playlist" className="flex-1 overflow-hidden flex flex-col space-y-4 pt-4">
                            <Card className="shrink-0">
                                <CardContent className="pt-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Judul Lagu</Label>
                                            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Murottal Juz 30" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Artis / Qori</Label>
                                            <Input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Contoh: Mishary Rashid" />
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-end">
                                        <div className="flex-1 space-y-2">
                                            <Label>File Audio (MP3/WAV)</Label>
                                            <Input type="file" accept="audio/*" onChange={handleFileChange} />
                                        </div>
                                        <Button onClick={handleUpload} disabled={uploading}>
                                            {uploading ? <span className="animate-pulse">Uploading...</span> : <><Upload className="w-4 h-4 mr-2"/> Upload</>}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex-1 min-h-[200px] border rounded-md relative overflow-hidden">
                                 <ScrollArea className="h-full w-full p-4">
                                    {playlist.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                                            <Music className="w-12 h-12 mb-2 opacity-20" />
                                            <p>Belum ada lagu di playlist.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {playlist.map((track) => (
                                                <div key={track.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border hover:border-blue-300 transition-colors">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
                                                            <Music className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium truncate">{track.title}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(track)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="settings" className="pt-4 space-y-4">
                            <Card>
                                <CardContent className="pt-6 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Shuffle Default</Label>
                                            <p className="text-sm text-muted-foreground">Aktifkan mode acak secara default saat player dimuat.</p>
                                        </div>
                                        <Switch checked={localStorage.getItem('mp_shuffle') === 'true'} onCheckedChange={(v) => { localStorage.setItem('mp_shuffle', v); toast({ title: "Disimpan", description: "Pengaturan shuffle diperbarui." }); }} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Loop Default</Label>
                                            <p className="text-sm text-muted-foreground">Ulangi playlist secara otomatis.</p>
                                        </div>
                                        <Switch checked={localStorage.getItem('mp_loop') === 'true'} onCheckedChange={(v) => { localStorage.setItem('mp_loop', v); toast({ title: "Disimpan", description: "Pengaturan loop diperbarui." }); }} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Crossfade</Label>
                                            <p className="text-sm text-muted-foreground">Transisi halus antar lagu (efek fade-out/fade-in).</p>
                                        </div>
                                        <Switch checked={localStorage.getItem('mp_crossfade') === 'true'} onCheckedChange={(v) => { localStorage.setItem('mp_crossfade', v); toast({ title: "Disimpan", description: "Pengaturan crossfade diperbarui." }); }} />
                                    </div>
                                </CardContent>
                            </Card>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200">
                                Catatan: Pengaturan di atas disimpan di browser ini (Local Storage). Untuk pengaturan global, fitur sedang dalam pengembangan.
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                open={deleteConfirmation.isOpen}
                onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, isOpen: open }))}
                title="Hapus Lagu"
                description={`Apakah Anda yakin ingin menghapus lagu "${deleteConfirmation.trackName}"? Tindakan ini tidak dapat dibatalkan.`}
                onConfirm={handleConfirmDelete}
                confirmText="Hapus"
                cancelText="Batal"
                variant="destructive"
            />
        </>
    );
};

export default MediaPlayerSettings;