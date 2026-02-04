/**
 * API Route: /api/github/repos/[owner]/[repo]/dependencies
 * Get repository dependency information
 */

import { NextRequest, NextResponse } from "next/server";
import { isGitHubConfigured, GitHubError, githubRequest } from "@/server/github";

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

interface DependencyNode {
  package_name: string;
  package_ecosystem: string;
  version: string;
  requirements: string;
}

interface DependencyManifest {
  name: string;
  file: {
    source_location: string;
  };
  resolved: Record<string, DependencyNode>;
}

interface DependencyGraphResponse {
  sbom: {
    SPDXID: string;
    spdxVersion: string;
    creationInfo: {
      created: string;
    };
    name: string;
    packages: Array<{
      SPDXID: string;
      name: string;
      versionInfo: string;
      downloadLocation: string;
      externalRefs?: Array<{
        referenceCategory: string;
        referenceType: string;
        referenceLocator: string;
      }>;
    }>;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isGitHubConfigured()) {
      return NextResponse.json({ error: "GitHub App not configured" }, { status: 503 });
    }

    const { owner, repo } = await params;

    // Try to get SBOM (Software Bill of Materials)
    try {
      const sbom = await githubRequest<DependencyGraphResponse>(`/repos/${owner}/${repo}/dependency-graph/sbom`);

      // Parse packages from SBOM
      const packages = sbom.sbom.packages
        .filter((pkg) => pkg.SPDXID !== "SPDXRef-DOCUMENT")
        .map((pkg) => {
          // Extract ecosystem from external refs
          const ecosystemRef = pkg.externalRefs?.find((ref) => ref.referenceType === "purl");
          let ecosystem = "unknown";
          if (ecosystemRef?.referenceLocator) {
            const purlMatch = ecosystemRef.referenceLocator.match(/^pkg:([^\/]+)\//);
            if (purlMatch) {
              ecosystem = purlMatch[1];
            }
          }

          return {
            name: pkg.name,
            version: pkg.versionInfo || "unknown",
            ecosystem,
            downloadLocation: pkg.downloadLocation,
          };
        });

      // Group by ecosystem
      const byEcosystem: Record<string, typeof packages> = {};
      packages.forEach((pkg) => {
        if (!byEcosystem[pkg.ecosystem]) {
          byEcosystem[pkg.ecosystem] = [];
        }
        byEcosystem[pkg.ecosystem].push(pkg);
      });

      return NextResponse.json({
        data: {
          packages,
          by_ecosystem: byEcosystem,
          total: packages.length,
          created_at: sbom.sbom.creationInfo.created,
        },
      });
    } catch {
      // SBOM might not be available, try alternative endpoints
      console.log("[Dependencies] SBOM not available, trying manifests...");

      // Try dependency manifests endpoint
      try {
        const manifests = await githubRequest<DependencyManifest[]>(
          `/repos/${owner}/${repo}/dependency-graph/manifests`
        );

        const packages: Array<{
          name: string;
          version: string;
          ecosystem: string;
          manifest: string;
        }> = [];

        manifests.forEach((manifest) => {
          Object.entries(manifest.resolved || {}).forEach(([name, dep]) => {
            packages.push({
              name: dep.package_name || name,
              version: dep.version,
              ecosystem: dep.package_ecosystem,
              manifest: manifest.name,
            });
          });
        });

        const byEcosystem: Record<string, typeof packages> = {};
        packages.forEach((pkg) => {
          if (!byEcosystem[pkg.ecosystem]) {
            byEcosystem[pkg.ecosystem] = [];
          }
          byEcosystem[pkg.ecosystem].push(pkg);
        });

        return NextResponse.json({
          data: {
            packages,
            by_ecosystem: byEcosystem,
            total: packages.length,
            manifests: manifests.map((m) => m.name),
          },
        });
      } catch {
        // Neither SBOM nor manifests available
        return NextResponse.json({
          data: {
            packages: [],
            by_ecosystem: {},
            total: 0,
          },
          message: "Dependency graph is not available for this repository",
        });
      }
    }
  } catch (error) {
    console.error("[GitHub Dependencies] Error:", error);

    if (error instanceof GitHubError) {
      if (error.statusCode === 404 || error.statusCode === 403) {
        return NextResponse.json({
          data: {
            packages: [],
            by_ecosystem: {},
            total: 0,
          },
          message: "Dependency graph is not enabled for this repository",
        });
      }
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Failed to fetch dependencies" }, { status: 500 });
  }
}
