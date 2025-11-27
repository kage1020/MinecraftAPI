/**
 * Java Edition JAR Downloader
 * Downloads Client and Server JARs from Mojang servers
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  type VersionDetail,
  type DownloadInfo,
  fetchVersionDetail,
  findVersion,
} from "../versions.js";

// ============================================================================
// Types
// ============================================================================

export interface DownloadConfig {
  /** Version ID to download */
  version: string;
  /** Output directory for downloaded files */
  outputDir: string;
  /** Whether to skip download if file exists with correct hash */
  skipExisting?: boolean;
  /** Download client JAR */
  downloadClient?: boolean;
  /** Download server JAR */
  downloadServer?: boolean;
  /** Download client mappings */
  downloadClientMappings?: boolean;
  /** Download server mappings */
  downloadServerMappings?: boolean;
}

export interface DownloadResult {
  version: string;
  versionDetail: VersionDetail;
  clientPath: string | null;
  serverPath: string | null;
  clientMappingsPath: string | null;
  serverMappingsPath: string | null;
  versionDir: string;
}

export interface DownloadProgress {
  type: "client" | "server" | "client_mappings" | "server_mappings";
  version: string;
  bytesDownloaded: number;
  totalBytes: number;
  complete: boolean;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DOWNLOAD_DIR = "data/downloads";

// ============================================================================
// JAR Downloader
// ============================================================================

/**
 * Downloads JARs for a specific Minecraft version
 * @param config - Download configuration
 * @param onProgress - Optional progress callback
 * @returns Download result with file paths
 */
export async function downloadJars(
  config: DownloadConfig,
  onProgress?: ProgressCallback
): Promise<DownloadResult> {
  const {
    version,
    outputDir = DEFAULT_DOWNLOAD_DIR,
    skipExisting = true,
    downloadClient = true,
    downloadServer = true,
    downloadClientMappings = false,
    downloadServerMappings = false,
  } = config;

  // Fetch version detail
  const versionEntry = await findVersion(version);
  if (!versionEntry) {
    throw new Error(`Version not found: ${version}`);
  }

  const versionDetail = await fetchVersionDetail(versionEntry);

  // Create version directory
  const versionDir = path.join(outputDir, version);
  await fs.mkdir(versionDir, { recursive: true });

  const result: DownloadResult = {
    version,
    versionDetail,
    clientPath: null,
    serverPath: null,
    clientMappingsPath: null,
    serverMappingsPath: null,
    versionDir,
  };

  // Download client JAR
  if (downloadClient && versionDetail.downloads.client) {
    const clientPath = path.join(versionDir, "client.jar");
    result.clientPath = await downloadFile(
      versionDetail.downloads.client,
      clientPath,
      skipExisting,
      onProgress
        ? (bytes, total, complete) =>
            onProgress({
              type: "client",
              version,
              bytesDownloaded: bytes,
              totalBytes: total,
              complete,
            })
        : undefined
    );
    console.log(`Downloaded client.jar for ${version}`);
  }

  // Download server JAR
  if (downloadServer && versionDetail.downloads.server) {
    const serverPath = path.join(versionDir, "server.jar");
    result.serverPath = await downloadFile(
      versionDetail.downloads.server,
      serverPath,
      skipExisting,
      onProgress
        ? (bytes, total, complete) =>
            onProgress({
              type: "server",
              version,
              bytesDownloaded: bytes,
              totalBytes: total,
              complete,
            })
        : undefined
    );
    console.log(`Downloaded server.jar for ${version}`);
  }

  // Download client mappings (optional, for deobfuscation)
  if (downloadClientMappings && versionDetail.downloads.client_mappings) {
    const mappingsPath = path.join(versionDir, "client.txt");
    result.clientMappingsPath = await downloadFile(
      versionDetail.downloads.client_mappings,
      mappingsPath,
      skipExisting,
      onProgress
        ? (bytes, total, complete) =>
            onProgress({
              type: "client_mappings",
              version,
              bytesDownloaded: bytes,
              totalBytes: total,
              complete,
            })
        : undefined
    );
    console.log(`Downloaded client mappings for ${version}`);
  }

  // Download server mappings (optional, for deobfuscation)
  if (downloadServerMappings && versionDetail.downloads.server_mappings) {
    const mappingsPath = path.join(versionDir, "server.txt");
    result.serverMappingsPath = await downloadFile(
      versionDetail.downloads.server_mappings,
      mappingsPath,
      skipExisting,
      onProgress
        ? (bytes, total, complete) =>
            onProgress({
              type: "server_mappings",
              version,
              bytesDownloaded: bytes,
              totalBytes: total,
              complete,
            })
        : undefined
    );
    console.log(`Downloaded server mappings for ${version}`);
  }

  return result;
}

/**
 * Downloads a file with SHA1 verification
 * @param info - Download information
 * @param outputPath - Path to save the file
 * @param skipExisting - Skip if file exists with correct hash
 * @param onProgress - Progress callback
 * @returns Path to downloaded file
 */
async function downloadFile(
  info: DownloadInfo,
  outputPath: string,
  skipExisting: boolean,
  onProgress?: (bytes: number, total: number, complete: boolean) => void
): Promise<string> {
  // Check if file already exists with correct hash
  if (skipExisting) {
    const existingHash = await getFileHash(outputPath);
    if (existingHash === info.sha1) {
      console.log(`Skipping ${path.basename(outputPath)} (already exists)`);
      onProgress?.(info.size, info.size, true);
      return outputPath;
    }
  }

  console.log(`Downloading ${path.basename(outputPath)}...`);

  const response = await fetch(info.url);
  if (!response.ok) {
    throw new Error(
      `Failed to download: ${response.status} ${response.statusText}`
    );
  }

  // Get the response as buffer
  const buffer = Buffer.from(await response.arrayBuffer());

  // Report progress (since we don't have streaming, report after download)
  onProgress?.(buffer.length, info.size, false);

  // Verify SHA1
  const hash = createHash("sha1").update(buffer).digest("hex");
  if (hash !== info.sha1) {
    throw new Error(`SHA1 mismatch: expected ${info.sha1}, got ${hash}`);
  }

  // Write file
  await fs.writeFile(outputPath, buffer);

  onProgress?.(info.size, info.size, true);

  return outputPath;
}

/**
 * Gets the SHA1 hash of a file
 * @param filePath - Path to the file
 * @returns SHA1 hash or null if file doesn't exist
 */
async function getFileHash(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath);
    return createHash("sha1").update(content).digest("hex");
  } catch {
    return null;
  }
}

