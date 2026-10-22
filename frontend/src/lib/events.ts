// Fired after a reply is resolved or reopened, so the nav badge refreshes at once
// instead of waiting for its next poll.
export const REPLIES_CHANGED = "itoni:replies-changed";

export function notifyRepliesChanged(): void {
  window.dispatchEvent(new Event(REPLIES_CHANGED));
}
