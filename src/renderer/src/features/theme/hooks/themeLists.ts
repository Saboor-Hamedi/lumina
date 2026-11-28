/**
 * Centralized Theme Exporter
 *
 * Curated studio collection of 18 distinct, high-contrast themes
 * (14 Dark + 4 Light) tuned for Lumina's 3-tier Islands UI.
 */

import { ThemeDefinition } from './themeDefinitions'

import { dark } from './themes/dark'
import { parchment } from './themes/parchment'
import { light } from './themes/light'
import { porcelain } from './themes/porcelain'
import { rosePineDawn } from './themes/rosePineDawn'
import { obsidian } from './themes/obsidian'
import { tokyoNight } from './themes/tokyoNight'
import { githubDark } from './themes/githubDark'
import { nord } from './themes/nord'
import { catppuccin } from './themes/catppuccin'
import { dracula } from './themes/dracula'
import { gruvbox } from './themes/gruvbox'
import { solarizedDark } from './themes/solarizedDark'
import { everforest } from './themes/everforest'
import { kanagawa } from './themes/kanagawa'
import { vesper } from './themes/vesper'
import { rosePine } from './themes/rosePine'
import { paddyEmerald } from './themes/paddyEmerald'

export const THEMES: Record<string, ThemeDefinition> = {
  dark,
  parchment,
  light,
  porcelain,
  rosePineDawn,
  obsidian,
  tokyoNight,
  githubDark,
  nord,
  catppuccin,
  dracula,
  gruvbox,
  solarizedDark,
  everforest,
  kanagawa,
  vesper,
  rosePine,
  paddyEmerald
}

export default THEMES
