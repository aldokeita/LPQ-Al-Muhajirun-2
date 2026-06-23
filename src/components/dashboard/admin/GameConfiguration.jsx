import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Save, Plus, Trash2, Percent, Gamepad2, Trophy, Lock, X, RefreshCw, BarChart2, User, UserCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
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
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-primary">Konfigurasi Permainan & Gamifikasi</h2>
            <p className="text-muted-foreground">Pusat pengaturan untuk Gatcha Game, Quiz Hafalan, dan Level Santri.</p>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex justify-start mb-6">
                    <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full gap-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    relative px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-out flex items-center gap-2
                                    ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}
                                `}
                            >
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="game-pill"
                                        className="absolute inset-0 bg-blue-600 dark:bg-blue-500 shadow-sm rounded-full"
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
        <div className="space-y-6">
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
        <div className="space-y-6">
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

const LevelSettings = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [levelConfig, setLevelConfig] = useState({
        male: [
            { id: 1, name: 'Pemula', min: 0, max: 100, color: '#3b82f6', enableGradient: true, cardBgColor: '#ffffff', textColor: '#333333', cardBorderThickness: 8, avatarBorderThickness: 4 },
            { id: 2, name: 'Menengah', min: 101, max: 300, color: '#22c55e', enableGradient: true, cardBgColor: '#ffffff', textColor: '#333333', cardBorderThickness: 8, avatarBorderThickness: 4 },
            { id: 3, name: 'Mahir', min: 301, max: 1000, color: '#eab308', enableGradient: true, cardBgColor: '#ffffff', textColor: '#333333', cardBorderThickness: 8, avatarBorderThickness: 4 }
        ],
        female: [
            { id: 1, name: 'Pemula', min: 0, max: 100, color: '#ec4899', enableGradient: true, cardBgColor: '#ffffff', textColor: '#333333', cardBorderThickness: 8, avatarBorderThickness: 4 },
            { id: 2, name: 'Menengah', min: 101, max: 300, color: '#a855f7', enableGradient: true, cardBgColor: '#ffffff', textColor: '#333333', cardBorderThickness: 8, avatarBorderThickness: 4 },
            { id: 3, name: 'Mahir', min: 301, max: 1000, color: '#f43f5e', enableGradient: true, cardBgColor: '#ffffff', textColor: '#333333', cardBorderThickness: 8, avatarBorderThickness: 4 }
        ]
    });

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const { data } = await supabase.from('website_content').select('content').eq('key', 'level_config').maybeSingle();
            if (data?.content) {
                const ensureFields = (levels) => levels.map(l => ({
                    ...l,
                    textColor: l.textColor || '#333333',
                    cardBorderThickness: l.cardBorderThickness || 8,
                    avatarBorderThickness: l.avatarBorderThickness || 4,
                    textGradient: l.textGradient || false
                }));
                setLevelConfig({
                    male: ensureFields(data.content.male || []),
                    female: ensureFields(data.content.female || [])
                });
            }
            setIsLoading(false);
        };
        load();
    }, []);

    const saveLevelConfig = async () => {
        setIsLoading(true);
        const { error } = await supabase.from('website_content').upsert({ key: 'level_config', content: levelConfig }, { onConflict: 'key' });
        if (error) toast({ title: "Gagal Simpan", description: error.message, variant: "destructive" });
        else toast({ title: "Berhasil", description: "Konfigurasi Level disimpan." });
        setIsLoading(false);
    };

    const updateLevel = (gender, id, field, value) => {
        setLevelConfig(prev => ({
            ...prev,
            [gender]: prev[gender].map(l => l.id === id ? { ...l, [field]: value } : l)
        }));
    };

    const addLevel = (gender) => {
        const newId = Math.max(0, ...levelConfig[gender].map(l => l.id)) + 1;
        setLevelConfig(prev => ({
            ...prev,
            [gender]: [...prev[gender], { id: newId, name: 'Level Baru', min: 0, max: 0, color: '#000000', enableGradient: false, cardBgColor: '#ffffff', textColor: '#333333', cardBorderThickness: 8, avatarBorderThickness: 4, textGradient: false }]
        }));
    };

    const removeLevel = (gender, id) => {
        setLevelConfig(prev => ({
            ...prev,
            [gender]: prev[gender].filter(l => l.id !== id)
        }));
    };

    const LevelList = ({ gender, levels }) => (
        <div className="space-y-4">
            {levels.map((level) => (
                <div key={level.id} className="flex flex-col gap-4 border p-4 rounded-lg bg-card shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-3 w-full"><Label className="text-xs">Nama Level</Label><Input value={level.name} onChange={(e) => updateLevel(gender, level.id, 'name', e.target.value)} /></div>
                        <div className="md:col-span-2 w-full"><Label className="text-xs">Min Poin</Label><Input type="number" value={level.min} onChange={(e) => updateLevel(gender, level.id, 'min', parseInt(e.target.value) || 0)} /></div>
                        <div className="md:col-span-2 w-full"><Label className="text-xs">Max Poin</Label><Input type="number" value={level.max} onChange={(e) => updateLevel(gender, level.id, 'max', parseInt(e.target.value) || 0)} /></div>
                        <div className="md:col-span-2 w-full"><Label className="text-xs">Warna Border</Label><Input type="color" value={level.color} onChange={(e) => updateLevel(gender, level.id, 'color', e.target.value)} className="h-10 cursor-pointer w-full" /></div>
                        <div className="md:col-span-2 w-full"><Label className="text-xs">Warna Teks</Label><Input type="color" value={level.textColor || '#333333'} onChange={(e) => updateLevel(gender, level.id, 'textColor', e.target.value)} className="h-10 cursor-pointer w-full" /></div>
                        <div className="md:col-span-2 w-full"><Label className="text-xs">Background Card</Label><Input type="color" value={level.cardBgColor || '#ffffff'} onChange={(e) => updateLevel(gender, level.id, 'cardBgColor', e.target.value)} className="h-10 cursor-pointer w-full" /></div>
                        <div className="md:col-span-2 w-full"><Label className="text-xs">Tebal Card (px)</Label><Input type="number" value={level.cardBorderThickness || 8} onChange={(e) => updateLevel(gender, level.id, 'cardBorderThickness', parseInt(e.target.value) || 0)} /></div>
                        <div className="md:col-span-2 w-full"><Label className="text-xs">Tebal Avatar (px)</Label><Input type="number" value={level.avatarBorderThickness || 4} onChange={(e) => updateLevel(gender, level.id, 'avatarBorderThickness', parseInt(e.target.value) || 0)} /></div>
                        <div className="md:col-span-1 flex justify-center"><Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => removeLevel(gender, level.id)}><Trash2 className="w-4 h-4" /></Button></div>
                    </div>
                    <div className="flex flex-col gap-2 border-t pt-3">
                        <div className="flex items-center gap-2">
                            <Checkbox id={`grad-${gender}-${level.id}`} checked={level.enableGradient || false} onCheckedChange={(c) => updateLevel(gender, level.id, 'enableGradient', c)}/>
                            <Label htmlFor={`grad-${gender}-${level.id}`} className="cursor-pointer text-sm">Aktifkan Efek Gradient & Glow (Border)</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id={`txtgrad-${gender}-${level.id}`} checked={level.textGradient || false} onCheckedChange={(c) => updateLevel(gender, level.id, 'textGradient', c)}/>
                            <Label htmlFor={`txtgrad-${gender}-${level.id}`} className="cursor-pointer text-sm">Aktifkan Efek Gradient Teks</Label>
                        </div>
                    </div>
                </div>
            ))}
            <Button variant="outline" onClick={() => addLevel(gender)} className="w-full border-dashed"><Plus className="w-4 h-4 mr-2" /> Tambah Level</Button>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Pengaturan Level & Poin</h3>
                <Button onClick={saveLevelConfig} disabled={isLoading}><Save className="w-4 h-4 mr-2"/> Simpan Konfigurasi Level</Button>
            </div>
            
            <Tabs defaultValue="male" className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="male"><User className="w-4 h-4 mr-2"/> Santri Putra</TabsTrigger>
                    <TabsTrigger value="female"><UserCheck className="w-4 h-4 mr-2"/> Santri Putri</TabsTrigger>
                </TabsList>
                <TabsContent value="male" className="mt-4">
                    <LevelList gender="male" levels={levelConfig.male} />
                </TabsContent>
                <TabsContent value="female" className="mt-4">
                    <LevelList gender="female" levels={levelConfig.female} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default GameConfiguration;