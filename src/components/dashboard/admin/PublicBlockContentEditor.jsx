import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const updateField = (content, key, value) => ({
  ...content,
  [key]: value,
});

const Field = ({ label, hint, children }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium">{label}</label>
    {children}
    {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

const PublicBlockContentEditor = ({ blockType, content = {}, onChange }) => {
  if (blockType === 'image') {
    return (
      <div className="grid gap-4">
        <Field label="URL gambar" hint="Gunakan URL HTTPS dari bucket website-assets atau sumber gambar yang dipercaya.">
          <Input value={content.url || ''} onChange={(event) => onChange(updateField(content, 'url', event.target.value))} placeholder="https://..." inputMode="url" />
        </Field>
        <Field label="Teks alternatif">
          <Input value={content.alt || ''} onChange={(event) => onChange(updateField(content, 'alt', event.target.value))} placeholder="Deskripsi singkat gambar" />
        </Field>
        <Field label="Keterangan (opsional)">
          <Input value={content.caption || ''} onChange={(event) => onChange(updateField(content, 'caption', event.target.value))} placeholder="Keterangan yang tampil di bawah gambar" />
        </Field>
      </div>
    );
  }

  if (blockType === 'link') {
    return (
      <div className="grid gap-4">
        <Field label="Label tombol">
          <Input value={content.label || ''} onChange={(event) => onChange(updateField(content, 'label', event.target.value))} placeholder="Buka informasi" />
        </Field>
        <Field label="URL tautan" hint="Tautan harus menggunakan http:// atau https://.">
          <Input value={content.url || ''} onChange={(event) => onChange(updateField(content, 'url', event.target.value))} placeholder="https://..." inputMode="url" />
        </Field>
        <Field label="Cara membuka">
          <select
            value={content.target === '_self' ? '_self' : '_blank'}
            onChange={(event) => onChange(updateField(content, 'target', event.target.value))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="_blank">Tab baru</option>
            <option value="_self">Halaman saat ini</option>
          </select>
        </Field>
      </div>
    );
  }

  if (blockType === 'embed') {
    return (
      <div className="grid gap-4">
        <Field label="URL embed" hint="Untuk keamanan, hanya provider yang didukung aplikasi yang dapat ditampilkan.">
          <Input value={content.url || ''} onChange={(event) => onChange(updateField(content, 'url', event.target.value))} placeholder="https://www.youtube.com/..." inputMode="url" />
        </Field>
        <Field label="Judul embed">
          <Input value={content.title || ''} onChange={(event) => onChange(updateField(content, 'title', event.target.value))} placeholder="Judul media" />
        </Field>
      </div>
    );
  }

  if (blockType === 'cards') {
    const items = Array.isArray(content.items) ? content.items : [];
    const setItems = (nextItems) => onChange({ ...content, items: nextItems });
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Kartu konten</p>
            <p className="text-xs text-muted-foreground">Atur kartu satu per satu. Gambar dan tautan bersifat opsional.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { title: '', description: '', image_url: '', url: '', alt: '' }])}>
            <Plus className="mr-2 h-4 w-4" /> Tambah kartu
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Belum ada kartu.</div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={`public-card-${index}`} className="space-y-3 rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Kartu {index + 1}</p>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Hapus kartu ${index + 1}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Input value={item.title || ''} onChange={(event) => setItems(items.map((current, itemIndex) => itemIndex === index ? { ...current, title: event.target.value } : current))} placeholder="Judul kartu" />
                <Textarea value={item.description || item.body || ''} onChange={(event) => setItems(items.map((current, itemIndex) => itemIndex === index ? { ...current, description: event.target.value, body: undefined } : current))} placeholder="Deskripsi kartu" rows={3} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input value={item.image_url || item.imageUrl || ''} onChange={(event) => setItems(items.map((current, itemIndex) => itemIndex === index ? { ...current, image_url: event.target.value, imageUrl: undefined } : current))} placeholder="URL gambar (opsional)" inputMode="url" />
                  <Input value={item.url || item.href || ''} onChange={(event) => setItems(items.map((current, itemIndex) => itemIndex === index ? { ...current, url: event.target.value, href: undefined } : current))} placeholder="URL tautan (opsional)" inputMode="url" />
                </div>
                <Input value={item.alt || ''} onChange={(event) => setItems(items.map((current, itemIndex) => itemIndex === index ? { ...current, alt: event.target.value } : current))} placeholder="Teks alternatif gambar (opsional)" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Field label="Isi teks" hint="Gunakan paragraf pendek agar nyaman dibaca di desktop dan mobile.">
      <Textarea value={content.body || content.text || ''} onChange={(event) => onChange(updateField({ ...content, text: undefined }, 'body', event.target.value))} placeholder="Tulis isi konten halaman..." rows={7} />
    </Field>
  );
};

export default PublicBlockContentEditor;
