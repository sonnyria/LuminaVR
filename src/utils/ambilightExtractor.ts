import { AmbilightSampleData, AmbilightConfig } from '../types';

export class AmbilightExtractor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private sampleWidth = 32;
  private sampleHeight = 18;
  
  // Smoothed state for temporal stability
  private smoothedData: AmbilightSampleData;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.sampleWidth;
    this.canvas.height = this.sampleHeight;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Initialize with soft warm cinema ambient
    const defaultColor: [number, number, number] = [15, 18, 25];
    this.smoothedData = {
      top: Array(8).fill(defaultColor),
      bottom: Array(8).fill(defaultColor),
      left: Array(6).fill(defaultColor),
      right: Array(6).fill(defaultColor),
      dominant: defaultColor,
      averageBrightness: 0.15,
    };
  }

  public extract(video: HTMLVideoElement, config: AmbilightConfig): AmbilightSampleData {
    if (
      !this.ctx ||
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0 ||
      (video.paused && !video.seeking)
    ) {
      return this.smoothedData;
    }

    try {
      this.ctx.drawImage(video, 0, 0, this.sampleWidth, this.sampleHeight);
      const imgData = this.ctx.getImageData(0, 0, this.sampleWidth, this.sampleHeight);
      const data = imgData.data;

      const topZones = 8;
      const bottomZones = 8;
      const sideZones = 6;

      const currentTop: [number, number, number][] = [];
      const currentBottom: [number, number, number][] = [];
      const currentLeft: [number, number, number][] = [];
      const currentRight: [number, number, number][] = [];

      let totalR = 0, totalG = 0, totalB = 0;
      let count = 0;

      // Extract Top edge zones (strictly outer edge with highest weight on the outermost row)
      const topColStep = Math.max(1, Math.floor(this.sampleWidth / topZones));
      for (let z = 0; z < topZones; z++) {
        let r = 0, g = 0, b = 0, totalWeight = 0;
        const startX = z * topColStep;
        const endX = Math.min(startX + topColStep, this.sampleWidth);
        for (let y = 0; y < 2; y++) {
          // Outermost row (y = 0) has 4x weight for maximum edge fidelity
          const weight = y === 0 ? 4.0 : 1.0;
          for (let x = startX; x < endX; x++) {
            const idx = (y * this.sampleWidth + x) * 4;
            r += (data[idx] || 0) * weight;
            g += (data[idx + 1] || 0) * weight;
            b += (data[idx + 2] || 0) * weight;
            totalWeight += weight;
          }
        }
        const avg: [number, number, number] = totalWeight > 0
          ? [r / totalWeight, g / totalWeight, b / totalWeight]
          : [15, 18, 25];
        currentTop.push(this.enhanceColor(avg, config.saturation * 1.15, config.intensity));
      }

      // Extract Bottom edge zones (outermost row y = sampleHeight - 1 has 4x weight)
      const bottomColStep = Math.max(1, Math.floor(this.sampleWidth / bottomZones));
      for (let z = 0; z < bottomZones; z++) {
        let r = 0, g = 0, b = 0, totalWeight = 0;
        const startX = z * bottomColStep;
        const endX = Math.min(startX + bottomColStep, this.sampleWidth);
        for (let y = this.sampleHeight - 2; y < this.sampleHeight; y++) {
          const weight = (y === this.sampleHeight - 1) ? 4.0 : 1.0;
          for (let x = startX; x < endX; x++) {
            const idx = (y * this.sampleWidth + x) * 4;
            r += (data[idx] || 0) * weight;
            g += (data[idx + 1] || 0) * weight;
            b += (data[idx + 2] || 0) * weight;
            totalWeight += weight;
          }
        }
        const avg: [number, number, number] = totalWeight > 0
          ? [r / totalWeight, g / totalWeight, b / totalWeight]
          : [15, 18, 25];
        currentBottom.push(this.enhanceColor(avg, config.saturation * 1.15, config.intensity));
      }

      // Extract Left edge zones (outermost column x = 0 has 4x weight)
      const leftRowStep = Math.max(1, Math.floor(this.sampleHeight / sideZones));
      for (let z = 0; z < sideZones; z++) {
        let r = 0, g = 0, b = 0, totalWeight = 0;
        const startY = z * leftRowStep;
        const endY = Math.min(startY + leftRowStep, this.sampleHeight);
        for (let y = startY; y < endY; y++) {
          for (let x = 0; x < 2; x++) {
            const weight = x === 0 ? 4.0 : 1.0;
            const idx = (y * this.sampleWidth + x) * 4;
            r += (data[idx] || 0) * weight;
            g += (data[idx + 1] || 0) * weight;
            b += (data[idx + 2] || 0) * weight;
            totalWeight += weight;
          }
        }
        const avg: [number, number, number] = totalWeight > 0
          ? [r / totalWeight, g / totalWeight, b / totalWeight]
          : [15, 18, 25];
        currentLeft.push(this.enhanceColor(avg, config.saturation * 1.15, config.intensity));
      }

      // Extract Right edge zones (outermost column x = sampleWidth - 1 has 4x weight)
      const rightRowStep = Math.max(1, Math.floor(this.sampleHeight / sideZones));
      for (let z = 0; z < sideZones; z++) {
        let r = 0, g = 0, b = 0, totalWeight = 0;
        const startY = z * rightRowStep;
        const endY = Math.min(startY + rightRowStep, this.sampleHeight);
        for (let y = startY; y < endY; y++) {
          for (let x = this.sampleWidth - 2; x < this.sampleWidth; x++) {
            const weight = (x === this.sampleWidth - 1) ? 4.0 : 1.0;
            const idx = (y * this.sampleWidth + x) * 4;
            r += (data[idx] || 0) * weight;
            g += (data[idx + 1] || 0) * weight;
            b += (data[idx + 2] || 0) * weight;
            totalWeight += weight;
          }
        }
        const avg: [number, number, number] = totalWeight > 0
          ? [r / totalWeight, g / totalWeight, b / totalWeight]
          : [15, 18, 25];
        currentRight.push(this.enhanceColor(avg, config.saturation * 1.15, config.intensity));
      }

      // Overall dominant color (sampling inner rectangle)
      for (let y = 3; y < this.sampleHeight - 3; y += 2) {
        for (let x = 3; x < this.sampleWidth - 3; x += 2) {
          const idx = (y * this.sampleWidth + x) * 4;
          totalR += data[idx];
          totalG += data[idx + 1];
          totalB += data[idx + 2];
          count++;
        }
      }

      const dominantAvg: [number, number, number] = count > 0 
        ? [totalR / count, totalG / count, totalB / count]
        : [20, 20, 30];

      const enhancedDominant = this.enhanceColor(dominantAvg, config.saturation, config.intensity);
      const brightness = (enhancedDominant[0] * 0.299 + enhancedDominant[1] * 0.587 + enhancedDominant[2] * 0.114) / 255;

      // Temporal smoothing (lerp factor based on config)
      const factor = Math.max(0.04, Math.min(0.6, config.smoothing));

      this.smoothedData = {
        top: currentTop.map((col, i) => this.lerpColor(this.smoothedData.top[i] || col, col, factor)),
        bottom: currentBottom.map((col, i) => this.lerpColor(this.smoothedData.bottom[i] || col, col, factor)),
        left: currentLeft.map((col, i) => this.lerpColor(this.smoothedData.left[i] || col, col, factor)),
        right: currentRight.map((col, i) => this.lerpColor(this.smoothedData.right[i] || col, col, factor)),
        dominant: this.lerpColor(this.smoothedData.dominant, enhancedDominant, factor),
        averageBrightness: this.smoothedData.averageBrightness + (brightness - this.smoothedData.averageBrightness) * factor,
      };

      return this.smoothedData;
    } catch {
      // Cross-origin fallback or error
      return this.smoothedData;
    }
  }

  private lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
    return [
      c1[0] + (c2[0] - c1[0]) * t,
      c1[1] + (c2[1] - c1[1]) * t,
      c1[2] + (c2[2] - c1[2]) * t,
    ];
  }

  private enhanceColor(rgb: [number, number, number], saturation: number, intensity: number): [number, number, number] {
    let [r, g, b] = rgb;
    
    // Convert RGB to HSL
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
        case gNorm: h = (bNorm - rNorm) / d + 2; break;
        case bNorm: h = (rNorm - gNorm) / d + 4; break;
      }
      h /= 6;
    }

    // Boost saturation
    s = Math.min(1, Math.max(0, s * saturation));

    // Convert back to RGB
    if (s === 0) {
      r = g = b = l * 255;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3) * 255;
      g = hue2rgb(p, q, h) * 255;
      b = hue2rgb(p, q, h - 1/3) * 255;
    }

    // Apply intensity multiplier
    return [
      Math.min(255, Math.max(0, r * intensity)),
      Math.min(255, Math.max(0, g * intensity)),
      Math.min(255, Math.max(0, b * intensity)),
    ];
  }
}
