import { calculateScriptStatistics } from "@/lib/domain/script-statistics";
import {
  fail,
  pass,
  warn,
  type GateResult,
} from "@/lib/production-runs/gates/gate-result";

/**
 * Whether a script is fit to be approved without a person reading it.
 *
 * What this checks is deliberately narrow: that there is a script, that it is
 * within the size the pipeline accepts, and that its estimated narration
 * length is near the brief's target. It does not judge writing quality or
 * factual accuracy; those remain a creator's call and a later model-backed
 * gate's, and nothing here claims otherwise.
 */
export function evaluateScriptGate(input: {
  content: string;
  maximumCharacters: number;
  targetDurationSeconds: number | null;
}): GateResult {
  const content = input.content.trim();
  if (content === "") return fail(["The script is empty."]);
  if (content.length > input.maximumCharacters)
    return fail([
      `The script is ${content.length.toLocaleString()} characters; the limit is ${input.maximumCharacters.toLocaleString()}.`,
    ]);

  const statistics = calculateScriptStatistics(content);
  const estimated = statistics.estimatedNarrationDurationSeconds;
  if (estimated < 15)
    return fail([
      `The script reads in about ${Math.round(estimated)} seconds, too short for a video.`,
    ]);

  const target = input.targetDurationSeconds;
  if (target === null || target <= 0) return pass([], 100);

  const ratio = estimated / target;
  const summary = `Estimated narration ${Math.round(estimated)}s against a ${target}s target.`;
  if (ratio < 0.5 || ratio > 2)
    return fail([
      `${summary} That is too far from the brief to accept unseen.`,
    ]);
  if (ratio < 0.75 || ratio > 1.4)
    return warn([summary], Math.round(100 - Math.abs(1 - ratio) * 100));
  return pass([summary], Math.round(100 - Math.abs(1 - ratio) * 100));
}