/**
 * Checks if a JAR file exists and is valid
 * @param filePath - Path to the JAR file
 * @param expectedSha1 - Expected SHA1 hash
 * @returns true if file exists and hash matches
 */
export async function verifyJar(
  filePath: string,
  expectedSha1: string
): Promise<boolean> {
  const hash = await getFileHash(filePath);
  return hash === expectedSha1;
}

/**
 * Gets the path to downloaded files for a version
 * @param version - Version ID
 * @param outputDir - Base output directory
 * @returns Object with paths to JAR files
 */
export function getJarPaths(
  version: string,
  outputDir: string = DEFAULT_DOWNLOAD_DIR
): {
  versionDir: string;
  clientJar: string;
  serverJar: string;
  clientMappings: string;
  serverMappings: string;
} {
  const versionDir = path.join(outputDir, version);
  return {
    versionDir,
    clientJar: path.join(versionDir, "client.jar"),
    serverJar: path.join(versionDir, "server.jar"),
    clientMappings: path.join(versionDir, "client.txt"),
    serverMappings: path.join(versionDir, "server.txt"),
  };
}

/**
 * Cleans up downloaded files for a version
 * @param version - Version ID
 * @param outputDir - Base output directory
 */
export async function cleanupVersion(
  version: string,
  outputDir: string = DEFAULT_DOWNLOAD_DIR
): Promise<void> {
  const versionDir = path.join(outputDir, version);

  try {
    await fs.rm(versionDir, { recursive: true });
    console.log(`Cleaned up ${versionDir}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Gets total download size for a version
 * @param version - Version ID
 * @param options - Which files to include
 * @returns Total size in bytes
 */
export async function getDownloadSize(
  version: string,
  options: {
    client?: boolean;
    server?: boolean;
    clientMappings?: boolean;
    serverMappings?: boolean;
  } = { client: true, server: true }
): Promise<number> {
  const versionDetail = await fetchVersionDetail(version);
  let size = 0;

  if (options.client && versionDetail.downloads.client) {
    size += versionDetail.downloads.client.size;
  }
  if (options.server && versionDetail.downloads.server) {
    size += versionDetail.downloads.server.size;
  }
  if (options.clientMappings && versionDetail.downloads.client_mappings) {
    size += versionDetail.downloads.client_mappings.size;
  }
  if (options.serverMappings && versionDetail.downloads.server_mappings) {
    size += versionDetail.downloads.server_mappings.size;
  }

  return size;
}

/**
 * Downloads multiple versions in parallel
 * @param versions - List of version IDs
 * @param outputDir - Output directory
 * @param concurrency - Number of concurrent downloads
 * @returns Array of download results
 */
export async function downloadMultipleVersions(
  versions: string[],
  outputDir: string = DEFAULT_DOWNLOAD_DIR,
  concurrency: number = 3
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];
  const queue = [...versions];

  async function processQueue(): Promise<void> {
    while (queue.length > 0) {
      const version = queue.shift();
      if (!version) break;

      try {
        const result = await downloadJars({
          version,
          outputDir,
          skipExisting: true,
        });
        results.push(result);
      } catch (error) {
        console.error(`Failed to download ${version}:`, error);
      }
    }
  }

  // Start concurrent workers
  const workers = Array.from({ length: concurrency }, () => processQueue());
  await Promise.all(workers);

  return results;
}
