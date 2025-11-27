#!/usr/bin/env node
/**
 * Minecraft Data Extraction CLI
 * Command-line interface for extracting Minecraft game data
 */

import { Command } from "commander";
import * as path from "node:path";
import * as fs from "node:fs/promises";

// Java Edition imports
import {
  fetchVersionManifest,
  getLatestRelease,
  getLatestSnapshot,
  getReleaseVersions,
  getSnapshotVersions,
  supportsDataReports,
} from "./versions.js";
import { downloadJars, type DownloadResult } from "./java/downloader.js";
import { extractAssets } from "./java/assets.js";
import { extractData, loadRecipes, loadLootTables, loadTags } from "./java/data.js";
import { extractLanguages } from "./java/lang.js";

// Bedrock Edition imports
import { extractBedrockAPK, validateBedrockAPK } from "./bedrock/downloader.js";
import { getAssetCounts } from "./bedrock/assets.js";
import { getDataStats } from "./bedrock/data.js";
import { processCumulativeUpdate } from "./bedrock/cumulative.js";

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
  .name("minecraft-extract")
  .description("Extract data from Minecraft Java and Bedrock editions")
  .version("0.1.0");

// ============================================================================
// Version Commands
// ============================================================================

const versionCmd = program.command("versions").description("Manage Minecraft versions");

versionCmd
  .command("list")
  .description("List available Minecraft versions")
  .option("-t, --type <type>", "Filter by type (release, snapshot, all)", "release")
  .option("-l, --limit <number>", "Limit number of versions", "20")
  .action(async (options) => {
    try {
      const manifest = await fetchVersionManifest();

      let versions = manifest.versions;

      if (options.type === "release") {
        versions = versions.filter((v) => v.type === "release");
      } else if (options.type === "snapshot") {
        versions = versions.filter((v) => v.type === "snapshot");
      }

      const limit = parseInt(options.limit, 10);
      versions = versions.slice(0, limit);

      console.log("\nAvailable Minecraft Versions:\n");
      console.log(`Latest Release: ${manifest.latest.release}`);
      console.log(`Latest Snapshot: ${manifest.latest.snapshot}`);
      console.log("");

      for (const version of versions) {
        const date = new Date(version.releaseTime).toLocaleDateString();
        const reports = supportsDataReports(version.id) ? "✓" : "✗";
        console.log(`  ${version.id.padEnd(15)} ${version.type.padEnd(10)} ${date} [reports: ${reports}]`);
      }

      console.log(`\nShowing ${versions.length} of ${manifest.versions.length} versions`);
    } catch (error) {
      console.error("Error listing versions:", error);
      process.exit(1);
    }
  });

versionCmd
  .command("latest")
  .description("Show latest versions")
  .action(async () => {
    try {
      const [release, snapshot] = await Promise.all([
        getLatestRelease(),
        getLatestSnapshot(),
      ]);

      console.log(`\nLatest Release:  ${release}`);
      console.log(`Latest Snapshot: ${snapshot}`);
    } catch (error) {
      console.error("Error fetching latest versions:", error);
      process.exit(1);
    }
  });

// ============================================================================
// Java Edition Commands
// ============================================================================

const javaCmd = program.command("java").description("Java Edition extraction commands");

javaCmd
  .command("download <version>")
  .description("Download JAR files for a version")
  .option("-o, --output <dir>", "Output directory", "data/downloads")
  .option("--no-client", "Skip client JAR")
  .option("--no-server", "Skip server JAR")
  .option("--mappings", "Also download obfuscation mappings")
  .action(async (version, options) => {
    try {
      console.log(`\nDownloading JARs for ${version}...`);

      const result = await downloadJars({
        version,
        outputDir: options.output,
        downloadClient: options.client !== false,
        downloadServer: options.server !== false,
        downloadClientMappings: options.mappings,
        downloadServerMappings: options.mappings,
      });

      console.log("\nDownload complete!");
      console.log(`  Version:    ${result.version}`);
      console.log(`  Directory:  ${result.versionDir}`);
      if (result.clientPath) console.log(`  Client:     ${result.clientPath}`);
      if (result.serverPath) console.log(`  Server:     ${result.serverPath}`);
    } catch (error) {
      console.error("Error downloading:", error);
      process.exit(1);
    }
  });

