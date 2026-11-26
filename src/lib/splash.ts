// Current iPhone screen sizes: CSS points and device pixel ratio.
export const SPLASH_SIZES = [
  { cw: 440, ch: 956, dpr: 3 }, // 16 Pro Max
  { cw: 402, ch: 874, dpr: 3 }, // 16 Pro
  { cw: 430, ch: 932, dpr: 3 }, // 14/15 Pro Max, 15/16 Plus
  { cw: 393, ch: 852, dpr: 3 }, // 14/15 Pro, 15, 16
  { cw: 390, ch: 844, dpr: 3 }, // 12–14
  { cw: 428, ch: 926, dpr: 3 }, // 12/13 Pro Max, 14 Plus
  { cw: 375, ch: 812, dpr: 3 }, // X/XS/11 Pro, 12/13 mini
  { cw: 414, ch: 896, dpr: 2 }, // XR/11
  { cw: 375, ch: 667, dpr: 2 }, // SE
].map((s) => ({ ...s, w: s.cw * s.dpr, h: s.ch * s.dpr }));

export const startupImages = SPLASH_SIZES.flatMap((s) =>
  (["light", "dark"] as const).map((theme) => ({
    url: `/pwa-splash/${s.w}x${s.h}-${theme}`,
    media: `(device-width: ${s.cw}px) and (device-height: ${s.ch}px) and (-webkit-device-pixel-ratio: ${s.dpr}) and (orientation: portrait) and (prefers-color-scheme: ${theme})`,
  })),
);
