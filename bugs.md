16s
Run npx electron-builder --publish always
  • electron-builder  version=26.4.0 os=10.0.26100
  • loaded configuration  file=D:\a\lumina\lumina\electron-builder.yml
  • @electron/rebuild already used by electron-builder, please consider to remove excess dependency from devDependencies

To ensure your native dependencies are always matched electron version, simply add script `"postinstall": "electron-builder install-app-deps" to your `package.json`
  • skipped dependencies rebuild  reason=npmRebuild is set to false
  • packaging       platform=win32 arch=x64 electron=39.2.4 appOutDir=dist\win-unpacked
  • downloading     url=https://github.com/electron/electron/releases/download/v39.2.4/electron-v39.2.4-win32-x64.zip size=137 MB parts=8
  • downloaded      url=https://github.com/electron/electron/releases/download/v39.2.4/electron-v39.2.4-win32-x64.zip duration=381ms
  • updating asar integrity executable resource  executablePath=dist\win-unpacked\Lumina.exe
  • downloading     url=https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z size=5.6 MB parts=1
  • downloaded      url=https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z duration=201ms
  • signing with signtool.exe  path=dist\win-unpacked\Lumina.exe
  • building        target=nsis file=dist\lumina-1.0.60-setup.exe archs=x64 oneClick=true perMachine=false
  ⨯ cannot resolve https://github.com/electron-userland/electron-builder-binaries/releases/download//nsis-3.0.4.1.7z: status code 404
github.com/develar/app-builder/pkg/download.(*Downloader).follow
	/Users/runner/work/app-builder/app-builder/pkg/download/downloader.go:237
github.com/develar/app-builder/pkg/download.(*Downloader).DownloadNoRetry
	/Users/runner/work/app-builder/app-builder/pkg/download/downloader.go:128
github.com/develar/app-builder/pkg/download.(*Downloader).Download
	/Users/runner/work/app-builder/app-builder/pkg/download/downloader.go:112
github.com/develar/app-builder/pkg/download.DownloadArtifact
	/Users/runner/work/app-builder/app-builder/pkg/download/artifactDownloader.go:107
github.com/develar/app-builder/pkg/download.ConfigureArtifactCommand.func1
	/Users/runner/work/app-builder/app-builder/pkg/download/artifactDownloader.go:27
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
  ⨯ D:\a\lumina\lumina\node_modules\app-builder-bin\win\x64\app-builder.exe process failed ERR_ELECTRON_BUILDER_CANNOT_EXECUTE
Exit code:
1  failedTask=build stackTrace=Error: D:\a\lumina\lumina\node_modules\app-builder-bin\win\x64\app-builder.exe process failed ERR_ELECTRON_BUILDER_CANNOT_EXECUTE
Exit code:
1
    at ChildProcess.<anonymous> (D:\a\lumina\lumina\node_modules\builder-util\src\util.ts:272:14)
    at Object.onceWrapper (node:events:634:26)
    at ChildProcess.emit (node:events:519:28)
    at ChildProcess.cp.emit (D:\a\lumina\lumina\node_modules\cross-spawn\lib\enoent.js:34:29)
    at maybeClose (node:internal/child_process:1101:16)
    at Process.ChildProcess._handle.onexit (node:internal/child_process:304:5)
Error: Process completed with exit code 1.