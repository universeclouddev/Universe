import { templateKey } from "@/lib/api/cross-cluster";
import type { Configuration, TemplateEntry } from "@/lib/api/types";

export type ConfigValidationSeverity = "warning" | "error";

export interface ConfigValidationIssue {
  severity: ConfigValidationSeverity;
  field: string;
  message: string;
}

export interface ConfigValidationResult {
  issues: ConfigValidationIssue[];
  errorCount: number;
  warningCount: number;
}

export interface ConfigValidationContext {
  templates?: TemplateEntry[];
  /** Configuration file name (without .json) when config.name is unset. */
  fileName?: string;
}

const VALID_PORT_MIN = 1;
const VALID_PORT_MAX = 65535;

function pushIssue(
  issues: ConfigValidationIssue[],
  severity: ConfigValidationSeverity,
  field: string,
  message: string,
) {
  issues.push({ severity, field, message });
}

function trim(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

function validateRequiredFields(
  config: Configuration,
  issues: ConfigValidationIssue[],
  fileName?: string,
) {
  const name = trim(config.name) || trim(fileName);
  if (!name) {
    pushIssue(issues, "error", "name", "Configuration name is required");
  }

  if (!trim(config.runtime)) {
    pushIssue(issues, "error", "runtime", "Runtime provider is required (e.g. screen, process, docker)");
  }

  if (!trim(config.command)) {
    pushIssue(issues, "warning", "command", "Start command is empty — instances will fail to launch");
  }

  if (config.ramMB == null || !Number.isFinite(config.ramMB) || config.ramMB <= 0) {
    pushIssue(issues, "error", "ramMB", "ramMB must be a positive number");
  }

  if (config.cpu == null || !Number.isFinite(config.cpu) || config.cpu <= 0) {
    pushIssue(issues, "error", "cpu", "cpu must be a positive number (100 = 1 core)");
  }

  if (config.minimumServiceCount == null) {
    pushIssue(issues, "warning", "minimumServiceCount", "minimumServiceCount is not set");
  } else if (!Number.isInteger(config.minimumServiceCount) || config.minimumServiceCount < 0) {
    pushIssue(issues, "error", "minimumServiceCount", "minimumServiceCount must be a non-negative integer");
  }

  if (!trim(config.hostAddress)) {
    pushIssue(issues, "warning", "hostAddress", "hostAddress is empty — clients may not connect correctly");
  }

  if (!config.nodes?.length) {
    pushIssue(issues, "warning", "nodes", "No nodes selected — this configuration cannot be scheduled anywhere");
  } else if (config.nodes.some((node) => !trim(node))) {
    pushIssue(issues, "warning", "nodes", "nodes contains blank entries");
  }

  if (!config.instanceGroups?.length) {
    pushIssue(issues, "warning", "instanceGroups", "instanceGroups is empty — grouping and template wildcards may not match");
  }
}

function validatePortRange(config: Configuration, issues: ConfigValidationIssue[]) {
  const range = config.availablePorts;
  if (!range) {
    pushIssue(
      issues,
      "warning",
      "availablePorts",
      "availablePorts is not set — port allocation may fail at deploy time",
    );
    return;
  }

  const { min, max } = range;

  if (min == null || max == null) {
    pushIssue(
      issues,
      "error",
      "availablePorts",
      "availablePorts requires both min and max",
    );
    return;
  }

  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    pushIssue(
      issues,
      "error",
      "availablePorts",
      "Port range min and max must be integers",
    );
    return;
  }

  if (min < VALID_PORT_MIN || max > VALID_PORT_MAX) {
    pushIssue(
      issues,
      "error",
      "availablePorts",
      `Port range must stay within ${VALID_PORT_MIN}–${VALID_PORT_MAX}`,
    );
  }

  if (min > max) {
    pushIssue(
      issues,
      "error",
      "availablePorts",
      `Port range min (${min}) is greater than max (${max})`,
    );
    return;
  }

  const span = max - min + 1;
  const desired =
    config.minimumServiceCount != null && config.minimumServiceCount > 0
      ? config.minimumServiceCount
      : 1;

  if (span < desired) {
    pushIssue(
      issues,
      "warning",
      "availablePorts",
      `Port range spans ${span} port(s) but minimumServiceCount is ${desired}`,
    );
  }
}

function collectReferencedTemplates(config: Configuration) {
  const install = config.templateInstallationConfig;
  if (!install) return { templates: [] as { group?: string; name?: string }[], groups: [] as string[] };

  return {
    templates: [...(install.allOf ?? []), ...(install.oneOf ?? [])],
    groups: [...(install.allInGroups ?? []), ...(install.oneInGroups ?? [])],
  };
}

