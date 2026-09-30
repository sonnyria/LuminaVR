import React, { useState, useRef } from 'react';
import { X, Upload, Link, Film, Play } from 'lucide-react';
import { VideoItem } from '../types';

interface VideoSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVideo: VideoItem;
  onSelectVideo: (video: VideoItem) => void;
}

export const VideoSelectorModal: React.FC<VideoSelectorModalProps> = ({
  isOpen,
  onClose,
  currentVideo,
  onSelectVideo,
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'url'>('local');
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

  const handleCustomUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;

    const urlItem: VideoItem = {
      id: `url-${Date.now()}`,
      title: customTitle.trim() || 'Flux Vidéo Personnalisé',
      subtitle: 'Flux externe direct',
      category: 'Streaming',
      aspectRatio: '16:9',
      description: customUrl,
      url: customUrl.trim(),
    };

    onSelectVideo(urlItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-amber-400" />
            <h2 className="font-display font-semibold text-lg text-white">
              Sélectionner un film ou une série
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls (Segmented control) */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('local')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'local'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Fichier Local (Quest / PC)
            </button>
            <button
              onClick={() => setActiveTab('url')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'url'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              Lien Streaming / URL
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4">
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

          {activeTab === 'url' && (
            <form onSubmit={handleCustomUrlSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Titre du film ou de la vidéo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mon Film 4K"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  URL directe du fichier vidéo (.mp4, .webm)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/video.mp4"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                Lancer la lecture avec Ambilight
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
