import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProductionBaselineFixture,
  BASELINE_SCOPE,
} from "@/lib/test-utils/version-two-production-fixture";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ currentRows: vi.fn(), execute: vi.fn() }));
vi.mock("@/db/repositories/scenes.repository", () => ({
  listCurrentScenes: state.currentRows,
}));
vi.mock("@/db/drizzle", () => ({
  getDatabase: () => ({ execute: state.execute }),
}));
import { updateScene } from "@/db/commands/scene-commands";

beforeEach(() => {
  state.currentRows.mockReset();
  state.execute.mockReset();
  state.execute.mockResolvedValue({ rows: [{ id: "revision" }] });
});
function setup() {
  const fixture = createProductionBaselineFixture();
  state.currentRows.mockResolvedValue(fixture.rows);
  const target = fixture.rows[1]!;
  return {
    fixture,
    input: {
      ...target.version,
      ...BASELINE_SCOPE,
      sceneId: target.scene.id,
      expectedVersion: 1,
    },
  };
}
describe("scene revision safety (mock database)", () => {
  it("saves unchanged content without writes or approval changes", async () => {
    const { fixture, input } = setup();
    const before = JSON.stringify(fixture.rows);
    expect(await updateScene(input)).toEqual({ changed: false });
    expect(state.execute).not.toHaveBeenCalled();
    expect(JSON.stringify(fixture.rows)).toBe(before);
  });
  it.each(["narrationText", "visualDescription", "continuityNotes"] as const)(
    "revises only the target for %s edits",
    async (field) => {
      const { fixture, input } = setup();
      const before = JSON.stringify(fixture.rows);
      expect(
        await updateScene({ ...input, [field]: "Revised content." }),
      ).toMatchObject({ changed: true });
      expect(state.execute).toHaveBeenCalledOnce();
      const statement: SQL = state.execute.mock.calls[0]![0];
      const query = new PgDialect().sqlToQuery(statement);
      expect(query.params).toContain(input.sceneId);
      for (const row of fixture.rows.slice(2)) {
        expect(query.params).not.toContain(row.scene.id);
        expect(query.params).not.toContain(row.version.id);
      }
      expect(query.sql).toContain("from claimed returning id");
      expect(query.sql).toContain("cast_row.stage_slot, cast_row.is_speaker");
      expect(JSON.stringify(fixture.rows)).toBe(before);
    },
  );
  it("rejects a stale no-op before writing", async () => {
    const { input } = setup();
    await expect(updateScene({ ...input, expectedVersion: 9 })).rejects.toThrow(
      "SCENE_REVISION_CONFLICT",
    );
    expect(state.execute).not.toHaveBeenCalled();
  });
  it("reports a lost optimistic claim", async () => {
    const { input } = setup();
    state.execute.mockResolvedValue({ rows: [] });
    await expect(
      updateScene({ ...input, narrationText: "Changed" }),
    ).rejects.toThrow("SCENE_REVISION_CONFLICT");
  });
  it("refuses a scene outside the authorized project result", async () => {
    const { input } = setup();
    state.currentRows.mockResolvedValue([]);
    await expect(updateScene(input)).rejects.toThrow("SCENE_REVISION_CONFLICT");
    expect(state.execute).not.toHaveBeenCalled();
  });
});
