import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Blocks, ExternalLink } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/customSupabaseClient';
import { fetchPublicContentBlocks } from '@/lib/publicPageContentAdapters';

const isSafeUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const getItems = (content) => (Array.isArray(content?.items) ? content.items : []);

const BlockText = ({ content }) => {
  const paragraphs = Array.isArray(content?.paragraphs)
    ? content.paragraphs
    : [content?.body || content?.text || ''];

  return (
    <div className="space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
      {paragraphs.filter((item) => typeof item === 'string' && item.trim()).map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 12)}-${index}`}>{paragraph}</p>
      ))}
    </div>
  );
};

const BlockImage = ({ content, title }) => {
  if (!isSafeUrl(content?.url)) return null;
  return (
    <figure className="overflow-hidden rounded-2xl border border-border/70 bg-muted/30">
      <img
        src={content.url}
        alt={content.alt || title}
        loading="lazy"
        width="1200"
        height="700"
        className="h-auto max-h-[32rem] w-full object-contain"
      />
      {content.caption ? <figcaption className="px-4 py-3 text-sm text-muted-foreground">{content.caption}</figcaption> : null}
    </figure>
  );
};

const BlockLink = ({ content }) => {
  if (!isSafeUrl(content?.url)) return null;
  return (
    <a
      href={content.url}
      target={content.target === '_self' ? undefined : '_blank'}
      rel={content.target === '_self' ? undefined : 'noopener noreferrer'}
      className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/60 bg-cyan-50/70 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-cyan-300/20 dark:bg-cyan-950/30 dark:text-cyan-100 dark:hover:bg-cyan-900/40"
    >
      {content.label || 'Buka informasi'}
      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
    </a>
  );
};

const BlockCards = ({ content }) => {
  const items = getItems(content);
  if (items.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => {
        const image = isSafeUrl(item?.image_url || item?.imageUrl) ? (item.image_url || item.imageUrl) : '';
        const href = isSafeUrl(item?.url || item?.href) ? (item.url || item.href) : '';
        const card = (
          <div className="h-full rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300/60 hover:shadow-md dark:bg-background/40">
            {image ? <img src={image} alt={item.alt || item.title || ''} loading="lazy" width="640" height="360" className="mb-4 aspect-video w-full rounded-xl object-cover" /> : null}
            <h4 className="font-semibold text-foreground">{item.title || 'Informasi'}</h4>
            {item.description || item.body ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description || item.body}</p> : null}
          </div>
        );
        return href ? (
          <a key={`${item.title || 'card'}-${index}`} href={href} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
            {card}
          </a>
        ) : <div key={`${item.title || 'card'}-${index}`}>{card}</div>;
      })}
    </div>
  );
};

const BlockEmbed = ({ content, title }) => {
  if (!isSafeUrl(content?.url)) return null;
  let hostname = '';
  try {
    hostname = new URL(content.url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const allowed = ['youtube.com', 'www.youtube.com', 'youtu.be', 'www.google.com', 'maps.google.com', 'canva.com', 'www.canva.com'];
  if (!allowed.some((host) => hostname === host || hostname.endsWith(`.${host}`))) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-black/5 dark:bg-white/5">
      <iframe
        src={content.url}
        title={content.title || title}
        loading="lazy"
        allowFullScreen
        className="aspect-video w-full"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
};

const renderBlockBody = (block) => {
  switch (block.block_type) {
    case 'image': return <BlockImage content={block.content} title={block.title} />;
    case 'link': return <BlockLink content={block.content} />;
    case 'cards': return <BlockCards content={block.content} />;
    case 'embed': return <BlockEmbed content={block.content} title={block.title} />;
    case 'rich_text':
    default: return <BlockText content={block.content} />;
  }
};

const PublicContentBlockRenderer = ({ pageKey, className = '' }) => {
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) return () => { active = false; };
    fetchPublicContentBlocks(pageKey)
      .then((data) => {
        if (active) setBlocks(data);
      })
      .catch(() => {
        // Modular content is additive. A missing migration or unavailable block must not break the legacy page.
        if (active) setBlocks([]);
      });
    return () => { active = false; };
  }, [pageKey]);

  if (blocks.length === 0) return null;

  return (
    <section className={`public-content-blocks w-full ${className}`} aria-label="Informasi tambahan">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-10 sm:px-6 lg:px-8">
        {blocks.map((block) => (
          <article key={block.id} className="rounded-3xl border border-cyan-200/60 bg-white/75 p-5 shadow-sm backdrop-blur-sm dark:border-cyan-300/10 dark:bg-slate-950/55 sm:p-7">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-xl border border-cyan-200/70 bg-cyan-50 p-2 text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-950/40 dark:text-cyan-200">
                <Blocks className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground sm:text-xl">{block.title}</h2>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Informasi LPQ</p>
              </div>
              {block.block_type === 'link' ? <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
            </div>
            {renderBlockBody(block)}
          </article>
        ))}
      </div>
    </section>
  );
};

export default PublicContentBlockRenderer;
