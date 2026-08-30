export {
  BadGateway,
  BadRequest,
  ConfigError,
  Conflict,
  Forbidden,
  GatewayTimeout,
  InternalServerError,
  NotFound,
  ServiceUnavailable,
  TooManyRequests,
  Unauthorized,
  UnprocessableEntity,
} from "@distilled.cloud/core/errors";
import type { ConfigError, DefaultErrors as CoreDefaultErrors } from "@distilled.cloud/core/errors";
import * as Category from "@distilled.cloud/core/category";
import * as Schema from "effect/Schema";

export class UnknownAffinityError extends Schema.TaggedError<UnknownAffinityError>()(
  "UnknownAffinityError",
  {
    code: Schema.optional(Schema.String),
    message: Schema.optional(Schema.String),
    body: Schema.Unknown,
  },
).pipe(Category.withServerError) {}

export class AffinityParseError extends Schema.TaggedError<AffinityParseError>()(
  "AffinityParseError",
  {
    body: Schema.Unknown,
    cause: Schema.Unknown,
  },
).pipe(Category.withParseError) {}

export type AffinityClientError = UnknownAffinityError | AffinityParseError;
export type DefaultErrors = CoreDefaultErrors | ConfigError | AffinityClientError;
