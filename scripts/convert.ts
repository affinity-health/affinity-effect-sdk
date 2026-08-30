#!/usr/bin/env bun

import { runOpenApiConvert } from "@distilled.cloud/core/codegen/openapi-cli";

await runOpenApiConvert({
  root: `${import.meta.dir}/..`,
  specs: [
    {
      name: "affinity",
      specPath: "spec/affinity.openapi.json",
    },
  ],
  options: {
    namespace: "com.joinaffinityai.api",
    serviceName: "Affinity",
    statusToErrorClass: {
      "400": "BadRequest",
      "401": "Unauthorized",
      "403": "Forbidden",
      "404": "NotFound",
      "409": "Conflict",
      "422": "UnprocessableEntity",
    },
    defaultErrorStatuses: ["401", "429", "500", "502", "503", "504"],
    skipDeprecated: true,
  },
});
