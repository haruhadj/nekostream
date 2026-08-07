/**
 * The new-episode email. Message building is pure and separate from sending
 * so it can be tested without a network — see notify.test.ts.
 */

import { sendMail } from "@/lib/email/mailer";
import { env } from "@/lib/env";

export function newEpisodeEmail({
  titleRomaji,
  episodeNumber,
  libraryEntryId,
}: {
  titleRomaji: string;
  episodeNumber: number;
  libraryEntryId: string;
}): { subject: string; text: string } {
  const origin = env.PUBLIC_URL ?? env.BETTER_AUTH_URL;

  return {
    subject: `${titleRomaji} — episode ${episodeNumber} is out`,
    text: `Episode ${episodeNumber} of ${titleRomaji} just showed up in your Nyaa feed.\n\n${origin}/anime/${libraryEntryId}`,
  };
}

/** Sent once per armed poll — see the `found` branch in lib/airing/poller.ts. */
export async function notifyNewEpisode({
  to,
  titleRomaji,
  episodeNumber,
  libraryEntryId,
}: {
  to: string;
  titleRomaji: string;
  episodeNumber: number;
  libraryEntryId: string;
}): Promise<void> {
  const { subject, text } = newEpisodeEmail({
    titleRomaji,
    episodeNumber,
    libraryEntryId,
  });

  await sendMail({ to, subject, text });
}
