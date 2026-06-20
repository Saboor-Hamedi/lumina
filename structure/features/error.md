  ⨯ exit status 2
github.com/develar/app-builder/pkg/util.WaitPipedCommand
        /Users/runner/work/app-builder/app-builder/pkg/util/util.go:104
github.com/develar/app-builder/pkg/util.RunPipedCommands
        /Users/runner/work/app-builder/app-builder/pkg/util/util.go:88
github.com/develar/app-builder/pkg/download.RunExtractCommands
        /Users/runner/work/app-builder/app-builder/pkg/download/artifactDownloader.go:200
github.com/develar/app-builder/pkg/download.unpackTar7z
        /Users/runner/work/app-builder/app-builder/pkg/download/artifactDownloader.go:187
github.com/develar/app-builder/pkg/download.DownloadArtifact
        /Users/runner/work/app-builder/app-builder/pkg/download/artifactDownloader.go:113
github.com/develar/app-builder/pkg/package-format/snap.ResolveTemplateDir
        /Users/runner/work/app-builder/app-builder/pkg/package-format/snap/snap.go:112
github.com/develar/app-builder/pkg/package-format/snap.ConfigureCommand.func1
        /Users/runner/work/app-builder/app-builder/pkg/package-format/snap/snap.go:77
github.com/alecthomas/kingpin.(*actionMixin).applyActions
        /Users/runner/go/pkg/mod/github.com/alecthomas/kingpin@v2.2.6+incompatible/actions.go:28
github.com/alecthomas/kingpin.(*Application).applyActions
        /Users/runner/go/pkg/mod/github.com/alecthomas/kingpin@v2.2.6+incompatible/app.go:557
github.com/alecthomas/kingpin.(*Application).execute
        /Users/runner/go/pkg/mod/github.com/alecthomas/kingpin@v2.2.6+incompatible/app.go:390
github.com/alecthomas/kingpin.(*Application).Parse
        /Users/runner/go/pkg/mod/github.com/alecthomas/kingpin@v2.2.6+incompatible/app.go:222
main.main
        /Users/runner/work/app-builder/app-builder/main.go:90
runtime.main
        /Users/runner/hostedtoolcache/go/1.21.13/arm64/src/runtime/proc.go:267
runtime.goexit
        /Users/runner/hostedtoolcache/go/1.21.13/arm64/src/runtime/asm_amd64.s:1650  
  • downloaded      url=https://github.com/electron-userland/electron-builder-binaries/releases/download/appimage-12.0.1/appimage-12.0.1.7z duration=2.698s
  ⨯ cannot execute  cause=exec: "C:\\Users\\Saboor\\AppData\\Local\\electron-builder\\Cache\\appimage\\appimage-12.0.1\\linux-x64\\mksquashfs": file does not exist
                    command='C:\Users\Saboor\AppData\Local\electron-builder\Cache\appimage\appimage-12.0.1\linux-x64\mksquashfs' 'B:\electron\lumina\dist\__appImage-x64' 'B:\electron\lumina\dist\lumina-1.0.16.AppImage' -offset 188392 -all-root -noappend -no-progress -quiet -no-xattrs -no-fragments
                    workingDir=B:\electron\lumina\dist\__appImage-x64
  ⨯ Cannot cleanup: 

Error #1 --------------------------------------------------------------------------------
Error: B:\electron\lumina\node_modules\app-builder-bin\win\x64\app-builder.exe process failed ERR_ELECTRON_BUILDER_CANNOT_EXECUTE
Exit code:
1
    at ChildProcess.<anonymous> (B:\electron\lumina\node_modules\builder-util\src\util.ts:272:14)
    at Object.onceWrapper (node:events:634:26)
    at ChildProcess.emit (node:events:519:28)
    at ChildProcess.cp.emit (B:\electron\lumina\node_modules\cross-spawn\lib\enoent.js:34:29)
    at maybeClose (node:internal/child_process:1101:16)
    at Process.ChildProcess._handle.onexit (node:internal/child_process:304:5)

Error #2 --------------------------------------------------------------------------------
Error: B:\electron\lumina\node_modules\app-builder-bin\win\x64\app-builder.exe process failed ERR_ELECTRON_BUILDER_CANNOT_EXECUTE
Exit code:
2
    at ChildProcess.<anonymous> (B:\electron\lumina\node_modules\builder-util\src\util.ts:272:14)
    at Object.onceWrapper (node:events:634:26)
    at ChildProcess.emit (node:events:519:28)
    at ChildProcess.cp.emit (B:\electron\lumina\node_modules\cross-spawn\lib\enoent.js:34:29)
    at maybeClose (node:internal/child_process:1101:16)
    at Process.ChildProcess._handle.onexit (node:internal/child_process:304:5)  failedTask=build stackTrace=Error: Cannot cleanup: 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    Error #1 --------------------------------------------------------------------------------
Error: B:\electron\lumina\node_modules\app-builder-bin\win\x64\app-builder.exe process failed ERR_ELECTRON_BUILDER_CANNOT_EXECUTE
Exit code:
1
    at ChildProcess.<anonymous> (B:\electron\lumina\node_modules\builder-util\src\util.ts:272:14)
    at Object.onceWrapper (node:events:634:26)
    at ChildProcess.emit (node:events:519:28)
    at ChildProcess.cp.emit (B:\electron\lumina\node_modules\cross-spawn\lib\enoent.js:34:29)
    at maybeClose (node:internal/child_process:1101:16)
    at Process.ChildProcess._handle.onexit (node:internal/child_process:304:5)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    Error #2 --------------------------------------------------------------------------------
Error: B:\electron\lumina\node_modules\app-builder-bin\win\x64\app-builder.exe process failed ERR_ELECTRON_BUILDER_CANNOT_EXECUTE
Exit code:
2
    at ChildProcess.<anonymous> (B:\electron\lumina\node_modules\builder-util\src\util.ts:272:14)
    at Object.onceWrapper (node:events:634:26)
    at ChildProcess.emit (node:events:519:28)
    at ChildProcess.cp.emit (B:\electron\lumina\node_modules\cross-spawn\lib\enoent.js:34:29)
    at maybeClose (node:internal/child_process:1101:16)
    at Process.ChildProcess._handle.onexit (node:internal/child_process:304:5)
    at throwError (B:\electron\lumina\node_modules\builder-util\src\asyncTaskManager.ts:88:11)
    at checkErrors (B:\electron\lumina\node_modules\builder-util\src\asyncTaskManager.ts:53:9)
    at AsyncTaskManager.awaitTasks (B:\electron\lumina\node_modules\builder-util\src\asyncTaskManager.ts:67:7)
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
    at B:\electron\lumina\node_modules\app-builder-lib\src\platformPackager.ts:182:7
    at async Promise.all (index 0)
    at AsyncTaskManager.awaitTasks (B:\electron\lumina\node_modules\builder-util\src\asyncTaskManager.ts:65:25)
    at Packager.doBuild (B:\electron\lumina\node_modules\app-builder-lib\src\packager.ts:564:5)
    at executeFinally (B:\electron\lumina\node_modules\builder-util\src\promise.ts:12:14)
    at Packager.build (B:\electron\lumina\node_modules\app-builder-lib\src\packager.ts:458:31)
@Saboor ➜ lumina git(mermaid-test)  





