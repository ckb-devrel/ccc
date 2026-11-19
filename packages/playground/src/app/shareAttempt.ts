export type ShareAttempt = { id: string; source: string };

/** Retry an acknowledged publication's read-back without publishing it again. */
export async function verifyShareAttempt(
  source: string,
  previous: ShareAttempt | undefined,
  publish: (source: string) => Promise<string>,
  read: (id: string) => Promise<string | undefined>,
  remember: (attempt: ShareAttempt) => void,
) {
  const attempt = previous ?? { id: await publish(source), source };
  remember(attempt);
  if ((await read(attempt.id)) !== attempt.source) {
    throw new Error("Published code could not be verified");
  }
  return attempt.id;
}
