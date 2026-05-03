# Nitro Azure Pipelines Tasks

Azure Pipelines tasks for the [Nitro CLI](https://chillicream.com/products/nitro).
This is the Azure DevOps counterpart of the
[`nitro-*` GitHub Actions](https://github.com/ChilliCream).

Install the extension from the Visual Studio Marketplace, then reference any of
the tasks in your pipeline:

```yaml
steps:
  - task: NitroFusionPublish@16
    inputs:
      tag: $(Build.BuildNumber)
      stage: production
      apiId: $(NITRO_API_ID)
      apiKey: $(NITRO_API_KEY) # secret pipeline variable
      sourceSchemas: |
        accounts
        products
```

The `@16` suffix pins the task to Nitro CLI major version 16. Each task
self-installs the matching CLI on first use; no separate installer task is
required.

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
| `NitroOpenapiPublish@16`  | `nitro openapi publish`  |
| `NitroOpenapiUpload@16`   | `nitro openapi upload`   |
| `NitroOpenapiValidate@16` | `nitro openapi validate` |
| `NitroSchemaPublish@16`   | `nitro schema publish`   |
| `NitroSchemaUpload@16`    | `nitro schema upload`    |
| `NitroSchemaValidate@16`  | `nitro schema validate`  |

## Secrets

The `apiKey` input is sensitive. Always pass it as a secret pipeline variable:

```yaml
inputs:
  apiKey: $(NITRO_API_KEY)
```

Declare `NITRO_API_KEY` as a secret variable in the pipeline UI or in a linked
variable group. **Never inline an API key as a literal string** — Azure
Pipelines only masks values that come from secret variables.

## Development

Yarn workspaces, Node 20.

```sh
corepack enable
yarn install --immutable
yarn build       # tsc + ncc bundle every task
yarn test        # mocha + task-lib mock harness
yarn package     # tfx extension create -> artifacts/*.vsix
```
