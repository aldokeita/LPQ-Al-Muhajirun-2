import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Blocks, BookOpen, Building2, ClipboardList, Eye, EyeOff, FilePlus2, Home, MonitorPlay, Newspaper, Pencil, RefreshCw, Save, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import {
  deletePublicContentBlock,
  fetchAdminPublicContentBlocks,
  getPublicContentErrorMessage,
  PUBLIC_BLOCK_TYPES,
  PUBLIC_PAGE_DEFINITIONS,
  PUBLIC_PAGE_GROUPS,
  savePublicContentBlock,
} from '@/lib/publicPageContentAdapters';

const GROUP_ICONS = {
  home: Home,
  registration: ClipboardList,
  learning: BookOpen,
  parenting: Users,
  institution: Building2,
  publication: Newspaper,
  display: MonitorPlay,
};
const blankBlock = (pageKey) => ({
  page_key: pageKey,
  block_key: '',
  block_type: 'rich_text',
  title: '',
  sort_order: 0,
  is_visible: true,
  contentJson: '{\n  "body": ""\n}',
});

const blockToForm = (block) => ({
  page_key: block.page_key,
  block_key: block.block_key,
  block_type: block.block_type,
  title: block.title,
  sort_order: block.sort_order,
  is_visible: block.is_visible,
  contentJson: JSON.stringify(block.content || {}, null, 2),
  id: block.id,
});

const getBlockErrorMessage = (error) => {
  if (error?.code === '42P01' || error?.code === 'PGRST205' || /public_content_blocks/i.test(error?.message || '')) {
    return 'Struktur blok konten belum diterapkan pada backend. Minta admin menerapkan migration konten publik terlebih dahulu.';
  }
  return getPublicContentErrorMessage(error);
};

const getBlockPreview = (block) => {
  const content = block?.content || {};
  if (typeof content.body === 'string' && content.body.trim()) return content.body.trim();
  if (typeof content.url === 'string' && content.url.trim()) return content.url.trim();
  if (Array.isArray(content.items)) return `${content.items.length} item tersimpan`;
  return 'Blok siap diisi';
};

