/**
 * Get the application version
 * When running from source: reads from package.json
 * When running as compiled binary: uses BUILD_VERSION injected at build time
 */
export async function getVersion(): Promise<string> {
  // Check if BUILD_VERSION was injected at build time
  if (typeof BUILD_VERSION !== "undefined") {
    return BUILD_VERSION;
  }

  // Running from source - read from package.json
  try {
    const packageJsonPath = new URL("../../package.json", import.meta.url);
    const packageJson = Bun.file(packageJsonPath);
    const data = (await packageJson.json()) as { version: string };
    return data.version;
  } catch (error) {
    console.warn("Warning: Could not determine version:", error);
    return "unknown";
  }
}

// Declare the global BUILD_VERSION variable for TypeScript
declare global {
  const BUILD_VERSION: string | undefined;
}
