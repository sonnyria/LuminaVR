import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Sliders,
  Sparkles,
  Tv,
  Film,
  Compass,
  HelpCircle,
  FolderOpen,
  Globe,
  ExternalLink,
} from 'lucide-react';
import {
  AmbilightConfig,
  AmbilightSampleData,
  EnvironmentType,
  ScreenConfig,
  VideoItem,
} from '../types';

interface CinemaHUDProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  onSeek: (percent: number) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  currentVideo: VideoItem;
  ambilightConfig: AmbilightConfig;
  onUpdateAmbilight: (updates: Partial<AmbilightConfig>) => void;
  onResetAmbilight?: () => void;
  screenConfig: ScreenConfig;
  onUpdateScreen: (updates: Partial<ScreenConfig>) => void;
  onResetScreen?: () => void;
  environment: EnvironmentType;
  onChangeEnvironment: (env: EnvironmentType) => void;
  ambilightData: AmbilightSampleData;
  onOpenVideoSelector: () => void;
  onOpenQuestGuide: () => void;
  isVRPresenting: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onFocusStreamTab?: () => void;
  onToggleStreamAudioMute?: () => void;
  isStreamMutedInLumina?: boolean;
  onStopStream?: () => void;
}

export const CinemaHUD: React.FC<CinemaHUDProps> = ({
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  currentVideo,
  ambilightConfig,
  onUpdateAmbilight,
  onResetAmbilight,
  screenConfig,
  onUpdateScreen,
  onResetScreen,
  environment,
  onChangeEnvironment,
  ambilightData,
  onOpenVideoSelector,
  onOpenQuestGuide,
  isVRPresenting,
  isFullscreen,
  onToggleFullscreen,
  onFocusStreamTab,
  onToggleStreamAudioMute,
  isStreamMutedInLumina = true,
  onStopStream,
}) => {
  const [showControls, setShowControls] = useState(true);
  const [activePanel, setActivePanel] = useState<'none' | 'ambilight' | 'screen' | 'environment'>('none');
  const [isMuted, setIsMuted] = useState(false);
  const prevVolumeRef = useRef(volume);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls after inactivity
  const resetHideTimer = () => {
    setShowControls(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (isPlaying && activePanel === 'none') {
      hideTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  };

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [isPlaying, activePanel]);

  // Volume toggle
  const handleToggleMute = () => {
    if (isMuted) {
      onVolumeChange(prevVolumeRef.current || 1);
      setIsMuted(false);
    } else {
      prevVolumeRef.current = volume;
      onVolumeChange(0);
      setIsMuted(true);
    }
  };

  const formatTime = (seconds: number) => {
    if (typeof seconds !== 'number' || !isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = (typeof duration === 'number' && isFinite(duration) && duration > 0 && typeof currentTime === 'number' && isFinite(currentTime))
    ? Math.max(0, Math.min(100, (currentTime / duration) * 100))
    : 0;

  // Dominant color hex string for Ambilight live badge
  const domRgb = ambilightData?.dominant;
  const domR = (domRgb && typeof domRgb[0] === 'number' && isFinite(domRgb[0])) ? Math.max(0, Math.min(255, Math.round(domRgb[0]))) : 20;
  const domG = (domRgb && typeof domRgb[1] === 'number' && isFinite(domRgb[1])) ? Math.max(0, Math.min(255, Math.round(domRgb[1]))) : 25;
  const domB = (domRgb && typeof domRgb[2] === 'number' && isFinite(domRgb[2])) ? Math.max(0, Math.min(255, Math.round(domRgb[2]))) : 35;
  const domColorCss = `rgb(${domR}, ${domG}, ${domB})`;

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-4 md:p-6 z-30 transition-opacity duration-300"
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
    >
      {/* TOP BAR CONTRACT: [Brand title, one line] — [4-6 nav links] — [1-2 primary actions] */}
      <header
        className={`w-full flex items-center justify-between transition-all duration-300 pointer-events-auto ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        {/* Zone 1: Brand title wordmark */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-800/80 shadow-lg">
            <div
              className="w-3 h-3 rounded-full transition-colors duration-500 shadow-sm"
              style={{ backgroundColor: ambilightConfig.enabled ? domColorCss : '#64748b' }}
            />
            <span className="font-display font-bold text-base tracking-tight text-white">
              LuminaVR
            </span>
          </div>

          {/* Current Video Title Tag */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800/50 max-w-xs truncate">
            <Film className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate text-slate-200">{currentVideo.title}</span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => setActivePanel(activePanel === 'ambilight' ? 'none' : 'ambilight')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activePanel === 'ambilight'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Ambilight {ambilightConfig.enabled ? 'Activé' : 'Désactivé'}
          </button>

          <button
            onClick={() => setActivePanel(activePanel === 'screen' ? 'none' : 'screen')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activePanel === 'screen'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-sky-400" />
            Écran IMAX ({Math.round(screenConfig.curvature * 100)}% incurvé)
          </button>

          <button
            onClick={() => setActivePanel(activePanel === 'environment' ? 'none' : 'environment')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activePanel === 'environment'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-purple-400" />
            Environnement ({environment === 'cinema' ? 'Théâtre' : environment === 'void' ? 'Void' : environment === 'lounge' ? 'Salon' : 'Cosmos'})
          </button>

          <button
            onClick={onOpenVideoSelector}
            className="px-3.5 py-1.5 text-xs font-semibold text-sky-300 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
            title="Choisir un film, lancer YouTube en streaming 3D ou charger un fichier local"
          >
            <Film className="w-3.5 h-3.5 text-sky-400" />
            <span>Films & Streaming 3D</span>
          </button>
        </nav>

        {/* Zone 3: Stream status badge (discreet) & Help Guide */}
        <div className="flex items-center gap-2">
          {currentVideo.isStream && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-950/60 border border-red-500/40 rounded-xl text-xs backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-red-200 font-medium truncate max-w-[130px] sm:max-w-[200px]">
                {currentVideo.title}
              </span>
              {onFocusStreamTab && (
                <button
                  onClick={onFocusStreamTab}
                  className="p-1 hover:bg-red-900/50 text-red-300 hover:text-white rounded transition-colors"
                  title="Ouvrir la fenêtre YouTube"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
              {onStopStream && (
                <button
                  onClick={onStopStream}
                  className="px-2 py-0.5 bg-red-600/80 hover:bg-red-500 text-white rounded text-[10px] font-semibold transition-colors"
                  title="Arrêter la diffusion"
                >
                  Arrêter
                </button>
              )}
            </div>
          )}

          <button
            onClick={onOpenQuestGuide}
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 backdrop-blur-md transition-colors"
            title="Guide d'optimisation Meta Quest 3S"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* FLOATING SETTINGS PANELS (Ambilight, Screen, Environment) */}
      <div className="flex-1 flex items-center justify-end pointer-events-none p-2">
        {activePanel === 'ambilight' && (
          <div className="w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl pointer-events-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-white">Ambilight Dynamique</h3>
              </div>
              <button
                onClick={() => onUpdateAmbilight({ enabled: !ambilightConfig.enabled })}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                  ambilightConfig.enabled
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {ambilightConfig.enabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Mode selection */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Mode d'immersion</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'halo', name: 'Halo Doux' },
                  { id: 'theater', name: 'Plein Théâtre' },
                  { id: 'vivid', name: 'Vibrant Quest' },
                  { id: 'led_strip', name: 'Bandeau 360°' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onUpdateAmbilight({ mode: m.id as any })}
                    className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left ${
                      ambilightConfig.mode === m.id
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Intensité lumineuse</span>
                <span className="font-mono text-slate-300">{Math.round(ambilightConfig.intensity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.05"
                value={ambilightConfig.intensity}
                onChange={(e) => onUpdateAmbilight({ intensity: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Spread / Radius */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Rayon & Diffusion du halo</span>
                <span className="font-mono text-slate-300">{ambilightConfig.spread.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.5"
                step="0.1"
                value={ambilightConfig.spread}
                onChange={(e) => onUpdateAmbilight({ spread: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Gradient steps / Nuances de dégradé vers le noir */}
            <div className="space-y-1 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Nuances vers le noir</span>
                <span className="font-mono text-amber-400 font-semibold">
                  {!ambilightConfig.gradientSteps || ambilightConfig.gradientSteps === 0
                    ? 'Continu (Fluide)'
                    : ambilightConfig.gradientSteps === 1
                    ? '1 nuance'
                    : `${ambilightConfig.gradientSteps} nuances`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="16"
                step="1"
                value={ambilightConfig.gradientSteps ?? 0}
                onChange={(e) => onUpdateAmbilight({ gradientSteps: parseInt(e.target.value) })}
                className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Continu</span>
                <span>2 nuances</span>
                <span>4</span>
                <span>8</span>
                <span>16</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight pt-0.5">
                Règle le nombre de paliers de couleur entre le bord de l'écran et le noir de la salle.
              </p>
            </div>

            {/* Saturation boost */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Vibrance & Saturation LED</span>
                <span className="font-mono text-slate-300">+{Math.round((ambilightConfig.saturation - 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.2"
                step="0.1"
                value={ambilightConfig.saturation}
                onChange={(e) => onUpdateAmbilight({ saturation: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Rebond sur parois 3D */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Éclairage des murs 3D</span>
                <span className="font-mono text-slate-300">{Math.round(ambilightConfig.wallReflection * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={ambilightConfig.wallReflection}
                onChange={(e) => onUpdateAmbilight({ wallReflection: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {onResetAmbilight && (
              <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                <button
                  onClick={onResetAmbilight}
                  className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors py-1 px-2 rounded-lg hover:bg-slate-800/60"
                  title="Rétablir les valeurs Ambilight par défaut"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Réinitialiser Ambilight</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activePanel === 'screen' && (
          <div className="w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl pointer-events-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-sky-400" />
                <h3 className="font-semibold text-sm text-white">Écran & Ergonomie VR</h3>
              </div>
              <button
                onClick={() => setActivePanel('none')}
                className="text-xs text-slate-400 hover:text-white"
              >
                Fermer
              </button>
            </div>

            {/* Curvature */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Courbure IMAX</span>
                <span className="font-mono text-slate-300">
                  {screenConfig.curvature === 0 ? 'Plat' : `${Math.round(screenConfig.curvature * 100)}%`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.6"
                step="0.05"
                value={screenConfig.curvature}
                onChange={(e) => onUpdateScreen({ curvature: parseFloat(e.target.value) })}
                className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Plat</span>
                <span>Cinéma (30%)</span>
                <span>IMAX Total (60%)</span>
              </div>
            </div>

            {/* Distance */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Distance de l'écran</span>
                <span className="font-mono text-slate-300">{screenConfig.distance.toFixed(1)}m</span>
              </div>
              <input
                type="range"
                min="2.2"
                max="5.5"
                step="0.1"
                value={screenConfig.distance}
                onChange={(e) => onUpdateScreen({ distance: parseFloat(e.target.value) })}
                className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Scale / Screen Size */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Taille de l'écran</span>
                <span className="font-mono text-slate-300">{Math.round(screenConfig.size * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.8"
                step="0.05"
                value={screenConfig.size}
                onChange={(e) => onUpdateScreen({ size: parseFloat(e.target.value) })}
                className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Tilt / Lying Down In Bed Mode */}
            <div className="space-y-1 pt-1 border-t border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Mode Allongé / Inclinaison Lit</span>
                <span className="font-mono text-slate-300">{screenConfig.tilt}°</span>
              </div>
              <input
                type="range"
                min="-10"
                max="55"
                step="5"
                value={screenConfig.tilt}
                onChange={(e) => onUpdateScreen({ tilt: parseInt(e.target.value) })}
                className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                Incline l'écran vers le plafond pour regarder allongé dans son lit avec le Quest 3S.
              </span>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-1 pt-1">
              <label className="text-xs text-slate-400 font-medium">Format d'image</label>
              <div className="grid grid-cols-3 gap-1">
                {(['16:9', '21:9', '4:3'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => onUpdateScreen({ aspectRatio: ratio })}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      screenConfig.aspectRatio === ratio
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-medium'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ratio === '21:9' ? '21:9 Cinéma' : ratio}
                  </button>
                ))}
              </div>
            </div>

            {onResetScreen && (
              <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                <button
                  onClick={onResetScreen}
                  className="text-[11px] text-slate-400 hover:text-sky-400 flex items-center gap-1.5 transition-colors py-1 px-2 rounded-lg hover:bg-slate-800/60"
                  title="Rétablir les valeurs d'écran par défaut"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Réinitialiser Écran</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activePanel === 'environment' && (
          <div className="w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl pointer-events-auto space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-purple-400" />
                <h3 className="font-semibold text-sm text-white">Environnement Virtuel</h3>
              </div>
              <button
                onClick={() => setActivePanel('none')}
                className="text-xs text-slate-400 hover:text-white"
              >
                Fermer
              </button>
            </div>

            <div className="space-y-2">
              {[
                {
                  id: 'cinema',
                  title: 'Grand Théâtre IMAX',
                  desc: 'Panneaux acoustiques, sol moquette et fauteuils de cinéma.',
                  tag: 'Immersion Réaliste',
                },
                {
                  id: 'void',
                  title: 'Vide Infini (OLED Void)',
                  desc: 'Noir absolu sans distraction, contraste ultime pour l\'Ambilight.',
                  tag: 'Contraste Pur',
                },
                {
                  id: 'lounge',
                  title: 'Salon Cosy Moderne',
                  desc: 'Ambiance lounge tamisée avec boiseries et reflets doux.',
                  tag: 'Chaleureux',
                },
                {
                  id: 'cosmic',
                  title: 'Nébuleuse Cosmique',
                  desc: 'Flottant dans l\'espace entouré de 1200 étoiles réactives.',
                  tag: 'Sci-Fi Spatial',
                },
              ].map((env) => (
                <button
                  key={env.id}
                  onClick={() => onChangeEnvironment(env.id as EnvironmentType)}
                  className={`w-full p-3 rounded-xl text-left transition-all border ${
                    environment === env.id
                      ? 'bg-purple-500/15 border-purple-500/40 text-purple-100 shadow-md'
                      : 'bg-slate-800/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white">{env.title}</span>
                    <span className="text-[10px] text-purple-300/80">{env.tag}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{env.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM CINEMA CONTROLS BAR */}
      <footer
        className={`w-full max-w-4xl mx-auto transition-all duration-300 pointer-events-auto ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="bg-slate-950/85 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-3 md:p-4 shadow-2xl flex flex-col gap-2.5">
          {/* Progress Bar with Scrubbing */}
          <div
            className="group relative w-full h-3 flex items-center cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              onSeek(Math.max(0, Math.min(1, pos)));
            }}
          >
            {/* Background Track */}
            <div className="w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden transition-all group-hover:h-2">
              {/* Buffer / Glow bar */}
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: ambilightConfig.enabled ? domColorCss : '#38bdf8',
                  boxShadow: ambilightConfig.enabled ? `0 0 10px ${domColorCss}` : '0 0 8px #38bdf8',
                }}
              />
            </div>

            {/* Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `calc(${progressPercent}% - 7px)` }}
            />
          </div>

          {/* Control Buttons Row */}
          <div className="flex items-center justify-between text-slate-300">
            {/* Left Zone: Playback & Volume */}
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={onTogglePlay}
                className="p-2.5 bg-white text-slate-950 hover:bg-slate-200 rounded-xl transition-transform active:scale-95 shadow-md flex items-center justify-center"
                title={isPlaying ? 'Pause (Espace)' : 'Lecture (Espace)'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-0.5" />}
              </button>

              <button
                onClick={() => {
                  const target = Math.max(0, currentTime - 10);
                  onSeek(duration > 0 ? target / duration : 0);
                }}
                className="p-2 hover:bg-slate-800/70 hover:text-white rounded-lg transition-colors text-slate-400"
                title="Reculer de 10 secondes"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  const target = Math.min(duration, currentTime + 10);
                  onSeek(duration > 0 ? target / duration : 0);
                }}
                className="p-2 hover:bg-slate-800/70 hover:text-white rounded-lg transition-colors text-slate-400"
                title="Avancer de 10 secondes"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Volume Slider */}
              <div className="flex items-center gap-1.5 ml-1">
                <button
                  onClick={handleToggleMute}
                  className="p-1.5 hover:bg-slate-800/70 hover:text-white rounded-lg transition-colors text-slate-400"
                  title={isMuted ? 'Rétablir le son' : 'Couper le son'}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setIsMuted(false);
                    onVolumeChange(parseFloat(e.target.value));
                  }}
                  className="w-16 md:w-20 accent-sky-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Time display */}
              <div className="text-xs font-mono tabular-nums text-slate-400 ml-2">
                <span className="text-slate-200">{formatTime(currentTime)}</span>
                <span className="mx-1 text-slate-600">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Zone: Quick Settings & Fullscreen */}
            <div className="flex items-center gap-1.5 md:gap-2">
              {/* Ambilight quick toggle button */}
              <button
                onClick={() => onUpdateAmbilight({ enabled: !ambilightConfig.enabled })}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 ${
                  ambilightConfig.enabled
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Activer ou désactiver l'Ambilight"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ambilight</span>
              </button>

              {/* Panel Toggles */}
              <button
                onClick={() => setActivePanel(activePanel === 'screen' ? 'none' : 'screen')}
                className={`p-2 rounded-xl transition-colors ${
                  activePanel === 'screen'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'hover:bg-slate-800/70 text-slate-400 hover:text-white'
                }`}
                title="Paramètres de l'écran IMAX"
              >
                <Tv className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActivePanel(activePanel === 'ambilight' ? 'none' : 'ambilight')}
                className={`p-2 rounded-xl transition-colors ${
                  activePanel === 'ambilight'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'hover:bg-slate-800/70 text-slate-400 hover:text-white'
                }`}
                title="Réglages fins de l'Ambilight"
              >
                <Sliders className="w-4 h-4" />
              </button>

              <button
                onClick={onToggleFullscreen}
                className="p-2 hover:bg-slate-800/70 hover:text-white rounded-xl transition-colors text-slate-400"
                title={isFullscreen ? 'Quitter plein écran (F)' : 'Plein écran (F)'}
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
