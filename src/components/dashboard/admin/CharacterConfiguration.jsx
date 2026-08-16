import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BookHeart,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import {
  createCharacterAssessmentItem,
  createCharacterStrengthItem,
  fetchCharacterAssessmentItems,
  fetchCharacterStrengthItems,
  getAcademicErrorMessage,
  moveCharacterAssessmentItem,
  moveCharacterStrengthItem,
  updateCharacterAssessmentItem,
  updateCharacterStrengthItem
} from '@/lib/academicAdapters';

const createStrengthKey = (label) => {
  const slug = String(label || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'kategori';
  const suffix = globalThis.crypto?.randomUUID?.() || String(Date.now());
  return 'custom-' + slug + '-' + suffix;
};

const CategoryPanel = ({
  title,
  description,
  icon: Icon,
  accentClass,
  items,
  getKey,
  getLabel,
  getOrder,
  getActive,
  onAdd,
  onUpdate,
  onToggle,
  onMove,
  loading
}) => {
  const [draft, setDraft] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [savingKey, setSavingKey] = useState('');

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => Number(getOrder(a)) - Number(getOrder(b))),
    [getOrder, items]
  );

  const handleAdd = async () => {
    const value = draft.trim();
    if (!value) {
      toast({ title: 'Nama kategori belum diisi', description: 'Tulis nama kategori terlebih dahulu.', variant: 'destructive' });
      return;
    }
    setSavingKey('new');
    try {
      await onAdd(value);
      setDraft('');
      toast({ title: 'Kategori ditambahkan', description: value });
    } catch (error) {
      toast({ title: 'Kategori tidak tersimpan', description: getAcademicErrorMessage(error), variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const handleUpdate = async (item) => {
    const value = editingValue.trim();
    if (!value) {
      toast({ title: 'Nama kategori belum diisi', variant: 'destructive' });
      return;
    }
    const key = getKey(item);
    setSavingKey('edit-' + key);
    try {
      await onUpdate(item, value);
      setEditingKey(null);
      setEditingValue('');
      toast({ title: 'Kategori diperbarui' });
    } catch (error) {
      toast({ title: 'Kategori tidak diperbarui', description: getAcademicErrorMessage(error), variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const handleToggle = async (item) => {
    const key = getKey(item);
    const nextActive = !getActive(item);
    if (!nextActive && !window.confirm('Arsipkan kategori ini? Riwayat penilaian tetap dipertahankan, tetapi kategori tidak akan muncul pada penilaian baru.')) return;
    setSavingKey('toggle-' + key);
    try {
      await onToggle(item, nextActive);
      toast({ title: nextActive ? 'Kategori diaktifkan' : 'Kategori diarsipkan' });
    } catch (error) {
      toast({ title: 'Status kategori tidak berubah', description: getAcademicErrorMessage(error), variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const handleMove = async (item, direction) => {
    const key = getKey(item);
    setSavingKey('move-' + key);
    try {
      await onMove(item, direction);
    } catch (error) {
      toast({ title: 'Urutan kategori tidak berubah', description: getAcademicErrorMessage(error), variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  return (
    <Card className="overflow-hidden border-slate-200/80 shadow-sm dark:border-white/10">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className={'flex h-9 w-9 items-center justify-center rounded-xl ' + accentClass}>
            <Icon className="h-4.5 w-4.5" />
          </span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleAdd();
            }}
            placeholder="Nama kategori baru"
            aria-label={'Nama kategori baru untuk ' + title}
            maxLength={120}
          />
          <Button type="button" onClick={handleAdd} disabled={loading || savingKey === 'new'} aria-label={'Tambah kategori ' + title}>
            {savingKey === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="sr-only">Tambah</span>
          </Button>
        </div>

        <div className="space-y-2">
          {!sortedItems.length && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada kategori. Tambahkan kategori pertama.
            </div>
          )}
          {sortedItems.map((item, index) => {
            const key = getKey(item);
            const active = getActive(item);
            const busy = savingKey.includes(String(key));
            const isEditing = editingKey === key;
            return (
              <div
                key={key}
                className={'rounded-xl border p-3 transition-colors ' + (active ? 'bg-background' : 'bg-muted/30 opacity-75')}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <Input
                        value={editingValue}
                        onChange={(event) => setEditingValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handleUpdate(item);
                          if (event.key === 'Escape') {
                            setEditingKey(null);
                            setEditingValue('');
                          }
                        }}
                        autoFocus
                        maxLength={120}
                        aria-label="Edit nama kategori"
                      />
                    ) : (
                      <p className="truncate text-sm font-semibold">{getLabel(item)}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Urutan {getOrder(item)} · {active ? 'Aktif' : 'Diarsipkan'}
                    </p>
                  </div>
                  <Switch
                    checked={active}
                    onCheckedChange={() => handleToggle(item)}
                    disabled={loading || busy}
                    aria-label={(active ? 'Nonaktifkan ' : 'Aktifkan ') + getLabel(item)}
                  />
                </div>

                <div className="mt-3 flex items-center justify-end gap-1 border-t pt-2">
                  {isEditing ? (
                    <>
                      <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingKey(null); setEditingValue(''); }} disabled={busy}>
                        <X className="mr-1 h-3.5 w-3.5" /> Batal
                      </Button>
                      <Button type="button" size="sm" onClick={() => handleUpdate(item)} disabled={busy}>
                        {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />} Simpan
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleMove(item, 'up')}
                        disabled={loading || busy || index === 0}
                        aria-label={'Naikkan urutan ' + getLabel(item)}
                        title="Naikkan urutan"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleMove(item, 'down')}
                        disabled={loading || busy || index === sortedItems.length - 1}
                        aria-label={'Turunkan urutan ' + getLabel(item)}
                        title="Turunkan urutan"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => { setEditingKey(key); setEditingValue(getLabel(item)); }}
                        disabled={loading || busy}
                        aria-label={'Edit ' + getLabel(item)}
                        title="Edit kategori"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleToggle(item)}
                        disabled={loading || busy}
                        aria-label={(active ? 'Arsipkan ' : 'Aktifkan kembali ') + getLabel(item)}
                        title={active ? 'Arsipkan kategori' : 'Aktifkan kembali'}
                      >
                        {active ? <Archive className="h-4 w-4 text-amber-600" /> : <RotateCcw className="h-4 w-4 text-emerald-600" />}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const CharacterConfiguration = () => {
  const [assessmentItems, setAssessmentItems] = useState([]);
  const [strengthItems, setStrengthItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [nextAssessmentItems, nextStrengthItems] = await Promise.all([
        fetchCharacterAssessmentItems({ includeInactive: true }),
        fetchCharacterStrengthItems({ includeInactive: true })
      ]);
      setAssessmentItems(nextAssessmentItems);
      setStrengthItems(nextStrengthItems);
    } catch (error) {
      setLoadError(getAcademicErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addAssessment = async (itemName) => {
    const nextOrder = assessmentItems.reduce((max, item) => Math.max(max, Number(item.item_order) || 0), 0) + 1;
    await createCharacterAssessmentItem({ itemName, itemOrder: nextOrder });
    await load();
  };

  const updateAssessment = async (item, itemName) => {
    await updateCharacterAssessmentItem({ id: item.id, itemName });
    await load();
  };

  const toggleAssessment = async (item, isActive) => {
    await updateCharacterAssessmentItem({ id: item.id, isActive });
    await load();
  };

  const moveAssessment = async (item, direction) => {
    await moveCharacterAssessmentItem(item.id, direction);
    await load();
  };

  const addStrength = async (label) => {
    const nextOrder = strengthItems.reduce((max, item) => Math.max(max, Number(item.item_order) || 0), 0) + 1;
    await createCharacterStrengthItem({ strengthKey: createStrengthKey(label), label, itemOrder: nextOrder });
    await load();
  };

  const updateStrength = async (item, label) => {
    await updateCharacterStrengthItem({ strengthKey: item.strength_key, label });
    await load();
  };

  const toggleStrength = async (item, isActive) => {
    await updateCharacterStrengthItem({ strengthKey: item.strength_key, isActive });
    await load();
  };

  const moveStrength = async (item, direction) => {
    await moveCharacterStrengthItem(item.strength_key, direction);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-200/70 bg-gradient-to-r from-emerald-50 via-cyan-50 to-violet-50 p-5 dark:border-white/10 dark:from-emerald-950/30 dark:via-slate-900 dark:to-violet-950/30 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white/80 p-2.5 text-violet-700 shadow-sm dark:bg-white/10 dark:text-violet-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black">Karakter Santri</h3>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Kelola indikator perkembangan dan karakter unggulan secara terpisah. Kategori yang diarsipkan tidak muncul pada penilaian baru, sementara riwayat lama tetap aman.
            </p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200" role="alert">
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Coba lagi
          </Button>
        </div>
      )}

      {loading && !assessmentItems.length && !strengthItems.length ? (
        <div className="flex min-h-40 items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat konfigurasi karakter...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <CategoryPanel
            title="Perkembangan Karakter"
            description="Indikator yang dinilai guru menggunakan skala BB, MB, BSH, dan SB."
            icon={BookHeart}
            accentClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            items={assessmentItems}
            getKey={(item) => item.id}
            getLabel={(item) => item.item_name}
            getOrder={(item) => item.item_order}
            getActive={(item) => item.is_active}
            onAdd={addAssessment}
            onUpdate={updateAssessment}
            onToggle={toggleAssessment}
            onMove={moveAssessment}
            loading={loading}
          />
          <CategoryPanel
            title="Karakter Unggulan"
            description="Kekuatan positif yang dapat dicentang guru untuk setiap santri."
            icon={Sparkles}
            accentClass="bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
            items={strengthItems}
            getKey={(item) => item.strength_key}
            getLabel={(item) => item.label}
            getOrder={(item) => item.item_order}
            getActive={(item) => item.is_active}
            onAdd={addStrength}
            onUpdate={updateStrength}
            onToggle={toggleStrength}
            onMove={moveStrength}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
};

export default CharacterConfiguration;