import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getSourceMetadata } from "./source-metadata.js";

// azure-pipelines-task-lib reads public variables from process.env on every
// call ("Build.Reason" → BUILD_REASON), so tests set env vars directly.
const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function setVariables(variables: Record<string, string>): void {
  const all: Record<string, string> = {
    "Build.RequestedFor": "Jane Doe",
    "System.TeamFoundationCollectionUri": "https://dev.azure.com/org/",
    "System.TeamProject": "project",
    "Build.DefinitionName": "pipeline",
    "Build.BuildNumber": "20260929.1",
    "Build.BuildId": "123",
    "Build.Repository.Uri": "https://dev.azure.com/org/project/_git/repo",
    "Build.SourceVersion": "merge-sha",
    ...variables,
  };

  for (const [name, value] of Object.entries(all)) {
    process.env[name.replace(/\./g, "_").toUpperCase()] = value;
  }
}

test("Azure Repos CI build reports source version and branch", () => {
  setVariables({
    "Build.Repository.Provider": "TfsGit",
    "Build.Reason": "IndividualCI",
    "Build.SourceVersion": "ci-sha",
    "Build.SourceBranch": "refs/heads/main",
  });

  const metadata = getSourceMetadata();

  assert.equal(metadata.commitHash, "ci-sha");
  assert.equal(metadata.ref, "refs/heads/main");
  assert.ok(!("pullRequestNumber" in JSON.parse(JSON.stringify(metadata))));
});

test("Azure Repos PR build reports source commit, branch and PR id", () => {
  setVariables({
    "Build.Repository.Provider": "TfsGit",
    "Build.Reason": "PullRequest",
    "Build.SourceBranch": "refs/pull/17/merge",
    "System.PullRequest.SourceCommitId": "head-sha",
    "System.PullRequest.SourceBranch": "refs/heads/feature/x",
    "System.PullRequest.PullRequestId": "17",
  });

  const metadata = getSourceMetadata();

  assert.equal(metadata.commitHash, "head-sha");
  assert.equal(metadata.ref, "refs/heads/feature/x");
  assert.equal(metadata.pullRequestNumber, 17);
});

test("GitHub PR build uses PullRequestNumber and passes bare branch through", () => {
  setVariables({
    "Build.Repository.Provider": "GitHub",
    "Build.Reason": "PullRequest",
    "System.PullRequest.SourceCommitId": "head-sha",
    "System.PullRequest.SourceBranch": "feature/x",
    "System.PullRequest.PullRequestId": "2876543210",
    "System.PullRequest.PullRequestNumber": "42",
  });

  const metadata = getSourceMetadata();

  assert.equal(metadata.commitHash, "head-sha");
  assert.equal(metadata.ref, "feature/x");
  assert.equal(metadata.pullRequestNumber, 42);
});

test("GitHub PR build without PullRequestNumber omits the number", () => {
  setVariables({
    "Build.Repository.Provider": "GitHub",
    "Build.Reason": "PullRequest",
    "System.PullRequest.SourceBranch": "feature/x",
    "System.PullRequest.PullRequestId": "2876543210",
  });

  const metadata = getSourceMetadata();

  assert.equal(metadata.commitHash, "merge-sha");
  assert.equal(metadata.pullRequestNumber, undefined);
});

for (const value of ["abc", "2147483648", "0"]) {
  test(`invalid PR number "${value}" is omitted`, () => {
    setVariables({
      "Build.Repository.Provider": "TfsGit",
      "Build.Reason": "PullRequest",
      "System.PullRequest.PullRequestId": value,
    });

    assert.equal(getSourceMetadata().pullRequestNumber, undefined);
  });
}
