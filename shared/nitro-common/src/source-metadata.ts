import * as tl from "azure-pipelines-task-lib/task.js";

export interface Actor {
  name: string;
  email?: string;
}

export interface SourceMetadata {
  type: "azure-devops";
  actor: Actor;
  pipelineName: string;
  runNumber: string;
  runId: string;
  jobId?: string;
  taskId?: string;
  commitHash?: string;
  repositoryUrl?: string;
  ref?: string;
  pullRequestNumber?: number;
  projectUrl: string;
}

function requireVariable(name: string): string {
  const value = tl.getVariable(name);

  if (!value) {
    throw new Error(`Required pipeline variable "${name}" is not set.`);
  }

  return value;
}

function parsePrNumber(value?: string): number | undefined {
  const trimmed = value?.trim();

  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return undefined;
  }

  const number = Number(trimmed);
  return number >= 1 && number <= 2147483647 ? number : undefined;
}

export function getSourceMetadata(): SourceMetadata {
  const actor: Actor = { name: requireVariable("Build.RequestedFor") };
  const actorEmail = tl.getVariable("Build.RequestedForEmail");

  if (actorEmail) {
    actor.email = actorEmail;
  }

  const collectionUri = requireVariable("System.TeamFoundationCollectionUri");
  const project = requireVariable("System.TeamProject");

  const metadata: SourceMetadata = {
    type: "azure-devops",
    actor,
    pipelineName: requireVariable("Build.DefinitionName"),
    runNumber: requireVariable("Build.BuildNumber"),
    runId: requireVariable("Build.BuildId"),
    jobId: tl.getVariable("System.JobId"),
    taskId: tl.getVariable("System.TaskInstanceId"),
    projectUrl: `${collectionUri}${encodeURIComponent(project)}`,
  };

  const provider = requireVariable("Build.Repository.Provider");
  if (
    provider === "TfsGit" ||
    provider === "GitHub" ||
    provider === "GitHubEnterprise"
  ) {
    if (tl.getVariable("Build.Reason") === "PullRequest") {
      // Build.SourceVersion is the synthetic merge commit on PR builds; it's
      // only a fallback in case the PR source commit isn't available.
      metadata.commitHash =
        tl.getVariable("System.PullRequest.SourceCommitId") ||
        requireVariable("Build.SourceVersion");
      metadata.ref =
        tl.getVariable("System.PullRequest.SourceBranch") || undefined;
      // On GitHub, PullRequestId is GitHub's internal id, not the PR number.
      metadata.pullRequestNumber = parsePrNumber(
        provider === "TfsGit"
          ? tl.getVariable("System.PullRequest.PullRequestId")
          : tl.getVariable("System.PullRequest.PullRequestNumber"),
      );
    } else {
      metadata.commitHash = requireVariable("Build.SourceVersion");
      metadata.ref = tl.getVariable("Build.SourceBranch") || undefined;
    }

    // Build.Repository.Uri for Azure Repos Git carries a "user@" prefix
    // ("https://tobiastengler@dev.azure.com/..."); the browser URL doesn't.
    metadata.repositoryUrl = requireVariable("Build.Repository.Uri").replace(
      /^(https?:\/\/)[^@/]+@/i,
      "$1",
    );
  }

  return metadata;
}
