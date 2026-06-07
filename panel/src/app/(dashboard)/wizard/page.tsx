"use client";

import { useCallback, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/sidebar";
import { PermissionGuard } from "@/components/layout/auth-guard";
import { Badge } from "@/components/ui/badge";
import { WIZARD_STEPS, WizardStepper } from "./wizard-stepper";
import { createInitialWizardState, type WizardState } from "./wizard-state";
import {
  ConnectStep,
  ConfigStep,
  ConsoleStep,
  DeployStep,
  HealthStep,
  syncConfigWithTemplate,
  TemplateStep,
} from "./wizard-steps";

export default function WizardPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [completedThrough, setCompletedThrough] = useState(0);
  const [state, setState] = useState<WizardState>(createInitialWizardState);

  const markComplete = useCallback((index: number) => {
    setCompletedThrough((prev) => Math.max(prev, index + 1));
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (index <= completedThrough) setStepIndex(index);
    },
    [completedThrough],
  );

  const advance = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  }, []);

  const handleConnectContinue = useCallback(() => {
    markComplete(0);
    advance();
  }, [advance, markComplete]);

  const handleTemplateSelect = useCallback((template: WizardState["template"]) => {
    if (!template) return;
    setState((prev) => ({
      ...prev,
      template,
      config: syncConfigWithTemplate(prev.config, prev.configName, template),
    }));
  }, []);

  const handleTemplateContinue = useCallback(() => {
    markComplete(1);
    advance();
  }, [advance, markComplete]);

  const handleConfigNameChange = useCallback((configName: string) => {
    setState((prev) => ({
      ...prev,
      configName,
      config: { ...prev.config, name: configName },
    }));
  }, []);

  const handleConfigChange = useCallback((config: WizardState["config"]) => {
    setState((prev) => ({ ...prev, config }));
  }, []);

  const handleConfigContinue = useCallback(() => {
    markComplete(2);
    advance();
  }, [advance, markComplete]);

  const handleDeployed = useCallback((instanceId: string) => {
    setState((prev) => ({ ...prev, instanceId }));
  }, []);

  const handleDeployContinue = useCallback(() => {
    markComplete(3);
    advance();
  }, [advance, markComplete]);

  const handleHealthContinue = useCallback(() => {
    markComplete(4);
    advance();
  }, [advance, markComplete]);

  const stepContent = useMemo(() => {
    switch (stepIndex) {
      case 0:
        return <ConnectStep onContinue={handleConnectContinue} />;
      case 1:
        return (
          <TemplateStep
            selected={state.template}
            onSelect={handleTemplateSelect}
            onContinue={handleTemplateContinue}
          />
        );
      case 2:
        if (!state.template) return null;
        return (
          <ConfigStep
            template={state.template}
            configName={state.configName}
            config={state.config}
            onConfigNameChange={handleConfigNameChange}
            onConfigChange={handleConfigChange}
            onContinue={handleConfigContinue}
          />
        );
      case 3:
        if (!state.template) return null;
        return (
          <DeployStep
            configName={state.configName}
            template={state.template}
            instanceId={state.instanceId}
            onDeployed={handleDeployed}
            onContinue={handleDeployContinue}
          />
        );
      case 4:
        if (!state.instanceId) return null;
        return <HealthStep instanceId={state.instanceId} onContinue={handleHealthContinue} />;
      case 5:
        if (!state.instanceId) return null;
        return <ConsoleStep instanceId={state.instanceId} configName={state.configName} />;
      default:
        return null;
    }
  }, [
    stepIndex,
    state,
    handleConnectContinue,
    handleTemplateSelect,
    handleTemplateContinue,
    handleConfigNameChange,
    handleConfigChange,
    handleConfigContinue,
    handleDeployed,
    handleDeployContinue,
    handleHealthContinue,
  ]);

  return (
    <PermissionGuard permission="dashboard.view">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="First server wizard"
          description="A guided path from empty cluster to a running instance — no prior Universe experience required."
          meta={
            <Badge variant="accent" className="gap-1 text-[10px]">
              <Sparkles className="h-3 w-3" />
              GUIDED
            </Badge>
          }
        />

        <WizardStepper
          currentIndex={stepIndex}
          completedThrough={completedThrough}
          onStepClick={goToStep}
        />

        {stepContent}
      </div>
    </PermissionGuard>
  );
}
