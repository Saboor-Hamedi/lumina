npx electron-builder --publish always
npm notice run lumina@1.0.68 npx
npm notice run electron-builder --publish always
• electron-builder version=26.15.3 os=10.0.26300
• loaded configuration file=B:\electron\lumina\electron-builder.yml
• @electron/rebuild already used by electron-builder, please consider to remove excess dependency from devDependencies

To ensure your native dependencies are always matched electron version, simply add script `"postinstall": "electron-builder install-app-deps" to your `package.json`
• writing effective config file=dist\builder-effective-config.yaml
• skipped dependencies rebuild reason=npmRebuild is set to false
• packaging platform=win32 arch=x64 electron=39.8.10 appOutDir=dist\win-unpacked
• downloading label=electron
[====================================================================================================] 100% | electron
• downloaded electron zip extracted successfully output=B:\electron\lumina\dist\win-unpacked
• searching for node modules pm=npm searchDir=B:\electron\lumina
• duplicate dependency references dependencies=["debug@4.4.3","@types/node@22.20.4","@types/node@22.20.4","@types/responselike@1.0.3","@types/node@22.20.4","get-stream@5.2.0","responselike@2.0.1","decompress-response@6.0.0","debug@4.4.3","@types/node@22.20.4","debug@4.4.3","pump@3.0.4","electron@39.8.10","@emnapi/wasi-threads@1.2.2","@types/node@22.20.4","once@1.4.0","once@1.4.0","simple-get@4.0.1","pump@3.0.4","string_decoder@1.3.0","end-of-stream@1.4.5","string_decoder@1.3.0","tunnel-agent@0.6.0","bare-fs@4.8.2","pump@3.0.4","tar-stream@3.2.1","streamx@2.28.1","streamx@2.28.1","readable-stream@4.7.0","readable-stream@4.7.0","readable-stream@4.7.0"]
• updating asar integrity executable resource executablePath=dist\win-unpacked\Lumina.exe
⨯ Application entry file "out\main\index.js" in the "B:\electron\lumina\dist\win-unpacked\resources\app.asar" is corrupted: Error: "out\main\index.js" was not found in this archive failedTask=build stackTrace=Error: Application entry file "out\main\index.js" in the "B:\electron\lumina\dist\win-unpacked\resources\app.asar" is corrupted: Error: "out\main\index.js" was not found in this archive
at error (B:\electron\lumina\node_modules\app-builder-lib\src\asar\asarFileChecker.ts:7:12)
at checkFileInArchive (B:\electron\lumina\node_modules\app-builder-lib\src\asar\asarFileChecker.ts:16:11)
at WinPackager.checkFileInPackage (B:\electron\lumina\node_modules\app-builder-lib\src\platformPackager.ts:636:7)
at WinPackager.sanityCheckPackage (B:\electron\lumina\node_modules\app-builder-lib\src\platformPackager.ts:684:5)
at WinPackager.doPack (B:\electron\lumina\node_modules\app-builder-lib\src\platformPackager.ts:350:5)
at WinPackager.pack (B:\electron\lumina\node_modules\app-builder-lib\src\platformPackager.ts:163:5)
at Packager.doBuild (B:\electron\lumina\node_modules\app-builder-lib\src\packager.ts:530:11)
at executeFinally (B:\electron\lumina\node_modules\builder-util\src\promise.ts:12:14)
at Packager.build (B:\electron\lumina\node_modules\app-builder-lib\src\packager.ts:450:31)
at executeFinally (B:\electron\lumina\node_modules\builder-util\src\promise.ts:12:14)
