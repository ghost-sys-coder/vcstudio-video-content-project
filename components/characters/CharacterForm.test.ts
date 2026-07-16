import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Character } from "@/db/schema";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  updateCharacter: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  let stateCall = 0;
  return {
    ...react,
    useState: () => {
      stateCall += 1;
      return [null, stateCall % 2 === 1 ? mocks.setError : mocks.setSuccess];
    },
    useRef: () => ({ current: null }),
    useTransition: () => [
      false,
      (callback: () => Promise<void>) => void callback(),
    ],
  };
});

vi.mock("@/app/(authenticated)/app/characters/actions", () => ({
  createCharacterAction: vi.fn(),
  updateCharacterAction: mocks.updateCharacter,
}));

import { CharacterForm } from "@/components/characters/CharacterForm";

const character: Character = {
  id: "00000000-0000-4000-8000-000000000001",
  workspaceId: "00000000-0000-4000-8000-000000000002",
  name: "Amina",
  slug: "amina",
  description: "",
  visualIdentity: "",
  bodyProportions: "",
  faceDescription: "",
  hairDescription: "",
  skinToneDescription: "",
  defaultOutfitDescription: "",
  personalityNotes: "",
  continuityRules: "",
  negativeConstraints: "",
  status: "draft",
  createdByUserId: "00000000-0000-4000-8000-000000000003",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("CharacterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirms a successful character update and refreshes its data", async () => {
    mocks.updateCharacter.mockResolvedValue({ success: true, error: null });
    const onSuccess = vi.fn();
    const form = CharacterForm({ character, onSuccess });

    form.props.action(new FormData());
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());

    expect(mocks.setSuccess).toHaveBeenLastCalledWith(
      "Character saved successfully.",
    );
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("shows an update error without refreshing stale data", async () => {
    mocks.updateCharacter.mockResolvedValue({
      success: false,
      error: "The character could not be updated.",
    });
    const form = CharacterForm({ character });

    form.props.action(new FormData());
    await vi.waitFor(() =>
      expect(mocks.setError).toHaveBeenLastCalledWith(
        "The character could not be updated.",
      ),
    );

    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
