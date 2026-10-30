const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// @PATH-REGISTRY-START
// Dynamic Project Root Anchor Walk-Up & Manifest Resolution (SKILL-15)
function findProjectRoot(startDir) {
    let current = path.resolve(startDir);
    while (current && current !== path.parse(current).root) {
        if (fs.existsSync(path.join(current, '.project-root'))) {
            return current;
        }
        current = path.dirname(current);
    }
    return path.resolve(__dirname, '..'); // Resilient fallback
}

const ROOT_DIR = findProjectRoot(__dirname);
let manifest = null;
const manifestPath = path.join(ROOT_DIR, 'paths.manifest.json');
if (fs.existsSync(manifestPath)) {
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (_) {}
}

const PATCH_DIR = path.join(ROOT_DIR, manifest?.dirs?.patch || 'patch');
const BUILD_DIR = path.join(ROOT_DIR, manifest?.dirs?.build || 'build');
const TEMP_DIR = path.join(ROOT_DIR, manifest?.dirs?.tempStage || 'temp_patch_stage');
const LOCAL_APPDATA = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData', 'Local');
const TARGET_DIR = path.join(LOCAL_APPDATA, manifest?.targetPaths?.resourcesRel || 'Programs/antigravity/resources');
const TARGET_ASAR = path.join(TARGET_DIR, manifest?.targetPaths?.asarFilename || 'app.asar');
const OUTPUT_ASAR = path.join(BUILD_DIR, manifest?.targetPaths?.asarFilename || 'app.asar');
// @PATH-REGISTRY-END

console.log('=======================================================');
console.log('  Antigravity Smart In-Place Dynamic Patcher');
console.log('=======================================================');
console.log(`Target Directory : ${TARGET_DIR}`);
console.log(`Target ASAR      : ${TARGET_ASAR}\n`);

// 1. Validate Target ASAR
if (!fs.existsSync(TARGET_ASAR)) {
    console.error(`[ERROR] Antigravity app.asar not found at:\n${TARGET_ASAR}`);
    console.error('Please ensure Google Antigravity is installed before running this script.');
    process.exit(1);
}

// 2. Backup current ASAR
const backupFile = path.join(TARGET_DIR, 'app.asar.backup_before_patch');
try {
    if (!fs.existsSync(backupFile)) {
        console.log('[1/6] Creating initial backup in resources folder...');
        fs.copyFileSync(TARGET_ASAR, backupFile);
        console.log(` -> Saved backup: ${backupFile}`);
    } else {
        console.log('[1/6] Existing safety backup already present.');
    }
} catch (err) {
    console.warn(`[WARNING] Could not create local backup: ${err.message}`);
}

