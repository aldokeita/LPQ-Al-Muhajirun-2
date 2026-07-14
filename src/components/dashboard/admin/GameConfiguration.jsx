import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Save, Plus, Trash2, Percent, Gamepad2, Trophy, Lock, X, RefreshCw, BarChart2, User, UserCheck, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { doaHarian, bacaanShalat, suratPendek } from '@/data/islamicContent';
import { motion } from 'framer-motion';

const GameConfiguration = () => {
    const [activeTab, setActiveTab] = useState("gatcha");
    const tabs = [
        { id: 'gatcha', label: 'Gatcha Game', icon: Gamepad2 },
        { id: 'quiz', label: 'Quiz Hafalan', icon: Trophy },
        { id: 'levels', label: 'Konfigurasi Level', icon: BarChart2 },
    ];

    return (
        <div className="game-config-shell space-y-6">
            <div className="game-config-hero">
                <div className="game-config-hero__icon"><Gamepad2 className="w-6 h-6" /></div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight">Konfigurasi Permainan & Gamifikasi</h2>
                    <p className="text-sm text-muted-foreground mt-1">Atur pengalaman bermain, konten quiz, hadiah, dan visual level santri.</p>
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
                
                <TabsContent value="gatcha" className="animate-in fade-in slide-in-from-bottom-2">
                    <GatchaSettings />
                </TabsContent>
                
                <TabsContent value="quiz" className="animate-in fade-in slide-in-from-bottom-2">
                    <QuizSettings />
                </TabsContent>

                <TabsContent value="levels" className="animate-in fade-in slide-in-from-bottom-2">
                    <LevelSettings />
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
    const [adminPin, setAdminPin] = useState('1234');
    const [quizConfig, setQuizConfig] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');

    const defaultQuizData = [
        { id: 1, label: 'Doa Harian', color: '#3b82f6', items: doaHarian },
        { id: 2, label: 'Surat Pendek', color: '#a855f7', items: suratPendek },
        { id: 3, label: 'Bacaan Shalat', color: '#f59e0b', items: bacaanShalat }
    ];

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const { data } = await supabase.from('website_content').select('content').eq('key', 'quiz_hafalan_config').maybeSingle();
            if (data?.content) {
                const loadedCats = data.content.categories || (Array.isArray(data.content) ? data.content : []);
                setQuizConfig(loadedCats.length === 0 ? defaultQuizData : loadedCats);
                if (data.content.adminPin) setAdminPin(data.content.adminPin);
            } else {
                setQuizConfig(defaultQuizData);
            }
            setIsLoading(false);
        };
        load();
    }, []);

    const saveQuizConfig = async () => {
        setIsLoading(true);
        const payload = { categories: quizConfig, adminPin: adminPin };
        const { error } = await supabase.from('website_content').upsert({ key: 'quiz_hafalan_config', content: payload }, { onConflict: 'key' });
        if (error) toast({ title: "Gagal Simpan", description: error.message, variant: "destructive" });
        else toast({ title: "Berhasil", description: "Konfigurasi Quiz disimpan." });
        setIsLoading(false);
    };

    const resetToDefaults = () => {
        if(window.confirm("Reset quiz ke konten standar (Doa, Surat, Sholat)?")) {
            setQuizConfig(defaultQuizData);
            toast({ title: "Reset Berhasil", description: "Quiz telah direset ke konten standar." });
        }
    }

    const addCategory = () => {
        if (!newCategoryName) return;
        const newId = Math.max(0, ...quizConfig.map(c => c.id)) + 1;
        setQuizConfig([...quizConfig, { id: newId, label: newCategoryName, color: newCategoryColor, items: [] }]);
        setNewCategoryName('');
    };
    const removeCategory = (id) => setQuizConfig(prev => prev.filter(c => c.id !== id));
    
    const addItem = (catId, item) => {
        if(!item) return;
        setQuizConfig(prev => prev.map(c => c.id === catId ? { ...c, items: [...c.items, item] } : c));
    };
    const removeItem = (catId, idx) => {
        setQuizConfig(prev => prev.map(c => c.id === catId ? { ...c, items: c.items.filter((_, i) => i !== idx) } : c));
    };

    return (
        <div className="game-config-panel game-config-panel--quiz space-y-6">
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-full text-yellow-600 dark:text-yellow-400"><Lock className="w-5 h-5"/></div>
                    <div>
                        <Label>PIN Akses Pengaturan (di Halaman Game)</Label>
                        <Input type="text" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} className="w-32 mt-1 font-mono tracking-widest"/>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={resetToDefaults}><RefreshCw className="w-4 h-4 mr-2"/> Reset</Button>
                    <Button onClick={saveQuizConfig} disabled={isLoading}><Save className="w-4 h-4 mr-2"/> Simpan Semua Konfigurasi</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 h-fit">
                    <CardHeader><CardTitle>Tambah Kategori</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div><Label>Nama Kategori</Label><Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Misal: Hadits"/></div>
                        <div><Label>Warna</Label><Input type="color" value={newCategoryColor} onChange={e => setNewCategoryColor(e.target.value)} className="h-10 cursor-pointer w-full"/></div>
                        <Button onClick={addCategory} className="w-full" variant="outline"><Plus className="w-4 h-4 mr-2"/> Tambah</Button>
                    </CardContent>
                </Card>

                <div className="md:col-span-2 space-y-4">
                    {quizConfig.map(cat => (
                        <Card key={cat.id}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-lg flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={{background: cat.color}}></div> {cat.label}</CardTitle>
                                    <Button variant="ghost" size="sm" onClick={() => removeCategory(cat.id)} className="text-red-500"><Trash2 className="w-4 h-4"/></Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <Input id={`new-item-${cat.id}`} placeholder="Tambah pertanyaan/item..." className="h-8 text-sm" onKeyDown={(e) => { if(e.key==='Enter'){ addItem(cat.id, e.currentTarget.value); e.currentTarget.value=''; }}}/>
                                        <Button size="sm" onClick={() => { const el = document.getElementById(`new-item-${cat.id}`); addItem(cat.id, el.value); el.value=''; }}><Plus className="w-4 h-4"/></Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {cat.items.map((item, idx) => (
                                            <div key={idx} className="bg-secondary px-3 py-1 rounded-full text-xs flex items-center gap-2">
                                                {item}
                                                <button onClick={() => removeItem(cat.id, idx)} className="hover:text-red-500"><X className="w-3 h-3"/></button>
                                            </div>
                                        ))}
                                        {cat.items.length === 0 && <span className="text-xs text-muted-foreground italic">Belum ada item</span>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};

const createDefaultLevelConfig = () => ({
    male: [
        { id: 1, name: 'Pemula', min: 0, max: 100, color: '#3b82f6', cardBgColor: '#ffffff', textColor: '#3b82f6', cardBorderThickness: 8, avatarBorderThickness: 4, enableGradient: true, textGradient: true },
        { id: 2, name: 'Menengah', min: 101, max: 300, color: '#22c55e', cardBgColor: '#ffffff', textColor: '#22c55e', cardBorderThickness: 10, avatarBorderThickness: 5, enableGradient: true, textGradient: true },
        { id: 3, name: 'Mahir', min: 301, max: 1000, color: '#eab308', cardBgColor: '#ffffff', textColor: '#eab308', cardBorderThickness: 12, avatarBorderThickness: 6, enableGradient: true, textGradient: true }
    ],
    female: [
        { id: 1, name: 'Pemula', min: 0, max: 100, color: '#ec4899', cardBgColor: '#ffffff', textColor: '#ec4899', cardBorderThickness: 8, avatarBorderThickness: 4, enableGradient: true, textGradient: true },
        { id: 2, name: 'Menengah', min: 101, max: 300, color: '#a855f7', cardBgColor: '#ffffff', textColor: '#a855f7', cardBorderThickness: 10, avatarBorderThickness: 5, enableGradient: true, textGradient: true },
        { id: 3, name: 'Mahir', min: 301, max: 1000, color: '#f43f5e', cardBgColor: '#ffffff', textColor: '#f43f5e', cardBorderThickness: 12, avatarBorderThickness: 6, enableGradient: true, textGradient: true }
    ]
});

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

const LevelSettings = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [levelConfig, setLevelConfig] = useState(createDefaultLevelConfig);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const { data } = await supabase.from('website_content').select('content').eq('key', 'level_config').maybeSingle();
            if (data?.content) {
                setLevelConfig({
                    male: (data.content.male || []).map((level) => normalizeLevel(level, '#3b82f6')),
                    female: (data.content.female || []).map((level) => normalizeLevel(level, '#ec4899'))
                });
            }
            setIsLoading(false);
        };
        load();
    }, []);

    const saveLevelConfig = async () => {
        setIsLoading(true);
        const normalizedConfig = {
            male: levelConfig.male.map((level) => normalizeLevel(level, '#3b82f6')).sort((a, b) => a.min - b.min),
            female: levelConfig.female.map((level) => normalizeLevel(level, '#ec4899')).sort((a, b) => a.min - b.min)
        };
        const { error } = await supabase.from('website_content').upsert(
            { key: 'level_config', content: normalizedConfig },
            { onConflict: 'key' }
        );

        if (error) {
            toast({ title: "Gagal Simpan", description: error.message, variant: "destructive" });
        } else {
            setLevelConfig(normalizedConfig);
            toast({ title: "Berhasil", description: "Konfigurasi level langsung terhubung ke profile card santri." });
        }
        setIsLoading(false);
    };

    const updateLevel = (gender, id, field, value) => {
        setLevelConfig((previous) => ({
            ...previous,
            [gender]: previous[gender].map((level) => level.id === id ? { ...level, [field]: value } : level)
        }));
    };

    const addLevel = (gender) => {
        const newId = Math.max(0, ...levelConfig[gender].map((level) => level.id)) + 1;
        const color = gender === 'female' ? '#ec4899' : '#3b82f6';
        setLevelConfig((previous) => ({
            ...previous,
            [gender]: [
                ...previous[gender],
                normalizeLevel({
                    id: newId,
                    name: 'Level Baru',
                    min: 0,
                    max: 0,
                    color,
                    cardBorderThickness: 8,
                    avatarBorderThickness: 4
                }, color)
            ]
        }));
    };

    const removeLevel = (gender, id) => {
        setLevelConfig((previous) => ({
            ...previous,
            [gender]: previous[gender].filter((level) => level.id !== id)
        }));
    };

    const LevelList = ({ gender, levels }) => (
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
                            <Input type="number" value={level.min} onChange={(event) => updateLevel(gender, level.id, 'min', Number.parseInt(event.target.value, 10) || 0)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label className="text-xs font-semibold">Max Poin</Label>
                            <Input type="number" value={level.max} onChange={(event) => updateLevel(gender, level.id, 'max', Number.parseInt(event.target.value, 10) || 0)} />
                        </div>
                        <div className="md:col-span-3">
                            <Label className="text-xs font-semibold">Warna Aksen</Label>
                            <Input type="color" value={level.color} onChange={(event) => updateLevel(gender, level.id, 'color', event.target.value)} className="h-10 cursor-pointer w-full" />
                        </div>
                        <div className="md:col-span-1 flex justify-center">
                            <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => removeLevel(gender, level.id)} aria-label="Hapus level">
                                <Trash2 className="w-4 h-4" />
                            </Button>
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
            <Button variant="outline" onClick={() => addLevel(gender)} className="game-level-add w-full">
                <Plus className="w-4 h-4 mr-2" /> Tambah Level
            </Button>
        </div>
    );

    return (
        <div className="game-config-panel game-config-panel--levels space-y-6">
            <div className="game-config-section-heading">
                <div>
                    <h3 className="text-lg font-black">Level & Visual Profile Card</h3>
                    <p className="text-sm text-muted-foreground">Atur rentang poin, nama level, warna aksen, serta depth neumorphic untuk santri putra dan putri.</p>
                </div>
                <Button onClick={saveLevelConfig} disabled={isLoading} className="game-config-save">
                    <Save className="w-4 h-4 mr-2"/> Simpan Konfigurasi Level
                </Button>
            </div>
            
            <Tabs defaultValue="male" className="w-full">
                <TabsList className="game-level-gender-tabs w-full grid grid-cols-2">
                    <TabsTrigger value="male"><User className="w-4 h-4 mr-2"/> Santri Putra</TabsTrigger>
                    <TabsTrigger value="female"><UserCheck className="w-4 h-4 mr-2"/> Santri Putri</TabsTrigger>
                </TabsList>
                <TabsContent value="male" className="mt-5">
                    <LevelList gender="male" levels={levelConfig.male} />
                </TabsContent>
                <TabsContent value="female" className="mt-5">
                    <LevelList gender="female" levels={levelConfig.female} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default GameConfiguration;