import * as tl from "azure-pipelines-task-lib/task.js";

export interface SourceMetadata {
  actor: string;
  commitHash: string;
  workflowName: string;
  runNumber: string;
  runId: string;
  jobId?: string;
  repositoryUrl: string;
  /** Source control provider, e.g. "TfsGit", "GitHub", "Bitbucket". */
  repositoryProvider: string;
  /** Azure DevOps collection/organization base URI, e.g. "https://dev.azure.com/contoso/". */
  collectionUri: string;
  /** Team project name the run belongs to. */
  project: string;
  /** Web URL to the repository's source code at `commitHash`. */
  commitUrl: string;
  /**
   * Web URL to this pipeline run's logs. When `jobId` is known the link
   * targets the logs of the job that produced this metadata.
   */
  runUrl: string;
}

function requireVariable(name: string): string {
  const value = tl.getVariable(name);
  if (!value) {
    throw new Error(`Required pipeline variable "${name}" is not set.`);
  }
  return value;
}

function buildCommitUrl(
  metadata: Pick<
    SourceMetadata,
    "repositoryUrl" | "repositoryProvider" | "commitHash"
  >,
): string {
  const base = metadata.repositoryUrl
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  // Bitbucket exposes commits under the plural "commits" path; Azure Repos Git
  // and GitHub both use "commit".
  const segment = metadata.repositoryProvider === "Bitbucket" ? "commits" : "commit";
  return `${base}/${segment}/${metadata.commitHash}`;
}

function buildRunUrl(
  metadata: Pick<SourceMetadata, "collectionUri" | "project" | "runId" | "jobId">,
): string {
  const base = metadata.collectionUri.replace(/\/+$/, "");
  let url =
    `${base}/${encodeURIComponent(metadata.project)}/_build/results` +
    `?buildId=${encodeURIComponent(metadata.runId)}&view=logs`;
  if (metadata.jobId) {
    // `j` selects a job (timeline record) in the logs view, deep-linking to
    // the output of the job that emitted this metadata.
    url += `&j=${encodeURIComponent(metadata.jobId)}`;
  }
  return url;
}

/**
 * Collects metadata about the current Azure Pipelines run, mirroring the shape
 * produced by the Nitro GitHub Actions and including both the raw pieces and
 * ready-to-use links to the source commit and the run's job logs. The URLs are
 * derived purely from the raw fields so a consumer can rebuild them itself.
 *
 * @param jobId Optional override for the job identifier. Defaults to the
 *   `System.JobId` predefined variable.
 */
export function getSourceMetadata(jobId?: string): SourceMetadata {
  const raw = {
    actor: requireVariable("Build.RequestedFor"),
    commitHash: requireVariable("Build.SourceVersion"),
    workflowName: requireVariable("Build.DefinitionName"),
    runNumber: requireVariable("Build.BuildNumber"),
    runId: requireVariable("Build.BuildId"),
    jobId: jobId ?? tl.getVariable("System.JobId"),
    repositoryUrl: requireVariable("Build.Repository.Uri"),
    repositoryProvider: requireVariable("Build.Repository.Provider"),
    collectionUri: requireVariable("System.TeamFoundationCollectionUri"),
    project: requireVariable("System.TeamProject"),
  };

  return {
    ...raw,
    commitUrl: buildCommitUrl(raw),
    runUrl: buildRunUrl(raw),
  };
}
