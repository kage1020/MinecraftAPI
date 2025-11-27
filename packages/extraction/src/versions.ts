/**
 * Version Manifest Fetcher
 * Handles fetching Mojang version_manifest_v2.json and Bedrock version information
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

// ============================================================================
// Types
// ============================================================================

/** Java Edition version types */
export type JavaVersionType =
  | "release"
  | "snapshot"
  | "old_beta"
  | "old_alpha";

/** Version entry from Mojang's manifest */
export interface VersionEntry {
  id: string;
  type: JavaVersionType;
  url: string;
  time: string;
  releaseTime: string;
  sha1: string;
  complianceLevel: number;
}

/** Version manifest structure */
export interface VersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: VersionEntry[];
}

/** Download information for a JAR file */
export interface DownloadInfo {
  sha1: string;
  size: number;
  url: string;
}

/** Asset index information */
export interface AssetIndex {
  id: string;
  sha1: string;
  size: number;
  totalSize: number;
  url: string;
}

/** Detailed version information */
export interface VersionDetail {
  id: string;
  type: JavaVersionType;
  downloads: {
    client?: DownloadInfo;
    client_mappings?: DownloadInfo;
    server?: DownloadInfo;
    server_mappings?: DownloadInfo;
  };
  assetIndex?: AssetIndex;
  assets?: string;
  releaseTime: string;
  time: string;
  minimumLauncherVersion?: number;
}

/** Bedrock version metadata */
export interface BedrockVersionInfo {
  version: string;
  releaseDate: string | null;
  source: "manual" | "apkmirror" | "playstore";
}

/** Combined version list */
export interface VersionList {
  java: {
    latest: {
      release: string;
      snapshot: string;
    };
    versions: VersionEntry[];
  };
  bedrock: BedrockVersionInfo | null;
  fetchedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const MOJANG_MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

const CACHE_DIR = ".cache";
const MANIFEST_CACHE_FILE = "version_manifest.json";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ============================================================================
// Version Manifest Fetcher
// ============================================================================

/**
 * Fetches the Mojang version manifest
 * @param useCache - Whether to use cached manifest if available
 * @returns Version manifest
 */
export async function fetchVersionManifest(
  useCache = true
): Promise<VersionManifest> {
  if (useCache) {
    const cached = await loadCachedManifest();
    if (cached) {
      return cached;
    }
  }

  console.log("Fetching version manifest from Mojang...");

  const response = await fetch(MOJANG_MANIFEST_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch version manifest: ${response.status} ${response.statusText}`
    );
  }

  const manifest: VersionManifest = await response.json();

  // Cache the manifest
  await cacheManifest(manifest);

  console.log(`Fetched ${manifest.versions.length} versions`);
  console.log(`Latest release: ${manifest.latest.release}`);
  console.log(`Latest snapshot: ${manifest.latest.snapshot}`);

  return manifest;
}

/**
 * Fetches detailed version information
 * @param version - Version ID or VersionEntry
 * @returns Detailed version information
 */
export async function fetchVersionDetail(
  version: string | VersionEntry
): Promise<VersionDetail> {
  const entry =
    typeof version === "string" ? await findVersion(version) : version;

  if (!entry) {
    throw new Error(`Version not found: ${version}`);
  }

  console.log(`Fetching version detail for ${entry.id}...`);

  const response = await fetch(entry.url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch version detail: ${response.status} ${response.statusText}`
    );
  }

  const detail: VersionDetail = await response.json();
  return detail;
}

/**
 * Finds a version in the manifest
 * @param versionId - Version ID to find
 * @returns Version entry or undefined
 */
export async function findVersion(
  versionId: string
): Promise<VersionEntry | undefined> {
  const manifest = await fetchVersionManifest();
  return manifest.versions.find((v) => v.id === versionId);
}

/**
 * Gets all release versions
 * @returns List of release versions
 */
