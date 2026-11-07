/** Pure portrait composition geometry; all measurements are CSS pixels. */
export interface PortraitLayoutInput {
  width: number;
  height: number;
  hudBottom: number;
  controlsTop: number;
  /** Measured maximum verse extents above and below the reading anchor. */
  above: number;
  below: number;
  padding: number;
  mode?: "stacked" | "immersive";
}

export interface PortraitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PortraitFrame {
  fits: true;
  readingAnchor: number;
  panelCenter: number;
  panelTop: number;
  panelBottom: number;
  panelHeight: number;
  /** Space above the panel, excluding navigation and the inter-region gap. */
  artArea: PortraitRect;
  /** Complete 3:2 image fitted inside artArea, with up to 8px inner padding. */
  artRect: PortraitRect;
}

export interface PortraitOverflow {
  fits: false;
  availableTop: number;
  availableBottom: number;
  availablePanelHeight: number;
  requiredPanelHeight: number;
  overflowHeight: number;
}

export type PortraitLayout = PortraitFrame | PortraitOverflow;

const GAP = 16;
const ART_PADDING = 8;
const ASPECT = 1.5;

/**
 * Null selects the existing desktop/landscape/explicit immersive presentation.
 * A false fits result deliberately has no drawing anchors: the caller must
 * handle a verse that cannot fit, rather than overlap navigation or controls.
 * A fitting panel may leave no art space on a short viewport; no minimum
 * illustration height is forced at the expense of readable verses.
 */
export function computePortraitLayout(input: PortraitLayoutInput): PortraitLayout | null {
  const { width, height, hudBottom, controlsTop, above, below, padding, mode } = input;
  for (const [key, value] of Object.entries({ width, height, hudBottom, controlsTop, above, below, padding })) {
    if (!Number.isFinite(value) || value < 0 || ((key === "width" || key === "height") && value === 0)) {
      throw new RangeError(`Invalid portrait layout measurement: ${key}`);
    }
  }
  if (mode === "immersive" || width > 760 || height <= width) return null;

  const top = Math.min(height, hudBottom + GAP);
  const bottom = Math.max(0, Math.min(height, controlsTop - GAP));
  const available = Math.max(0, bottom - top);
  const panelHeight = above + below + padding * 2;
  if (panelHeight > available || bottom < top) {
    return {
      fits: false,
      availableTop: top,
      availableBottom: bottom,
      availablePanelHeight: available,
      requiredPanelHeight: panelHeight,
      overflowHeight: Math.max(0, panelHeight - available),
    };
  }

  const panelTop = bottom - panelHeight;
  const artArea = { x: 0, y: top, width, height: Math.max(0, panelTop - GAP - top) };
  const innerWidth = Math.max(0, width - ART_PADDING * 2);
  const innerHeight = Math.max(0, artArea.height - ART_PADDING * 2);
  const artWidth = Math.min(innerWidth, innerHeight * ASPECT);
  const artHeight = artWidth / ASPECT;
  return {
    fits: true,
    readingAnchor: panelTop + padding + above,
    panelCenter: panelTop + panelHeight / 2,
    panelTop,
    panelBottom: bottom,
    panelHeight,
    artArea,
    artRect: {
      x: (width - artWidth) / 2,
      y: top + (artArea.height - artHeight) / 2,
      width: artWidth,
      height: artHeight,
    },
  };
}
