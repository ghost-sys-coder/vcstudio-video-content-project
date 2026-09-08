import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  ScriptDraftController,
  ScriptDraftState,
} from "@/lib/scripts/script-draft-controller";

export function ScriptDraftNotices({
  state,
  controller,
}: {
  state: ScriptDraftState;
  controller: ScriptDraftController;
}) {
  return (
    <div className="space-y-3">
      {state.storageWarning ? (
        <p role="alert" className="text-sm text-amber-700">
          Local recovery is unavailable or full. Keep this tab open until the
          server confirms your changes are saved.
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.recovery ? (
        <section
          className="space-y-2 rounded-md border p-3"
          aria-label="Recover unsaved script"
        >
          <p>
            An unsaved local draft was found. Review it before restoring or
            discarding it.
          </p>
          <Textarea
            aria-label="Recoverable script"
            readOnly
            value={state.recovery.content}
          />
          <Button onClick={() => controller.recover()} type="button">
            Recover local draft
          </Button>{" "}
          <Button
            onClick={() => controller.discard()}
            type="button"
            variant="outline"
          >
            Discard local recovery
          </Button>
        </section>
      ) : null}
      {state.remote ? (
        <section
          className="space-y-2 rounded-md border p-3"
          aria-label="Resolve script conflict"
        >
          <p>
            Your writing is in the editor above. The newer server draft is
            below. Choosing your draft will replace that server text only if its
            revision is still current.
          </p>
          <Textarea
            aria-label="Newer server script"
            readOnly
            value={state.remote.content}
          />
          <Button
            onClick={() => controller.keepLocalOverRemote()}
            type="button"
          >
            Use my draft over this server revision
          </Button>{" "}
          <Button
            onClick={() => controller.discard()}
            type="button"
            variant="outline"
          >
            Discard mine and use server draft
          </Button>
        </section>
      ) : null}
      {state.generated ? (
        <section
          className="space-y-2 rounded-md border p-3"
          aria-label="Review generated replacement"
        >
          <p>
            Review the generated script before replacing the editor text.
            Existing saved versions remain in history.
          </p>
          <Textarea
            aria-label="Generated replacement script"
            readOnly
            value={state.generated}
          />
          <Button
            disabled={Boolean(state.recovery) || state.approving}
            onClick={() => controller.acceptGenerated()}
            type="button"
          >
            Replace editor with generated script
          </Button>{" "}
          <Button
            onClick={() => controller.dismissGenerated()}
            type="button"
            variant="outline"
          >
            Keep my writing
          </Button>
        </section>
      ) : null}
    </div>
  );
}
