import { DEFAULT_UPDATE_REGION } from "./constants.js";
import type {
  GenericPublishConfig,
  GithubPublishConfig,
  PublishConfig,
  S3PublishConfig
} from "./types.js";

/** Minimal compatible shape for env */
export type EnvLike = Record<string, string | undefined>;

/** Minimal compatible shape for env source */
export type EnvSourceLike = Readonly<Record<string, unknown>>;

/** Options for aws credential */
export type AwsCredentialOptions = Readonly<{
  accessKeyEnvName?: string;
  env             ?: EnvLike;
  secretKeyEnvName?: string;
  source          ?: EnvSourceLike;
  targetAccessKey ?: string;
  targetSecretKey ?: string;
}>;

/** Options for generic publish */
export type GenericPublishOptions = Readonly<{
  channel          ?: string;
  publishAutoUpdate?: boolean;
  url              ?: string;
}>;

/** Options for s3 publish */
export type S3PublishOptions = Readonly<{
  acl              ?: string | null;
  bucket           ?: string;
  channel          ?: string;
  path             ?: string;
  publishAutoUpdate?: boolean;
  region           ?: string;
}>;

/** Options for github publish */
export type GithubPublishOptions = Readonly<{
  channel          ?: string;
  host             ?: string;
  owner            ?: string;
  private          ?: boolean;
  protocol         ?: "https" | "http";
  publishAutoUpdate?: boolean;
  releaseType      ?: "draft" | "prerelease" | "release";
  repo             ?: string;
}>;

/** Options for publish config */
export type PublishConfigOptions = Readonly<{
  generic?: GenericPublishOptions;
  github ?: GithubPublishOptions;
  order  ?: Array<"generic" | "github" | "s3">;
  s3     ?: S3PublishOptions;
}>;

/** Provides the trim trailing slashes helper */
export const trimTrailingSlashes = (value: string): string => (
  value.trim().replace(/\/+$/u, "")
);

/** Normalizes publish path */
export const normalizePublishPath = (value: string): string => (
  value.trim().replace(/^\/+|\/+$/gu, "")
);

const toOptionalText = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const text = String(value).trim();

  return text.length > 0 ? text : undefined;
};

/** Reads env value */
export const readEnvValue = (
  source: EnvSourceLike,
  key: string,
  fallback = ""
): string => toOptionalText(source[key]) ?? fallback;

const getDefaultEnv = (): EnvLike => {
  const maybeProcess = (globalThis as typeof globalThis & {
    process?: {
      env?: EnvLike;
    };
  }).process;

  return maybeProcess?.env ?? {};
};

/** Applies aws credentials */
export const applyAwsCredentials = (options: AwsCredentialOptions = {}): EnvLike => {
  const env = options.env ?? getDefaultEnv();
  const source = options.source ?? env;
  const accessKey = readEnvValue(source, options.accessKeyEnvName ?? "APP_UPDATE_ACCESS_KEY");
  const secretKey = readEnvValue(source, options.secretKeyEnvName ?? "APP_UPDATE_SECRET_KEY");
  const targetAccessKey = options.targetAccessKey ?? "AWS_ACCESS_KEY_ID";
  const targetSecretKey = options.targetSecretKey ?? "AWS_SECRET_ACCESS_KEY";

  if (!env[targetAccessKey] && accessKey) {
    env[targetAccessKey] = accessKey;
  }

  if (!env[targetSecretKey] && secretKey) {
    env[targetSecretKey] = secretKey;
  }

  return env;
};

/** Creates generic publish config */
export const createGenericPublishConfig = (
  options: GenericPublishOptions
): GenericPublishConfig | undefined => {
  const url = options.url ? trimTrailingSlashes(options.url) : "";

  if (!url) {
    return undefined;
  }

  return {
    ...(options.channel ? { channel: options.channel } : {}),
    ...(options.publishAutoUpdate === undefined ? {} : { publishAutoUpdate: options.publishAutoUpdate }),
    provider: "generic",
    url
  };
};

/** Creates s3 publish config */
export const createS3PublishConfig = (
  options: S3PublishOptions
): S3PublishConfig | undefined => {
  const bucket = toOptionalText(options.bucket);

  if (!bucket) {
    return undefined;
  }

  const publishPath = options.path ? normalizePublishPath(options.path) : "";

  return {
    ...(options.acl === undefined ? { acl: null } : { acl: options.acl }),
    bucket,
    ...(options.channel ? { channel: options.channel } : {}),
    ...(publishPath ? { path: publishPath } : {}),
    ...(options.publishAutoUpdate === undefined ? { publishAutoUpdate: true } : { publishAutoUpdate: options.publishAutoUpdate }),
    provider: "s3",
    region  : toOptionalText(options.region) ?? DEFAULT_UPDATE_REGION
  };
};

/** Creates github publish config, returning undefined without required owner and repo */
export const createGithubPublishConfig = (
  options: GithubPublishOptions = {}
): GithubPublishConfig | undefined => {
  const owner = toOptionalText(options.owner);
  const repo  = toOptionalText(options.repo);

  if (!owner || !repo) {
    return undefined;
  }

  return {
    ...(options.channel ? { channel: options.channel } : {}),
    ...(options.host ? { host: options.host } : {}),
    owner,
    ...(options.private === undefined ? {} : { private: options.private }),
    ...(options.protocol ? { protocol: options.protocol } : {}),
    provider: "github",
    ...(options.publishAutoUpdate === undefined ? {} : { publishAutoUpdate: options.publishAutoUpdate }),
    ...(options.releaseType ? { releaseType: options.releaseType } : {}),
    repo
  };
};

/** Creates publish config */
export const createPublishConfig = (
  options: PublishConfigOptions
): PublishConfig[] | undefined => {
  const byProvider = {
    generic: createGenericPublishConfig(options.generic ?? {}),
    github : options.github ? createGithubPublishConfig(options.github) : undefined,
    s3     : createS3PublishConfig(options.s3 ?? {})
  } satisfies Record<string, PublishConfig | undefined>;

  const order = options.order ?? [
    "generic",
    "s3",
    "github"
  ];
  const publish = order
    .map((provider) => byProvider[provider])
    .filter((provider): provider is PublishConfig => Boolean(provider));

  return publish.length > 0 ? publish : undefined;
};

/** Patches updater cache dir name */
export const patchUpdaterCacheDirName = (
  yamlContent: string,
  updaterCacheDirName: string
): string => {
  const normalizedName = updaterCacheDirName.trim();

  if (!normalizedName) {
    return yamlContent;
  }

  const updaterCacheDirPattern = /^updaterCacheDirName:\s*.+$/mu;

  if (updaterCacheDirPattern.test(yamlContent)) {
    return yamlContent.replace(
      updaterCacheDirPattern,
      `updaterCacheDirName: ${normalizedName}`
    );
  }

  const normalizedYamlContent = yamlContent.endsWith("\n")
    ? yamlContent
    : `${yamlContent}\n`;

  return `${normalizedYamlContent}updaterCacheDirName: ${normalizedName}\n`;
};
