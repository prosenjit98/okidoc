/**
 * Metro for the Okidoc npm-workspace monorepo.
 *  - watches the repository root so hoisted packages and packages/shared are visible
 *  - resolves `@okidoc/shared` to packages/shared/dist (build it with `npm run build:shared`)
 *  - resolves the `@/` alias to ./src (same as tsconfig "paths")
 *  - dev server on port 8088 (8081 is used by another local project)
 */
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const sharedEntry = path.join(workspaceRoot, 'packages', 'shared', 'dist', 'index.js');

/** Regex matching everything below a directory, with either path separator. */
const under = (...parts) => {
  const escaped = path
    .join(...parts)
    .split(/[\\/]/)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\\\/]');
  return new RegExp(`^${escaped}[\\\\/].*`);
};

const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [path.join(projectRoot, 'node_modules'), path.join(workspaceRoot, 'node_modules')],
    blockList: [
      under(workspaceRoot, '.dev-db'),
      under(workspaceRoot, 'apps', 'web'),
      under(workspaceRoot, 'apps', 'api'),
      under(projectRoot, 'android', 'build'),
      under(projectRoot, 'android', 'app', 'build'),
      under(projectRoot, 'android', '.gradle'),
      under(projectRoot, 'ios', 'Pods'),
      under(projectRoot, 'ios', 'build'),
      under(projectRoot, 'build'),
      // Native build output anywhere, including inside node_modules/<lib>/android after a Gradle build.
      // Without this Metro tries to crawl/watch tens of thousands of .cxx / build files and stops responding.
      /[\\/]android[\\/](build|\.cxx|\.gradle|app[\\/]build|app[\\/]\.cxx)[\\/].*/,
      /[\\/]\.cxx[\\/].*/,
      /[\\/]\.git[\\/].*/,
    ],
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === '@okidoc/shared') return { type: 'sourceFile', filePath: sharedEntry };
      if (moduleName.startsWith('@/')) {
        return context.resolveRequest(context, path.join(projectRoot, 'src', moduleName.slice(2)), platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
  server: { port: 8088 },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
