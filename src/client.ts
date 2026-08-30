import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { fromApiKey, type CredentialsOptions } from "./credentials.ts";

export const layer = (options: CredentialsOptions) =>
  Layer.merge(fromApiKey(options), FetchHttpClient.layer);
