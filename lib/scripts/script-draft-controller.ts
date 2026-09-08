import type {
  ScriptDraftResult,
  ScriptDraftSnapshot,
} from "./script-draft-contract";
import type {
  ScriptRecoveryStore,
  ScriptRecoveryRecord,
} from "./script-recovery";

export interface ScriptDraftState {
  content: string;
  savedContent: string;
  revision: number;
  status: "saved" | "unsaved" | "saving" | "error" | "conflict" | "recovery";
  approving: boolean;
  saving: boolean;
  error: string | null;
  remote: ScriptDraftSnapshot | null;
  recovery: ScriptRecoveryRecord | null;
  generated: string | null;
  storageWarning: boolean;
  approved: boolean;
}

/** Serializes autosave, explicit saves and approval; incoming replies never replace new typing. */
export class ScriptDraftController {
  private state: ScriptDraftState;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | null = null;
  private stopped = false;
  private recoveryStore: ScriptRecoveryStore | null = null;
  constructor(
    private options: {
      initial: ScriptDraftSnapshot;
      canEdit: boolean;
      maximumCharacters: number;
      persist: (
        input: ScriptDraftSnapshot & { approve: boolean },
      ) => Promise<ScriptDraftResult>;
      approved: () => void;
    },
  ) {
    this.state = {
      ...options.initial,
      savedContent: options.initial.content,
      status: "saved",
      approving: false,
      saving: false,
      error: null,
      remote: null,
      recovery: null,
      generated: null,
      storageWarning: false,
      approved: false,
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private patch(patch: Partial<ScriptDraftState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  start(store: ScriptRecoveryStore | null) {
    this.stopped = false;
    this.recoveryStore = store;
    if (!this.options.canEdit) return;
    const recovery = store?.read();
    if (recovery && recovery.content !== this.state.content)
      this.patch({ recovery, status: "recovery" });
    else if (recovery) store?.clear();
    if (!store) this.patch({ storageWarning: true });
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
  private retain() {
    if (this.stopped || !this.options.canEdit) return;
    if (this.state.content === this.state.savedContent && !this.inFlight)
      this.recoveryStore?.clear();
    else if (
      !this.recoveryStore?.write({
        content: this.state.content,
        revision: this.state.revision,
      })
    )
      this.patch({ storageWarning: true });
  }
  private schedule() {
    clearTimeout(this.timer);
    if (
      !this.stopped &&
      this.state.status === "unsaved" &&
      !this.state.approving
    )
      this.timer = setTimeout(() => {
        void this.save();
      }, 1000);
  }
  edit(content: string) {
    if (!this.options.canEdit || this.state.approving || this.state.recovery)
      return;
    this.patch({
      content,
      approved: false,
      status: this.state.remote
        ? "conflict"
        : content === this.state.savedContent
          ? "saved"
          : "unsaved",
      error: null,
    });
    this.retain();
    this.schedule();
  }
  offerGenerated(content: string) {
    if (!this.options.canEdit || this.state.approving) return;
    // Always stage replacement, including while a save is in flight.
    this.patch({ generated: content });
  }
  acceptGenerated() {
    const content = this.state.generated;
    this.patch({ generated: null });
    if (content !== null) this.edit(content);
  }
  dismissGenerated() {
    this.patch({ generated: null });
  }
  recover() {
    const recovery = this.state.recovery;
    if (!recovery) return;
    const remote = {
      content: this.state.savedContent,
      revision: this.state.revision,
    };
    this.patch({
      recovery: null,
      content: recovery.content,
      revision: recovery.revision,
      remote: recovery.revision === remote.revision ? null : remote,
      status: recovery.revision === remote.revision ? "unsaved" : "conflict",
    });
    this.retain();
    this.schedule();
  }
  discard() {
    if (this.inFlight || this.state.approving) return;
    const remote = this.state.remote ?? {
      content: this.state.savedContent,
      revision: this.state.revision,
    };
    this.patch({
      ...remote,
      savedContent: remote.content,
      status: "saved",
      remote: null,
      recovery: null,
      error: null,
      generated: null,
    });
    this.recoveryStore?.clear();
    clearTimeout(this.timer);
  }
  keepLocalOverRemote() {
    if (!this.state.remote) return;
    this.patch({
      revision: this.state.remote.revision,
      savedContent: this.state.remote.content,
      remote: null,
      status: "unsaved",
      error: null,
    });
    this.retain();
    this.schedule();
  }
  async save(approve = false): Promise<void> {
    if (
      !this.options.canEdit ||
      this.stopped ||
      this.state.recovery ||
      this.state.remote
    )
      return;
    if (!approve && (this.inFlight || this.state.approving)) return;
    if (approve && this.state.approving) return;
    clearTimeout(this.timer);
    if (approve) this.patch({ approving: true });
    if (this.inFlight) {
      await this.inFlight;
      if (this.stopped || this.state.remote || this.state.status === "error") {
        this.patch({ approving: false });
        return;
      }
    }
    if (
      !approve &&
      this.state.content === this.state.savedContent &&
      this.state.status !== "error"
    )
      return;
    if (
      this.state.content.length > this.options.maximumCharacters ||
      (approve && !this.state.content.trim())
    ) {
      this.patch({
        status: "error",
        approving: false,
        error:
          "Use a non-empty script within the character limit before approval.",
      });
      return;
    }
    const submitted = {
      content: this.state.content,
      revision: this.state.revision,
      approve,
    };
    this.patch({ status: "saving", saving: true, error: null });
    const request = (async () => {
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          this.options.persist(submitted),
          new Promise<ScriptDraftResult>((resolve) => {
            deadline = setTimeout(
              () =>
                resolve({
                  status: "error",
                  message:
                    "Save confirmation timed out. Your writing is kept here. Retry to check the server revision.",
                }),
              15_000,
            );
          }),
        ]);
        if (this.stopped) return;
        if (result.status === "saved") {
          this.patch({
            revision: result.draft.revision,
            savedContent: result.draft.content,
            status:
              this.state.content === result.draft.content ? "saved" : "unsaved",
            approved: Boolean(result.approvedVersionId),
          });
          this.retain();
          if (result.approvedVersionId) this.options.approved();
        } else if (result.status === "conflict")
          this.patch({
            status: "conflict",
            remote: result.draft,
            error:
              "Another session saved newer text. Compare both drafts before choosing.",
          });
        else this.patch({ status: "error", error: result.message });
      } catch {
        if (!this.stopped)
          this.patch({
            status: "error",
            error:
              "Connection interrupted. Your writing is kept here; retry when connected.",
          });
      } finally {
        clearTimeout(deadline);
      }
    })();
    this.inFlight = request;
    await request;
    if (this.inFlight === request) this.inFlight = null;
    this.patch({ saving: false });
    if (this.state.status !== "error") this.retain();
    if (approve) this.patch({ approving: false });
    this.schedule();
  }
}
