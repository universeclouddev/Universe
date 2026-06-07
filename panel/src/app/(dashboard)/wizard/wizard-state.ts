"use client";

import type { Configuration } from "@/lib/api/types";

export interface WizardTemplateSelection {
  group: string;
  name: string;
}

export interface WizardState {
  template: WizardTemplateSelection | null;
  configName: string;
  config: Configuration;
  instanceId: string | null;
}

export function defaultWizardConfig(
  template: WizardTemplateSelection | null,
  configName = "my-first-server",
): Configuration {
  const templateRef = template ? `${template.group}/${template.name}` : "default/lobby";
  const [templateGroup = "default", templateName = "lobby"] = templateRef.split("/");

  return {
    name: configName,
    runtime: "screen",
    command: "java -Xmx2048M -jar server.jar nogui",
    static: false,
    ramMB: 2048,
    cpu: 100,
    instanceGroups: [],
    nodes: [],
    hostAddress: "127.0.0.1",
    availablePorts: { min: 25565, max: 25575 },
    minimumServiceCount: 1,
    environmentVariables: { UNIVERSE_INSTANCE_ID: "%INSTANCE_ID%" },
    templateInstallationConfig: {
      allOf: [{ group: templateGroup, name: templateName }],
      allInGroups: [],
      oneOf: [],
      oneInGroups: [],
      onTemplatePasteOverridePresentFiles: false,
    },
    fileModifications: [],
    properties: {},
  };
}

export function createInitialWizardState(): WizardState {
  const configName = "my-first-server";
  return {
    template: null,
    configName,
    config: defaultWizardConfig(null, configName),
    instanceId: null,
  };
}
