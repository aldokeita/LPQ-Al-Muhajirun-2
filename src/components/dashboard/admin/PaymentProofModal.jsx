
import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Printer, MessageSquare } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from '@/components/ui/use-toast';
import QRCode from 'qrcode';

const PaymentProofModal = ({ isOpen, onClose, payment }) => {
    const receiptRef = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [qrCodeDataURL, setQrCodeDataURL] = useState('');

    useEffect(() => {
        if (isOpen && payment) {
            const qrCodeLoginUrl = `https://lpqalmuhajirun.id/login`;
            QRCode.toDataURL(qrCodeLoginUrl, { width: 120, margin: 1 }, (err, url) => {
                if (!err) setQrCodeDataURL(url);
            });
        }
    }, [isOpen, payment]);

    const handleDownload = async () => {
        if (!receiptRef.current || !payment) return;
        setIsGenerating(true);
        try {
            const dataUrl = await toPng(receiptRef.current, { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: 2 });
            const link = document.createElement('a');
            const santriName = payment.santri?.nama_lengkap.replace(/\s+/g, '_') || 'Santri';
            const dateStr = new Date(payment.tanggal_pembayaran).toLocaleDateString('id-ID').replace(/\//g, '-');
            link.download = `Bukti-Pembayaran-${santriName}-${dateStr}.png`;
            link.href = dataUrl;
            link.click();
            toast({ title: "Berhasil", description: "Bukti pembayaran berhasil diunduh." });
        } catch (err) {
            console.error('Error generating image:', err);
            toast({ title: "Gagal", description: "Gagal membuat gambar bukti pembayaran.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendWhatsApp = () => {
        if (!payment || !payment.santri?.no_hp_ortu) {
            toast({ title: "Gagal", description: "Nomor HP Wali Santri tidak ditemukan.", variant: "destructive" });
            return;
        }

        let phoneNumber = payment.santri.no_hp_ortu.replace(/\D/g, '');
        if (phoneNumber.startsWith('0')) phoneNumber = '62' + phoneNumber.substring(1);
        else if (!phoneNumber.startsWith('62')) phoneNumber = '62' + phoneNumber;
        
        if (phoneNumber.length < 10) {
            toast({ title: "Gagal", description: "Format nomor HP tidak valid.", variant: "destructive" });
            return;
        }

        const santriName = payment.santri.nama_lengkap;
        const amount = payment.jumlah.toLocaleString('id-ID');
        const date = new Date(payment.tanggal_pembayaran).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
        const items = payment.catatan || 'Pembayaran Administrasi';
        const method = payment.metode_pembayaran;

        const message = `Assalamualaikum Wr. Wb.
Ayah/Bunda dari *${santriName}*

Terima kasih telah melakukan pembayaran di LPQ Al-Muhajirun.
Berikut rincian pembayaran yang telah kami terima:

📋 *Rincian:* ${items}
💰 *Nominal:* Rp ${amount}
📅 *Tanggal:* ${date}
💳 *Metode:* ${method}
✅ *Status:* LUNAS

Terima kasih atas kepercayaannya. Semoga menjadi amal jariyah dan berkah untuk keluarga.
        
Salam,
*Admin LPQ Al-Muhajirun*`;

        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        toast({ title: "Membuka WhatsApp", description: "Pesan telah disiapkan." });
    };

    if (!payment) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[480px] p-0 overflow-hidden bg-transparent border-none shadow-none">
                <DialogTitle className="sr-only">Bukti Pembayaran</DialogTitle>
                <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
                    <div ref={receiptRef} className="p-6 bg-white text-slate-800 relative font-sans">
                        {/* Header */}
                        <div className="text-center pb-4 mb-4 border-b border-dashed border-slate-300 relative z-10">
                            <img src="/logo.png" alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain"/>
                            <h3 className="font-bold text-xl text-primary tracking-tight font-poppins">LPQ AL-MUHAJIRUN</h3>
                            <p className="text-xs text-slate-500 mt-1">Jl. R. Suprapto No. 195 Kel. Kemalaraja Baturaja Timur</p>
                            <p className="text-xs text-slate-500">Telp: 0856-0902-5238</p>
                        </div>
                        
                        {/* Watermark LUNAS */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none select-none">
                            <div className="border-4 border-red-500 text-red-500 rounded-lg px-8 py-3 text-5xl font-bold -rotate-12 opacity-15 whitespace-nowrap">
                                LUNAS
                            </div>
                        </div>

                        {/* Meta Info */}
                        <div className="flex justify-between text-xs mb-4 text-slate-600 bg-slate-50 p-3 rounded-lg relative z-10">
                            <div className="space-y-1">
                                <p>Tgl: <span className="font-semibold text-slate-900">{new Date(payment.tanggal_pembayaran).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                                <p>Jam: <span className="font-semibold text-slate-900">{new Date(payment.tanggal_pembayaran).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span></p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p>Metode: <span className="font-semibold text-slate-900 uppercase">{payment.metode_pembayaran}</span></p>
                                <p>Ref: <span className="font-mono">{payment.transaction_id ? payment.transaction_id.substring(0,8) : payment.id.substring(0,8)}</span></p>
                            </div>
                        </div>

                        {/* Student Info */}
                        <div className="mb-4 relative z-10">
                            <p className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Diterima Dari:</p>
                            <p className="text-sm font-bold text-slate-900">{payment.santri?.nama_lengkap}</p>
                        </div>
                        
                        {/* Items */}
                        <div className="space-y-3 mb-6 relative z-10">
                            <div className="border-t border-slate-200 pt-3"></div>
                            <div className="flex justify-between text-sm py-1">
                                <span className="text-slate-700 flex-1 font-medium">{payment.catatan || 'Pembayaran Lainnya'}</span>
                                <span className="font-bold text-slate-900">Rp {payment.jumlah.toLocaleString('id-ID')}</span>
                            </div>
                            {payment.bulan && payment.tahun && (
                                <div className="text-xs text-slate-500 pl-2">
                                    Tagihan: {payment.bulan} {payment.tahun}
                                </div>
                            )}
                            <div className="border-t border-slate-200 pt-3"></div>
                        </div>

                        {/* Total */}
                        <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-100 mb-6 relative z-10">
                            <span className="text-sm font-bold text-green-800">TOTAL BAYAR</span>
                            <span className="text-xl font-black text-green-900">Rp {payment.jumlah.toLocaleString('id-ID')}</span>
                        </div>

                        {/* Footer */}
                        <div className="text-center relative z-10 flex flex-col items-center">
                             <div className="bg-white p-1 inline-block rounded-lg shadow-sm border border-slate-100 mb-2">
                                {qrCodeDataURL && <img src={qrCodeDataURL} alt="QR Code" className="w-20 h-20"/>}
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Terima Kasih</p>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 flex justify-center gap-2 border-t flex-wrap">
                        <Button variant="outline" size="sm" onClick={onClose}>Tutup</Button>
                        <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50" onClick={handleSendWhatsApp}>
                            <MessageSquare className="mr-2 h-4 w-4"/> Kirim WA
                        </Button>
                        <Button size="sm" onClick={handleDownload} disabled={isGenerating}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                            Simpan Bukti
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PaymentProofModal;
