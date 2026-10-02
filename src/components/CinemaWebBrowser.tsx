import React, { useState, useEffect } from 'react';
import {
  Globe,
  Search,
  ArrowLeft,
  RotateCcw,
  ExternalLink,
  Film,
  Sparkles,
  Tv,
  Maximize2,
  X,
  Volume2,
  CheckCircle2,
  Play,
  Layers,
} from 'lucide-react';
import { VideoItem, ScreenConfig, AmbilightConfig } from '../types';

interface CinemaWebBrowserProps {
  currentVideo: VideoItem;
  onSelectVideo: (video: VideoItem) => void;
  onCloseBrowser?: () => void;
  screenConfig: ScreenConfig;
  ambilightConfig: AmbilightConfig;
}

interface CuratedCard {
  id: string;
  title: string;
  category: string;
  duration: string;
  youtubeId?: string;
  twitchChannel?: string;
  thumbnail: string;
  description: string;
}

const CURATED_CONTENT: CuratedCard[] = [
  // Trailers IMAX
  {
    id: 'yt-dune2',
    title: 'Dune: Deuxième Partie - Bande-annonce IMAX',
    category: 'Cinéma IMAX',
    duration: '3:02',
    youtubeId: 'Way9Dexny3w',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
    description: 'Bande-annonce spectaculaire de Dune Part Two en qualité cinéma numérique.',
  },
  {
    id: 'yt-avatar2',
    title: 'Avatar: La Voie de l\'Eau - Bande-annonce 4K',
    category: 'Cinéma IMAX',
    duration: '2:28',
    youtubeId: 'd9MyW72ELq0',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    description: 'Découvrez le monde sous-marin de Pandora en immersion grand écran.',
  },
  {
    id: 'yt-interstellar',
    title: 'Interstellar - Bande-annonce 10e Anniversaire 4K',
    category: 'Cinéma IMAX',
    duration: '2:34',
    youtubeId: 'zSWdZVtXT7E',
    thumbnail: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
    description: 'Le chef-d\'œuvre de Christopher Nolan au format cinéma géant.',
  },
  {
    id: 'yt-oppenheimer',
    title: 'Oppenheimer - Bande-annonce Officielle 70mm',
    category: 'Cinéma IMAX',
    duration: '3:06',
    youtubeId: 'uYPbbksJxIg',
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
    description: 'L\'expérience cinématographique historique filmée en pellicule IMAX 70mm.',
  },
  // Nature & Cosmos 4K
  {
    id: 'yt-cosmos',
    title: 'Voyage aux confins du Cosmos - Télescope James Webb 4K',
    category: 'Espace & Nature',
    duration: '14:20',
    youtubeId: '21X5lGlDOfg',
    thumbnail: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&auto=format&fit=crop&q=80',
    description: 'Exploration des nébuleuses et galaxies lointaines en ultra haute définition.',
  },
  {
    id: 'yt-aurora',
    title: 'Aurores Boréales en Norvège 4K HDR',
    category: 'Espace & Nature',
    duration: '10:45',
    youtubeId: '1MiTcC_O33E',
    thumbnail: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&auto=format&fit=crop&q=80',
    description: 'Spectacle céleste d\'aurores polaires nocturnes au-dessus des fjords.',
  },
  // Concerts & Musique
  {
    id: 'yt-lofi',
    title: 'Lofi Girl - Beats to relax / study to (Live 24/7)',
    category: 'Musique & Ambiance',
    duration: 'Direct 24/7',
    youtubeId: 'jfKfPfyJRdk',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
    description: 'Flux musical relaxant idéal pour une ambiance cinéma tamisée.',
  },
  {
    id: 'yt-queen',
    title: 'Queen - Live Aid 1985 (Remasterisé 4K 60FPS)',
    category: 'Concert Live',
    duration: '21:12',
    youtubeId: 'bdfK_4JqJ1M',
    thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
    description: 'Le légendaire concert de Wembley avec Freddie Mercury en qualité restaurée.',
  },
];

