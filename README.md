# Nitro Azure Pipelines Tasks

Azure Pipelines tasks wrapping the [Nitro CLI](https://chillicream.com/docs/nitro/cli/installation) for the most common tasks.

The `@16` suffix pins the task to Nitro CLI major version 16. Each task
self-installs the matching CLI on first use; no separate installer task is
required.

## Authentication

Every task authenticates against the Nitro registry. Two options:

1. **Nitro service connection** _(recommended)_ — store the API key once in
   project settings; tasks reference it by name. Rotation and access control
   happen in one place.
2. **API key pipeline variable** — pass a secret variable directly into each
   task.

### Option 1: Nitro service connection (recommended)

Create the connection once per project:

1. _Project Settings → Service connections → New service connection._
2. Pick **Nitro** from the list.
3. Paste the API key. Keep **Cloud URL** at its default; overriding this is
   only required when self-hosting or using a dedicated instance.
4. Name the connection (e.g. `nitro-prod`) and save.

Reference it from a task with `authType: serviceConnection`:

```yaml
steps:
  - task: NitroFusionPublish@16
    inputs:
      authenticationType: serviceConnection
      nitroServiceConnection: nitro-prod
      apiId: $(NITRO_API_ID)
      tag: $(Build.BuildNumber)
      stage: production
      sourceSchemas: |
        accounts
        products
```

The API key and cloud URL are read from the connection; do not set `apiKey` or
`cloudUrl` on the task.

### Option 2: API key pipeline variable

```yaml
steps:
  - task: NitroFusionPublish@16
    inputs:
      authenticationType: apiKey
      apiKey: $(NITRO_API_KEY) # secret pipeline variable
      apiId: $(NITRO_API_ID)
      tag: $(Build.BuildNumber)
      stage: production
      sourceSchemas: |
        accounts
        products
```

`apiKey` is sensitive. Always pass it through a secret pipeline variable or a
linked variable group — **never inline a literal key**. Azure Pipelines only
masks values that come from secret variables.

## Tasks

| Task                      | Subcommand               |
| ------------------------- | ------------------------ |
| `NitroClientPublish@16`   | `nitro client publish`   |
| `NitroClientUpload@16`    | `nitro client upload`    |
| `NitroClientValidate@16`  | `nitro client validate`  |
| `NitroFusionPublish@16`   | `nitro fusion publish`   |
| `NitroFusionUpload@16`    | `nitro fusion upload`    |
| `NitroFusionValidate@16`  | `nitro fusion validate`  |
| `NitroMcpPublish@16`      | `nitro mcp publish`      |
| `NitroMcpUpload@16`       | `nitro mcp upload`       |
| `NitroMcpValidate@16`     | `nitro mcp validate`     |
| `NitroOpenApiPublish@16`  | `nitro openapi publish`  |
| `NitroOpenApiUpload@16`   | `nitro openapi upload`   |
| `NitroOpenApiValidate@16` | `nitro openapi validate` |
| `NitroSchemaDownload@16`  | `nitro schema download`  |
| `NitroSchemaPublish@16`   | `nitro schema publish`   |
| `NitroSchemaUpload@16`    | `nitro schema upload`    |
| `NitroSchemaValidate@16`  | `nitro schema validate`  |

<!-- ## Pull request comments

Tasks that post a pull-request comment (e.g. `NitroFusionUpload@16`) need two
things in a PR-triggered run, otherwise the comment is silently skipped (the
task itself still succeeds):

1. **Expose the OAuth token to the task** — map it on the step:

   ```yaml
   - task: NitroFusionUpload@16
     inputs:
       # ...
     env:
       SYSTEM_ACCESSTOKEN: $(System.AccessToken)
   ```

2. **Grant the build service "Contribute to pull requests"** — the task posts
   as the build identity, which by default can't write PR threads:
   _Project Settings → Repositories → (your repo, or the top-level Security tab)
   → Security → find `{Project} Build Service ({Org})` → set
   **Contribute to pull requests** to **Allow**._ Without it you get
   `TF401027: You need the Git 'PullRequestContribute' permission`.

Notes: this only works for **Azure Repos** repositories in the **same project**
(`System.AccessToken` can't authenticate against GitHub-hosted repos), and only
in pull-request-triggered runs. For Azure Repos, "runs on PR" means a
**Build Validation** branch policy — the YAML `pr:` trigger is ignored. -->
