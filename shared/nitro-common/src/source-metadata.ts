import * as tl from "azure-pipelines-task-lib/task.js";

export interface Actor {
  name: string;
  email?: string;
}

export interface SourceMetadata {
  actor: Actor;
  pipelineName: string;
  runNumber: string;
  runId: string;
  jobId?: string;
  taskId?: string;
  commitHash?: string;
  repositoryUrl?: string;
  projectUrl: string;
}

function requireVariable(name: string): string {
  const value = tl.getVariable(name);

  if (!value) {
    throw new Error(`Required pipeline variable "${name}" is not set.`);
  }

  return value;
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
    metadata.commitHash = requireVariable("Build.SourceVersion");

    // Build.Repository.Uri for Azure Repos Git carries a "user@" prefix
    // ("https://tobiastengler@dev.azure.com/..."); the browser URL doesn't.
    metadata.repositoryUrl = requireVariable("Build.Repository.Uri").replace(
      /^(https?:\/\/)[^@/]+@/i,
      "$1",
    );
  }

  return metadata;
}
