export type CliSelection = "main" | "setup-totp" | "config" | "query";

export type StartupAction = "run" | "print-version" | "print-help" | "print-help-examples";

export type CliInvocationPlan = {
  action: StartupAction;
  argsForSelectedCli: ReadonlyArray<string>;
  debug: boolean;
  normalizedArgv: ReadonlyArray<string>;
  selectedCli: CliSelection;
};

type RawFlags = {
  debug: boolean;
  forceConfig: boolean;
  forceInit: boolean;
  forceSetupTotp: boolean;
  wantsHelp: boolean;
  wantsHelpExamples: boolean;
  wantsVersion: boolean;
};

const stripFirstToken = (input: ReadonlyArray<string>, token: string): ReadonlyArray<string> => {
  // Keep argv shape intact while removing only the first subcommand token after argv[0..1].
  let removed = false;
  return input.filter((arg, index) => {
    if (index < 2) {
      return true;
    }
    if (!removed && arg === token) {
      removed = true;
      return false;
    }
    return true;
  });
};

const stripTokens = (
  input: ReadonlyArray<string>,
  tokens: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  // Remove all matching framework/global flags after argv[0..1].
  if (tokens.length === 0) {
    return input;
  }
  return input.filter((arg, index) => (index < 2 ? true : !tokens.includes(arg)));
};

const parseRawFlags = (argv: ReadonlyArray<string>): RawFlags => {
  const args = argv.slice(2);
  return {
    debug: args.includes("--debug"),
    forceConfig: args.includes("--config"),
    forceInit: args.includes("--init"),
    forceSetupTotp: args.includes("--setup-totp"),
    wantsHelp: args.length === 0 || args.includes("--help") || args.includes("-h"),
    wantsHelpExamples: args.includes("--help-examples"),
    wantsVersion: args.includes("--version"),
  };
};

const normalizeArgv = (argv: ReadonlyArray<string>, flags: RawFlags): ReadonlyArray<string> => {
  const args = argv.slice(2);
  if (flags.forceSetupTotp) {
    return [...argv.slice(0, 2), "setup-totp", ...args.filter((arg) => arg !== "--setup-totp")];
  }
  if (flags.forceInit) {
    return [...argv.slice(0, 2), "init", ...args.filter((arg) => arg !== "--init")];
  }
  if (flags.forceConfig) {
    return [...argv.slice(0, 2), "config", ...args.filter((arg) => arg !== "--config")];
  }
  return argv;
};

type SelectedState = {
  selectedCli: CliSelection;
  wantsConfig: boolean;
};

const detectSelectedCli = (
  normalizedArgv: ReadonlyArray<string>,
  flags: RawFlags,
): SelectedState => {
  const normalizedArgsForDetection = normalizedArgv.slice(2);
  const firstPositionalToken = normalizedArgsForDetection.find((arg) => !arg.startsWith("-"));
  const wantsSetupTotp = flags.forceSetupTotp || firstPositionalToken === "setup-totp";
  const wantsConfig = flags.forceConfig || firstPositionalToken === "config";
  const wantsQuery = firstPositionalToken === "query";

  const selectedCli: CliSelection = wantsSetupTotp
    ? "setup-totp"
    : wantsConfig
      ? "config"
      : wantsQuery
        ? "query"
        : "main";

  return { selectedCli, wantsConfig };
};

const getStartupAction = (flags: RawFlags, wantsConfig: boolean): StartupAction => {
  if (flags.wantsVersion) {
    return "print-version";
  }
  if (flags.wantsHelp && !flags.forceInit && !flags.forceSetupTotp && !wantsConfig) {
    return "print-help";
  }
  if (flags.wantsHelpExamples && !flags.forceInit && !flags.forceSetupTotp && !wantsConfig) {
    return "print-help-examples";
  }
  return "run";
};

const getArgsForSelectedCli = (
  selectedCli: CliSelection,
  normalizedArgv: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  if (selectedCli === "setup-totp") {
    return stripTokens(stripFirstToken(normalizedArgv, "setup-totp"), ["--debug"]);
  }
  if (selectedCli === "config") {
    return stripTokens(stripFirstToken(normalizedArgv, "config"), ["--debug"]);
  }
  if (selectedCli === "query") {
    return stripTokens(stripFirstToken(normalizedArgv, "query"), ["--debug"]);
  }
  return normalizedArgv;
};

export const planCliInvocation = (argv: ReadonlyArray<string>): CliInvocationPlan => {
  const flags = parseRawFlags(argv);
  const normalizedArgv = normalizeArgv(argv, flags);
  const { selectedCli, wantsConfig } = detectSelectedCli(normalizedArgv, flags);
  const action = getStartupAction(flags, wantsConfig);
  const argsForSelectedCli = getArgsForSelectedCli(selectedCli, normalizedArgv);

  return {
    action,
    argsForSelectedCli,
    debug: flags.debug,
    normalizedArgv,
    selectedCli,
  };
};
