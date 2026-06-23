
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { User, Clock, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const getEmbedUrl = (url) => {
    if (!url) return null;
    let videoId = null;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.hostname.includes('youtube.com')) {
            if (urlObj.pathname.includes('/embed/')) {
                videoId = urlObj.pathname.split('/embed/')[1].split('?')[0];
            } else {
                videoId = urlObj.searchParams.get('v');
            }
        }
    } catch (e) {
        const embedMatch = url.match(/(?:https?:\/\/)?map(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?([\w-]{11})/);
        if (embedMatch) videoId = embedMatch[1];
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
};

const ParentingArticlePage = () => {
    const { articleId } = useParams();
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchArticle = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('website_content')
                .select('content')
                .eq('key', 'parentingArticles')
                .single();

            if (error && error.code !== 'PGRST116') {
                setError('Gagal memuat artikel.');
                console.error(error);
            } else if (data) {
                const articles = data.content || [];
                const foundArticle = articles.find(a => String(a.id) === articleId);
                if (foundArticle) {
                    setArticle(foundArticle);
                } else {
                    setError('Artikel tidak ditemukan.');
                }
            } else {
                setError('Artikel tidak ditemukan.');
            }
            setLoading(false);
        };
        fetchArticle();
    }, [articleId]);

    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('id-ID', options);
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Memuat artikel...</div>;
    }

    if (error) {
        return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>;
    }

    if (!article) {
        return <div className="flex justify-center items-center h-screen">Artikel tidak ditemukan.</div>;
    }

    const embedUrl = getEmbedUrl(article.youtube_url);

    return (
        <>
            <Helmet>
                <title>{article.title} - Parenting LPQ</title>
                <meta name="description" content={article.summary} />
            </Helmet>
            <div className="py-20 bg-gray-50 dark:bg-gray-900">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="mb-8">
                          <Button asChild variant="ghost">
                            <Link to="/parenting" className="flex items-center text-primary hover:underline">
                                <ChevronLeft className="w-5 h-5 mr-1" />
                                Kembali ke Semua Artikel
                            </Link>
                          </Button>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">{article.title}</h1>
                        <div className="flex items-center space-x-6 text-gray-500 dark:text-gray-400 mb-8">
                            <div className="flex items-center gap-2">
                                <User className="w-5 h-5" />
                                <span>{article.author}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5" />
                                <span>{formatDate(article.date)}</span>
                            </div>
                        </div>

                        <img src={article.image_url} alt={article.title} className="w-full h-auto max-h-[500px] object-cover rounded-2xl shadow-lg mb-8" />
                        
                        {embedUrl && (
                            <div className="aspect-video w-full mb-8 rounded-2xl overflow-hidden shadow-lg">
                                <iframe
                                    className="w-full h-full"
                                    src={embedUrl}
                                    title="YouTube video player"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            </div>
                        )}

                        <div className="prose dark:prose-invert max-none text-lg leading-relaxed text-gray-700 dark:text-gray-300">
                           <p className="whitespace-pre-line">{article.content}</p>
                        </div>
                    </motion.div>
                </div>
            </div>
        </>
    );
};

export default ParentingArticlePage;
