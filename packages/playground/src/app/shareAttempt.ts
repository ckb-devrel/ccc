export type ShareAttempt = { id: string; source: string };

/** Remember an acknowledged publication only until its snapshot verifies. */
export async function verifyShareAttempt(
  source: string,
  previous: ShareAttempt | undefined,
  publish: (source: string) => Promise<string>,
  read: (id: string) => Promise<string | undefined>,
  remember: (attempt: ShareAttempt | undefined) => void,
) {
  let attempt = previous;
  if (!attempt) {
    // An explicit fresh publication abandons any older retry, even if the
    // new event never receives a relay acknowledgement.
    remember(undefined);
    attempt = { id: await publish(source), source };
    remember(attempt);
  }
  if ((await read(attempt.id)) !== attempt.source) {
    throw new Error("Published code could not be verified");
  }
  remember(undefined);
  return attempt.id;
}
