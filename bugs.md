# Additional Requirements: Terminal Alignment, Shell Discovery & Cross-Shell Compatibility

Integrate the following requirements into the existing Lumina Terminal Reliability & UI Polish task. These requirements are additional to the original scope, not a replacement for it.

## 11. Fix Initial Prompt Alignment Across Shells

### Current issue

In CMD, the initial prompt appears as:

`C:\Users\Saboor\OneDrive\Documents\lumina>`

The prompt appears on a single line below the expected starting position and does not align consistently with Bash. The initial terminal rendering looks visually inconsistent across shell profiles.

### Required investigation

Determine whether the issue originates from:

- Terminal emulator initialization or initial cursor positioning.
- PTY startup and initial output delivery.
- Incorrect handling of carriage returns and line feeds.
- Terminal dimensions being applied after the initial output arrives.
- Duplicate initialization, startup commands, or shell-generated newlines.
- Differences between Windows console behavior and the terminal emulator's expected input/output protocol.

Do not assume CMD itself is defective. Identify the actual source of the discrepancy.

### Expected behavior

- CMD, PowerShell, and Bash should begin at the correct initial cursor position.
- The first prompt must appear naturally at the beginning of the terminal's active input line.
- Do not introduce an unwanted blank line before or after the initial prompt.
- Ensure prompt text, caret, and subsequent command input share the same baseline.
- Preserve each shell's native prompt format and behavior.
- Ensure the prompt remains correctly positioned after clearing the screen, resizing the panel, switching sessions, and executing commands.
- Do not hard-code shell-specific cursor coordinates or manually print an additional prompt.
- Avoid cosmetic CSS adjustments that conceal an underlying terminal state or PTY synchronization issue.

**Important:** Different shells do not necessarily produce identical prompt strings. The requirement is consistent terminal rendering and cursor behavior, not identical prompt text.

## 12. Discover and Support Additional Installed Shells

Audit Lumina's current shell-profile implementation and determine which additional terminal environments can be supported safely on the user's system.

Do not limit discovery to the existing Bash, PowerShell, and CMD profiles.

Investigate support for the following environments where compatible with Lumina's current platform and PTY architecture:

### Windows shells

- Windows PowerShell (`powershell.exe`).
- PowerShell 7 (`pwsh.exe`).
- Windows Command Prompt (`cmd.exe`).
- Git Bash, if installed.
- WSL distributions, if WSL is installed and functional.

### Linux and Unix-like shells

- Bash.
- Zsh.
- Fish.
- Sh-compatible shells.
- Other installed shells where their executable, environment, and PTY requirements can be satisfied.

### Cross-platform considerations

- On Windows, discover compatible Windows shells and optional environments such as Git Bash and WSL.
- On Linux, discover available shell executables and respect the user's configured default shell where appropriate.
- On macOS, support compatible installed shells such as Zsh and Bash if macOS is within Lumina's supported platform scope.
- Do not assume that Linux-specific shells or executables exist on Windows.
- Do not assume that the presence of WSL or Git Bash means it is correctly configured.
- Distinguish between a shell that is installed, a shell that is available through PATH, and a shell that can actually start successfully.

## 13. Implement Safe Shell Discovery and Registration

Create or improve a centralized shell-profile registry that describes supported terminal profiles.

Each profile should provide, as appropriate:

- Stable profile identifier.
- Display name.
- Executable path or command.
- Arguments.
- Operating-system compatibility.
- Availability and discovery status.
- Initial working directory.
- Environment variables.
- Shell-specific startup configuration, if required.
- Optional profile-specific icon or presentation metadata.

Requirements:

- Discover installed shells without blocking the UI thread.
- Resolve executable paths safely.
- Validate that a candidate executable can be launched before treating it as fully functional.
- Avoid starting a persistent shell process merely to populate the profile list.
- Prefer the user's configured default shell when it is available and compatible.
- Provide a sensible fallback when the preferred shell is unavailable.
- Allow manual configuration of a shell executable when automatic discovery fails.
- Handle paths containing spaces, missing executables, invalid configurations, and startup errors.
- Avoid executing arbitrary shell commands solely for discovery.
- Use safe process argument handling rather than constructing shell commands through unsafe string concatenation.
- Do not modify system PATH, shell configuration files, registry settings, or user profiles automatically.
- Keep shell discovery separate from terminal session creation.