javaCmd
  .command("extract <version>")
  .description("Extract all data from a version")
  .option("-o, --output <dir>", "Output directory", "data")
  .option("--skip-download", "Skip JAR download (use existing)")
  .option("--skip-assets", "Skip asset extraction")
  .option("--skip-data", "Skip data extraction")
  .option("--skip-lang", "Skip language extraction")
  .action(async (version, options) => {
    try {
      console.log(`\n========== Extracting Java Edition ${version} ==========\n`);

      const outputDir = options.output;
      const downloadDir = path.join(outputDir, "downloads");

      // Step 1: Download JARs
      let downloadResult: DownloadResult;

      if (!options.skipDownload) {
        console.log("Step 1: Downloading JARs...");
        downloadResult = await downloadJars({
          version,
          outputDir: downloadDir,
          skipExisting: true,
        });
      } else {
        console.log("Step 1: Skipping download (using existing files)");
        const versionDir = path.join(downloadDir, version);
        downloadResult = {
          version,
          versionDetail: {} as DownloadResult["versionDetail"],
          clientPath: path.join(versionDir, "client.jar"),
          serverPath: path.join(versionDir, "server.jar"),
          clientMappingsPath: null,
          serverMappingsPath: null,
          versionDir,
        };
      }

      // Step 2: Extract assets
      if (!options.skipAssets && downloadResult.clientPath) {
        console.log("\nStep 2: Extracting assets...");
        const assetResult = await extractAssets({
          version,
          clientJarPath: downloadResult.clientPath,
          outputDir,
        });
        console.log(`  Extracted ${assetResult.totalFiles} asset files`);
      } else {
        console.log("\nStep 2: Skipping asset extraction");
      }

      // Step 3: Extract data
      if (!options.skipData && downloadResult.serverPath && downloadResult.clientPath) {
        console.log("\nStep 3: Extracting game data...");

        if (supportsDataReports(version)) {
          const dataResult = await extractData({
            version,
            serverJarPath: downloadResult.serverPath,
            clientJarPath: downloadResult.clientPath,
            outputDir,
          });

          console.log(`  Reports generated in: ${dataResult.reportsDir}`);
          console.log(`  Data extracted to: ${dataResult.dataDir}`);

          // Show stats
          const blockCount = Object.keys(dataResult.blocks).length;
          const registryCount = Object.keys(dataResult.registries).length;
          console.log(`  Blocks: ${blockCount}`);
          console.log(`  Registries: ${registryCount}`);

          if (dataResult.hasRecipes) {
            const recipes = await loadRecipes(dataResult.dataDir);
            console.log(`  Recipes: ${recipes.size}`);
          }
        } else {
          console.log(`  Note: Version ${version} does not support --reports flag`);
        }
      } else {
        console.log("\nStep 3: Skipping data extraction");
      }

      // Step 4: Extract languages
      if (!options.skipLang && downloadResult.clientPath) {
        console.log("\nStep 4: Extracting languages...");
        const langResult = await extractLanguages({
          version,
          clientJarPath: downloadResult.clientPath,
          outputDir,
        });
        console.log(`  Extracted ${langResult.languages.length} languages`);
        console.log(`  Total translations: ${langResult.totalTranslations}`);
      } else {
        console.log("\nStep 4: Skipping language extraction");
      }

      console.log(`\n========== Extraction complete for ${version} ==========\n`);
    } catch (error) {
      console.error("Error during extraction:", error);
      process.exit(1);
    }
  });