const PublicBlockManager = ({ pageKey, pageLabel }) => {
  const [blocks, setBlocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState(() => blankBlock(pageKey));
  const [isSaving, setIsSaving] = useState(false);

  const loadBlocks = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setBlocks(await fetchAdminPublicContentBlocks(pageKey));
    } catch (loadError) {
      setBlocks([]);
      setError(getBlockErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [pageKey]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  const openNew = () => {
    setForm(blankBlock(pageKey));
    setIsEditorOpen(true);
  };

  const openEdit = (block) => {
    setForm(blockToForm(block));
    setIsEditorOpen(true);
  };

  const handleSave = async () => {
    let content;
    try {
      content = JSON.parse(form.contentJson || '{}');
    } catch {
      toast({ title: 'Format isi belum valid', description: 'Isi konten harus berupa JSON yang valid.', variant: 'destructive' });
      return;
    }
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      toast({ title: 'Format isi belum valid', description: 'Isi konten harus berupa objek JSON.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      await savePublicContentBlock({ ...form, content });
      toast({ title: 'Blok tersimpan', description: `${form.title || 'Blok konten'} siap digunakan pada halaman ${pageLabel}.` });
      setIsEditorOpen(false);
      await loadBlocks();
    } catch (saveError) {
      toast({ title: 'Blok gagal disimpan', description: getBlockErrorMessage(saveError), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (block) => {
    if (!window.confirm(`Hapus blok "${block.title}" dari halaman ${pageLabel}?`)) return;
    try {
      await deletePublicContentBlock(block.id);
      toast({ title: 'Blok dihapus', description: 'Blok konten berhasil dihapus.' });
      await loadBlocks();
    } catch (deleteError) {
      toast({ title: 'Blok gagal dihapus', description: getBlockErrorMessage(deleteError), variant: 'destructive' });
    }
  };

  return (
    <section className="admin-card mt-6 p-4 sm:p-6" aria-labelledby={`public-blocks-${pageKey}`}>
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id={`public-blocks-${pageKey}`} className="flex items-center gap-2 text-lg font-bold sm:text-xl">
            <Blocks className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
            Blok modular halaman
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tambahkan elemen baru yang dapat dikembangkan tanpa mengubah kontrak konten lama. Blok hanya tampil ke publik saat diaktifkan.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={loadBlocks} disabled={isLoading} aria-label="Muat ulang blok konten">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Muat ulang
          </Button>
          <Button type="button" size="sm" onClick={openNew}>
            <FilePlus2 className="mr-2 h-4 w-4" /> Tambah blok
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-amber-300/70 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-950/20 dark:text-amber-100" role="alert">
          <p className="font-semibold">Blok modular belum dapat dimuat</p>
          <p className="mt-1">{error}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadBlocks}>Coba lagi</Button>
        </div>
      ) : isLoading ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2" aria-live="polite" aria-busy="true">
          {[1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-muted/60" />)}
        </div>
      ) : blocks.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Blocks className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p>Belum ada blok tambahan di halaman {pageLabel}.</p>
          <p className="mt-1 text-xs">Editor lama tetap menggunakan data website_content yang sudah ada.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2" aria-live="polite">
          {blocks.map((block) => (
            <article key={block.id} className={`rounded-xl border p-4 transition-colors ${block.is_visible ? 'bg-background' : 'bg-muted/40 opacity-75'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate font-semibold">{block.title}</h4>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{block.block_type}</span>
                    {block.is_visible ? <Eye className="h-3.5 w-3.5 text-emerald-600" aria-label="Tampil" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" aria-label="Disembunyikan" />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{getBlockPreview(block)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Urutan {block.sort_order} · {block.block_key}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(block)} aria-label={`Edit blok ${block.title}`}><Pencil className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(block)} aria-label={`Hapus blok ${block.title}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit' : 'Tambah'} blok {pageLabel}</DialogTitle>
            <DialogDescription>Isi data blok secara terstruktur. Perubahan tersimpan ke halaman yang sedang dipilih.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor={`block-key-${pageKey}`}>Identifier blok</label>
                <Input id={`block-key-${pageKey}`} value={form.block_key} onChange={(event) => setForm((prev) => ({ ...prev, block_key: event.target.value }))} placeholder="contoh: nilai-utama" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor={`block-title-${pageKey}`}>Judul blok</label>
                <Input id={`block-title-${pageKey}`} value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Judul yang terlihat admin" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-2">
                <label className="text-sm font-medium">Jenis blok</label>
                <Select value={form.block_type} onValueChange={(value) => setForm((prev) => ({ ...prev, block_type: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PUBLIC_BLOCK_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor={`block-order-${pageKey}`}>Urutan</label>
                <Input id={`block-order-${pageKey}`} type="number" min="0" step="1" value={form.sort_order} onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div><p className="text-sm font-medium">Tampilkan ke publik</p><p className="text-xs text-muted-foreground">Nonaktifkan sementara tanpa menghapus blok.</p></div>
              <Switch checked={form.is_visible} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_visible: checked }))} aria-label="Tampilkan blok ke publik" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={`block-content-${pageKey}`}>Isi JSON</label>
              <Textarea id={`block-content-${pageKey}`} rows={10} value={form.contentJson} onChange={(event) => setForm((prev) => ({ ...prev, contentJson: event.target.value }))} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">Contoh teks: <code>{'{ "body": "Isi konten" }'}</code>. Untuk media dapat memakai <code>url</code>, <code>alt</code>, atau <code>items</code>.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsEditorOpen(false)}>Batal</Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}><Save className="mr-2 h-4 w-4" />{isSaving ? 'Menyimpan…' : 'Simpan blok'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

const PublicContentHub = ({ sections = {} }) => {
  const [activePage, setActivePage] = useState('home');
  const activeGroup = useMemo(
    () => PUBLIC_PAGE_GROUPS.find((group) => group.pages.includes(activePage)) || PUBLIC_PAGE_GROUPS[0],
    [activePage],
  );
  const activeGroupPages = useMemo(
    () => activeGroup.pages.map((pageKey) => PUBLIC_PAGE_DEFINITIONS.find((page) => page.key === pageKey)).filter(Boolean),
    [activeGroup],
  );
  const activeDefinition = useMemo(
    () => PUBLIC_PAGE_DEFINITIONS.find((page) => page.key === activePage) || PUBLIC_PAGE_DEFINITIONS[0],
    [activePage],
  );

  return (
    <section className="space-y-5" aria-labelledby="public-content-hub-title">
      <div className="rounded-2xl border border-cyan-200/70 bg-gradient-to-br from-cyan-50/90 via-white/75 to-violet-50/75 p-4 shadow-sm dark:border-cyan-300/10 dark:from-cyan-950/30 dark:via-slate-950/40 dark:to-violet-950/25 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/70 bg-white/70 p-2 text-cyan-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-cyan-200"><Blocks className="h-5 w-5" /></div>
          <div>
            <h3 id="public-content-hub-title" className="font-bold sm:text-lg">Halaman Publik</h3>
            <p className="mt-1 text-sm text-muted-foreground">Satu pusat untuk mengelola seluruh halaman publik. Editor lama tetap memakai key dan data yang sama agar konten tidak hilang.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/25 p-2 shadow-sm dark:bg-white/[0.03] sm:p-3">
        <div role="tablist" aria-label="Kelompok halaman publik" className="flex flex-wrap gap-2">
          {PUBLIC_PAGE_GROUPS.map((group) => {
            const Icon = GROUP_ICONS[group.key] || Blocks;
            const isActive = activeGroup.key === group.key;

            return (
              <button
                key={group.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={'public-subnav-' + group.key}
                onClick={() => setActivePage(group.pages[0])}
                className={'inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ' + (isActive ? 'border-cyan-400/70 bg-cyan-600 text-white shadow-md shadow-cyan-900/15 dark:border-cyan-300/40 dark:bg-cyan-500/20 dark:text-cyan-100' : 'border-border/80 bg-background/75 text-muted-foreground hover:-translate-y-0.5 hover:border-cyan-300/70 hover:bg-cyan-50/70 hover:text-foreground dark:bg-background/35 dark:hover:bg-cyan-950/30')}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{group.label}</span>
                <span className={'rounded-full px-1.5 py-0.5 text-[10px] leading-none ' + (isActive ? 'bg-white/20 text-white dark:bg-cyan-100/15 dark:text-cyan-100' : 'bg-muted text-muted-foreground')}>
                  {group.pages.length}
                </span>
              </button>
            );
          })}
        </div>

        <div id={'public-subnav-' + activeGroup.key} className="mt-3 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{activeGroup.description}</p>
            <span className="text-[11px] font-medium text-muted-foreground">{activeGroupPages.length} halaman dalam kelompok ini</span>
          </div>
          <div role="tablist" aria-label={'Halaman ' + activeGroup.label} className="mt-2 flex flex-wrap gap-2">
            {activeGroupPages.map((page) => (
              <button
                key={page.key}
                type="button"
                role="tab"
                aria-selected={activePage === page.key}
                aria-controls={'public-panel-' + page.key}
                onClick={() => setActivePage(page.key)}
                className={'min-h-9 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ' + (activePage === page.key ? 'border-foreground bg-foreground text-background shadow-sm dark:border-cyan-200/40 dark:bg-cyan-100 dark:text-slate-950' : 'border-border/70 bg-background/65 text-muted-foreground hover:border-cyan-300/70 hover:text-foreground dark:bg-background/25')}
              >
                {page.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div id={`public-panel-${activePage}`} role="tabpanel" tabIndex={0} className="space-y-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
        {sections[activePage] || (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Editor halaman {activeDefinition.label} siap ditambahkan melalui blok modular.
          </div>
        )}
        <PublicBlockManager pageKey={activePage} pageLabel={activeDefinition.label} />
      </div>
    </section>
  );
};

export default PublicContentHub;
