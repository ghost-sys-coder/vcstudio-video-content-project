import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/db/drizzle", () => ({
  getDatabase: () => ({ execute: state.execute }),
}));

import { createManualScene } from "./create-manual-scene";

const input = {
  workspaceId: "3d54e162-c9ce-4367-bae2-e6dcc97cdac5",
  projectId: "cd07cfe2-dd66-4d79-895b-1f5c31dc6268",
  userId: "fb0c5519-4cbc-488b-9386-c0e2ac0d143f",
  narrationText: "Start with an emergency fund.",
  visualDescription: "A savings chart.",
  locationDescription: "Desk",
  actionDescription: "The balance increases.",
  cameraShot: "wide",
  cameraAngle: "eye level",
  cameraMotion: "static",
  emotionalTone: "calm",
  characterNames: [],
  propNames: ["chart"],
  continuityNotes: "",
  estimatedDurationMilliseconds: 10000,
};

beforeEach(() => state.execute.mockReset());

describe("manual scene creation command", () => {
  it("writes a scene and its first version in one tenant-scoped statement", async () => {
    state.execute.mockResolvedValue({ rows: [{ scene_number: 1 }] });
    await expect(createManualScene(input)).resolves.toMatchObject({
      sceneNumber: 1,
    });
    expect(state.execute).toHaveBeenCalledOnce();
    const query = new PgDialect().sqlToQuery(
      state.execute.mock.calls[0]![0] as SQL,
    );
    expect(query.sql).toContain("insert into scenes");
    expect(query.sql).toContain("insert into scene_versions");
    expect(query.sql).toContain("for update");
    expect(query.sql).toContain("on conflict do nothing");
    expect(query.params).toContain(input.workspaceId);
    expect(query.params).toContain(input.projectId);
    expect(query.params).toContain(input.userId);
    expect(query.params).toContain(input.narrationText);
  });

  it("retries a numbering conflict without duplicating a version", async () => {
    state.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ scene_number: 2 }] });
    await expect(createManualScene(input)).resolves.toMatchObject({
      sceneNumber: 2,
    });
    expect(state.execute).toHaveBeenCalledTimes(2);
  });
});
