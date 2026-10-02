import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Link,
  Play,
  Globe,
  ExternalLink,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { VideoItem } from '../types';

interface VideoSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVideo: VideoItem;
  onSelectVideo: (video: VideoItem) => void;
  onStartTabCapture?: () => Promise<void>;
  onStopTabCapture?: () => void;
  isStreamActive?: boolean;
  onOpenStreamWindow?: (url: string) => void;
  onOpenWebBrowser?: () => void;
}

export const VideoSelectorModal: React.FC<VideoSelectorModalProps> = ({
  isOpen,
  onClose,
  currentVideo,
  onSelectVideo,
  onStartTabCapture,
  onStopTabCapture,
  isStreamActive = false,
  onOpenStreamWindow,
  onOpenWebBrowser,
}) => {
  const [activeTab, setActiveTab] = useState<'browser' | 'stream' | 'local'>('browser');
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle live tab capture (Netflix, YouTube, Twitch, etc.)
  const handleLaunchCapture = async () => {
    if (!onStartTabCapture) return;
    try {
      setIsCapturing(true);
      await onStartTabCapture();
    } catch (err) {
      console.warn('Tab capture aborted or failed:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle local file selection
  const handleFileProcess = (file: File) => {
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mkv|webm|mov|m4v)$/i)) {
      alert('Veuillez sélectionner un fichier vidéo valide (.mp4, .mkv, .webm, .mov).');
      return;
    }

    let processedBlob: Blob = file;
    if (file.name.toLowerCase().endsWith('.mkv') && (!file.type || file.type === 'video/x-matroska')) {
      try {
        processedBlob = file.slice(0, file.size, 'video/webm');
      } catch {
        processedBlob = file;
      }
    }

    const objectUrl = URL.createObjectURL(processedBlob);
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);

    const localItem: VideoItem = {
      id: `local-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      subtitle: `Fichier local · ${sizeInMB} Mo`,
      category: file.name.toLowerCase().endsWith('.mkv') ? 'MKV Local' : 'Local',
      aspectRatio: '16:9',
      isLocal: true,
      fileSize: `${sizeInMB} Mo`,
      description: 'Fichier vidéo lu directement depuis votre appareil sans transfert réseau.',
      url: objectUrl,
    };

    onSelectVideo(localItem);
    onClose();
  };

  // Custom Stream URL Submit
  const handleCustomUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;

    const urlItem: VideoItem = {
      id: `url-${Date.now()}`,
      title: customTitle.trim() || 'Flux Vidéo Web Direct',
      subtitle: 'Flux externe direct',
      category: 'Streaming Web',
      aspectRatio: '16:9',
      description: customUrl,
      url: customUrl.trim(),
    };

    onSelectVideo(urlItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="font-display font-semibold text-base text-white">
                Centre de Streaming & Navigateur Web
              </h2>
              <p className="text-[11px] text-slate-400">
                Regardez YouTube, Netflix, vos streams et films locaux avec Ambilight
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tab Controls (3 tabs: Navigateur Web, Flux Direct, Fichier Local) */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/80 rounded-2xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('browser')}
              className={`py-2 px-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'browser'
                  ? 'bg-sky-500 text-slate-950 font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="truncate">Navigateur Web</span>
            </button>
            <button
              onClick={() => setActiveTab('stream')}
              className={`py-2 px-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'stream'
                  ? 'bg-sky-500 text-slate-950 font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              <span className="truncate">Flux Direct</span>
            </button>
            <button
              onClick={() => setActiveTab('local')}
              className={`py-2 px-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'local'
                  ? 'bg-sky-500 text-slate-950 font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="truncate">Fichier Local</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-300">
          {/* TAB 1: NAVIGATEUR & DIFFUSION D'ONGLET (YouTube, Netflix, Twitch...) */}
          {activeTab === 'browser' && (
            <div className="space-y-5">
              {/* Feature Banner: Direct Cinema Web Browser */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-orange-500/15 border border-amber-500/40 space-y-3 shadow-xl">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold border border-amber-500/30">
                      <Sparkles className="w-3 h-3" />
                      Option Recommandée : Sans Partage d'Écran
                    </div>
                    <h3 className="text-base font-semibold text-white">
                      Écran Navigateur Web Intégré (YouTube, Twitch, Web)
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Transforme directement l'écran cinéma géant en un <strong className="text-white">navigateur web interactif</strong>. Vous pouvez chercher et lire des vidéos YouTube, Twitch ou coller n'importe quel lien web sans aucun partage d'écran complexe.
                </p>

                {/* Big Action Button */}
                <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
                  <button
                    onClick={() => {
                      if (onOpenWebBrowser) {
                        onOpenWebBrowser();
                      }
                      onClose();
                    }}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Ouvrir l'Écran Navigateur Web (YouTube & Twitch)</span>
                  </button>
                </div>
              </div>

              {/* Alternative: Screen / Tab capture */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Alternative : Partage d'un onglet externe (Bureau / PC)
                  </span>
                  {!isStreamActive ? (
                    <button
                      onClick={handleLaunchCapture}
                      disabled={isCapturing}
                      className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Globe className="w-3.5 h-3.5 text-sky-400" />
                      <span>{isCapturing ? 'Connexion...' : 'Partager un onglet'}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-400 font-medium">Flux actif</span>
                      <button
                        onClick={onStopTabCapture}
                        className="py-1 px-2.5 bg-red-600/80 hover:bg-red-500 text-white text-xs font-semibold rounded-lg"
                      >
                        Arrêter
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Si vous préférez diffuser un onglet Chrome ou Edge externe, vous pouvez utiliser la capture d'onglet classique.
                </p>
              </div>

              {/* Quick Launch Websites in New Tab */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  1. Ouvrir votre service de streaming :
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenStreamWindow) {
                        onOpenStreamWindow('https://www.youtube.com');
                      } else {
                        window.open('https://www.youtube.com', '_blank');
                      }
                    }}
                    className="p-3 bg-slate-950/60 hover:bg-slate-850 rounded-xl border border-slate-800 hover:border-red-500/50 transition-all flex items-center justify-between group text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center font-bold text-xs border border-red-500/30">
                        YT
                      </div>
                      <span className="text-xs font-medium text-slate-200 group-hover:text-white">YouTube</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400 transition-colors" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenStreamWindow) {
                        onOpenStreamWindow('https://www.netflix.com');
                      } else {
                        window.open('https://www.netflix.com', '_blank');
                      }
                    }}
                    className="p-3 bg-slate-950/60 hover:bg-slate-850 rounded-xl border border-slate-800 hover:border-red-600/50 transition-all flex items-center justify-between group text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-red-900/30 text-red-500 flex items-center justify-center font-bold text-xs border border-red-600/30">
                        N
                      </div>
                      <span className="text-xs font-medium text-slate-200 group-hover:text-white">Netflix</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400 transition-colors" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenStreamWindow) {
                        onOpenStreamWindow('https://www.twitch.tv');
                      } else {
                        window.open('https://www.twitch.tv', '_blank');
                      }
                    }}
                    className="p-3 bg-slate-950/60 hover:bg-slate-850 rounded-xl border border-slate-800 hover:border-purple-500/50 transition-all flex items-center justify-between group text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold text-xs border border-purple-500/30">
                        TW
                      </div>
                      <span className="text-xs font-medium text-slate-200 group-hover:text-white">Twitch</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                  </button>
                </div>
              </div>

              {/* Anti-Echo and Window Management Tip */}
              <div className="p-3.5 bg-sky-950/30 rounded-xl border border-sky-500/30 text-xs text-slate-300 space-y-1.5">
                <div className="font-semibold text-sky-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Anti-Écho & Contrôle de l'onglet YouTube :
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-300 leading-relaxed">
                  <li>
                    <strong>Son en double (Écho) :</strong> Par défaut, LuminaVR coupe son propre son en mode stream pour laisser place au son direct parfait de YouTube sans aucun retard. Vous pouvez basculer le mode via le bouton <em>Anti-Écho</em> de la barre de contrôle.
                  </li>
                  <li>
                    <strong>Affichage fluide :</strong> Laissez la fenêtre YouTube en arrière-plan ou ouverte sur votre écran. Ne la réduisez pas complètement dans la barre des tâches de votre PC, car certains navigateurs suspendent l'envoi des images d'une fenêtre totalement minimisée.
                  </li>
                </ul>
              </div>

              {/* Instructions Steps */}
              <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-400" />
                  Comment ça fonctionne :
                </div>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
                  <li>Cliquez sur le bouton YouTube ci-dessus pour ouvrir la fenêtre de lecture.</li>
                  <li>Cliquez sur <strong>« Connecter un Onglet »</strong> et choisissez la fenêtre ou l'onglet YouTube.</li>
                  <li>Laissez YouTube en arrière-plan : l'écran cinéma géant IMAX affiche le flux avec Ambilight 60 FPS !</li>
                  <li>Cliquez sur <strong>« Changer de vidéo »</strong> dans LuminaVR pour faire réapparaître YouTube et choisir un autre film.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: FLUX DIRECT & URL */}
          {activeTab === 'stream' && (
            <form onSubmit={handleCustomUrlSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Titre du flux ou de la vidéo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mon Stream HD / Film Web"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  URL directe du fichier ou du stream (.mp4, .webm, .m3u8, direct web)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/stream.mp4"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                Lancer le flux avec Ambilight
              </button>
            </form>
          )}

          {/* TAB 3: FICHIER LOCAL */}
          {activeTab === 'local' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileProcess(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-slate-700/80 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-900/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/mkv,video/quicktime,video/*,.mkv,.mp4"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400 mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-sm text-white mb-1">
                  Glissez-déposez votre film ou cliquez pour parcourir
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mb-3">
                  Compatible avec les fichiers stockés dans votre <strong>Meta Quest 3S</strong> ou votre PC (MP4, MKV, WebM, MOV).
                </p>
                <div className="text-[11px] text-slate-500">
                  Lecture instantanée locale · Aucun envoi sur un serveur externe · Fluidité maximale
                </div>
              </div>

              <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-400">
                <span className="font-semibold text-slate-200 block mb-1">
                  Astuce pour les utilisateurs Meta Quest 3S :
                </span>
                Vous pouvez transférer vos fichiers vidéos dans le dossier <code>/Movies</code> de votre casque via câble USB ou utiliser le navigateur Meta Quest Browser pour charger directement vos films.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