javaCmd
  .command("extract-all")
  .description("Extract all release versions")
  .option("-o, --output <dir>", "Output directory", "data")
  .option("--type <type>", "Version type (release, snapshot, all)", "release")
  .option("--limit <number>", "Limit number of versions")
  .option("--from <version>", "Start from version")
  .option("--to <version>", "End at version")
  .action(async (options) => {
    try {
      let versions =
        options.type === "snapshot"
          ? await getSnapshotVersions()
          : options.type === "all"
          ? (await fetchVersionManifest()).versions
          : await getReleaseVersions();

      // Apply filters
      if (options.from) {
        const fromIndex = versions.findIndex((v) => v.id === options.from);
        if (fromIndex !== -1) {
          versions = versions.slice(fromIndex);
        }
      }

      if (options.to) {
        const toIndex = versions.findIndex((v) => v.id === options.to);
        if (toIndex !== -1) {
          versions = versions.slice(0, toIndex + 1);
        }
      }

      if (options.limit) {
        versions = versions.slice(0, parseInt(options.limit, 10));
      }

      console.log(`\nExtracting ${versions.length} versions...\n`);

      for (let i = 0; i < versions.length; i++) {
        const version = versions[i];
        console.log(`\n[${i + 1}/${versions.length}] Processing ${version.id}...`);

        try {
          // Download
          const downloadResult = await downloadJars({
            version: version.id,
            outputDir: path.join(options.output, "downloads"),
            skipExisting: true,
          });

          // Extract assets
          if (downloadResult.clientPath) {
            await extractAssets({
              version: version.id,
              clientJarPath: downloadResult.clientPath,
              outputDir: options.output,
            });
          }

          // Extract data
          if (downloadResult.serverPath && downloadResult.clientPath && supportsDataReports(version.id)) {
            await extractData({
              version: version.id,
              serverJarPath: downloadResult.serverPath,
              clientJarPath: downloadResult.clientPath,
              outputDir: options.output,
            });
          }

          // Extract languages
          if (downloadResult.clientPath) {
            await extractLanguages({
              version: version.id,
              clientJarPath: downloadResult.clientPath,
              outputDir: options.output,
            });
          }

          console.log(`  ✓ ${version.id} complete`);
        } catch (error) {
          console.error(`  ✗ ${version.id} failed:`, error);
        }
      }

      console.log("\n========== All versions processed ==========\n");
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

// ============================================================================
// Bedrock Edition Commands
// ============================================================================

const bedrockCmd = program.command("bedrock").description("Bedrock Edition extraction commands");

bedrockCmd
  .command("extract <apk>")
  .description("Extract data from Bedrock APK")
  .option("-o, --output <dir>", "Output directory", "data")
  .option("-v, --version <version>", "Override version detection")
  .action(async (apkPath, options) => {
    try {
      console.log(`\n========== Extracting Bedrock Edition ==========\n`);

      // Validate APK
      console.log("Validating APK...");
      const validation = await validateBedrockAPK(apkPath);
      if (!validation.valid) {
        console.error(`Invalid APK: ${validation.reason}`);
        process.exit(1);
      }

      // Extract APK
      console.log("Extracting APK contents...");
      const result = await extractBedrockAPK({
        apkPath,
        version: options.version,
        outputDir: options.output,
      });

      console.log(`\nExtraction complete!`);
      console.log(`  Version:         ${result.version}`);
      console.log(`  Directory:       ${result.extractDir}`);
      console.log(`  Behavior Packs:  ${result.hasBehaviorPacks ? "✓" : "✗"}`);
      console.log(`  Resource Packs:  ${result.hasResourcePacks ? "✓" : "✗"}`);
      console.log(`  Definitions:     ${result.hasDefinitions ? "✓" : "✗"}`);

      // Show asset counts
      console.log("\nAsset counts:");
      const assetCounts = await getAssetCounts(result.extractDir);
      for (const [type, count] of Object.entries(assetCounts)) {
        if (count > 0) {
          console.log(`  ${type}: ${count}`);
        }
      }

      // Show data stats
      console.log("\nData counts:");
      const dataStats = await getDataStats(result.extractDir);
      for (const [type, count] of Object.entries(dataStats)) {
        if (count > 0) {
          console.log(`  ${type}: ${count}`);
        }
      }

      console.log(`\n========== Bedrock extraction complete ==========\n`);
    } catch (error) {
      console.error("Error during extraction:", error);
      process.exit(1);
    }
  });

bedrockCmd
  .command("update <apk>")
  .description("Update cumulative Bedrock data with new version")
  .option("-o, --output <dir>", "Output directory", "data")
  .option("-v, --version <version>", "Override version detection")
  .action(async (apkPath, options) => {
    try {
      console.log(`\n========== Updating Bedrock Cumulative Data ==========\n`);

      // Extract APK first
      const extractResult = await extractBedrockAPK({
        apkPath,
        version: options.version,
        outputDir: options.output,
      });

      // Process cumulative update
      const { diff, data } = await processCumulativeUpdate(
        extractResult.extractDir,
        extractResult.version,
        options.output
      );

      console.log("\nCumulative update summary:");
      console.log(`  Version: ${data.version}`);
      console.log(`  Blocks:   +${diff.blocks.added.length} ~${diff.blocks.modified.length} -${diff.blocks.removed.length}`);
      console.log(`  Items:    +${diff.items.added.length} ~${diff.items.modified.length} -${diff.items.removed.length}`);
      console.log(`  Entities: +${diff.entities.added.length} ~${diff.entities.modified.length} -${diff.entities.removed.length}`);
      console.log(`  Recipes:  +${diff.recipes.added.length} ~${diff.recipes.modified.length} -${diff.recipes.removed.length}`);

      // Show notable additions
      if (diff.blocks.added.length > 0) {
        console.log("\nNew blocks:");
        for (const id of diff.blocks.added.slice(0, 5)) {
          console.log(`  + ${id}`);
        }
        if (diff.blocks.added.length > 5) {
          console.log(`  ... and ${diff.blocks.added.length - 5} more`);
        }
      }

      if (diff.items.added.length > 0) {
        console.log("\nNew items:");
        for (const id of diff.items.added.slice(0, 5)) {
          console.log(`  + ${id}`);
        }
        if (diff.items.added.length > 5) {
          console.log(`  ... and ${diff.items.added.length - 5} more`);
        }
      }

      console.log(`\n========== Update complete ==========\n`);
    } catch (error) {
      console.error("Error during update:", error);
      process.exit(1);
    }
  });

// ============================================================================
// Info Commands
// ============================================================================

program
  .command("info <path>")
  .description("Show info about extracted data")
  .action(async (dataPath) => {
    try {
      const stats = await fs.stat(dataPath);

      if (stats.isDirectory()) {
        console.log(`\nDirectory: ${dataPath}\n`);

        // List contents
        const entries = await fs.readdir(dataPath, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory());
        const files = entries.filter((e) => e.isFile());

        console.log(`Directories: ${dirs.length}`);
        for (const dir of dirs.slice(0, 10)) {
          console.log(`  📁 ${dir.name}`);
        }

        console.log(`\nFiles: ${files.length}`);
        for (const file of files.slice(0, 10)) {
          console.log(`  📄 ${file.name}`);
        }
      } else {
        console.log(`\nFile: ${dataPath}`);
        console.log(`Size: ${stats.size} bytes`);

        if (dataPath.endsWith(".json")) {
          const content = await fs.readFile(dataPath, "utf-8");
          const data = JSON.parse(content);

          if (Array.isArray(data)) {
            console.log(`Type: Array with ${data.length} elements`);
          } else if (typeof data === "object") {
            console.log(`Type: Object with ${Object.keys(data).length} keys`);
            console.log("Keys:", Object.keys(data).slice(0, 10).join(", "));
          }
        }
      }
    } catch (error) {
      console.error("Error reading path:", error);
      process.exit(1);
    }
  });

// ============================================================================
// Clean Command
// ============================================================================

program
  .command("clean")
  .description("Clean extracted data")
  .option("-o, --output <dir>", "Output directory", "data")
  .option("--downloads", "Only clean downloads")
  .option("--cache", "Only clean cache")
  .option("-y, --yes", "Skip confirmation")
  .action(async (options) => {
    try {
      const targets: string[] = [];

      if (options.downloads) {
        targets.push(path.join(options.output, "downloads"));
      } else if (options.cache) {
        targets.push(".cache");
      } else {
        targets.push(options.output);
        targets.push(".cache");
      }

      console.log("\nThe following will be deleted:");
      for (const target of targets) {
        console.log(`  ${target}`);
      }

      if (!options.yes) {
        console.log("\nUse --yes to confirm deletion");
        return;
      }

      for (const target of targets) {
        try {
          await fs.rm(target, { recursive: true });
          console.log(`Deleted: ${target}`);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
          }
        }
      }

      console.log("\nCleanup complete!");
    } catch (error) {
      console.error("Error during cleanup:", error);
      process.exit(1);
    }
  });

// ============================================================================
// Run CLI
// ============================================================================

program.parse();
