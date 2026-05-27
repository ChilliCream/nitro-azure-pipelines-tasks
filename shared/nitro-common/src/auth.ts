import * as tl from "azure-pipelines-task-lib/task.js";

export interface NitroAuth {
  apiKey: string;
  cloudUrl: string | undefined;
}

/**
 * Resolves Nitro authentication from either a service connection or direct
 * task inputs, based on the `authenticationType` pickList. Tasks that omit `authenticationType`
 * fall back to the legacy direct inputs for backwards compatibility.
 */
export function resolveAuth(): NitroAuth {
  const authenticationType = tl.getInput("authenticationType", false) ?? "apiKey";

  if (authenticationType === "serviceConnection") {
    const endpointId = tl.getInput("nitroServiceConnection", true)!;
    const apiKey = tl.getEndpointAuthorizationParameter(endpointId, "apitoken", false);
    if (!apiKey) {
      throw new Error(`Service connection '${endpointId}' is missing the API key.`);
    }
    const cloudUrl = tl.getEndpointUrl(endpointId, true) || undefined;
    return { apiKey, cloudUrl };
  }

  const apiKey = tl.getInput("apiKey", true)!;
  const cloudUrl = tl.getInput("cloudUrl", false);
  return { apiKey, cloudUrl };
}
