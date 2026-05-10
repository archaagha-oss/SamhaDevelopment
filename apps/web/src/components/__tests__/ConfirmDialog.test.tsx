import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog from "@/components/ConfirmDialog";

// Sample component test — proves the Vitest + RTL + jsdom + path-alias wiring
// all works end-to-end before we layer on hooks/network in the next files.

describe("ConfirmDialog", () => {
  it("renders the title and message when open", () => {
    render(
      <ConfirmDialog
        open
        title="Delete deal?"
        message="This permanently removes the record."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText("Delete deal?")).toBeInTheDocument();
    expect(
      screen.getByText("This permanently removes the record."),
    ).toBeInTheDocument();
  });

  it("does not render dialog content when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Should not appear"
        message="Hidden body"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.queryByText("Should not appear")).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden body")).not.toBeInTheDocument();
  });

  it("fires onConfirm when the confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Confirm action"
        message="Proceed?"
        confirmLabel="Yes, proceed"
        cancelLabel="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Yes, proceed" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("fires onCancel when the cancel button is clicked", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Confirm action"
        message="Proceed?"
        confirmLabel="Yes"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