// 3. Clean temporary staging area
console.log('[2/6] Preparing clean staging directory...');
if (fs.existsSync(TEMP_DIR)) {
    try {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch (_) {
        execSync(`powershell -NoProfile -Command "Remove-Item -Path '${TEMP_DIR}' -Recurse -Force"`, { stdio: 'ignore' });
    }
}
fs.mkdirSync(TEMP_DIR, { recursive: true });

// 4. Extract target ASAR
console.log('[3/6] Extracting live app.asar from installation...');
execSync(`npx asar extract "${TARGET_ASAR}" "${TEMP_DIR}"`, { stdio: 'inherit' });

// 5. Apply Patches
console.log('[4/6] Applying Smart BiDi Engine & DevTools patches...');
const preloadPath = path.join(TEMP_DIR, 'dist', 'preload.js');
const utilsPath = path.join(TEMP_DIR, 'dist', 'utils.js');
const menuPath = path.join(TEMP_DIR, 'dist', 'menu.js');
const debugConsolePath = path.join(TEMP_DIR, 'dist', 'debugConsole.js');
const bidiEngineCode = fs.readFileSync(path.join(PATCH_DIR, 'bidi_engine.js'), 'utf-8');

// Patch preload.js
if (fs.existsSync(preloadPath)) {
    let preloadContent = fs.readFileSync(preloadPath, 'utf-8');
    if (preloadContent.includes('// === Antigravity Smart BiDi & RTL Isolation Engine ===')) {
        console.log(' -> preload.js already contains a BiDi patch. Updating it...');
        const parts = preloadContent.split('// === Antigravity Smart BiDi & RTL Isolation Engine ===');
        preloadContent = parts[0];
    }
    preloadContent += '\n\n// === Antigravity Smart BiDi & RTL Isolation Engine ===\n' + bidiEngineCode + '\n';
    fs.writeFileSync(preloadPath, preloadContent, 'utf-8');
    console.log(' -> preload.js successfully patched with latest BiDi Engine.');
} else {
    console.error('[ERROR] dist/preload.js not found in extracted archive.');
    process.exit(1);
}

// Patch debugConsole.js (Newer Antigravity releases)
if (fs.existsSync(debugConsolePath)) {
    let debugContent = fs.readFileSync(debugConsolePath, 'utf-8');
    if (debugContent.includes('return !electron_1.app.isPackaged;')) {
        debugContent = debugContent.replace(
            'return !electron_1.app.isPackaged;',
            'return true; // Patched: Enable DevTools across all windows & menu'
        );
        fs.writeFileSync(debugConsolePath, debugContent, 'utf-8');
        console.log(' -> debugConsole.js patched: isDebugConsoleEnabled set to true.');
    }
}

// Patch utils.js (DevTools)
if (fs.existsSync(utilsPath)) {
    let utilsContent = fs.readFileSync(utilsPath, 'utf-8');
    if (utilsContent.includes('devTools: !electron_1.app.isPackaged,')) {
        utilsContent = utilsContent.replace(
            'devTools: !electron_1.app.isPackaged,',
            'devTools: true, // Patched: Enabled DevTools for debugging & styles'
        );
        fs.writeFileSync(utilsPath, utilsContent, 'utf-8');
        console.log(' -> utils.js patched: devTools set to true.');
    } else if (utilsContent.includes('devTools: (0, debugConsole_1.isDebugConsoleEnabled)(),')) {
        utilsContent = utilsContent.replace(
            'devTools: (0, debugConsole_1.isDebugConsoleEnabled)(),',
            'devTools: true, // Patched: Enabled DevTools for debugging & styles'
        );
        fs.writeFileSync(utilsPath, utilsContent, 'utf-8');
        console.log(' -> utils.js patched: devTools explicitly set to true.');
    }
}

// Patch menu.js (DevTools Menu Item)
if (fs.existsSync(menuPath)) {
    let menuContent = fs.readFileSync(menuPath, 'utf-8');
    if (menuContent.includes('item.visible = false;')) {
        menuContent = menuContent.replace(
            'item.visible = false;',
            '// item.visible = false; // Patched: Keep DevTools visible in menu'
        );
        fs.writeFileSync(menuPath, menuContent, 'utf-8');
        console.log(' -> menu.js patched: DevTools menu item preserved.');
    }
}

// 6. Repack ASAR
console.log('[5/6] Repacking patched app.asar archive...');
if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
}
execSync(`npx asar pack "${TEMP_DIR}" "${OUTPUT_ASAR}" --unpack-dir "node_modules/chrome-devtools-mcp"`, { stdio: 'inherit' });

// 7. Deploy to Target
console.log('[6/6] Deploying patched app.asar to Antigravity...');
fs.copyFileSync(OUTPUT_ASAR, TARGET_ASAR);

// Also copy unpacked dependencies if present
const unpackedSource = path.join(TEMP_DIR, 'node_modules', 'chrome-devtools-mcp');
const unpackedTarget = path.join(TARGET_DIR, 'app.asar.unpacked', 'node_modules', 'chrome-devtools-mcp');
if (fs.existsSync(unpackedSource)) {
    fs.mkdirSync(path.dirname(unpackedTarget), { recursive: true });
    execSync(`powershell -NoProfile -Command "Copy-Item -Path '${unpackedSource}' -Destination '${path.dirname(unpackedTarget)}' -Recurse -Force"`, { stdio: 'ignore' });
}

// Clean up staging
try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
} catch (_) {}

const stats = fs.statSync(TARGET_ASAR);
console.log('\n=======================================================');
console.log('  PATCH COMPLETED SUCCESSFULLY!');
console.log('=======================================================');
console.log(`Deployed File : ${TARGET_ASAR}`);
console.log(`Archive Size  : ${(stats.size / (1024 * 1024)).toFixed(2)} MB (${stats.size} bytes)`);
console.log('Antigravity is now updated and patched.\n');
