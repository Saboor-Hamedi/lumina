Prompt for your agent:

"Please update README.md to sync our latest v1.4.0 release assets and add clear installation instructions—specifically unblocking macOS users hitting Apple Gatekeeper:

1. Update the Version Badge:

Update the top version badge from 1.1.2 to 1.4.0 ([https://img.shields.io/badge/version-1.4.0-blue?style=flat-square](https://img.shields.io/badge/version-1.4.0-blue?style=flat-square)).

2. Add a Download & Install (v1.4.0) Section:

Right below the main intro paragraph (above ## Highlights), add a clean download table listing all v1.4.0 installers from [https://github.com/Saboor-Hamedi/lumina/releases/latest](https://github.com/Saboor-Hamedi/lumina/releases/latest):

Windows: Lumina_1.4.0_x64-setup.exe or Lumina_1.4.0_x64_en-US.msi (note SmartScreen More info → Run anyway if prompted)

macOS (Apple Silicon & Intel): Lumina_1.4.0_universal.dmg — include clear instructions that since builds are not yet Apple-notarized, users should drag Lumina.app to Applications and run xattr -cr /Applications/Lumina.app once in Terminal if Gatekeeper blocks opening.

Linux (Debian / Ubuntu): Lumina_1.4.0_amd64.deb (sudo apt install ./Lumina_1.4.0_amd64.deb)

Linux (Portable): Lumina_1.4.0_amd64.AppImage (chmod +x Lumina_1.4.0_amd64.AppImage)

3. Keep Existing Content Intact:

Preserve all existing sections, shortcuts, architecture notes, and MIT license details."
