import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Save, Plus, Trash2, Percent, Gamepad2, Trophy, X, RefreshCw, BarChart2, User, UserCheck, Sparkles, Clock3, Settings2, MessageSquare, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { doaHarian, bacaanShalat, suratPendek } from '@/data/islamicContent';
import { motion } from 'framer-motion';
import AttendanceConfiguration from './AttendanceConfiguration';
import ClassAttendanceLiveEditor from './ClassAttendanceLiveEditor';
import CharacterConfiguration from './CharacterConfiguration';
import { enableGameFeatures } from '@/lib/featureFlags';
import { saveWebsiteContentItem } from '@/lib/publicContentAdapters';
import { createDefaultSantriLevelConfig, normalizeLevelConfigShape } from '@/lib/santriLevel';
import {
    QUIZ_HAFALAN_JILIDS,
    createDefaultQuizHafalanConfig,
    normalizeQuizHafalanConfig,
} from '@/lib/quizHafalanConfig';
import { DEFAULT_WHATSAPP_TEMPLATES, fetchWhatsAppTemplates, saveWhatsAppTemplates } from '@/lib/whatsappTemplateAdapters';
import {
    DEFAULT_WHATSAPP_GROUP_LINKS,
    WHATSAPP_GROUP_LINK_FIELDS,
    fetchWhatsAppGroupLinks,
    saveWhatsAppGroupLinks,
    validateWhatsAppGroupLinks,
} from '@/lib/whatsappGroupLinkAdapters';

