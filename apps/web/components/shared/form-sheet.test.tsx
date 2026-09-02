import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormSheet } from "./form-sheet";

describe("FormSheet", () => {
  it("renders title, description, and children when open", () => {
    render(
      <FormSheet open title="Add cattle" description="Create a new animal" onOpenChange={() => {}} onSubmit={() => {}}>
        <input aria-label="Tag number" />
      </FormSheet>,
    );

    expect(screen.getByText("Add cattle")).toBeInTheDocument();
    expect(screen.getByText("Create a new animal")).toBeInTheDocument();
    expect(screen.getByLabelText("Tag number")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(
      <FormSheet open={false} title="Add cattle" onOpenChange={() => {}} onSubmit={() => {}}>
        <input aria-label="Tag number" />
      </FormSheet>,
    );

    expect(screen.queryByText("Add cattle")).not.toBeInTheDocument();
  });

  it("calls onSubmit when the form is submitted and disables actions while pending", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <FormSheet open title="Add cattle" onOpenChange={() => {}} onSubmit={onSubmit} pending submitLabel="Save">
        <input aria-label="Tag number" />
      </FormSheet>,
    );

    const submitButton = screen.getByRole("button", { name: "…" });
    expect(submitButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await user.click(submitButton);
  });

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <FormSheet open title="Add cattle" onOpenChange={onOpenChange} onSubmit={() => {}}>
        <input aria-label="Tag number" />
      </FormSheet>,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
