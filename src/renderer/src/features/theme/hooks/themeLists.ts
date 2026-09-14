/**
 * Centralized Theme Exporter
 * 
 * Individual themes are organized in the './themes/' directory.
 * To add a new theme:
 * 1. Create a new file './themes/<themeName>.ts'
 * 2. Export the theme object as default or named export
 * 3. Import and add it to THEMES below
 */

import { ThemeDefinition } from './themeDefinitions'

import { dark } from './themes/dark'
import { dracula } from './themes/dracula'
import { jellyfish } from './themes/jellyfish'
import { one_monokai } from './themes/one_monokai'
import { mayukai } from './themes/mayukai'
import { light } from './themes/light'
import { rosePineDawn } from './themes/rosePineDawn'
import { obsidian } from './themes/obsidian'
import { tokyoNight } from './themes/tokyoNight'
import { synthwave } from './themes/synthwave'
import { rosePine } from './themes/rosePine'
import { catppuccin } from './themes/catppuccin'
import { sunset } from './themes/sunset'
import { gruvbox } from './themes/gruvbox'
import { nord } from './themes/nord'
import { githubDark } from './themes/githubDark'
import { monokai } from './themes/monokai'
import { aura } from './themes/aura'
import { cyberpunk } from './themes/cyberpunk'
import { solarizedDark } from './themes/solarizedDark'
import { nightOwl } from './themes/nightOwl'
import { everforest } from './themes/everforest'
import { ayuMirage } from './themes/ayuMirage'
import { kanagawa } from './themes/kanagawa'
import { horizon } from './themes/horizon'
import { palenight } from './themes/palenight'
import { oceanicNext } from './themes/oceanicNext'
import { shadesOfPurple } from './themes/shadesOfPurple'
import { poimandres } from './themes/poimandres'
import { edgeDark } from './themes/edgeDark'
import { moonlight } from './themes/moonlight'
import { materialPalenight } from './themes/materialPalenight'
import { paddyEmerald } from './themes/paddyEmerald'
import { vesper } from './themes/vesper'
import { zenburn } from './themes/zenburn'
import { iceberg } from './themes/iceberg'
import { woodland } from './themes/woodland'
import { emberGlow } from './themes/emberGlow'
import { deepOcean } from './themes/deepOcean'
import { autumnLeaves } from './themes/autumnLeaves'
import { mintCondition } from './themes/mintCondition'
import { retroTerminal } from './themes/retroTerminal'
import { sakuraDream } from './themes/sakuraDream'
import { arcticFox } from './themes/arcticFox'
import { coffeeHouse } from './themes/coffeeHouse'
import { neonDistrict } from './themes/neonDistrict'
import { stormCloud } from './themes/stormCloud'
import { bambooGrove } from './themes/bambooGrove'
import { galaxyDrift } from './themes/galaxyDrift'
import { copperPatina } from './themes/copperPatina'
import { midnightRose } from './themes/midnightRose'
import { desertDusk } from './themes/desertDusk'
import { crystalline } from './themes/crystalline'
import { volcanic } from './themes/volcanic'
import { porcelain } from './themes/porcelain'
import { moonlightSonata } from './themes/moonlightSonata'
import { matchaLatte } from './themes/matchaLatte'
import { crimsonTide } from './themes/crimsonTide'
import { celestial } from './themes/celestial'
import { darkForest } from './themes/darkForest'
import { winterFrost } from './themes/winterFrost'
import { amberGlow } from './themes/amberGlow'
import { deepSpace } from './themes/deepSpace'
import { parchment } from './themes/parchment'

export const THEMES: Record<string, ThemeDefinition> = {
  dark,
  dracula,
  jellyfish,
  one_monokai,
  mayukai,
  light,
  rosePineDawn,
  obsidian,
  tokyoNight,
  synthwave,
  rosePine,
  catppuccin,
  sunset,
  gruvbox,
  nord,
  githubDark,
  monokai,
  aura,
  cyberpunk,
  solarizedDark,
  nightOwl,
  everforest,
  ayuMirage,
  kanagawa,
  horizon,
  palenight,
  oceanicNext,
  shadesOfPurple,
  poimandres,
  edgeDark,
  moonlight,
  materialPalenight,
  paddyEmerald,
  vesper,
  zenburn,
  iceberg,
  woodland,
  emberGlow,
  deepOcean,
  autumnLeaves,
  mintCondition,
  retroTerminal,
  sakuraDream,
  arcticFox,
  coffeeHouse,
  neonDistrict,
  stormCloud,
  bambooGrove,
  galaxyDrift,
  copperPatina,
  midnightRose,
  desertDusk,
  crystalline,
  volcanic,
  porcelain,
  moonlightSonata,
  matchaLatte,
  crimsonTide,
  celestial,
  darkForest,
  winterFrost,
  amberGlow,
  deepSpace,
  parchment,
}

export default THEMES
