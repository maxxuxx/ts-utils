import { spawnSync as nodeSpawnSync } from "node:child_process";

/** Resolves a shell-free npm invocation for the current runtime */
export const resolveNpmInvocation = (
  args,
  {
    env      = process.env,
    execPath = process.execPath,
    platform = process.platform
  } = {}
) => {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new TypeError("[npm-runner] npm arguments must be an array of strings");
  }

  const npmExecPath = typeof env?.npm_execpath === "string"
    ? env.npm_execpath.trim()
    : "";

  if (npmExecPath.length > 0) {
    return {
      args   : [npmExecPath, ...args],
      command: execPath
    };
  }

  if (platform === "win32") {
    throw new Error(
      "[npm-runner] npm_execpath is required on Windows; run this script through npm so its CLI path is available"
    );
  }

  return {
    args: [...args],
    command: "npm"
  };
};

/** Runs npm synchronously without invoking a command shell */
export const spawnNpmSync = (args, options = {}, runtime = {}) => {
  const {
    spawnSync = nodeSpawnSync,
    ...invocationRuntime
  } = runtime;
  const invocation = resolveNpmInvocation(args, invocationRuntime);

  return spawnSync(invocation.command, invocation.args, {
    ...options,
    shell: false
  });
};
