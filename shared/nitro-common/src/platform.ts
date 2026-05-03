import * as os from "node:os";

export type OsType = "osx" | "linux" | "win";
export type ArchType = "x64" | "arm64";

export interface PlatformInfo {
  osType: OsType;
  archType: ArchType;
}

export function getPlatformInfo(): PlatformInfo {
  const platform = os.platform();
  const arch = os.arch();

  let osType: OsType;
  switch (platform) {
    case "darwin":
      osType = "osx";
      break;
    case "linux":
      osType = "linux";
      break;
    case "win32":
      osType = "win";
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  let archType: ArchType;
  switch (arch) {
    case "x64":
      archType = "x64";
      break;
    case "arm64":
      archType = "arm64";
      break;
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }

  return { osType, archType };
}