Display unavailable profiles clearly or omit them from the default selectable list, according to the existing UI design. Do not silently substitute a different shell without informing the user when that substitution materially changes behavior.

## 14. Preserve Existing Shell Sessions and Functionality

Adding new profiles must not break any existing functionality.

Verify that:

- Existing Bash, PowerShell, and CMD sessions continue to work.
- Each terminal session retains its own process, input, output, working directory, and terminal state.
- Switching between shell profiles does not overwrite another session's state.
- Adding a profile does not restart existing terminals.
- Renaming a session does not change the underlying shell executable.
- Closing a session terminates only the process resources owned by that session.
- A missing optional shell does not prevent Lumina from launching.
- A failed shell startup does not crash the application or corrupt other sessions.
- Terminal resizing and panel maximization continue to work for all supported profiles.
- ANSI escape sequences, cursor positioning, keyboard input, scrolling, and clipboard operations remain correct.
- Application startup remains fast even when many shell profiles are available.

If a particular shell requires a different PTY configuration or terminal compatibility mode, implement that support explicitly rather than introducing global changes that destabilize existing shells.

## 15. Terminal Profile UI

Improve shell selection while retaining Lumina's existing design language.

- Provide a clear way to create a terminal using a selected shell profile.
- Show the shell name and, where useful, its executable or environment.
- Distinguish the active terminal session from available profiles.
- Keep the terminal session list compact and readable.
- Provide useful error messages when a shell cannot start.
- Preserve existing terminal tab behavior.
- Avoid unnecessary controls, excessive visual complexity, or a wholesale redesign.

The user should be able to open Bash, PowerShell, CMD, Git Bash, or WSL when available without having to manually modify application source code.

## 16. Cross-Shell Regression Matrix

Run the following tests against every shell that is actually available in the test environment.

| Test                | Expected result                                                     |
| ------------------- | ------------------------------------------------------------------- |
| Initial startup     | Prompt appears at the correct position without unwanted blank lines |
| First command       | Input and execution work normally                                   |
| Clear screen        | No duplicated prompt or incorrect cursor position                   |
| Long command        | Input wraps and remains editable                                    |
| Command history     | Shell-native history navigation works                               |
| Resize terminal     | Cursor and content remain synchronized                              |
| Switch sessions     | Each session preserves its own state                                |
| Large output        | UI remains responsive and output is not duplicated                  |
| Shell unavailable   | Clear error or safe fallback                                        |
| Close terminal      | Only the intended session is terminated                             |
| Restart application | No orphaned processes or stale session subscriptions                |

Do not claim that a shell is supported merely because its executable is detected. Verify that it can initialize, accept input, render output, and terminate correctly.

## 17. Final Acceptance Criteria

The implementation is complete when:

1. CMD's initial prompt no longer appears on an unintended extra line.
2. Bash, PowerShell, and CMD maintain correct cursor and prompt positioning.
3. The original duplicate-prompt and misplaced-caret issues are resolved.
4. Additional compatible shells are discovered and exposed safely.
5. Optional shell environments can be unavailable without affecting core functionality.
6. Shell selection and terminal session management remain reliable.
7. Existing Lumina features continue to work without regression.
8. Automated tests and real application tests validate the improvements.

In the final engineering report, list the shells detected on the test machine, which ones were successfully launched and tested, which ones remain unsupported, and why.

**Implementation priority:** Fix terminal protocol and initialization issues first, establish reliable cross-shell lifecycle management second, implement shell discovery third, and polish the profile-selection UI last.

Do not introduce a new terminal architecture or replace the existing emulator unless the investigation establishes that the current implementation cannot meet these requirements safely.