const GameConfiguration = () => {
    const [activeTab, setActiveTab] = useState('attendance');
    const tabs = [
        { id: 'attendance', label: 'Waktu Absensi', icon: Clock3 },
        { id: 'attendance-editor', label: 'Live Editor Absensi', icon: Eye },
        { id: 'levels', label: 'Konfigurasi Level', icon: BarChart2 },
        { id: 'characters', label: 'Karakter Santri', icon: Sparkles },
        { id: 'whatsapp', label: 'Whatsapp & Jilid', icon: MessageSquare },
        ...(enableGameFeatures ? [
            { id: 'gatcha', label: 'Gatcha Game', icon: Gamepad2 },
            { id: 'quiz', label: 'Quiz Hafalan', icon: Trophy },
        ] : []),
    ];

    return (
        <div className="game-config-shell space-y-6">
            <div className="game-config-hero">
                <div className="game-config-hero__icon"><Settings2 className="w-6 h-6" /></div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight">Konfigurasi Sistem</h2>
                    <p className="text-sm text-muted-foreground mt-1">Atur waktu absensi serta pengalaman permainan dan gamifikasi.</p>
                </div>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex justify-start mb-6 overflow-x-auto pb-1">
                    <div className="game-config-tabs inline-flex p-1.5 rounded-2xl gap-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ease-out flex items-center gap-2 whitespace-nowrap
                                    ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}
                                `}
                            >
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="game-pill"
                                        className="game-config-tabs__active absolute inset-0 shadow-sm rounded-xl"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
                
                <TabsContent value="attendance" className="animate-in fade-in slide-in-from-bottom-2">
                    <AttendanceConfiguration />
                </TabsContent>

                <TabsContent value="attendance-editor" className="animate-in fade-in slide-in-from-bottom-2">
                    <ClassAttendanceLiveEditor />
                </TabsContent>

                <TabsContent value="gatcha" className="animate-in fade-in slide-in-from-bottom-2">
                    <GatchaSettings />
                </TabsContent>
                
                <TabsContent value="quiz" className="animate-in fade-in slide-in-from-bottom-2">
                    <QuizSettings />
                </TabsContent>

                <TabsContent value="levels" className="animate-in fade-in slide-in-from-bottom-2">
                    <LevelSettings />
                </TabsContent>

                <TabsContent value="characters" className="animate-in fade-in slide-in-from-bottom-2">
                    <CharacterConfiguration />
                </TabsContent>
                <TabsContent value="whatsapp" className="animate-in fade-in slide-in-from-bottom-2">
                    <WhatsAppTemplateSettings />
                </TabsContent>
            </Tabs>
        </div>
    );
};

const GatchaSettings = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [config, setConfig] = useState({
        challenges: [],
        rewards: [
            { id: 1, type: "points", value: 10, label: "10 Poin Tambahan", weight: 50 },
            { id: 2, type: "item", value: "Snack", label: "Voucher Snack", weight: 20 }
        ]
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const populateDefaultChallenges = () => {
        const newChallenges = [];
        let idCounter = 1;
        suratPendek.slice(0, 10).forEach(surat => {
            newChallenges.push({ id: idCounter++, text: `Bacakan ${surat}`, difficulty: 'Medium' });
        });
        doaHarian.slice(0, 10).forEach(doa => {
            newChallenges.push({ id: idCounter++, text: `Bacakan ${doa}`, difficulty: 'Easy' });
        });
        bacaanShalat.slice(0, 5).forEach(bacaan => {
            newChallenges.push({ id: idCounter++, text: `Praktikkan ${bacaan}`, difficulty: 'Hard' });
        });
        return newChallenges;
    };

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase.from('website_content').select('content').eq('key', 'gatcha_config').maybeSingle();
            if (data?.content) {
                if (!data.content.challenges || data.content.challenges.length === 0) {
                    setConfig({ ...data.content, challenges: populateDefaultChallenges() });
                } else {
                    setConfig(data.content);
                }
            } else {
                setConfig({
                    challenges: populateDefaultChallenges(),
                    rewards: config.rewards
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveConfig = async () => {
        setIsLoading(true);
        const { error } = await supabase.from('website_content').upsert({ key: 'gatcha_config', content: config }, { onConflict: 'key' });
        if (error) toast({ title: "Gagal Simpan", description: error.message, variant: "destructive" });
        else toast({ title: "Berhasil", description: "Pengaturan Gatcha disimpan." });
        setIsLoading(false);
    };

    const resetToDefaults = () => {
        if(window.confirm("Reset tantangan ke paket standar Islami? Tantangan custom akan hilang.")) {
            setConfig(prev => ({ ...prev, challenges: populateDefaultChallenges() }));
            toast({ title: "Reset Berhasil", description: "Tantangan telah direset ke standar Islami." });
        }
    };

    const updateChallenge = (id, field, value) => setConfig(prev => ({ ...prev, challenges: prev.challenges.map(c => c.id === id ? { ...c, [field]: value } : c) }));
    const addChallenge = () => { const newId = Math.max(0, ...config.challenges.map(c => c.id)) + 1; setConfig(prev => ({ ...prev, challenges: [...prev.challenges, { id: newId, text: "", difficulty: "Medium" }] })); };
    const removeChallenge = (id) => setConfig(prev => ({ ...prev, challenges: prev.challenges.filter(c => c.id !== id) }));

    const updateReward = (id, field, value) => setConfig(prev => ({ ...prev, rewards: prev.rewards.map(r => r.id === id ? { ...r, [field]: value } : r) }));
    const addReward = () => { const newId = Math.max(0, ...config.rewards.map(r => r.id)) + 1; setConfig(prev => ({ ...prev, rewards: [...prev.rewards, { id: newId, type: "points", value: 0, label: "", weight: 10 }] })); };
    const removeReward = (id) => setConfig(prev => ({ ...prev, rewards: prev.rewards.filter(r => r.id !== id) }));

    return (
        <div className="game-config-panel game-config-panel--gatcha space-y-6">
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetToDefaults} className="hover:bg-yellow-50 border-yellow-200 text-yellow-700"><RefreshCw className="w-4 h-4 mr-2"/> Reset Konten Islami</Button>
                <Button onClick={saveConfig} disabled={isLoading} className="bg-primary"><Save className="w-4 h-4 mr-2"/> Simpan Perubahan Gatcha</Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-md border-0">
                    <CardHeader><CardTitle>Tantangan</CardTitle><CardDescription>Daftar tantangan yang muncul acak.</CardDescription></CardHeader>
                    <CardContent className="space-y-4 h-96 overflow-y-auto pr-2 custom-scrollbar">
                        {config.challenges.map((c) => (
                            <div key={c.id} className="flex gap-2 items-start border p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-white transition-colors">
                                <div className="flex-1 space-y-2">
                                    <Input value={c.text} onChange={(e) => updateChallenge(c.id, 'text', e.target.value)} placeholder="Tantangan..." className="h-9 text-sm"/>
                                    <Select value={c.difficulty} onValueChange={(val) => updateChallenge(c.id, 'difficulty', val)}>
                                        <SelectTrigger className="h-8 text-xs w-full"><SelectValue/></SelectTrigger>
                                        <SelectContent><SelectItem value="Easy">Mudah</SelectItem><SelectItem value="Medium">Sedang</SelectItem><SelectItem value="Hard">Sulit</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-100" onClick={() => removeChallenge(c.id)}><Trash2 className="w-4 h-4"/></Button>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addChallenge}><Plus className="w-4 h-4 mr-2"/> Tambah Tantangan</Button>
                    </CardContent>
                </Card>
                <Card className="shadow-md border-0">
                    <CardHeader><CardTitle>Hadiah</CardTitle><CardDescription>Hadiah dan probabilitas (bobot).</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        {config.rewards.map((r) => (
                            <div key={r.id} className="flex flex-col gap-2 border p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-white transition-colors">
                                <div className="flex gap-2">
                                    <Select value={r.type} onValueChange={(val) => updateReward(r.id, 'type', val)}>
                                        <SelectTrigger className="h-9 w-28 text-xs"><SelectValue/></SelectTrigger>
                                        <SelectContent><SelectItem value="points">Poin</SelectItem><SelectItem value="item">Barang</SelectItem></SelectContent>
                                    </Select>
                                    <Input value={r.label} onChange={(e) => updateReward(r.id, 'label', e.target.value)} placeholder="Label Hadiah" className="h-9 text-sm flex-1"/>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-100" onClick={() => removeReward(r.id)}><Trash2 className="w-4 h-4"/></Button>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <div className="flex-1 relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{r.type === 'points' ? 'Nilai:' : 'Item:'}</span>
                                        <Input type={r.type === 'points' ? "number" : "text"} value={r.value} onChange={(e) => updateReward(r.id, 'value', e.target.value)} className="h-9 text-sm pl-12"/>
                                    </div>
                                    <div className="flex items-center w-28 relative">
                                        <Percent className="w-3 h-3 absolute left-2 text-muted-foreground"/>
                                        <Input type="number" value={r.weight} onChange={(e) => updateReward(r.id, 'weight', parseInt(e.target.value)||0)} className="h-9 text-sm pl-6" placeholder="Bobot"/>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addReward}><Plus className="w-4 h-4 mr-2"/> Tambah Hadiah</Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const QuizSettings = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [quizConfig, setQuizConfig] = useState(() => createDefaultQuizHafalanConfig().categories);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('website_content')
                .select('content')
                .eq('key', 'quiz_hafalan_config')
                .maybeSingle();

            if (error) {
                toast({ title: 'Gagal memuat konfigurasi quiz', description: error.message, variant: 'destructive' });
            } else {
                const normalizedConfig = normalizeQuizHafalanConfig(data?.content);
                setQuizConfig(normalizedConfig.categories);

                // One-time cleanup keeps old custom categories and legacy jilid shapes
                // from returning after the admin next opens this configuration.
                if (data?.content && JSON.stringify(data.content) !== JSON.stringify(normalizedConfig)) {
                    const { error: normalizeError } = await supabase
                        .from('website_content')
                        .upsert({ key: 'quiz_hafalan_config', content: normalizedConfig }, { onConflict: 'key' });
                    if (normalizeError) {
                        toast({ title: 'Konfigurasi quiz belum dinormalisasi', description: normalizeError.message, variant: 'destructive' });
                    }
                }
            }
            setIsLoading(false);
        };
        load();
    }, [toast]);

    const saveQuizConfig = async () => {
        setIsLoading(true);
        const payload = normalizeQuizHafalanConfig({ categories: quizConfig });
        const { error } = await supabase
            .from('website_content')
            .upsert({ key: 'quiz_hafalan_config', content: payload }, { onConflict: 'key' });
        if (error) toast({ title: "Gagal Simpan", description: error.message, variant: "destructive" });
        else toast({ title: "Berhasil", description: "Konfigurasi Quiz disimpan." });
        setIsLoading(false);
    };

    const resetToDefaults = () => {
        if (window.confirm("Aktifkan kembali tiga kategori dan seluruh jilid?")) {
            setQuizConfig(createDefaultQuizHafalanConfig().categories);
            toast({ title: "Reset Berhasil", description: "Quiz telah direset ke konten standar." });
        }
    };

    const toggleCategory = (categoryId, enabled) => {
        setQuizConfig((previous) => previous.map((category) => (
            category.id === categoryId ? { ...category, enabled } : category
        )));
    };

    const toggleJilid = (categoryId, jilid, enabled) => {
        setQuizConfig((previous) => previous.map((category) => (
            category.id === categoryId
                ? { ...category, jilids: { ...category.jilids, [jilid]: enabled } }
                : category
        )));
    };

    return (
        <div className="game-config-panel game-config-panel--quiz space-y-6">
            <div className="game-config-section-heading">
                <div>
                    <h3 className="text-lg font-black flex items-center gap-2"><Sparkles className="w-5 h-5 text-cyan-500" /> Pengaturan Quiz Hafalan</h3>
                    <p className="text-sm text-muted-foreground">Aktifkan kategori dan jilid secara terpisah. Item quiz tetap mengikuti master hafalan TPQ.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={resetToDefaults}><RefreshCw className="w-4 h-4 mr-2"/> Reset</Button>
                    <Button onClick={saveQuizConfig} disabled={isLoading} className="game-config-save"><Save className="w-4 h-4 mr-2"/> Simpan Quiz</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {quizConfig.map((category) => (
                    <Card key={category.id} className="h-full">
                        <CardHeader className="pb-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: category.color }} />
                                    <div>
                                        <CardTitle className="text-lg">{category.label}</CardTitle>
                                        <p className="mt-1 text-xs text-muted-foreground">Kategori utama</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={category.enabled}
                                    onCheckedChange={(enabled) => toggleCategory(category.id, enabled)}
                                    aria-label={category.label + ' ' + (category.enabled ? 'aktif' : 'nonaktif')}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {QUIZ_HAFALAN_JILIDS.map((jilid) => {
                                const enabled = category.jilids?.[jilid] === true;
                                return (
                                    <div key={jilid} className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2.5">
                                        <div>
                                            <p className="text-sm font-semibold">Jilid {jilid}</p>
                                            <p className="text-[11px] text-muted-foreground">{enabled ? 'Tersedia di quiz' : 'Disembunyikan dari quiz'}</p>
                                        </div>
                                        <Switch
                                            checked={enabled}
                                            onCheckedChange={(nextEnabled) => toggleJilid(category.id, jilid, nextEnabled)}
                                            aria-label={category.label + ' Jilid ' + jilid + ' ' + (enabled ? 'aktif' : 'nonaktif')}
                                        />
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">Quiz hanya menggunakan tiga kategori ini dan item hafalan TPQ yang aktif. Menonaktifkan semua jilid pada kategori akan menyembunyikan kategori tersebut dari pilihan pengguna.</p>
        </div>
    );
};

const createDefaultLevelConfig = () => createDefaultSantriLevelConfig();

const normalizeLevel = (level, fallbackColor = '#3b82f6') => {
    const color = level.color || level.accentColor || fallbackColor;
    return {
        ...level,
        color,
        accentColor: color,
        cardBgColor: '#ffffff',
        textColor: color,
        cardBorderThickness: level.cardDepth ?? level.cardBorderThickness ?? 8,
        avatarBorderThickness: level.avatarDepth ?? level.avatarBorderThickness ?? 4,
        enableGradient: true,
        textGradient: true
    };
};

const normalizeEditableLevelConfig = (content) => {
    const defaults = createDefaultLevelConfig();
    const normalized = normalizeLevelConfigShape(content);
    return {
        male: (normalized.male.length > 0 ? normalized.male : defaults.male)
            .map((level, index) => normalizeLevel({ ...level, id: index + 1, name: level.name || level.label || `Level ${index + 1}` }, '#3b82f6')),
        female: (normalized.female.length > 0 ? normalized.female : defaults.female)
            .map((level, index) => normalizeLevel({ ...level, id: index + 1, name: level.name || level.label || `Level ${index + 1}` }, '#ec4899')),
    };
};

const LevelSettings = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [levelConfig, setLevelConfig] = useState(createDefaultLevelConfig);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.from('website_content').select('content').eq('key', 'level_config').maybeSingle();
                if (error) throw error;
                if (data?.content) {
                    setLevelConfig(normalizeEditableLevelConfig(data.content));
                }
            } catch (error) {
                toast({ title: 'Gagal Memuat Konfigurasi Level', description: error.message || 'Konfigurasi default tetap dapat diedit dan disimpan.', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const saveLevelConfig = async () => {
        setIsSaving(true);
        try {
            for (const [gender, levels] of Object.entries(levelConfig)) {
                if (levels.length === 0) throw new Error(`Minimal satu level santri ${gender === 'male' ? 'putra' : 'putri'} wajib tersedia.`);
                levels.forEach((level) => {
                    if (!level.name?.trim()) throw new Error('Nama level tidak boleh kosong.');
                    if (
                        String(level.min ?? '').trim() === ''
                        || String(level.max ?? '').trim() === ''
                        || !Number.isFinite(Number(level.min))
                        || !Number.isFinite(Number(level.max))
                        || Number(level.min) > Number(level.max)
                    ) {
                        throw new Error(`Rentang poin level ${level.name} tidak valid.`);
                    }
                });
            }

            const normalizedConfig = {
                male: levelConfig.male.map((level) => normalizeLevel({ ...level, min: Number(level.min), max: Number(level.max) }, '#3b82f6')).sort((a, b) => a.min - b.min),
                female: levelConfig.female.map((level) => normalizeLevel({ ...level, min: Number(level.min), max: Number(level.max) }, '#ec4899')).sort((a, b) => a.min - b.min)
            };

            const saved = await saveWebsiteContentItem({ key: 'level_config', content: normalizedConfig, isPublic: true });
            const savedConfig = normalizeLevelConfigShape(saved?.content);
            if (savedConfig.male.length === 0 || savedConfig.female.length === 0) {
                throw new Error('Konfigurasi tersimpan tanpa data level lengkap.');
            }
            setLevelConfig(normalizeEditableLevelConfig(saved.content));
            toast({ title: "Berhasil", description: "Konfigurasi level putra dan putri sudah aktif pada profil absensi digital." });
        } catch (error) {
            toast({ title: "Gagal Simpan", description: error.message || 'Konfigurasi level tidak dapat disimpan.', variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const updateLevel = (gender, id, field, value) => {
        const synchronizedField = ['name', 'min', 'max'].includes(field);
        setLevelConfig((previous) => ({
            male: previous.male.map((level) => (
                level.id === id && (gender === 'male' || synchronizedField) ? { ...level, [field]: value } : level
            )),
            female: previous.female.map((level) => (
                level.id === id && (gender === 'female' || synchronizedField) ? { ...level, [field]: value } : level
            )),
        }));
    };

    const renderLevelList = (gender, levels) => (
        <div className="space-y-4">
            <div className="game-level-note">
                <Sparkles className="w-5 h-5" />
                <p>Background profile card tetap putih. Warna di bawah hanya mengubah aksen, aura, nama, waktu, dan ikon sesuai level.</p>
            </div>
            {levels.map((level) => (
                <div
                    key={level.id}
                    className="game-level-card"
                    style={{
                        '--level-preview-accent': level.color,
                        '--level-card-depth': `${Math.max(0, Number(level.cardBorderThickness) || 0)}px`,
                        '--level-avatar-depth': `${Math.max(0, Number(level.avatarBorderThickness) || 0)}px`
                    }}
                >
                    <div className="game-level-card__preview">
                        <div className="game-level-card__avatar">{gender === 'female' ? 'P' : 'L'}</div>
                        <div className="min-w-0">
                            <p className="game-level-card__name">Nama Santri</p>
                            <p className="game-level-card__meta">{level.name || 'Level Baru'} · {level.min}–{level.max} poin</p>
                        </div>
                        <div className="game-level-card__accent" aria-label="Warna aksen level" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4">
                            <Label className="text-xs font-semibold">Nama Level</Label>
                            <Input value={level.name} onChange={(event) => updateLevel(gender, level.id, 'name', event.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label className="text-xs font-semibold">Min Poin</Label>
                            <Input type="number" value={level.min} onChange={(event) => updateLevel(gender, level.id, 'min', event.target.value === '' ? '' : Number(event.target.value))} />
                        </div>
                        <div className="md:col-span-2">
                            <Label className="text-xs font-semibold">Max Poin</Label>
                            <Input type="number" value={level.max} onChange={(event) => updateLevel(gender, level.id, 'max', event.target.value === '' ? '' : Number(event.target.value))} />
                        </div>
                        <div className="md:col-span-4">
                            <Label className="text-xs font-semibold">Warna Aksen</Label>
                            <Input type="color" value={level.color} onChange={(event) => updateLevel(gender, level.id, 'color', event.target.value)} className="h-10 cursor-pointer w-full" />
                        </div>
                        <div className="md:col-span-6">
                            <div className="game-level-depth-control">
                                <div>
                                    <Label className="text-xs font-semibold">Depth Card</Label>
                                    <p className="text-[11px] text-muted-foreground">Mengatur ketebalan shadow card, bukan border.</p>
                                </div>
                                <span>{level.cardBorderThickness ?? 8}px</span>
                            </div>
                            <Input
                                type="range"
                                min="0"
                                max="16"
                                step="1"
                                value={level.cardBorderThickness ?? 8}
                                onChange={(event) => updateLevel(gender, level.id, 'cardBorderThickness', Number(event.target.value))}
                                className="game-level-range"
                            />
                        </div>
                        <div className="md:col-span-6">
                            <div className="game-level-depth-control">
                                <div>
                                    <Label className="text-xs font-semibold">Depth Avatar</Label>
                                    <p className="text-[11px] text-muted-foreground">Mengatur ketebalan shadow frame avatar.</p>
                                </div>
                                <span>{level.avatarBorderThickness ?? 4}px</span>
                            </div>
                            <Input
                                type="range"
                                min="0"
                                max="16"
                                step="1"
                                value={level.avatarBorderThickness ?? 4}
                                onChange={(event) => updateLevel(gender, level.id, 'avatarBorderThickness', Number(event.target.value))}
                                className="game-level-range"
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="game-config-panel game-config-panel--levels space-y-6">
            <div className="game-config-section-heading">
                <div>
                    <h3 className="text-lg font-black">Level & Visual Profile Card</h3>
                    <p className="text-sm text-muted-foreground">Atur rentang poin, nama level, warna aksen, serta depth neumorphic untuk santri putra dan putri.</p>
                </div>
                <Button type="button" onClick={saveLevelConfig} disabled={isLoading || isSaving} className="game-config-save">
                    <Save className="w-4 h-4 mr-2"/> {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi Level'}
                </Button>
            </div>
            
            <Tabs defaultValue="male" className="w-full">
                <TabsList className="game-level-gender-tabs w-full grid grid-cols-2">
                    <TabsTrigger value="male"><User className="w-4 h-4 mr-2"/> Santri Putra</TabsTrigger>
                    <TabsTrigger value="female"><UserCheck className="w-4 h-4 mr-2"/> Santri Putri</TabsTrigger>
                </TabsList>
                <TabsContent value="male" className="mt-5">
                    {renderLevelList('male', levelConfig.male)}
                </TabsContent>
                <TabsContent value="female" className="mt-5">
                    {renderLevelList('female', levelConfig.female)}
                </TabsContent>
            </Tabs>
        </div>
    );
};

const TEMPLATE_FIELDS = [
    {
        key: 'jilidPromotion',
        title: 'Kenaikan Jilid',
        description: 'Pesan untuk wali saat santri melanjutkan ke jilid berikutnya.',
        variables: ['nama_santri', 'jilid_lama', 'jilid_baru', 'link_grup', 'nama_lembaga'],
    },
    {
        key: 'jilidDemotion',
        title: 'Penurunan / Penguatan Jilid',
        description: 'Pesan pendampingan saat santri perlu menguatkan pembelajaran di jilid tujuan.',
        variables: ['nama_santri', 'jilid_lama', 'jilid_baru', 'link_grup', 'nama_lembaga'],
    },
    {
        key: 'paymentReceipt',
        title: 'Bukti Pembayaran',
        description: 'Pesan yang menyertai rincian transaksi pembayaran kepada wali santri.',
        variables: ['nama_santri', 'nomor_induk', 'rincian', 'nominal', 'tanggal', 'periode', 'metode', 'transaction_id', 'status', 'nama_lembaga'],
    },
];

const WhatsAppTemplateSettings = () => {
    const [templates, setTemplates] = useState({ ...DEFAULT_WHATSAPP_TEMPLATES });
    const [isLoading, setIsLoading] = useState(true);
    const [groupLinks, setGroupLinks] = useState({ ...DEFAULT_WHATSAPP_GROUP_LINKS });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let active = true;
        Promise.all([fetchWhatsAppTemplates(), fetchWhatsAppGroupLinks()])
            .then(([templateData, linkData]) => {
                if (!active) return;
                setTemplates(templateData);
                setGroupLinks(linkData);
            })
            .catch((error) => active && toast({ title: 'Gagal memuat konfigurasi WhatsApp', description: error.message, variant: 'destructive' }))
            .finally(() => active && setIsLoading(false));
        return () => { active = false; };
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            for (const field of TEMPLATE_FIELDS) {
                if (!templates[field.key]?.trim()) throw new Error(`Template ${field.title} tidak boleh kosong.`);
            }
            const normalizedLinks = validateWhatsAppGroupLinks(groupLinks);
            const [saved, savedLinks] = await Promise.all([
                saveWhatsAppTemplates(templates),
                saveWhatsAppGroupLinks(normalizedLinks),
            ]);
            setTemplates(saved);
            setGroupLinks(savedLinks);
            toast({ title: 'Berhasil', description: 'Template pesan dan link grup WhatsApp telah disimpan dan langsung digunakan.' });
        } catch (error) {
            toast({ title: 'Gagal menyimpan template', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="game-config-panel space-y-5">
            <div className="game-config-section-heading">
                <div>
                    <h3 className="text-lg font-black">Editor Pesan WhatsApp</h3>
                    <p className="text-sm text-muted-foreground">Gunakan variabel dinamis agar pesan tetap personal tanpa menulis ulang setiap transaksi.</p>
                </div>
                <Button type="button" onClick={handleSave} disabled={isLoading || isSaving} className="game-config-save">
                    <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Menyimpan...' : 'Simpan Template & Link'}
                </Button>
            </div>
            <section className="rounded-lg border bg-background/80 p-4 shadow-sm">
                <div className="mb-4">
                    <h4 className="font-bold text-foreground">Link Grup WhatsApp per Jilid</h4>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Atur tautan grup yang dipakai otomatis pada pesan kenaikan dan penurunan jilid. Perubahan tersimpan di konfigurasi website.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {WHATSAPP_GROUP_LINK_FIELDS.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                            <Label htmlFor={`whatsapp-group-${field.key}`}>{field.label}</Label>
                            <Input
                                id={`whatsapp-group-${field.key}`}
                                type="url"
                                value={groupLinks[field.key] || ''}
                                onChange={(event) => setGroupLinks((current) => ({ ...current, [field.key]: event.target.value }))}
                                placeholder="https://chat.whatsapp.com/..."
                                disabled={isLoading || isSaving}
                                aria-label={`Link grup WhatsApp ${field.label}`}
                            />
                        </div>
                    ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Gunakan URL grup WhatsApp yang diawali https://chat.whatsapp.com/.</p>
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
                {TEMPLATE_FIELDS.map((field, index) => (
                    <section key={field.key} className={`rounded-lg border bg-background/80 p-4 shadow-sm ${index === 2 ? 'xl:col-span-2' : ''}`}>
                        <div className="mb-3">
                            <h4 className="font-bold text-foreground">{field.title}</h4>
                            <p className="text-xs leading-relaxed text-muted-foreground">{field.description}</p>
                        </div>
                        <Textarea
                            value={templates[field.key] || ''}
                            onChange={(event) => setTemplates((current) => ({ ...current, [field.key]: event.target.value }))}
                            className="min-h-64 resize-y font-mono text-xs leading-relaxed"
                            aria-label={`Template WhatsApp ${field.title}`}
                        />
                        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Variabel tersedia">
                            {field.variables.map((variable) => (
                                <code key={variable} className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{'{{'}{variable}{'}}'}</code>
                            ))}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 px-0 text-xs"
                            onClick={() => setTemplates((current) => ({ ...current, [field.key]: DEFAULT_WHATSAPP_TEMPLATES[field.key] }))}
                        >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Kembalikan contoh awal
                        </Button>
                    </section>
                ))}
            </div>
        </div>
    );
};

export default GameConfiguration;
