import { supabase } from '../lib/customSupabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableCell,
    TableRow,
    WidthType,
    AlignmentType,
    BorderStyle,
    HeadingLevel,
    Footer,
    PageNumber,
    ShadingType
} from 'docx';
import {
    fetchCharacterAssessmentItems,
    fetchSantriCharacterScores,
    fetchSantriCharacterStrengths,
    DEVELOPMENT_SCORE_OPTIONS
} from '../lib/academicAdapters';

// Helper for Wali Santri priority: nama_ibu -> nama_ayah -> nama_wali -> '-'
export const getWaliSantriName = (santri) => {
    if (!santri) return '-';
    return (santri.nama_ibu && santri.nama_ibu.trim())
        ? santri.nama_ibu.trim()
        : (santri.nama_ayah && santri.nama_ayah.trim())
            ? santri.nama_ayah.trim()
            : (santri.nama_wali && santri.nama_wali.trim())
                ? santri.nama_wali.trim()
                : '-';
};

// Helper for Hafalan item name fallback chain
export const getHafalanItemName = (item) => {
    if (!item) return '-';
    return item.item_name || item.display_name || item.nama_item || item.title || '-';
};

export const calculateAttendanceData = async (santriId, startDate, endDate) => {
    try {
        let query = supabase.from('attendance').select('status, attendance_date, check_in_timestamp, class_id').eq('user_id', santriId);

        if (startDate) query = query.gte('attendance_date', startDate);
        if (endDate) query = query.lte('attendance_date', endDate);

        const { data, error } = await query;
        if (error) throw error;

        const totalPresent = (data || []).filter(d => (d.status || '').toLowerCase() === 'hadir').length;
        const totalLate = (data || []).filter(d => (d.status || '').toLowerCase() === 'terlambat').length;
        const totalAbsent = (data || []).filter(d => ['alpha', 'tidak hadir'].includes((d.status || '').toLowerCase())).length;
        const totalPermit = (data || []).filter(d => ['izin', 'sakit'].includes((d.status || '').toLowerCase())).length;

        const validPresence = totalPresent + totalLate;
        const totalDays = validPresence + totalAbsent + totalPermit;

        const attendancePercentage = totalDays > 0 ? Math.round((validPresence / totalDays) * 100) : 0;

        return {
            totalPresent,
            totalLate,
            totalAbsent,
            totalPermit,
            totalDays,
            attendancePercentage,
            attendanceData: data || []
        };
    } catch (error) {
        console.error("Error calculating attendance:", error);
        return {
            totalPresent: 0,
            totalLate: 0,
            totalAbsent: 0,
            totalPermit: 0,
            totalDays: 0,
            attendancePercentage: 0,
            attendanceData: []
        };
    }
};

