import * as tl from "azure-pipelines-task-lib/task.js";

const API_VERSION = "7.1";

/**
 * Key under which the caller-supplied comment id is stored in a PR thread's
 * `properties` bag. It's metadata only — it never appears in the comment body —
 * so re-runs update the same thread instead of stacking new comments.
 */
const COMMENT_KEY_PROPERTY = "Nitro.CommentKey";

interface PullRequestContext {
  /** `.../pullRequests/{id}/threads` REST endpoint (no `?api-version`). */
  threadsUrl: string;
  token: string;
}

interface AdoComment {
  id: number;
}

interface AdoThread {
  id: number;
  comments?: AdoComment[];
  properties?: Record<string, { $value?: unknown } | undefined> | null;
}

function requireVariable(name: string): string {
  const value = tl.getVariable(name);

  if (!value) {
    throw new Error(`Required pipeline variable "${name}" is not set.`);
  }

  return value;
}

/**
 * Resolves the PR thread endpoint and OAuth token for the current run. Throws
 * when the build wasn't triggered by a pull request — mirroring the GitHub
 * Action's "can only be used in pull_request contexts" guard — so callers can
 * try/catch and skip in non-PR runs.
 */
function getPullRequestContext(): PullRequestContext {
  if (tl.getVariable("Build.Reason") !== "PullRequest") {
    throw new Error(
      "Pull request comments are only available in pull-request-triggered runs " +
        "(Build.Reason must be 'PullRequest').",
    );
  }

  const pullRequestId = requireVariable("System.PullRequest.PullRequestId");
  const repositoryId = requireVariable("Build.Repository.ID");
  // System.TeamFoundationCollectionUri already includes a trailing slash.
  const collectionUri = requireVariable("System.TeamFoundationCollectionUri");
  const project = requireVariable("System.TeamProject");

  const token = tl.getVariable("System.AccessToken");
  if (!token) {
    throw new Error(
      "System.AccessToken is not available. Enable 'Allow scripts to access the " +
        "OAuth token' for the job and grant the build service identity " +
        "'Contribute to pull requests' on the repository.",
    );
  }

  const threadsUrl =
    `${collectionUri}${encodeURIComponent(project)}/_apis/git/repositories/` +
    `${encodeURIComponent(repositoryId)}/pullRequests/` +
    `${encodeURIComponent(pullRequestId)}/threads`;

  return { threadsUrl, token };
}

async function adoFetch(
  url: string,
  token: string,
  init?: { method?: string; body?: string },
): Promise<unknown> {
  const response = await fetch(url, {
    method: init?.method,
    body: init?.body,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Azure DevOps API ${init?.method ?? "GET"} ${url} failed: ` +
        `${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`,
    );
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as unknown) : undefined;
}

async function listThreads(ctx: PullRequestContext): Promise<AdoThread[]> {
  const data = (await adoFetch(`${ctx.threadsUrl}?api-version=${API_VERSION}`, ctx.token)) as
    | { value?: AdoThread[] }
    | undefined;

  return data?.value ?? [];
}

function threadKey(thread: AdoThread): unknown {
  return thread.properties?.[COMMENT_KEY_PROPERTY]?.$value;
}

/**
 * Creates or updates a single pull-request comment identified by `id`. The id
 * is stored in the thread's `properties` bag (never in the visible body), so a
 * subsequent run with the same `id` edits the existing comment instead of
 * adding another. Throws when the run isn't pull-request-triggered.
 */
export async function upsertComment(id: string, markdown: string): Promise<void> {
  if (!id.trim()) {
    throw new Error("Comment id must not be empty.");
  }

  if (!markdown.trim()) {
    throw new Error("Comment markdown must not be empty.");
  }

  const ctx = getPullRequestContext();
  const existing = (await listThreads(ctx)).find((thread) => threadKey(thread) === id);

  if (!existing) {
    await adoFetch(`${ctx.threadsUrl}?api-version=${API_VERSION}`, ctx.token, {
      method: "POST",
      body: JSON.stringify({
        comments: [{ commentType: "text", content: markdown }],
        status: "active",
        properties: { [COMMENT_KEY_PROPERTY]: id },
      }),
    });
    return;
  }

  const comment = existing.comments?.[0];
  if (comment) {
    await adoFetch(
      `${ctx.threadsUrl}/${existing.id}/comments/${comment.id}?api-version=${API_VERSION}`,
      ctx.token,
      { method: "PATCH", body: JSON.stringify({ content: markdown }) },
    );
    return;
  }

  // Tagged thread exists but has no comments — append one.
  await adoFetch(`${ctx.threadsUrl}/${existing.id}/comments?api-version=${API_VERSION}`, ctx.token, {
    method: "POST",
    body: JSON.stringify({ commentType: "text", content: markdown }),
  });
}

/**
 * Removes the pull-request comment(s) previously created with
 * `upsertComment(id, …)`. No-op when none exist. Throws when the run isn't
 * pull-request-triggered.
 *
 * Note: Azure DevOps soft-deletes thread comments (a "deleted comment"
 * placeholder may remain in the PR's activity feed).
 */
export async function removeComment(id: string): Promise<void> {
  if (!id.trim()) {
    throw new Error("Comment id must not be empty.");
  }

  const ctx = getPullRequestContext();
  const matching = (await listThreads(ctx)).filter((thread) => threadKey(thread) === id);

  for (const thread of matching) {
    for (const comment of thread.comments ?? []) {
      await adoFetch(
        `${ctx.threadsUrl}/${thread.id}/comments/${comment.id}?api-version=${API_VERSION}`,
        ctx.token,
        { method: "DELETE" },
      );
    }
  }
}