export const CinemaWebBrowser: React.FC<CinemaWebBrowserProps> = ({
  currentVideo,
  onSelectVideo,
  onCloseBrowser,
  screenConfig,
  ambilightConfig,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [embedUrl, setEmbedUrl] = useState<string | null>(() => {
    return currentVideo.isWebEmbed && currentVideo.webEmbedUrl ? currentVideo.webEmbedUrl : null;
  });
  const [history, setHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'youtube' | 'twitch' | 'url' | 'portal'>('portal');

  // Sync with currentVideo if it changes externally
  useEffect(() => {
    if (currentVideo.isWebEmbed && currentVideo.webEmbedUrl) {
      setEmbedUrl(currentVideo.webEmbedUrl);
    }
  }, [currentVideo]);

  // Intelligent parser for any web input, YouTube URL or search
  const handleNavigate = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // 1. YouTube standard URL (watch?v=...)
    const ytWatchMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (ytWatchMatch && ytWatchMatch[1]) {
      const vidId = ytWatchMatch[1];
      const targetEmbed = `https://www.youtube-nocookie.com/embed/${vidId}?autoplay=1&playsinline=1&rel=0&enablejsapi=1`;
      setEmbedUrl(targetEmbed);
      setHistory((prev) => [...prev, targetEmbed]);
      onSelectVideo({
        id: `yt-${vidId}`,
        title: `YouTube: ${vidId}`,
        subtitle: 'Lecture Web Cinéma',
        url: '',
        isWebEmbed: true,
        webEmbedUrl: targetEmbed,
        category: 'YouTube Web',
        description: 'Vidéo YouTube lue directement sur l\'écran cinéma.',
      });
      return;
    }

    // 2. Twitch Channel URL or handle
    const twitchMatch = trimmed.match(/twitch\.tv\/([a-zA-Z0-9_]{3,25})/i);
    if (twitchMatch && twitchMatch[1]) {
      const channel = twitchMatch[1];
      const host = window.location.hostname || 'localhost';
      const targetEmbed = `https://player.twitch.tv/?channel=${channel}&parent=${host}&autoplay=true`;
      setEmbedUrl(targetEmbed);
      setHistory((prev) => [...prev, targetEmbed]);
      onSelectVideo({
        id: `twitch-${channel}`,
        title: `Twitch: ${channel}`,
        subtitle: 'Direct Twitch Cinéma',
        url: '',
        isWebEmbed: true,
        webEmbedUrl: targetEmbed,
        category: 'Twitch',
        description: `Diffusion en direct de la chaîne Twitch ${channel}.`,
      });
      return;
    }

    // 3. Direct video URL (.mp4, .webm, .m3u8)
    if (trimmed.match(/\.(mp4|webm|m3u8|mov|mkv)(\?.*)?$/i)) {
      onSelectVideo({
        id: `direct-${Date.now()}`,
        title: trimmed.split('/').pop()?.split('?')[0] || 'Vidéo Web Directe',
        subtitle: 'Flux Vidéo Web HD',
        url: trimmed,
        isWebEmbed: false,
        category: 'Web Direct',
        description: 'Lecture vidéo Web en direct avec Ambilight 60 FPS.',
      });
      if (onCloseBrowser) onCloseBrowser();
      return;
    }

    // 4. General full URL (https://...)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      setEmbedUrl(trimmed);
      setHistory((prev) => [...prev, trimmed]);
      onSelectVideo({
        id: `web-${Date.now()}`,
        title: trimmed.replace(/^https?:\/\//, '').split('/')[0] || 'Page Web',
        subtitle: 'Navigateur Web Cinéma',
        url: '',
        isWebEmbed: true,
        webEmbedUrl: trimmed,
        category: 'Navigateur Web',
        description: `Navigation sur ${trimmed}`,
      });
      return;
    }

    // 5. Search query -> YouTube Search Embed
    const searchEmbed = `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(trimmed)}&autoplay=1`;
    setEmbedUrl(searchEmbed);
    setHistory((prev) => [...prev, searchEmbed]);
    onSelectVideo({
      id: `yt-search-${Date.now()}`,
      title: `Recherche: "${trimmed}"`,
      subtitle: 'Résultats YouTube Cinéma',
      url: '',
      isWebEmbed: true,
      webEmbedUrl: searchEmbed,
      category: 'YouTube Search',
      description: `Recherche YouTube pour "${trimmed}"`,
    });
  };

  const handleLaunchCard = (card: CuratedCard) => {
    if (card.youtubeId) {
      const targetEmbed = `https://www.youtube-nocookie.com/embed/${card.youtubeId}?autoplay=1&playsinline=1&rel=0&enablejsapi=1`;
      setEmbedUrl(targetEmbed);
      setUrlInput(`https://www.youtube.com/watch?v=${card.youtubeId}`);
      onSelectVideo({
        id: card.id,
        title: card.title,
        subtitle: card.category,
        url: '',
        isWebEmbed: true,
        webEmbedUrl: targetEmbed,
        category: card.category,
        description: card.description,
      });
    }
  };

  const handleGoHome = () => {
    setEmbedUrl(null);
    setUrlInput('');
  };

  // Filter curated cards
  const filteredCards = activeCategory === 'all'
    ? CURATED_CONTENT
    : CURATED_CONTENT.filter((c) => c.category === activeCategory);

  // Dynamic Ambilight ambient glow color for the web screen
  const glowColor = embedUrl?.includes('youtube')
    ? 'rgba(239, 68, 68, 0.45)' // Red YouTube glow
    : embedUrl?.includes('twitch')
    ? 'rgba(168, 85, 247, 0.45)' // Purple Twitch glow
    : 'rgba(56, 189, 248, 0.4)'; // Cyan IMAX glow

  return (
    <div className="absolute inset-0 pointer-events-auto flex flex-col items-center justify-center p-3 sm:p-6 z-20">
      {/* Dynamic Atmospheric Ambilight Halo behind the cinema screen */}
      <div
        className="absolute transition-all duration-700 pointer-events-none rounded-3xl"
        style={{
          width: 'min(94vw, 1340px)',
          height: 'min(78vh, 760px)',
          boxShadow: ambilightConfig.enabled
            ? `0 0 140px 45px ${glowColor}, 0 0 60px 20px ${glowColor}`
            : 'none',
          filter: 'blur(20px)',
          opacity: ambilightConfig.enabled ? ambilightConfig.intensity * 0.85 : 0,
        }}
      />

      {/* Screen Container (IMAX Curved Screen Perspective) */}
      <div
        className="relative flex flex-col w-full max-w-6xl h-[80vh] max-h-[820px] bg-slate-950/95 rounded-2xl sm:rounded-3xl border border-slate-700/60 shadow-2xl overflow-hidden backdrop-blur-2xl transition-all"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), inset 0 1px 2px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Cinema Web Browser Top Omnibar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs shrink-0 select-none">
          {/* Navigation Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleGoHome}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 font-medium ${
                !embedUrl ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Accueil Navigateur Cinéma"
            >
              <Film className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline text-[11px]">Portail Cinéma</span>
            </button>

            {embedUrl && (
              <button
                onClick={() => setEmbedUrl((prev) => (prev ? prev + '' : null))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Actualiser la page"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Omnibar Input (URL or YouTube search) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleNavigate(urlInput);
            }}
            className="flex-1 max-w-xl flex items-center min-w-[200px]"
          >
            <div className="relative w-full flex items-center">
              <div className="absolute left-3 text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Coller un lien YouTube / Twitch ou taper une recherche..."
                className="w-full pl-9 pr-20 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/40 font-mono transition-all"
              />
              <button
                type="submit"
                className="absolute right-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] transition-colors"
              >
                Aller
              </button>
            </div>
          </form>

          {/* Quick Access Badges & Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setUrlInput('https://www.youtube.com');
                handleNavigate('bande annonce imax 4k');
              }}
              className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-medium text-[11px] transition-all flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              YouTube
            </button>

            <button
              onClick={() => {
                setUrlInput('https://www.twitch.tv/directory');
                handleNavigate('https://player.twitch.tv/?channel=otplol&parent=' + (window.location.hostname || 'localhost'));
              }}
              className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-medium text-[11px] transition-all flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
              Twitch
            </button>

            {onCloseBrowser && (
              <button
                onClick={onCloseBrowser}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
                title="Fermer le navigateur et revenir au lecteur 3D"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Screen Display Area (Interactive IFrame or Portal Home) */}
        <div className="relative flex-1 w-full bg-black overflow-hidden flex flex-col">
          {embedUrl ? (
            /* Live Web / YouTube / Twitch IFrame Player */
            <div className="relative w-full h-full flex flex-col">
              <iframe
                src={embedUrl}
                title="Écran Cinéma Navigateur Web"
                className="w-full flex-1 border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />

              {/* Bottom Cinema Indicator */}
              <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-slate-200 font-medium truncate max-w-md">
                    {currentVideo.title || 'Diffusion Web Cinéma Active'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGoHome}
                    className="text-amber-400 hover:text-amber-300 font-medium text-[11px] flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Changer de vidéo (Portail)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Cinema Portal Home (Curated YouTube 4K & Quick Launch) */
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
              {/* Hero Banner */}
              <div className="relative rounded-2xl overflow-hidden p-6 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-slate-900 border border-amber-500/30 shadow-xl">
                <div className="max-w-2xl space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold border border-amber-500/40">
                    <Sparkles className="w-3.5 h-3.5" />
                    Navigateur Cinéma Intégré
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
                    Regardez n'importe quelle vidéo du Web en grand écran
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Plus besoin de partage d'écran complexe. Collez simplement un lien YouTube, cherchez un film ou choisissez une sélection ci-dessous pour lancer la vidéo immédiatement dans votre cinéma IMAX.
                  </p>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: 'Tout' },
                  { id: 'Cinéma IMAX', label: '🎬 Bandes-Annonces IMAX' },
                  { id: 'Espace & Nature', label: '🌌 Espace & Nature 4K' },
                  { id: 'Musique & Ambiance', label: '🎵 Musique & Ambiance' },
                  { id: 'Concert Live', label: '🎸 Concerts Live' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                      activeCategory === cat.id
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                        : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Grid of Curated Videos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredCards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => handleLaunchCard(card)}
                    className="group bg-slate-900/70 hover:bg-slate-850 rounded-2xl border border-slate-800/80 hover:border-amber-500/50 overflow-hidden shadow-lg transition-all duration-300 cursor-pointer flex flex-col"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                      <img
                        src={card.thumbnail}
                        alt={card.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                      
                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-11 h-11 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/40 transform scale-90 group-hover:scale-100 transition-transform">
                          <Play className="w-5 h-5 fill-current translate-x-0.5" />
                        </div>
                      </div>

                      {/* Duration Tag */}
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-sm rounded text-[10px] font-mono text-slate-200">
                        {card.duration}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">
                          {card.category}
                        </span>
                        <h3 className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                          {card.title}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