export async function getReleaseVersions(): Promise<VersionEntry[]> {
  const manifest = await fetchVersionManifest();
  return manifest.versions.filter((v) => v.type === "release");
}

/**
 * Gets all snapshot versions
 * @returns List of snapshot versions
 */
export async function getSnapshotVersions(): Promise<VersionEntry[]> {
  const manifest = await fetchVersionManifest();
  return manifest.versions.filter((v) => v.type === "snapshot");
}

/**
 * Gets the latest release version
 * @returns Latest release version ID
 */
export async function getLatestRelease(): Promise<string> {
  const manifest = await fetchVersionManifest();
  return manifest.latest.release;
}

/**
 * Gets the latest snapshot version
 * @returns Latest snapshot version ID
 */
export async function getLatestSnapshot(): Promise<string> {
  const manifest = await fetchVersionManifest();
  return manifest.latest.snapshot;
}

/**
 * Filters versions by type
 * @param types - Version types to include
 * @returns Filtered version entries
 */
export async function filterVersionsByType(
  types: JavaVersionType[]
): Promise<VersionEntry[]> {
  const manifest = await fetchVersionManifest();
  return manifest.versions.filter((v) => types.includes(v.type));
}

/**
 * Filters versions by date range
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns Filtered version entries
 */
export async function filterVersionsByDate(
  startDate?: Date,
  endDate?: Date
): Promise<VersionEntry[]> {
  const manifest = await fetchVersionManifest();

  return manifest.versions.filter((v) => {
    const releaseDate = new Date(v.releaseTime);
    if (startDate && releaseDate < startDate) return false;
    if (endDate && releaseDate > endDate) return false;
    return true;
  });
}

// ============================================================================
// Bedrock Version Information
// ============================================================================

/**
 * Gets Bedrock version information
 * Note: Bedrock versions are typically managed manually or via external sources
 * @returns Bedrock version info or null
 */
export async function getBedrockVersionInfo(): Promise<BedrockVersionInfo | null> {
  // Check for manually configured Bedrock version
  const bedrockConfigPath = path.join(CACHE_DIR, "bedrock_version.json");

  try {
    const content = await fs.readFile(bedrockConfigPath, "utf-8");
    return JSON.parse(content);
  } catch {
    // No Bedrock version configured
    return null;
  }
}

/**
 * Sets Bedrock version information manually
 * @param version - Version string
 * @param releaseDate - Optional release date
 */
export async function setBedrockVersionInfo(
  version: string,
  releaseDate?: string
): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const info: BedrockVersionInfo = {
    version,
    releaseDate: releaseDate ?? null,
    source: "manual",
  };

  const bedrockConfigPath = path.join(CACHE_DIR, "bedrock_version.json");
  await fs.writeFile(bedrockConfigPath, JSON.stringify(info, null, 2));

  console.log(`Set Bedrock version to ${version}`);
}

// ============================================================================
// Combined Version List
// ============================================================================

/**
 * Gets a combined list of all versions (Java and Bedrock)
 * @returns Combined version list
 */