function validateTemplateRefs(
  config: Configuration,
  templates: TemplateEntry[],
  issues: ConfigValidationIssue[],
) {
  const knownKeys = new Set(templates.map((entry) => templateKey(entry.group, entry.name)));
  const knownGroups = new Set(templates.map((entry) => entry.group));
  const { templates: refs, groups } = collectReferencedTemplates(config);

  if (!refs.length && !groups.length) {
    pushIssue(
      issues,
      "warning",
      "templateInstallationConfig",
      "No templates configured — instance working directory will be empty unless static",
    );
    return;
  }

  for (const ref of refs) {
    const group = trim(ref.group);
    const name = trim(ref.name);
    if (!group || !name) {
      pushIssue(
        issues,
        "error",
        "templateInstallationConfig",
        "Template reference is missing group or name",
      );
      continue;
    }

    const key = templateKey(group, name);
    if (!knownKeys.has(key)) {
      pushIssue(
        issues,
        "error",
        "templateInstallationConfig",
        `Unknown template reference "${key}"`,
      );
    }
  }

  for (const group of groups) {
    const trimmed = trim(group);
    if (!trimmed) {
      pushIssue(
        issues,
        "warning",
        "templateInstallationConfig",
        "Template group reference is blank",
      );
      continue;
    }

    if (!knownGroups.has(trimmed)) {
      pushIssue(
        issues,
        "error",
        "templateInstallationConfig",
        `Unknown template group "${trimmed}"`,
      );
    }
  }
}

function jarReferenceInCommand(command: string): string | null {
  const jarFlag = command.match(/-jar\s+(\S+)/i);
  if (jarFlag?.[1]) return jarFlag[1];

  const bareJar = command.match(/\b(\S+\.jar)\b/i);
  return bareJar?.[1] ?? null;
}

function isRelativeJarPath(jarPath: string): boolean {
  if (!jarPath) return false;
  if (jarPath.startsWith("./") || jarPath.startsWith(".\\")) return true;
  if (/^[a-zA-Z]:[\\/]/.test(jarPath)) return false;
  if (jarPath.startsWith("/") || jarPath.startsWith("\\")) return false;
  return !jarPath.includes("/") && !jarPath.includes("\\");
}

function validateServerJarHints(
  config: Configuration,
  issues: ConfigValidationIssue[],
  templates?: TemplateEntry[],
) {
  const command = trim(config.command);
  if (!command) return;

  const jarPath = jarReferenceInCommand(command);
  if (!jarPath) {
    if (/java/i.test(command)) {
      pushIssue(
        issues,
        "warning",
        "command",
        "Java start command has no -jar reference — verify the launch command",
      );
    }
    return;
  }

  if (!isRelativeJarPath(jarPath)) return;

  const fileName = jarPath.replace(/^\.[/\\]/, "");
  const { templates: refs, groups } = collectReferencedTemplates(config);
  const hasExplicitTemplate = refs.some(
    (ref) => trim(ref.group) && trim(ref.name),
  );
  const hasGroupTemplate = groups.some((group) => trim(group));

  if (!hasExplicitTemplate && !hasGroupTemplate) {
    pushIssue(
      issues,
      "warning",
      "command",
      `Command references "${jarPath}" but no templates are configured to provide it`,
    );
    return;
  }

  if (templates?.length && (fileName === "server.jar" || fileName.endsWith("/server.jar"))) {
    const providesServerJar = refs.some((ref) => {
      const group = trim(ref.group);
      const name = trim(ref.name);
      if (!group || !name) return false;
      return templates.some(
        (entry) =>
          entry.group === group &&
          entry.name === name &&
          entry.path.toLowerCase().endsWith("server.jar"),
      );
    });

    const groupMightProvide = groups.some((groupName) => {
      const group = trim(groupName);
      if (!group) return false;
      return templates.some(
        (entry) =>
          entry.group === group &&
          entry.name === "server" &&
          entry.path.toLowerCase().endsWith("server.jar"),
      );
    });

    if (!providesServerJar && !groupMightProvide) {
      pushIssue(
        issues,
        "warning",
        "command",
        `Command expects "${fileName}" in the working directory — ensure an installed template includes it`,
      );
    }
  } else if (fileName === "server.jar" || fileName.endsWith("server.jar")) {
    pushIssue(
      issues,
      "warning",
      "command",
      `Command expects "${fileName}" in the working directory — confirm your template contains this file`,
    );
  }
}

export function validateConfiguration(
  config: Configuration,
  context: ConfigValidationContext = {},
): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  validateRequiredFields(config, issues, context.fileName);
  validatePortRange(config, issues);

  if (context.templates) {
    validateTemplateRefs(config, context.templates, issues);
  }

  validateServerJarHints(config, issues, context.templates);

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return { issues, errorCount, warningCount };
}

export function configValidationSummary(result: ConfigValidationResult): string {
  if (result.issues.length === 0) return "No issues found";
  const parts: string[] = [];
  if (result.errorCount > 0) {
    parts.push(`${result.errorCount} error${result.errorCount === 1 ? "" : "s"}`);
  }
  if (result.warningCount > 0) {
    parts.push(`${result.warningCount} warning${result.warningCount === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}
