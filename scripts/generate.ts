#!/usr/bin/env bun

import { runGeneratorCli } from "@distilled.cloud/core/codegen/cli";
import type { SdkSpec } from "@distilled.cloud/core/codegen/generator";
import {
  ERROR_MATCHERS_TRAIT,
  NULLABLE_TRAIT,
  RAW_RESPONSE_TRAIT,
} from "@distilled.cloud/core/codegen/openapi";

const spec: SdkSpec = {
  nullableTrait: NULLABLE_TRAIT,
  errorMatchersTrait: ERROR_MATCHERS_TRAIT,
  extraBindings: [
    {
      trait: RAW_RESPONSE_TRAIT,
      binding: "rawResponse",
      pipe: "T.RawResponse()",
      rootPipe: "T.RawResponseRoot()",
    },
  ],
  memberTraitPipes: {
    "smithy.api#sensitive": "T.SensitiveValue",
  },
  union: ({ name, caseTargets, tsRef }) => [
    `export type ${name} = ${caseTargets.map(tsRef).join(" | ") || "unknown"};`,
    `export const ${name} = /*@__PURE__*/ S.Unknown as any as S.Schema<${name}>;\n`,
  ],
  sourceNote: ".generated-specs (spec/affinity.openapi.json)",
  operationDecl: {
    contextType: "AffinityOpContext",
    commonErrorType: "AffinityOpError",
    commonErrorClasses: [],
    protocol: "AffinityProtocol",
    retry: "Retry.Retry",
  },
  postProcess: (code) => code.replace(/import \{\s*\} from "\.\.\/errors\.ts";\n/, ""),
};

runGeneratorCli({
  description: "Generate the Affinity Effect SDK from its Smithy model",
  root: `${import.meta.dir}/..`,
  patchesDir: false,
  spec: () => spec,
});
