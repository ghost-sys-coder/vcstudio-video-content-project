import { describe, expect, it, vi } from "vitest";
import { AnalyzeScriptButton } from "@/components/scenes/AnalyzeScriptButton";

describe("AnalyzeScriptButton", () => {
  it("forwards dialog trigger props to the underlying button", () => {
    const onClick = vi.fn();
    const button = AnalyzeScriptButton({
      "aria-expanded": false,
      disabled: false,
      onClick,
    });

    expect(button.props.onClick).toBe(onClick);
    expect(button.props["aria-expanded"]).toBe(false);
    expect(button.props.type).toBe("button");
  });
});
