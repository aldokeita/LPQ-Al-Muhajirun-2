import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { MessageCircle, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { generateWhatsAppLink, resolveWhatsAppGroupLink } from '@/utils/whatsappMessages';
import { toast } from '@/components/ui/use-toast';
import { fetchWhatsAppTemplates, renderWhatsAppTemplate } from '@/lib/whatsappTemplateAdapters';
import { fetchWhatsAppGroupLinks, getWhatsAppGroupLink } from '@/lib/whatsappGroupLinkAdapters';
import { SANTRI_PTPT_LABEL } from '@/lib/santriJilid';

const JilidChangeModal = ({ isOpen, onClose, santri, direction, currentJilid, nextJilid, onConfirm, kategori = 'Anak' }) => {
    const [message, setMessage] = useState('');
    const [hasSiblings, setHasSiblings] = useState(false);
    const [isLoadingLink, setIsLoadingLink] = useState(false);

    const isCategoryTransition = nextJilid === SANTRI_PTPT_LABEL;
    useEffect(() => {
        if (isOpen && santri) {
            checkSiblings();
            fetchGroupLinkAndGenerateMessage();
        }
    }, [isOpen, santri, direction, nextJilid, kategori]);

    const checkSiblings = async () => {
        if (!santri?.no_hp_ortu) return;
        const { data } = await supabase
            .from('santri')
            .select('id')
            .eq('no_hp_ortu', santri.no_hp_ortu)
            .eq('status', 'Aktif')
            .neq('id', santri.id);

        setHasSiblings(data && data.length > 0);
    };

    const fetchGroupLinkAndGenerateMessage = async () => {
        setIsLoadingLink(true);
        try {
            const [groupLinks, templates] = await Promise.all([
                fetchWhatsAppGroupLinks(),
                fetchWhatsAppTemplates(),
            ]);
            const groupLink = getWhatsAppGroupLink(nextJilid, groupLinks);
            generateMessage(groupLink, templates, groupLinks);
        } catch (err) {
            toast({ title: 'Gagal memuat konfigurasi WhatsApp', description: err.message || 'Link grup belum dapat dimuat.', variant: 'destructive' });
        } finally {
            setIsLoadingLink(false);
        }
    };

    const generateMessage = (groupLink, templates, groupLinks) => {
        const template = direction === 'up' ? templates.jilidPromotion : templates.jilidDemotion;
        setMessage(renderWhatsAppTemplate(template, {
            nama_santri: santri.nama_lengkap,
            jilid_lama: currentJilid,
            jilid_baru: nextJilid,
            link_grup: resolveWhatsAppGroupLink(nextJilid, groupLink, groupLinks),
            nama_lembaga: 'LPQ Al-Muhajirun',
            kategori,
        }));
    };

    const handleSendWA = () => {
        if (!santri.no_hp_ortu) {
            toast({ title: "Gagal", description: "Nomor HP Orang Tua tidak tersedia.", variant: "destructive" });
            return;
        }
        
        const url = generateWhatsAppLink(santri.no_hp_ortu, message);
        window.open(url, '_blank');
        toast({ title: "Berhasil", description: "Membuka WhatsApp..." });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {direction === 'up' ? <ChevronRight className="text-green-500"/> : <AlertTriangle className="text-orange-500"/>}
                        {isCategoryTransition ? 'Konfirmasi Kenaikan ke Santri PTPT' : <>Konfirmasi {direction === 'up' ? 'Kenaikan' : 'Penurunan'} Jilid {kategori === 'Dewasa' ? '(Dewasa)' : ''}</>}
                    </DialogTitle>
                    <DialogDescription>
                        {isCategoryTransition
                            ? <>Memindahkan program santri dari <strong>{currentJilid}</strong> ke <strong>{SANTRI_PTPT_LABEL}</strong>. Kelas aktif akan ditutup melalui proses migrasi kategori.</>
                            : <>Mengubah jilid dari <strong>{currentJilid}</strong> ke <strong>{nextJilid}</strong>.</>}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="wa-message">Pesan WhatsApp</Label>
                            {isLoadingLink && <span className="text-xs text-muted-foreground animate-pulse">Mengambil link grup...</span>}
                        </div>
                        <Textarea 
                            id="wa-message" 
                            value={message} 
                            onChange={(e) => setMessage(e.target.value)} 
                            className="h-64 font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">Anda dapat mengedit pesan di atas sebelum mengirimnya.</p>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">Batal</Button>
                    <Button 
                        variant="outline" 
                        className="w-full sm:w-auto border-green-600 text-green-600 hover:bg-green-50" 
                        onClick={handleSendWA}
                        disabled={!santri?.no_hp_ortu || isLoadingLink}
                    >
                        <MessageCircle className="w-4 h-4 mr-2"/>
                        {santri?.no_hp_ortu ? 'Kirim WA' : 'No. HP Kosong'}
                    </Button>
                    <Button onClick={onConfirm} className="w-full sm:w-auto">
                        <Check className="w-4 h-4 mr-2"/>
                        Konfirmasi & Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default JilidChangeModal;
