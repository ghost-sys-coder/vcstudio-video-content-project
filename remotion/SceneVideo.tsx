import {
  AbsoluteFill,
  Freeze,
  Loop,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
} from "remotion";
import type { VideoCompositionScene } from "@/lib/render/video-composition-data";
/** One muted visual plate. Narration and captions remain independent tracks. */
export function SceneVideo({
  video,
}: {
  video: NonNullable<VideoCompositionScene["video"]>;
}) {
  const frame = useCurrentFrame() + (video.sourceOffsetFrames ?? 0);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <Sequence from={-(video.sourceOffsetFrames ?? 0)}>
        {video.loop ? (
          <Loop durationInFrames={video.durationFrames}>
            <OffthreadVideo
              src={video.url}
              muted
              trimBefore={video.trimBeforeFrames}
              pauseWhenBuffering
              style={{ width: "100%", height: "100%", objectFit: video.fit }}
            />
          </Loop>
        ) : (
          <Freeze
            frame={video.durationFrames - 1}
            active={frame >= video.durationFrames}
          >
            <OffthreadVideo
              src={video.url}
              muted
              trimBefore={video.trimBeforeFrames}
              pauseWhenBuffering
              style={{ width: "100%", height: "100%", objectFit: video.fit }}
            />
          </Freeze>
        )}
      </Sequence>
    </AbsoluteFill>
  );
}
