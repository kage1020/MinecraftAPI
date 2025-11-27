/**
 * Prebuild script to fetch Mojang version manifest
 * This script fetches the latest version manifest and saves it to the src/data directory
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const OUTPUT_DIR = path.join(__dirname, "../src/data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "version_manifest.json");

async function fetchManifest() {
  console.log("Fetching Mojang version manifest...");

  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.status}`);
    }

    const manifest = await response.json();

    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Add metadata
    const manifestWithMeta = {
      ...manifest,
      _fetchedAt: new Date().toISOString(),
    };

    // Write manifest
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(manifestWithMeta, null, 2));

    console.log(`Manifest saved to ${OUTPUT_FILE}`);
    console.log(`  Latest release: ${manifest.latest.release}`);
    console.log(`  Latest snapshot: ${manifest.latest.snapshot}`);
    console.log(`  Total versions: ${manifest.versions.length}`);
  } catch (error) {
    console.error("Failed to fetch manifest:", error);

    // Check if we have an existing manifest
    try {
      await fs.access(OUTPUT_FILE);
      console.log("Using existing cached manifest");
    } catch {
      console.log("No cached manifest available. Creating minimal fallback...");

      // Create minimal fallback manifest for offline development
      const fallbackManifest = {
        latest: {
          release: "1.21.4",
          snapshot: "1.21.4",
        },
        versions: [
          {
            id: "1.21.4",
            type: "release" as const,
            url: "https://piston-meta.mojang.com/v1/packages/1.21.4.json",
            time: "2024-12-03T00:00:00+00:00",
            releaseTime: "2024-12-03T00:00:00+00:00",
            sha1: "placeholder",
            complianceLevel: 1,
          },
        ],
        _fetchedAt: new Date().toISOString(),
        _fallback: true,
      };

      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      await fs.writeFile(OUTPUT_FILE, JSON.stringify(fallbackManifest, null, 2));
      console.log("Created fallback manifest (update in production)");
    }
  }
}

fetchManifest();
