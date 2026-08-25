import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Wizard, type WizardStep } from "./wizard";

const stepOfLabel = (step: number, total: number) => `Step ${step} of ${total}`;

const steps: WizardStep<"name" | "amount">[] = [
  { key: "step1", title: "Step One", fields: ["name"], content: <div data-testid="step1-content">Step 1</div> },
  { key: "step2", title: "Step Two", fields: ["amount"], content: <div data-testid="step2-content">Step 2</div> },
  { key: "step3", title: "Review", content: <div data-testid="step3-content">Step 3</div> },
];

describe("Wizard step-validation logic", () => {
  it("blocks advancing to the next step when onValidateStep resolves false", async () => {
    const onValidateStep = vi.fn().mockResolvedValue(false);
    const onSubmit = vi.fn();
    render(
      <Wizard
        steps={steps}
        onValidateStep={onValidateStep}
        onSubmit={onSubmit}
        submitLabel="Submit"
        cancelLabel="Cancel"
        backLabel="Back"
        nextLabel="Continue"
        stepOfLabel={stepOfLabel}
      />,
    );

    expect(screen.getByTestId("step1-content")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await Promise.resolve();

    expect(onValidateStep).toHaveBeenCalledWith(["name"], 0);
    // Still on step 1 — validation failed, the wizard must not have advanced.
    expect(screen.getByTestId("step1-content")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("advances to the next step's fields when onValidateStep resolves true, validating each step's own fields in turn", async () => {
    const onValidateStep = vi.fn().mockResolvedValue(true);
    const onSubmit = vi.fn();
    render(
      <Wizard
        steps={steps}
        onValidateStep={onValidateStep}
        onSubmit={onSubmit}
        submitLabel="Submit"
        cancelLabel="Cancel"
        backLabel="Back"
        nextLabel="Continue"
        stepOfLabel={stepOfLabel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await Promise.resolve();
    expect(onValidateStep).toHaveBeenNthCalledWith(1, ["name"], 0);
    expect(await screen.findByTestId("step2-content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await Promise.resolve();
    expect(onValidateStep).toHaveBeenNthCalledWith(2, ["amount"], 1);
    expect(await screen.findByTestId("step3-content")).toBeInTheDocument();
    // Last step has no declared `fields` — its Continue button already reads "Submit".
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("calls onSubmit only after the last step's own validation passes, with that step's (undefined) fields", async () => {
    const onValidateStep = vi.fn().mockResolvedValue(true);
    const onSubmit = vi.fn();
    render(
      <Wizard
        steps={steps}
        onValidateStep={onValidateStep}
        onSubmit={onSubmit}
        submitLabel="Submit"
        cancelLabel="Cancel"
        backLabel="Back"
        nextLabel="Continue"
        stepOfLabel={stepOfLabel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await Promise.resolve();
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    await Promise.resolve();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    await Promise.resolve();
    expect(onValidateStep).toHaveBeenLastCalledWith(undefined, 2);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("steps back without re-running validation, and calls onCancel instead of stepping back from the first step", async () => {
    const onValidateStep = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn();
    render(
      <Wizard
        steps={steps}
        onValidateStep={onValidateStep}
        onSubmit={vi.fn()}
        onCancel={onCancel}
        submitLabel="Submit"
        cancelLabel="Cancel"
        backLabel="Back"
        nextLabel="Continue"
        stepOfLabel={stepOfLabel}
      />,
    );

    // First step's Back button reads "Cancel" and calls onCancel instead of stepping.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await Promise.resolve();
    expect(await screen.findByTestId("step2-content")).toBeInTheDocument();

    // Stepping back doesn't call onValidateStep again — going backward is never gated.
    onValidateStep.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onValidateStep).not.toHaveBeenCalled();
    expect(screen.getByTestId("step1-content")).toBeInTheDocument();
  });

  it("disables both buttons while submitting", () => {
    render(
      <Wizard
        steps={steps}
        onValidateStep={vi.fn().mockResolvedValue(true)}
        onSubmit={vi.fn()}
        submitting
        submitLabel="Submit"
        cancelLabel="Cancel"
        backLabel="Back"
        nextLabel="Continue"
        stepOfLabel={stepOfLabel}
      />,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});
