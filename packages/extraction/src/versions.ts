/**
 * Version Manifest Manager
 * Uses pre-fetched Mojang version_manifest_v2.json bundled at build time
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

// Import the bundled manifest (fetched at build time)
import bundledManifest from "./data/version_manifest.json" with { type: "json" };

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
  _fetchedAt?: string;
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

const CACHE_DIR = ".cache";

// ============================================================================
// Version Manifest (Bundled)
// ============================================================================

/**
 * Gets the bundled version manifest
 * The manifest is fetched at build time via prebuild script
 * @returns Version manifest
 */
export function getVersionManifest(): VersionManifest {
  return bundledManifest as VersionManifest;
}

/**
 * Gets the bundled version manifest (async for compatibility)
 * @deprecated Use getVersionManifest() instead
 * @returns Version manifest
 */
export async function fetchVersionManifest(): Promise<VersionManifest> {
  return getVersionManifest();
}

/**
 * Gets the timestamp when the manifest was fetched
 * @returns ISO date string or undefined
 */
export function getManifestFetchedAt(): string | undefined {
  return bundledManifest._fetchedAt;
}

/**
 * Fetches detailed version information
 * Note: This still requires network access as version details are not bundled
 * @param version - Version ID or VersionEntry
 * @returns Detailed version information
 */
export async function fetchVersionDetail(
  version: string | VersionEntry
): Promise<VersionDetail> {
  const entry = typeof version === "string" ? findVersion(version) : version;

  if (!entry) {
    throw new Error(`Version not found: ${version}`);
  }

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
export function findVersion(versionId: string): VersionEntry | undefined {
  const manifest = getVersionManifest();
  return manifest.versions.find((v) => v.id === versionId);
}

/**
 * Gets all release versions
 * @returns List of release versions
 */
export function getReleaseVersions(): VersionEntry[] {
  const manifest = getVersionManifest();
  return manifest.versions.filter((v) => v.type === "release");
}

/**
 * Gets all snapshot versions
 * @returns List of snapshot versions
 */
export function getSnapshotVersions(): VersionEntry[] {
  const manifest = getVersionManifest();
  return manifest.versions.filter((v) => v.type === "snapshot");
}

/**
 * Gets the latest release version
 * @returns Latest release version ID
 */
export function getLatestRelease(): string {
  const manifest = getVersionManifest();
  return manifest.latest.release;
}

/**
 * Gets the latest snapshot version
 * @returns Latest snapshot version ID
 */
export function getLatestSnapshot(): string {
  const manifest = getVersionManifest();
  return manifest.latest.snapshot;
}

/**
 * Filters versions by type
 * @param types - Version types to include
 * @returns Filtered version entries
 */
export function filterVersionsByType(types: JavaVersionType[]): VersionEntry[] {
  const manifest = getVersionManifest();
  return manifest.versions.filter((v) => types.includes(v.type));
}

/**
 * Filters versions by date range
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns Filtered version entries
 */
export function filterVersionsByDate(
  startDate?: Date,
  endDate?: Date
): VersionEntry[] {
  const manifest = getVersionManifest();

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
 * Note: Bedrock versions are managed manually
 * @returns Bedrock version info or null
 */
export async function getBedrockVersionInfo(): Promise<BedrockVersionInfo | null> {
  const bedrockConfigPath = path.join(CACHE_DIR, "bedrock_version.json");

  try {
    const content = await fs.readFile(bedrockConfigPath, "utf-8");
    return JSON.parse(content);
  } catch {
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
    Promise.resolve(getVersionManifest()),
    getBedrockVersionInfo(),
  ]);

  return {
    java: {
      latest: javaManifest.latest,
      versions: javaManifest.versions,
    },
    bedrock: bedrockInfo,
    fetchedAt: javaManifest._fetchedAt ?? new Date().toISOString(),
  };
}

// ============================================================================
// Data Report Support
// ============================================================================

/**
 * Checks if a version supports data reports (--reports flag)
 *
 * Data reports were added in Minecraft 1.13 (18w01a snapshot).
 * For versions before 1.13, the server JAR does not support the --reports flag,
 * so we cannot extract registry data (blocks, items, entities, etc.) automatically.
 *
 * For pre-1.13 versions, data must be extracted through alternative methods:
 * - Client JAR decompilation
 * - Manual data collection
 * - Third-party data sources
 *
 * @param versionId - Version ID to check
 * @returns true if version supports --reports flag
 */
export function supportsDataReports(versionId: string): boolean {
  // Data reports were added in 1.13 (snapshot 18w01a)
  const match = versionId.match(/^1\.(\d+)/);
  if (!match) {
    // Snapshots: 18w+ are 1.13+, 17w and below are pre-1.13
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
 * In 1.21+, paths changed from plural to singular:
 * - recipes/ -> recipe/
 * - loot_tables/ -> loot_table/
 * - advancements/ -> advancement/
 *
 * @param versionId - Version ID to check
 * @returns true if version uses new structure
 */
export function usesNewDataPackStructure(versionId: string): boolean {
  const match = versionId.match(/^1\.(\d+)/);
  if (!match) {
    // Check snapshot naming (24w+ are 1.21+)
    if (versionId.match(/^(24w|25w|26w)/)) {
      return true;
    }
    return false;
  }

  const minorVersion = parseInt(match[1], 10);
  return minorVersion >= 21;
}

// ============================================================================
// Version Parsing Utilities
// ============================================================================

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
