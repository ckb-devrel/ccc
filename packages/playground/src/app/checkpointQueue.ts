export type CheckpointPosition = [number, number, number, number];

/** One queue per execution. Every checkpoint owns its completion and timer. */
export function createCheckpointQueue(
  autoPlay: boolean,
  onActive: (
    position: CheckpointPosition | undefined,
    advance?: () => void,
  ) => void,
) {
  type Checkpoint = {
    position: CheckpointPosition | undefined;
    resolve: () => void;
  };
  const pending: Checkpoint[] = [];
  let active: Checkpoint | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const showNext = () => {
    active = pending.shift();
    if (!active) {
      onActive(undefined);
      return;
    }
    const checkpoint = active;
    const advance = () => {
      if (closed || active !== checkpoint) {
        return;
      }
      clearTimeout(timer);
      timer = undefined;
      active = undefined;
      checkpoint.resolve();
      showNext();
    };
    onActive(checkpoint.position, advance);
    if (autoPlay) {
      timer = setTimeout(advance, 500);
    }
  };
  return {
    enqueue(position: CheckpointPosition | undefined) {
      if (closed) {
        return new Promise<void>(() => {});
      }
      return new Promise<void>((resolve) => {
        pending.push({ position, resolve });
        if (!active) {
          showNext();
        }
      });
    },
    dispose() {
      if (closed) {
        return;
      }
      closed = true;
      clearTimeout(timer);
      timer = undefined;
      // The top-level script has ended (or the view unmounted). Do not resume
      // detached async work or turn unawaited render() into an unhandled error.
      // Dropping references allows abandoned checkpoints to be collected.
      active = undefined;
      pending.length = 0;
    },
  };
}
