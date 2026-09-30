export type AmbilightMode = 'halo' | 'theater' | 'led_strip' | 'vivid';

export interface AmbilightConfig {
  enabled: boolean;
  intensity: number; // 0 to 2 (default 1.2)
  spread: number;    // 1 to 3 (glow blur/radius scale)
  saturation: number; // 0.8 to 2 (boost vibrant movie tones)
  smoothing: number;  // 0.05 to 0.4 (temporal lerp speed)
  zones: number;      // 16, 32, 64
  mode: AmbilightMode;
  wallReflection: number; // 0 to 1 (intensity of room wall bounce)
}

export type ScreenCurvature = 'flat' | 'subtle' | 'imax' | 'deep';

export interface ScreenConfig {
  curvature: number; // 0 to 0.8 (arc curve angle in radians)
  distance: number;  // 2.2m to 6m
  size: number;      // scale factor 0.8 to 2.2
  heightOffset: number; // -0.8m to 1.5m
  tilt: number;      // degrees: -20 to 60 (for lying down in bed mode)
  format3D: '2d' | 'sbs' | 'ou'; // 2D standard, Side-by-Side 3D, Over-Under 3D
  aspectRatio: '16:9' | '21:9' | '4:3' | 'fill';
}

export type EnvironmentType = 'cinema' | 'void' | 'lounge' | 'cosmic';

export interface VideoItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  duration?: number;
  category: string;
  aspectRatio?: string;
  isLocal?: boolean;
  fileSize?: string;
  description: string;
}

export interface AmbilightSampleData {
  top: [number, number, number][];
  bottom: [number, number, number][];
  left: [number, number, number][];
  right: [number, number, number][];
  dominant: [number, number, number];
  averageBrightness: number;
}
