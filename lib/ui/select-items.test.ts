import { createElement, Fragment } from "react";
import { describe, expect, it } from "vitest";
import {
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
} from "@/components/ui/select";
import { readSelectItems } from "./select-items";

describe("select labels before the popup opens", () => {
  it("reads empty values, groups, fragments and conditional items in order", () => {
    const children = [
      createElement(SelectItem, { value: "", key: "empty" }, "No selection"),
      createElement(
        SelectGroup,
        { key: "group" },
        createElement(SelectGroupLabel, {}, "Group label"),
        createElement(SelectItem, { value: "24" }, "24 frames per second"),
      ),
      createElement(
        Fragment,
        { key: "fragment" },
        false,
        null,
        createElement(SelectItem, { value: "alpha" }, "Alpha"),
      ),
    ];
    expect(readSelectItems(children)).toEqual([
      { value: "", label: "No selection" },
      { value: "24", label: "24 frames per second" },
      { value: "alpha", label: "Alpha" },
    ]);
  });
});