export const getHafalanProgressData = async (santriId) => {
    try {
        const { data: santri, error: santriError } = await supabase
            .from('santri')
            .select('kategori')
            .eq('id', santriId)
            .single();
        if (santriError) throw santriError;
        const programScope = String(santri?.kategori || '').toUpperCase() === 'PTPT' ? 'PTPT' : 'TPQ';

        const [itemsRes, progressRes] = await Promise.all([
            supabase.from('hafalan_items').select('id,program_scope,category,jilid,item_name,item_order,is_active,created_at').eq('program_scope', programScope).eq('is_active', true).order('item_order'),
            supabase.from('hafalan_progress').select('id,santri_id,item_id,category,item_name,status,score,created_at,updated_at').eq('santri_id', santriId)
        ]);

        if (itemsRes.error) throw itemsRes.error;
        if (progressRes.error) throw progressRes.error;

        const progressByItemId = new Map((progressRes.data || []).filter(item => item.item_id).map(item => [item.item_id, item]));
        const progressByName = new Map((progressRes.data || []).map(item => [`${item.category}-${item.item_name}`, item]));

        const rawAllItems = (itemsRes.data || []).map(item => {
            const progress = progressByItemId.get(item.id) || progressByName.get(`${item.category}-${item.item_name}`);
            const resolvedName = getHafalanItemName(item);
            return {
                ...item,
                ...progress,
                id: progress?.id || item.id,
                item_id: item.id,
                category: item.category,
                item_name: resolvedName,
                display_name: resolvedName,
                is_completed: progress?.status === 'lulus',
                hafal: progress?.status === 'lulus',
                created_at: progress?.updated_at || progress?.created_at || item.created_at
            };
        });

        // Structured Category Order: Doa -> Sholat -> Surat -> Tahfizh
        const categoryOrderMap = { 'Doa': 1, 'Sholat': 2, 'Surat': 3, 'Tahfizh': 4 };
        const allItems = rawAllItems.sort((a, b) => {
            const orderA = categoryOrderMap[a.category] || 99;
            const orderB = categoryOrderMap[b.category] || 99;
            if (orderA !== orderB) return orderA - orderB;
            return (a.item_order || 0) - (b.item_order || 0);
        });

        const doa = allItems.filter(d => d.category === 'Doa');
        const sholat = allItems.filter(d => d.category === 'Sholat');
        const surat = allItems.filter(d => d.category === 'Surat');
        const tahfizh = allItems.filter(d => d.category === 'Tahfizh');

        const getCompleted = (arr) => arr.filter(d => d.is_completed).length;

        return {
            doa: { total: doa.length, completed: getCompleted(doa), items: doa },
            sholat: { total: sholat.length, completed: getCompleted(sholat), items: sholat },
            surat: { total: surat.length, completed: getCompleted(surat), items: surat },
            tahfizh: { total: tahfizh.length, completed: getCompleted(tahfizh), items: tahfizh },
            programScope,
            totalCompleted: getCompleted(allItems),
            overallProgress: allItems.length > 0 ? Math.round((getCompleted(allItems) / allItems.length) * 100) : 0,
            allItems
        };
    } catch (error) {
        console.error("Error fetching hafalan progress:", error);
        return {
            doa: { total: 0, completed: 0, items: [] },
            sholat: { total: 0, completed: 0, items: [] },
            surat: { total: 0, completed: 0, items: [] },
            tahfizh: { total: 0, completed: 0, items: [] },
            programScope: 'TPQ',
            totalCompleted: 0,
            overallProgress: 0,
            allItems: []
        };
    }
};

export const getPointsData = async (santriId, startDate, endDate) => {
    try {
        const { data, error } = await supabase.from('santri').select('points').eq('id', santriId).single();
        if (error) throw error;

        return {
            totalPoints: data?.points || 0,
            pointsBreakdown: []
        };
    } catch (error) {
        console.error("Error fetching points:", error);
        return { totalPoints: 0, pointsBreakdown: [] };
    }
};

export const getCharacterAssessmentData = async (santriId) => {
    try {
        const [items, scores, strengths] = await Promise.all([
            fetchCharacterAssessmentItems(),
            fetchSantriCharacterScores(santriId),
            fetchSantriCharacterStrengths(santriId)
        ]);

        const scoreMap = new Map((scores || []).map(s => [s.item_id, Number(s.score)]));
        const selectedStrengths = (strengths || []).map(s => s.strength_key);

        const assessedItems = (items || []).map(item => {
            const score = scoreMap.get(item.id) || 3; // Default 3 (BSH) if unrated
            const option = DEVELOPMENT_SCORE_OPTIONS.find(o => o.score === score) || DEVELOPMENT_SCORE_OPTIONS[2];
            return {
                id: item.id,
                item_order: item.item_order,
                item_name: item.item_name,
                score,
                code: option.code,
                label: option.label,
                tone: option.tone
            };
        });

        const scoredValues = assessedItems.map(i => i.score);
        const avgScore = scoredValues.length > 0 ? scoredValues.reduce((a, b) => a + b, 0) / scoredValues.length : 0;
        const avgPercent = Math.round((avgScore / 4) * 100);

        return {
            items: assessedItems,
            strengths: selectedStrengths,
            avgScore: parseFloat(avgScore.toFixed(1)),
            avgPercent,
            totalItems: assessedItems.length
        };
    } catch (error) {
        console.error("Error fetching character assessment data:", error);
        return { items: [], strengths: [], avgScore: 0, avgPercent: 0, totalItems: 0 };
    }
};

// Calculate combined total report score (Kehadiran 34%, Hafalan 33%, Karakter 33%)
export const calculateOverallReportScore = (attPercent, hafalanPercent, charPercent) => {
    return Math.round((attPercent * 0.34) + (hafalanPercent * 0.33) + (charPercent * 0.33));
};

