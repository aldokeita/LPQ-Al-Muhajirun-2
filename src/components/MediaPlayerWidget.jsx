import React, { useState } from 'react';
import { useMediaPlayer } from '@/hooks/useMediaPlayer';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Zap, Settings, Music } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MediaPlayerSettings from '@/components/dashboard/admin/MediaPlayerSettings';
import { motion } from 'framer-motion';

const MediaPlayerWidget = () => {
    const { 
        currentTrack, 
        isPlaying, 
        progress, 
        duration, 
        play, 
        pause, 
        togglePlay, 
        next, 
        previous, 
        seek,
        isShuffle,
        isLoop,
        isCrossfade,
        toggleShuffle,
        toggleLoop,
        toggleCrossfade,
        refreshPlaylist
    } = useMediaPlayer();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleSeek = (value) => {
        seek(value[0]);
    };

    return (
        <div className="w-full max-w-xl mx-auto my-2 px-4">
             <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
             >
                <div className="flex flex-col p-3 gap-2">
                    {/* Top Row: Track Info, Settings & Crossfade */}
                    <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all duration-500", isPlaying ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 scale-105" : "bg-slate-100 dark:bg-slate-800")}>
                                {isPlaying ? (
                                    <div className="flex items-end gap-0.5 h-4 pb-1">
                                        {[1,2,3].map(i => (
                                            <motion.div 
                                                key={i} 
                                                className="w-0.5 bg-white rounded-full"
                                                animate={{ height: [3, 10, 3] }}
                                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <Music className="w-5 h-5 text-slate-400" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-slate-800 dark:text-white truncate text-sm leading-tight">
                                    {currentTrack?.title || "Tidak ada lagu"}
                                </h3>
                                <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                                    {currentTrack?.artist || "Pilih lagu di pengaturan"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn("h-7 w-7 rounded-full", isCrossfade ? "text-purple-500 bg-purple-50 dark:bg-purple-900/30" : "text-slate-400")}
                                onClick={toggleCrossfade}
                                title="Crossfade"
                            >
                                <Zap className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                onClick={() => setIsSettingsOpen(true)}
                                title="Pengaturan & Playlist"
                            >
                                <Settings className="w-3.5 h-3.5 animate-spin-slow hover:animate-spin" style={{ animationDuration: '3s' }} />
                            </Button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 dark:text-slate-400 w-full px-1">
                        <span className="w-7 text-right tabular-nums">{formatTime(progress)}</span>
                        <Slider 
                            value={[progress]} 
                            max={duration || 100} 
                            step={1} 
                            onValueChange={handleSeek}
                            className="flex-1 cursor-pointer h-1.5"
                        />
                        <span className="w-7 tabular-nums">{formatTime(duration)}</span>
                    </div>

                    {/* Controls Row */}
                    <div className="flex items-center justify-center gap-4 w-full">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn("h-8 w-8 rounded-full transition-colors", isShuffle ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30" : "text-slate-400 hover:text-slate-600")}
                            onClick={toggleShuffle}
                            title="Acak (Shuffle)"
                        >
                            <Shuffle className="w-4 h-4" />
                        </Button>
                        
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={previous}>
                            <SkipBack className="w-5 h-5 fill-current" />
                        </Button>
                        
                        <Button 
                            className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:scale-105 transition-all flex items-center justify-center"
                            onClick={togglePlay}
                        >
                            {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
                        </Button>
                        
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={next}>
                            <SkipForward className="w-5 h-5 fill-current" />
                        </Button>
                        
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn("h-8 w-8 rounded-full transition-colors", isLoop ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30" : "text-slate-400 hover:text-slate-600")}
                            onClick={toggleLoop}
                            title="Ulang (Loop)"
                        >
                            <Repeat className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
             </motion.div>

             <MediaPlayerSettings 
                isOpen={isSettingsOpen} 
                onOpenChange={setIsSettingsOpen} 
                onUpdate={refreshPlaylist} 
            />
        </div>
    );
};

export default MediaPlayerWidget;