export async function getVersionList(): Promise<VersionList> {
  const [javaManifest, bedrockInfo] = await Promise.all([
    fetchVersionManifest(),
    getBedrockVersionInfo(),
  ]);

  return {
    java: {
      latest: javaManifest.latest,
      versions: javaManifest.versions,
    },
    bedrock: bedrockInfo,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Checks if a new version is available
 * @param currentVersion - Current version ID
 * @returns Object with new version info if available
 */
export async function checkForNewVersion(currentVersion: string): Promise<{
  hasNewRelease: boolean;
  hasNewSnapshot: boolean;
  latestRelease: string;
  latestSnapshot: string;
}> {
  const manifest = await fetchVersionManifest(false); // Force fetch

  const currentEntry = manifest.versions.find((v) => v.id === currentVersion);
  const currentIndex = currentEntry
    ? manifest.versions.indexOf(currentEntry)
    : -1;

  // Check if there are newer versions
  const newerVersions =
    currentIndex > 0 ? manifest.versions.slice(0, currentIndex) : [];

  const hasNewRelease = newerVersions.some((v) => v.type === "release");
  const hasNewSnapshot = newerVersions.some((v) => v.type === "snapshot");

  return {
    hasNewRelease,
    hasNewSnapshot,
    latestRelease: manifest.latest.release,
    latestSnapshot: manifest.latest.snapshot,
  };
}

// ============================================================================
// Cache Management
// ============================================================================

interface CachedManifest {
  manifest: VersionManifest;
  cachedAt: number;
}

async function loadCachedManifest(): Promise<VersionManifest | null> {
  try {
    const cachePath = path.join(CACHE_DIR, MANIFEST_CACHE_FILE);
    const content = await fs.readFile(cachePath, "utf-8");
    const cached: CachedManifest = JSON.parse(content);

    // Check if cache is still valid
    const age = Date.now() - cached.cachedAt;
    if (age > CACHE_TTL_MS) {
      console.log("Cache expired, will fetch fresh manifest");
      return null;
    }

    console.log("Using cached version manifest");
    return cached.manifest;
  } catch {
    return null;
  }
}

async function cacheManifest(manifest: VersionManifest): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });

    const cached: CachedManifest = {
      manifest,
      cachedAt: Date.now(),
    };

    const cachePath = path.join(CACHE_DIR, MANIFEST_CACHE_FILE);
    await fs.writeFile(cachePath, JSON.stringify(cached, null, 2));
  } catch (error) {
    console.warn("Failed to cache manifest:", error);
  }
}

/**
 * Clears the version manifest cache
 */
export async function clearCache(): Promise<void> {
  try {
    const cachePath = path.join(CACHE_DIR, MANIFEST_CACHE_FILE);
    await fs.unlink(cachePath);
    console.log("Cache cleared");
  } catch {
    // Cache file doesn't exist, ignore
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if a version supports data reports (1.13+)
 * @param versionId - Version ID to check
 * @returns true if version supports --reports flag
 */
export function supportsDataReports(versionId: string): boolean {
  // Data reports were added in 1.13
  const match = versionId.match(/^1\.(\d+)/);
  if (!match) {
    // Snapshots for 1.13+ start with 18w
    if (versionId.match(/^(1[89]|[2-9]\d)w/)) {
      return true;
    }
    return false;
  }

  const minorVersion = parseInt(match[1], 10);
  return minorVersion >= 13;
}

/**
 * Checks if a version uses the new data pack structure (1.21+)
 * @param versionId - Version ID to check
 * @returns true if version uses new structure
 */
export function usesNewDataPackStructure(versionId: string): boolean {
  const match = versionId.match(/^1\.(\d+)/);
  if (!match) {
    // Check snapshot naming
    if (versionId.match(/^(24w|25w|26w)/)) {
      return true;
    }
    return false;
  }

  const minorVersion = parseInt(match[1], 10);
  return minorVersion >= 21;
}

/**
 * Parses a version string into comparable parts
 * @param versionId - Version ID to parse
 * @returns Parsed version parts or null
 */
export function parseVersion(
  versionId: string
): { major: number; minor: number; patch?: number } | null {
  const match = versionId.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: match[3] ? parseInt(match[3], 10) : undefined,
  };
}

/**
 * Compares two version IDs
 * @param a - First version
 * @param b - Second version
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);

  // If either can't be parsed, fall back to string comparison
  if (!parsedA || !parsedB) {
    return a.localeCompare(b);
  }

  if (parsedA.major !== parsedB.major) {
    return parsedA.major - parsedB.major;
  }

  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor - parsedB.minor;
  }

  const patchA = parsedA.patch ?? 0;
  const patchB = parsedB.patch ?? 0;

  return patchA - patchB;
}
