import React from 'react';
import { X, Glasses, Sparkles, Moon, HardDrive, Check, Radio } from 'lucide-react';

interface QuestGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuestGuideModal: React.FC<QuestGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Glasses className="w-5 h-5 text-amber-400" />
            <h2 className="font-display font-semibold text-lg text-white">
              Guide d'optimisation Meta Quest 3S
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-300">
          {/* Section 1: Lancement WebXR */}
          <div className="flex gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Glasses className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-white">1. Passer en Immersion Totale WebXR</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Depuis le navigateur <strong>Meta Quest Browser</strong> de votre casque, cliquez sur le bouton <span className="text-amber-400 font-medium">« VR Quest 3S »</span> en haut à droite. Votre écran passe immédiatement en réalité virtuelle à 360° avec un suivi de tête 6DOF ultra-fluide.
              </p>
            </div>
          </div>

          {/* Section 2: Ambilight Dynamique */}
          <div className="flex gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-white">2. Ambilight Temps Réel Haute Précision</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Le moteur Ambilight analyse en continu les bords de chaque image de votre vidéo pour projeter un halo lumineux synchronisé sur les parois du cinéma. Sur le Meta Quest 3S, le mode <span className="text-sky-400 font-medium">« Vibrant Quest »</span> ou <span className="text-sky-400 font-medium">« Plein Théâtre »</span> offre un contraste et une sensation d'immersion spectaculaire.
              </p>
            </div>
          </div>

          {/* Section 3: Mode Allongé / Au lit */}
          <div className="flex gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
              <Moon className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-white">3. Mode Lit / Plafond (Lying Down)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Envie de regarder votre film confortablement allongé sur le dos ? Ouvrez le panneau <strong>Écran IMAX</strong> et ajustez le curseur <strong>« Mode Allongé / Inclinaison Lit »</strong> entre 30° et 55°. L'écran et l'Ambilight s'orientent vers le haut sans forcer sur vos cervicales.
              </p>
            </div>
          </div>

          {/* Section 4: Fichiers de films locaux */}
          <div className="flex gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-white">4. Transférer vos films dans le Quest 3S</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Branchez votre Quest 3S à votre ordinateur avec un câble USB-C, autorisez l'accès dans le casque, et glissez vos fichiers <strong>.mp4</strong> ou <strong>.mkv</strong> dans le dossier <code>Films</code> ou <code>Download</code>. Cliquez sur <span className="text-emerald-400 font-medium">« Fichier Local »</span> dans LuminaVR pour lancer le film instantanément.
              </p>
            </div>
          </div>

          {/* Section 5: Commandes Manettes */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Raccourcis Manettes Meta Quest Touch Plus
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400" />
                <span><strong>Gâchette (Trigger)</strong> : Lecture / Pause</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400" />
                <span><strong>Rayon Laser</strong> : Pointer sur l'interface</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400" />
                <span><strong>Bouton Meta / Oculus</strong> : Recentrer l'écran</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400" />
                <span><strong>Touche Espace / Clic</strong> : Lecture / Pause</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl transition-colors"
          >
            Fermer le guide
          </button>
        </div>
      </div>
    </div>
  );
};
