import { describe, expect, it } from "vitest";
import {
  createProjectSchema,
  createScriptContentSchema,
  projectListQuerySchema,
} from "@/lib/schemas/project";

const validProject = {
  name: "Launch video",
  description: "A short product launch",
  aspectRatio: "16:9",
  framesPerSecond: 30,
  language: "English",
  maximumBudgetCents: 200,
};

describe("project validation", () => {
  it("accepts a valid project budget", () => {
    expect(createProjectSchema.safeParse(validProject).success).toBe(true);
  });

  it("rejects negative and excessive budgets", () => {
    expect(
      createProjectSchema.safeParse({
        ...validProject,
        maximumBudgetCents: -1,
      }).success,
    ).toBe(false);
    expect(
      createProjectSchema.safeParse({
        ...validProject,
        maximumBudgetCents: 100001,
      }).success,
    ).toBe(false);
  });

  it("bounds pagination inputs", () => {
    expect(projectListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 12 });
    expect(
      projectListQuerySchema.safeParse({ page: 1, pageSize: 51 }).success,
    ).toBe(false);
  });

  it("enforces the configured script length", () => {
    expect(createScriptContentSchema(5).safeParse("12345").success).toBe(true);
    expect(createScriptContentSchema(5).safeParse("123456").success).toBe(
      false,
    );
  });
});
