const fs = require('fs');
const path = require('path');

/**
 * Pre-generates Expo Router typed routes declaration file (.expo/types/router.d.ts)
 * so that `tsc --noEmit` and CI typechecking succeed without needing an active dev server.
 */
function generateTypedRoutes() {
  const appRoot = path.resolve(__dirname, '../src/app');
  const targetDir = path.resolve(__dirname, '../.expo/types');
  const targetFile = path.join(targetDir, 'router.d.ts');

  process.env.EXPO_ROUTER_APP_ROOT = 'src/app';

  let getTypedRoutesDeclarationFile = null;

  const candidatePaths = [
    'expo/node_modules/@expo/cli/node_modules/@expo/router-server/build/typed-routes/generate',
    '@expo/cli/node_modules/@expo/router-server/build/typed-routes/generate',
    '@expo/router-server/build/typed-routes/generate',
  ];

  for (const candidate of candidatePaths) {
    try {
      getTypedRoutesDeclarationFile = require(candidate).getTypedRoutesDeclarationFile;
      if (getTypedRoutesDeclarationFile) break;
    } catch {
      // Continue to next candidate
    }
  }

  if (!getTypedRoutesDeclarationFile) {
    console.warn('[generate-routes] Notice: Typed routes generator module not found. Skipping route pregeneration.');
    return;
  }

  try {
    const { requireContext } = require('expo-router/internal/testing');
    const { EXPO_ROUTER_CTX_IGNORE } = require('expo-router/_ctx-shared');

    const ctx = requireContext('src/app', true, EXPO_ROUTER_CTX_IGNORE);
    const content = getTypedRoutesDeclarationFile(ctx, {});

    if (content) {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(targetFile, content, 'utf8');
      console.log(`[generate-routes] Successfully generated ${targetFile}`);
    }
  } catch (error) {
    console.warn('[generate-routes] Warning: Could not pre-generate router types:', error.message);
  }
}

generateTypedRoutes();
