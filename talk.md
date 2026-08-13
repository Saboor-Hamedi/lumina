aultSearch] ✓ Loaded 6781 chunks into memory
[IndexerWorker] Loading embedding model...
[IndexerWorker] Embedder loaded
Failed to trigger dictation: Error: Command failed: powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$code = 'using System; using System.Runtime.InteropServices; public class Keyboard { [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo); public static void PressWinH() { keybd_event(0x5B, 0, 0, UIntPtr.Zero); keybd_event(0x48, 0, 0, UIntPtr.Zero); keybd_event(0x48, 0, 0x0002, UIntPtr.Zero); keybd_event(0x5B, 0, 0x0002, UIntPtr.Zero); } }'; Add-Type -TypeDefinition $code; [Keyboard]::PressWinH()"
Add-Type : c:\Users\Saboor\AppData\Local\Temp\ob52kryh.0.cs(1) : The name 'user32' does not exist in the current 
context
c:\Users\Saboor\AppData\Local\Temp\ob52kryh.0.cs(1) : >>> using System; using System.Runtime.InteropServices; public 
class Keyboard { [DllImport(user32.dll)] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, 
UIntPtr dwExtraInfo); public static void PressWinH() { keybd_event(0x5B, 0, 0, UIntPtr.Zero); keybd_event(0x48, 0, 0, 
UIntPtr.Zero); keybd_event(0x48, 0, 0x0002, UIntPtr.Zero); keybd_event(0x5B, 0, 0x0002, UIntPtr.Zero); } }
At line:1 char:411
+ ... , 0x0002, UIntPtr.Zero); } }'; Add-Type -TypeDefinition $code; [Keybo ...
+                                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidData: (Microsoft.Power...peCompilerError:AddTypeCompilerError) [Add-Type], Except 
   ion
    + FullyQualifiedErrorId : SOURCE_CODE_ERROR,Microsoft.PowerShell.Commands.AddTypeCommand
 
Add-Type : Cannot add type. Compilation errors occurred.
At line:1 char:411
+ ... , 0x0002, UIntPtr.Zero); } }'; Add-Type -TypeDefinition $code; [Keybo ...
+                                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidData: (:) [Add-Type], InvalidOperationException
    + FullyQualifiedErrorId : COMPILER_ERRORS,Microsoft.PowerShell.Commands.AddTypeCommand
 
Unable to find type [Keyboard].
At line:1 char:443
+ ... ntPtr.Zero); } }'; Add-Type -TypeDefinition $code; [Keyboard]::PressW ...
+                                                        ~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (Keyboard:TypeName) [], RuntimeException
    + FullyQualifiedErrorId : TypeNotFound
 

    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at ChildProcess.exithandler (node:child_process:417:12)
    at ChildProcess.emit (node:events:519:28)
    at maybeClose (node:internal/child_process:1101:16)
    at ChildProcess._handle.onexit (node:internal/child_process:304:5) {
  code: 1,
  killed: false,
  signal: null,
  cmd: `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$code = 'using System; using System.Runtime.InteropServices; public class Keyboard { [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo); public static void PressWinH() { keybd_event(0x5B, 0, 0, UIntPtr.Zero); keybd_event(0x48, 0, 0, UIntPtr.Zero); keybd_event(0x48, 0, 0x0002, UIntPtr.Zero); keybd_event(0x5B, 0, 0x0002, UIntPtr.Zero); } }'; Add-Type -TypeDefinition $code; [Keyboard]::PressWinH()"`
}