export const generateRaporPDF = async (santriData, attendanceData, hafalanData, pointsData, periodText, characterData = null) => {
    if (!characterData) {
        characterData = await getCharacterAssessmentData(santriData.id);
    }

    const waliName = getWaliSantriName(santriData);
    const overallScore = calculateOverallReportScore(
        attendanceData.attendancePercentage,
        hafalanData.overallProgress,
        characterData.avgPercent
    );

    return new Promise((resolve) => {
        const doc = new jsPDF('p', 'mm', 'a4');

        // --- Colors ---
        const royalBlueHeader = [29, 78, 216]; // #1D4ED8
        const goldAccent = [245, 158, 11];     // #F59E0B
        const secondaryDark = [30, 41, 59];    // Slate 800
        const successColor = [16, 185, 129];   // Emerald
        const warningColor = [245, 158, 11];   // Amber
        const dangerColor = [239, 68, 68];     // Rose

        // --- Header Section Banner (Royal Blue) ---
        doc.setFillColor(...royalBlueHeader);
        doc.rect(0, 0, 210, 42, 'F');

        // Header Text & Gold Accent
        doc.setFontSize(20);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text("RAPOR SANTRI LPQ AL-MUHAJIRUN", 105, 18, { align: "center" });

        doc.setFontSize(11);
        doc.setTextColor(...goldAccent);
        doc.setFont('helvetica', 'bold');
        doc.text("Laporan Capaian Akademik & Pembentukan Karakter Santri", 105, 26, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(226, 232, 240);
        doc.setFont('helvetica', 'normal');
        doc.text(`Periode Evaluasi: ${periodText}`, 105, 34, { align: "center" });

        // --- Student Biodata Section ---
        doc.setTextColor(...secondaryDark);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text("BIODATA SANTRI", 15, 52);

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.5);
        doc.line(15, 54, 195, 54);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        // Left Column
        doc.text(`Nama Lengkap`, 15, 62);
        doc.setFont('helvetica', 'bold');
        doc.text(`: ${santriData.nama_lengkap}`, 52, 62);
        doc.setFont('helvetica', 'normal');

        doc.text(`Jilid / Tingkat`, 15, 69);
        doc.text(`: ${santriData.jilid || '-'} (${santriData.kategori || 'Anak'})`, 52, 69);

        doc.text(`Kelas / Sesi`, 15, 76);
        doc.text(`: ${santriData.class?.nama_kelas || '-'} / ${santriData.sesi_mengaji || '-'}`, 52, 76);

        // Right Column
        doc.text(`Wali Santri (Ibu/Ayah)`, 110, 62);
        doc.setFont('helvetica', 'bold');
        doc.text(`: ${waliName}`, 155, 62);
        doc.setFont('helvetica', 'normal');

        doc.text(`No. HP Orang Tua`, 110, 69);
        doc.text(`: ${santriData.no_hp_ortu || '-'}`, 155, 69);

        doc.text(`Karakter Unggulan`, 110, 76);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 118, 110); // Teal
        doc.text(`: ${characterData.strengths.length > 0 ? characterData.strengths.join(', ') : '-'}`, 155, 76);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');

        // --- Summary Progress Score Cards ---
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryDark);
        doc.text("REKAPITULASI CAPAIAN PERKEMBANGAN", 15, 90);

        doc.autoTable({
            startY: 94,
            head: [['Aspek Evaluasi', 'Bobot', 'Skor Capaian', 'Status / Kategori']],
            body: [
                ['Kehadiran Presensi', '34%', `${attendanceData.attendancePercentage}%`, attendanceData.attendancePercentage >= 85 ? 'Sangat Baik' : attendanceData.attendancePercentage >= 70 ? 'Cukup' : 'Perlu Perhatian'],
                ['Progres Hafalan', '33%', `${hafalanData.overallProgress}%`, hafalanData.overallProgress >= 85 ? 'Sangat Baik' : hafalanData.overallProgress >= 70 ? 'Baik' : 'Dalam Proses'],
                ['Perkembangan Karakter', '33%', `${characterData.avgPercent}% (Avg ${characterData.avgScore}/4)`, characterData.avgScore >= 3.5 ? 'SB (Sangat Berkembang)' : characterData.avgScore >= 2.8 ? 'BSH (Berkembang Sesuai Harapan)' : 'MB (Mulai Berkembang)'],
                [{ content: 'TOTAL SKOR RAPOR DENGAN BOBOT TERIMBANG', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, { content: `${overallScore}%`, styles: { fontStyle: 'bold', textColor: royalBlueHeader } }, { content: overallScore >= 80 ? 'ISTIMEWA / LULUS' : 'BAIK', styles: { fontStyle: 'bold', textColor: successColor } }]
            ],
            theme: 'grid',
            headStyles: { fillColor: royalBlueHeader, textColor: 255, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { textColor: 50, halign: 'center' },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
            styles: { fontSize: 9.5, cellPadding: 4 }
        });

        // --- Attendance Details Section ---
        let currentY = doc.lastAutoTable.finalY + 8;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryDark);
        doc.text("1. Rincian Kehadiran Santri", 15, currentY);

        doc.autoTable({
            startY: currentY + 3,
            head: [['Status Presensi', 'Hadir', 'Terlambat', 'Izin / Sakit', 'Alpha / TH', 'Persentase Kehadiran']],
            body: [[
                attendanceData.attendancePercentage >= 85 ? 'Disiplin Tinggi' : 'Cukup Disiplin',
                `${attendanceData.totalPresent} Hari`,
                `${attendanceData.totalLate} Hari`,
                `${attendanceData.totalPermit} Hari`,
                `${attendanceData.totalAbsent} Hari`,
                { content: `${attendanceData.attendancePercentage}%`, styles: { fontStyle: 'bold', textColor: attendanceData.attendancePercentage >= 85 ? successColor : dangerColor } }
            ]],
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { textColor: 50, halign: 'center' },
            styles: { fontSize: 9, cellPadding: 4 }
        });

        // --- 15 Aspek Perkembangan Karakter Table ---
        currentY = doc.lastAutoTable.finalY + 8;
        if (currentY > 220) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryDark);
        doc.text("2. Penilaian 15 Aspek Perkembangan Karakter & Adab", 15, currentY);

        const characterRows = (characterData.items || []).map((item, idx) => [
            (idx + 1).toString(),
            item.item_name,
            `${item.score} / 4`,
            `${item.code} (${item.label})`
        ]);

        doc.autoTable({
            startY: currentY + 3,
            head: [['No', 'Aspek Karakter & Adab', 'Skor (1-4)', 'Predikat Perkembangan']],
            body: characterRows.length > 0 ? characterRows : [['-', 'Belum ada penilaian karakter', '-', '-']],
            theme: 'striped',
            headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { textColor: 50 },
            columnStyles: { 0: { halign: 'center', width: 12 }, 2: { halign: 'center', width: 25 }, 3: { halign: 'center', width: 65 } },
            styles: { fontSize: 8.5, cellPadding: 3.5 }
        });

        // --- Hafalan Overview & Details ---
        currentY = doc.lastAutoTable.finalY + 8;
        if (currentY > 210) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryDark);
        doc.text("3. Capaian Hafalan Santri (Doa, Sholat, Surat & Tahfizh)", 15, currentY);

        const hafalanSummaryBody = hafalanData.programScope === 'PTPT'
            ? [['Tahfizh PTPT', hafalanData.tahfizh.total, hafalanData.tahfizh.completed, hafalanData.tahfizh.total - hafalanData.tahfizh.completed]]
            : [
                ['Doa Harian', hafalanData.doa.total, hafalanData.doa.completed, hafalanData.doa.total - hafalanData.doa.completed],
                ['Bacaan Sholat', hafalanData.sholat.total, hafalanData.sholat.completed, hafalanData.sholat.total - hafalanData.sholat.completed],
                ['Surat Pendek', hafalanData.surat.total, hafalanData.surat.completed, hafalanData.surat.total - hafalanData.surat.completed]
            ];

        doc.autoTable({
            startY: currentY + 3,
            head: [['Kategori Hafalan', 'Total Target', 'Dihafal / Lulus', 'Sisa Belum Hafal']],
            body: hafalanSummaryBody,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { textColor: 50, halign: 'center' },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
            styles: { fontSize: 9, cellPadding: 3.5 }
        });

        // Detail Hafalan Rows
        currentY = doc.lastAutoTable.finalY + 6;
        if (currentY > 210) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text("Daftar Rincian Hafalan:", 15, currentY);

        const hafalanDetailRows = (hafalanData.allItems || []).map((item) => [
            getHafalanItemName(item),
            item.category || '-',
            item.is_completed ? 'Lulus' : 'Belum Lulus',
            item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
        ]);

        doc.autoTable({
            startY: currentY + 3,
            head: [['Nama Item / Surat', 'Kategori', 'Status Hafalan', 'Tanggal Update']],
            body: hafalanDetailRows.length > 0 ? hafalanDetailRows : [['-', '-', 'Belum ada data', '-']],
            theme: 'striped',
            headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { textColor: 50 },
            columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' } },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 2) {
                    if (data.cell.raw === 'Lulus') {
                        data.cell.styles.textColor = successColor;
                        data.cell.styles.fontStyle = 'bold';
                    } else {
                        data.cell.styles.textColor = dangerColor;
                    }
                }
            },
            styles: { fontSize: 8.5, cellPadding: 3 }
        });

        // --- 3 Signature Blocks (Orang Tua, Guru Pengampu, Pentashih) ---
        currentY = doc.lastAutoTable.finalY + 12;
        if (currentY > 235) {
            doc.addPage();
            currentY = 30;
        }

        const dateFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(`Ditetapkan di Depok, ${dateFormatted}`, 195, currentY, { align: 'right' });

        currentY += 8;

        // Column 1: Orang Tua / Wali
        doc.setFont('helvetica', 'bold');
        doc.text("Orang Tua / Wali Santri", 35, currentY, { align: 'center' });
        // Column 2: Guru Pengampu
        doc.text("Guru Pengampu Kelas", 105, currentY, { align: 'center' });
        // Column 3: Pentashih
        doc.text("Pentashih LPQ Al-Muhajirun", 175, currentY, { align: 'center' });

        currentY += 22; // Signature space

        doc.setFont('helvetica', 'bold');
        doc.text(`( ${waliName} )`, 35, currentY, { align: 'center' });
        doc.text(`( ${santriData.class?.guru?.nama || 'Guru Pengampu'} )`, 105, currentY, { align: 'center' });
        doc.text("( Al-Ustadz Pentashih )", 175, currentY, { align: 'center' });

        // --- Footer across all pages ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const bottomY = 287;
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.5);
            doc.line(15, bottomY - 5, 195, bottomY - 5);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text(`Dokumen Resmi Rapor LPQ Al-Muhajirun · ${periodText}`, 15, bottomY);
            doc.text(`Halaman ${i} dari ${pageCount}`, 105, bottomY, { align: 'center' });
            doc.text(`Cetak: ${new Date().toLocaleDateString('id-ID')}`, 195, bottomY, { align: 'right' });
        }

        resolve(doc);
    });
};

