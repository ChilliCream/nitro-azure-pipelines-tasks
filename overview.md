# Nitro for Azure Pipelines

Azure Pipelines tasks for the [Nitro CLI](https://chillicream.com/products/nitro)
— publish, upload, and validate GraphQL schemas, MCP feature collections,
OpenAPI specs, and client operations against the Nitro registry, directly
from your pipelines.

## Quick start

```yaml
steps:
  - task: NitroFusionPublish@16
    inputs:
      tag: $(Build.BuildNumber)
      stage: production
      apiId: $(NITRO_API_ID)
      apiKey: $(NITRO_API_KEY)
      sourceSchemas: |
        accounts
        products
```

Each task installs the matching Nitro CLI version on first use. Task major
versions track Nitro CLI majors, so pinning `@16` keeps your pipeline on
Nitro CLI v16 even after newer majors ship.

## Available tasks

- **Publish**: `NitroClientPublish`, `NitroFusionPublish`, `NitroMcpPublish`,
  `NitroOpenapiPublish`, `NitroSchemaPublish`
- **Upload**: `NitroClientUpload`, `NitroFusionUpload`, `NitroMcpUpload`,
  `NitroOpenapiUpload`, `NitroSchemaUpload`
- **Validate**: `NitroClientValidate`, `NitroFusionValidate`,
  `NitroMcpValidate`, `NitroOpenapiValidate`, `NitroSchemaValidate`

## Documentation

Full documentation lives at
[chillicream.com/docs/nitro](https://chillicream.com/docs/nitro).
