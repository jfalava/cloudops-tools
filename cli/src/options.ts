import { Options } from "@effect/cli";

export const account = Options.optional(Options.text("account")).pipe(
  Options.withAlias("a"),
  Options.withDescription("AWS account or profile name"),
);

export const useLetmeOption = Options.boolean("use-letme").pipe(
  Options.withDescription("Use LetMe with profile name from --account to obtain MFA credentials"),
);

export const region = Options.withDefault(Options.text("region"), "us-east-1").pipe(
  Options.withAlias("r"),
  Options.withDescription("AWS region(s), comma-separated"),
);

export const initRegions = Options.optional(Options.text("region")).pipe(
  Options.withAlias("r"),
  Options.withDescription("AWS region(s), comma-separated"),
);

export const exportFormat = Options.withDefault(
  Options.choice("export-format", ["csv", "xlsx", "json", "both", "all"]),
  "csv" as const,
).pipe(Options.withAlias("f"), Options.withDescription("Export format"));

export const limitRegions = Options.optional(Options.text("limit-regions")).pipe(
  Options.withDescription("Limit scan to these regions (comma-separated)"),
);

export const debugOption = Options.boolean("debug").pipe(
  Options.withDescription("Show raw error output (stack traces)"),
);

export const describeOption = Options.optional(Options.text("describe")).pipe(
  Options.withDescription("Describe all resources of a type (e.g. rds, ec2, vpc, dynamodb)"),
);

export const skipGlobalOption = Options.boolean("skip-global").pipe(
  Options.withDescription("Skip global services (S3, IAM, CloudFront, Route53, etc.)"),
);

export const onlyGlobalOption = Options.boolean("only-global").pipe(
  Options.withDescription("Scan only global services (skip all regional services)"),
);

export const incrementalOption = Options.boolean("incremental").pipe(
  Options.withDescription("Only output new or changed resources since last scan"),
);

export const modeOption = Options.withDefault(
  Options.choice("mode", ["basic", "detailed", "security", "cost"]),
  "basic" as const,
);

export const servicesOption = Options.optional(Options.text("services")).pipe(
  Options.withAlias("s"),
  Options.withDescription(
    "Comma-separated list of services to scan (e.g. EC2,RDS,S3). Use 'all' for all services.",
  ),
);

export const helpExamplesOption = Options.boolean("help-examples").pipe(
  Options.withDescription("Show CLI usage examples."),
);
