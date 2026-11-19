/**
 * NyayaSetu (न्यायसेतु) Design Tokens
 * 
 * Extracted directly from the design reference homepage (src/app/page.tsx, globals.css, navbar.tsx).
 * The homepage is the single source of truth for the visual identity.
 */

export const tokens = {
  colors: {
    // Canvas & Surface Colors
    bgPrimary: "#f4efe6", // Warm Ivory / Cream Paper base canvas
    bgPrimaryAlt: "#f3ece1", // Alternative warm alabaster
    bgSecondary: "#ebe1d1", // Warm Sand secondary surface (cards, tabs, avatar rings)
    bgCard: "#fffaf2", // Bright Warm White card & dialog surface
    bgCardInteractive: "#ffffff", // Pure white for select interactive components
    bgDark: "#24180f", // Near-black espresso (Footer, dark contrast showcase panels)
    bgDarkCard: "#2f2116", // Charcoal espresso container surface

    // Borders & Dividers
    borderSubtle: "#e2d5c1", // Subtle stone architectural dividing line
    borderHover: "#cfbe9e", // Border hover transition state
    borderDark: "#3f2c1f", // Dark container dividing lines

    // Typography Colors
    textPrimary: "#2a1c12", // Deep Espresso Roast (Display, headings, high-contrast actions)
    textSecondary: "#5b4a3b", // Muted Umber (Body editorial text, secondary instructions)
    textMuted: "#85725f", // Tertiary Warm Gray (Micro-labels, stamp badges, captions)
    textMutedLight: "#a89682", // Secondary subtitle muted tone
    textDarkCard: "#fffaf2", // High contrast light text on dark containers

    // Brand Accents
    accentBronze: "#9a6a35", // Warm Bronze / Ochre (Brand primary accent, focus rings, stat bars)
    accentDarkBronze: "#7c5226", // Deep Antique Bronze (Button active/hover states)
    accentGold: "#d1a46a", // Light Champagne Gold (Sub-highlights, dark container accents)
    accentGoldLight: "#f3d3a3", // Gold hover tint

    // Semantic Status Tones (Restrained Editorial / Non-Pastel)
    statusActive: {
      border: "#e2d5c1",
      bg: "rgba(220, 234, 218, 0.5)",
      text: "#2e7d32",
      dot: "#2e7d32",
    },
    statusPending: {
      border: "#e2d5c1",
      bg: "rgba(255, 248, 231, 0.6)",
      text: "#b54708",
      dot: "#b54708",
    },
    statusUrgent: {
      border: "rgba(192, 57, 43, 0.3)",
      bg: "rgba(253, 242, 240, 0.6)",
      text: "#c0392b",
      dot: "#c0392b",
    },
    statusNeutral: {
      border: "#e2d5c1",
      bg: "rgba(255, 250, 242, 0.8)",
      text: "#85725f",
      dot: "#85725f",
    },
  },

  typography: {
    fontSerif: "Gambetta, Georgia, Cambria, 'Times New Roman', serif",
    fontSans: "'General Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'Inter', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",

    // Scale Guidelines
    displayH1: "clamp(32px, 5vw, 56px)",
    sectionH2: "clamp(28px, 4vw, 46px)",
    cardH3: "clamp(22px, 3vw, 32px)",
    subH4: "clamp(18px, 2vw, 24px)",
    body: "15px",
    bodySm: "13.5px",
    caption: "12px",
    stamp: "11px",
  },

  geometry: {
    radiusNone: "0px",
    radiusSharp: "2px", // Canonical architectural button & container corner radius
    radiusSoft: "4px", // Slight softness for small interactive pills
    borderThin: "1px solid #e2d5c1",
    borderThick: "2px solid #2a1c12",
  },

  shadows: {
    subtle: "0 4px 24px rgba(42, 28, 18, 0.04)",
    card: "0 8px 30px rgba(42, 28, 18, 0.06)",
    elevated: "0 12px 40px -12px rgba(42, 28, 18, 0.12)",
  },
} as const;

export type DesignTokens = typeof tokens;
