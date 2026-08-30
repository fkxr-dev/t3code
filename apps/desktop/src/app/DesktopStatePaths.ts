import * as Option from "effect/Option";

export type JoinPath = (first: string, ...segments: string[]) => string;

function normalizeConfiguredBaseDir(t3Home: Option.Option<string>): Option.Option<string> {
  if (Option.isNone(t3Home)) {
    return Option.none();
  }
  const trimmed = t3Home.value.trim();
  return trimmed.length > 0 ? Option.some(trimmed) : Option.none();
}

export function resolveDesktopBaseDir(input: {
  readonly homeDirectory: string;
  readonly joinPath: JoinPath;
  readonly t3Home: Option.Option<string>;
}): string {
  return Option.getOrElse(normalizeConfiguredBaseDir(input.t3Home), () =>
    input.joinPath(input.homeDirectory, ".t3"),
  );
}

export function resolveDesktopStateDir(input: {
  readonly baseDir: string;
  readonly isDevelopment: boolean;
  readonly joinPath: JoinPath;
  readonly t3Home: Option.Option<string>;
}): string {
  const useDevSubdir =
    input.isDevelopment && Option.isNone(normalizeConfiguredBaseDir(input.t3Home));
  return input.joinPath(input.baseDir, useDevSubdir ? "dev" : "userdata");
}

// An explicit T3CODE_HOME asks for a fully isolated install. Electron's
// userData holds the Chromium profile, Clerk session, and single-instance
// lock, so it must move under the configured home too — otherwise two
// installs sharing the default appData path would collide on the lock and
// the second one would silently quit.
export function resolveDesktopUserDataOverride(input: {
  readonly baseDir: string;
  readonly joinPath: JoinPath;
  readonly t3Home: Option.Option<string>;
}): Option.Option<string> {
  return Option.map(normalizeConfiguredBaseDir(input.t3Home), () =>
    input.joinPath(input.baseDir, "electron"),
  );
}