// Native DOCX Generator using 'docx' npm library
export const generateRaporDOCX = async (santriData, attendanceData, hafalanData, pointsData, periodText, characterData = null) => {
    if (!characterData) {
        characterData = await getCharacterAssessmentData(santriData.id);
    }

    const waliName = getWaliSantriName(santriData);
    const overallScore = calculateOverallReportScore(
        attendanceData.attendancePercentage,
        hafalanData.overallProgress,
        characterData.avgPercent
    );

    const dateFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Table Helper Cell
    const createCell = (text, options = {}) => {
        return new TableCell({
            children: [new Paragraph({
                children: [new TextRun({ text, bold: options.bold, size: options.size || 18, color: options.color || "334155" })],
                alignment: options.align || AlignmentType.LEFT
            })],
            shading: options.bg ? { fill: options.bg, type: ShadingType.CLEAR } : undefined,
            width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined
        });
    };

    // Header Table (Royal Blue Background)
    const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: "RAPOR SANTRI LPQ AL-MUHAJIRUN", bold: true, size: 28, color: "FFFFFF" })],
                                alignment: AlignmentType.CENTER
                            }),
                            new Paragraph({
                                children: [new TextRun({ text: "Laporan Capaian Akademik & Pembentukan Karakter Santri", bold: true, size: 20, color: "F59E0B" })],
                                alignment: AlignmentType.CENTER
                            }),
                            new Paragraph({
                                children: [new TextRun({ text: `Periode Evaluasi: ${periodText}`, size: 18, color: "E2E8F0" })],
                                alignment: AlignmentType.CENTER
                            })
                        ],
                        shading: { fill: "1D4ED8", type: ShadingType.CLEAR }
                    })
                ]
            })
        ]
    });

    // Biodata Table
    const biodataTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    createCell("Nama Lengkap:", { bold: true, width: 25 }),
                    createCell(santriData.nama_lengkap || '-', { bold: true, width: 25 }),
                    createCell("Wali Santri (Ibu/Ayah):", { bold: true, width: 25 }),
                    createCell(waliName, { bold: true, width: 25 })
                ]
            }),
            new TableRow({
                children: [
                    createCell("Jilid / Tingkat:", { width: 25 }),
                    createCell(`${santriData.jilid || '-'} (${santriData.kategori || 'Anak'})`, { width: 25 }),
                    createCell("No. HP Ortu:", { width: 25 }),
                    createCell(santriData.no_hp_ortu || '-', { width: 25 })
                ]
            }),
            new TableRow({
                children: [
                    createCell("Kelas / Sesi:", { width: 25 }),
                    createCell(`${santriData.class?.nama_kelas || '-'} / ${santriData.sesi_mengaji || '-'}`, { width: 25 }),
                    createCell("Karakter Unggulan:", { width: 25 }),
                    createCell(characterData.strengths.length > 0 ? characterData.strengths.join(', ') : '-', { bold: true, color: "0F766E", width: 25 })
                ]
            })
        ]
    });

    // Summary Score Table
    const summaryRows = [
        new TableRow({
            children: [
                createCell("Aspek Evaluasi", { bold: true, color: "FFFFFF", bg: "1D4ED8", width: 35 }),
                createCell("Bobot", { bold: true, color: "FFFFFF", bg: "1D4ED8", align: AlignmentType.CENTER, width: 15 }),
                createCell("Skor Capaian", { bold: true, color: "FFFFFF", bg: "1D4ED8", align: AlignmentType.CENTER, width: 25 }),
                createCell("Status / Kategori", { bold: true, color: "FFFFFF", bg: "1D4ED8", align: AlignmentType.CENTER, width: 25 })
            ]
        }),
        new TableRow({
            children: [
                createCell("Kehadiran Presensi", { bold: true, width: 35 }),
                createCell("34%", { align: AlignmentType.CENTER, width: 15 }),
                createCell(`${attendanceData.attendancePercentage}%`, { align: AlignmentType.CENTER, width: 25 }),
                createCell(attendanceData.attendancePercentage >= 85 ? 'Sangat Baik' : attendanceData.attendancePercentage >= 70 ? 'Cukup' : 'Perlu Perhatian', { align: AlignmentType.CENTER, width: 25 })
            ]
        }),
        new TableRow({
            children: [
                createCell("Progres Hafalan", { bold: true, width: 35 }),
                createCell("33%", { align: AlignmentType.CENTER, width: 15 }),
                createCell(`${hafalanData.overallProgress}%`, { align: AlignmentType.CENTER, width: 25 }),
                createCell(hafalanData.overallProgress >= 85 ? 'Sangat Baik' : hafalanData.overallProgress >= 70 ? 'Baik' : 'Dalam Proses', { align: AlignmentType.CENTER, width: 25 })
            ]
        }),
        new TableRow({
            children: [
                createCell("Perkembangan Karakter", { bold: true, width: 35 }),
                createCell("33%", { align: AlignmentType.CENTER, width: 15 }),
                createCell(`${characterData.avgPercent}% (${characterData.avgScore}/4)`, { align: AlignmentType.CENTER, width: 25 }),
                createCell(characterData.avgScore >= 3.5 ? 'SB (Sangat Berkembang)' : characterData.avgScore >= 2.8 ? 'BSH (Berkembang Sesuai Harapan)' : 'MB (Mulai Berkembang)', { align: AlignmentType.CENTER, width: 25 })
            ]
        }),
        new TableRow({
            children: [
                createCell("TOTAL SKOR RAPOR (BOBOT TERIMBANG)", { bold: true, width: 50 }),
                createCell("", { width: 0 }),
                createCell(`${overallScore}%`, { bold: true, color: "1D4ED8", align: AlignmentType.CENTER, width: 25 }),
                createCell(overallScore >= 80 ? 'ISTIMEWA / LULUS' : 'BAIK', { bold: true, color: "10B981", align: AlignmentType.CENTER, width: 25 })
            ]
        })
    ];

    const summaryTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: summaryRows
    });

    // 15 Character Aspects Table
    const charAspectRows = [
        new TableRow({
            children: [
                createCell("No", { bold: true, color: "FFFFFF", bg: "0F766E", align: AlignmentType.CENTER, width: 10 }),
                createCell("Aspek Karakter & Adab", { bold: true, color: "FFFFFF", bg: "0F766E", width: 50 }),
                createCell("Skor (1-4)", { bold: true, color: "FFFFFF", bg: "0F766E", align: AlignmentType.CENTER, width: 20 }),
                createCell("Predikat Perkembangan", { bold: true, color: "FFFFFF", bg: "0F766E", align: AlignmentType.CENTER, width: 20 })
            ]
        })
    ];

    (characterData.items || []).forEach((item, idx) => {
        charAspectRows.push(new TableRow({
            children: [
                createCell((idx + 1).toString(), { align: AlignmentType.CENTER, width: 10 }),
                createCell(item.item_name, { width: 50 }),
                createCell(`${item.score} / 4`, { align: AlignmentType.CENTER, width: 20 }),
                createCell(`${item.code} (${item.label})`, { align: AlignmentType.CENTER, width: 20 })
            ]
        }));
    });

    const charAspectTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: charAspectRows
    });

    // Hafalan Detail Table
    const hafalanRows = [
        new TableRow({
            children: [
                createCell("Nama Item / Surat", { bold: true, color: "FFFFFF", bg: "475569", width: 40 }),
                createCell("Kategori", { bold: true, color: "FFFFFF", bg: "475569", width: 20 }),
                createCell("Status Hafalan", { bold: true, color: "FFFFFF", bg: "475569", align: AlignmentType.CENTER, width: 20 }),
                createCell("Tanggal Update", { bold: true, color: "FFFFFF", bg: "475569", align: AlignmentType.CENTER, width: 20 })
            ]
        })
    ];

    (hafalanData.allItems || []).forEach((item) => {
        hafalanRows.push(new TableRow({
            children: [
                createCell(getHafalanItemName(item), { width: 40 }),
                createCell(item.category || '-', { width: 20 }),
                createCell(item.is_completed ? 'Lulus' : 'Belum Lulus', { bold: true, color: item.is_completed ? "10B981" : "EF4444", align: AlignmentType.CENTER, width: 20 }),
                createCell(item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-', { align: AlignmentType.CENTER, width: 20 })
            ]
        }));
    });

    const hafalanTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: hafalanRows
    });

    // 3 Signature Blocks Table
    const signatureTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    createCell("Orang Tua / Wali Santri", { bold: true, align: AlignmentType.CENTER, width: 33 }),
                    createCell("Guru Pengampu Kelas", { bold: true, align: AlignmentType.CENTER, width: 33 }),
                    createCell("Pentashih LPQ Al-Muhajirun", { bold: true, align: AlignmentType.CENTER, width: 34 })
                ]
            }),
            new TableRow({
                children: [
                    createCell("\n\n\n", { width: 33 }),
                    createCell("\n\n\n", { width: 33 }),
                    createCell("\n\n\n", { width: 34 })
                ]
            }),
            new TableRow({
                children: [
                    createCell(`( ${waliName} )`, { bold: true, align: AlignmentType.CENTER, width: 33 }),
                    createCell(`( ${santriData.class?.guru?.nama || 'Guru Pengampu'} )`, { bold: true, align: AlignmentType.CENTER, width: 33 }),
                    createCell("( Al-Ustadz Pentashih )", { bold: true, align: AlignmentType.CENTER, width: 34 })
                ]
            })
        ]
    });

    const doc = new Document({
        sections: [
            {
                properties: {},
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: `Dokumen Resmi Rapor LPQ Al-Muhajirun · ${periodText} · Page `, size: 16, color: "94A3B8" }),
                                    PageNumber.CURRENT,
                                    new TextRun({ text: " of ", size: 16, color: "94A3B8" }),
                                    PageNumber.TOTAL_PAGES
                                ],
                                alignment: AlignmentType.CENTER
                            })
                        ]
                    })
                },
                children: [
                    headerTable,
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    new Paragraph({ text: "BIODATA SANTRI", heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }),
                    biodataTable,
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    new Paragraph({ text: "REKAPITULASI CAPAIAN PERKEMBANGAN", heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }),
                    summaryTable,
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    new Paragraph({ text: "PENILAIAN 15 ASPEK KARAKTER & ADAB", heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }),
                    charAspectTable,
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    new Paragraph({ text: "DAFTAR RINCIAN HAFALAN SANTRI", heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }),
                    hafalanTable,
                    new Paragraph({ text: "", spacing: { after: 300 } }),

                    new Paragraph({ text: `Ditetapkan di Depok, ${dateFormatted}`, alignment: AlignmentType.RIGHT, spacing: { after: 150 } }),
                    signatureTable
                ]
            }
        ]
    });

    return await Packer.toBlob(doc);
};
