import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NextStepCard from "../NextStepCard";

describe("NextStepCard", () => {
  it("renders the label and 'Next step' heading", () => {
    render(
      <NextStepCard
        label="Move to QUALIFIED"
        onClick={() => {}}
      />,
    );
    expect(screen.getByText("Next step")).toBeInTheDocument();
    expect(screen.getByText("Move to QUALIFIED")).toBeInTheDocument();
  });

  it("fires onClick when the primary button is pressed", () => {
    const handle = vi.fn();
    render(<NextStepCard label="Do thing" onClick={handle} />);
    fireEvent.click(screen.getByRole("button", { name: /do thing/i }));
    expect(handle).toHaveBeenCalledOnce();
  });

  it("disables the primary CTA when disabled=true", () => {
    render(<NextStepCard label="Locked" onClick={() => {}} disabled />);
    expect(screen.getByRole("button", { name: /locked/i })).toBeDisabled();
  });

  it("renders the description when provided", () => {
    render(
      <NextStepCard
        label="X"
        description="Last activity 4d ago"
        onClick={() => {}}
      />,
    );
    expect(screen.getByText("Last activity 4d ago")).toBeInTheDocument();
  });

  it("renders metadata rows in the order given", () => {
    render(
      <NextStepCard
        label="X"
        onClick={() => {}}
        metadata={[
          { label: "Stalled", value: "12d", tone: "warning" },
          { label: "Last contact", value: "2d ago" },
        ]}
      />,
    );
    expect(screen.getByText("Stalled")).toBeInTheDocument();
    expect(screen.getByText("12d")).toBeInTheDocument();
    expect(screen.getByText("Last contact")).toBeInTheDocument();
    expect(screen.getByText("2d ago")).toBeInTheDocument();
  });

  it("renders the secondary action and fires its handler", () => {
    const secondary = vi.fn();
    render(
      <NextStepCard
        label="Primary"
        onClick={() => {}}
        secondary={{ label: "Skip stage", onClick: secondary }}
      />,
    );
    const skip = screen.getByRole("button", { name: /skip stage/i });
    fireEvent.click(skip);
    expect(secondary).toHaveBeenCalledOnce();
  });

  it("uses the variant token class when variant is provided", () => {
    render(
      <NextStepCard
        label="Approve"
        variant="success"
        onClick={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /approve/i });
    expect(btn.className).toMatch(/bg-success/);
  });
});
