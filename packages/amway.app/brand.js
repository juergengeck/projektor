/**
 * Amway brand tokens for the `/amway` workspace shell.
 *
 * Observed from https://www.amway.de/ on 2026-09-13 and recorded in
 * `docs/amway-app-book.md`. These are observed website treatments, not a
 * formal Amway brand manual. The wordmark SVG is the official asset,
 * preserved with its aspect ratio (71:24) rather than redrawn.
 */

export const AMWAY_LOGO_PATH = "./assets/amway-logo-black.svg";
export const AMWAY_LOGO_ASPECT = { width: 71, height: 24 };
export const AMWAY_LOGO_SOURCE_URL =
  "https://images.contentstack.io/v3/assets/blt70a7e9d08c98ce54/bltc9c12b3aad776123/636a050025f98d3896160f1b/Color_Amway_Black.svg";

export const AMWAY_PALETTE = {
  /** Header/page surface. */
  surface: "#FFFFFF",
  /** Main text. */
  ink: "#2C2C2C",
  /** Footer/neutral surface. */
  neutral: "#F4F4F4",
  /** Blue links and corporate hero action; app accent. */
  accent: "#38539A",
  /** Product-group accents; never authority scopes. */
  category: {
    nutrition: "#546223",
    beauty: "#7F3E3E",
    home: "#396E75",
  },
};

/**
 * Typography: GT Walsheim (regular/medium/bold) is observed on amway.de but
 * NOT licensed for redistribution, so the shell must use a system
 * sans-serif stack until font packaging is resolved with Amway.
 */
export const AMWAY_FONT_STACK =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const AMWAY_FONT_LICENSED = false;
