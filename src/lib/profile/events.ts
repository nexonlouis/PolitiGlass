export const PROFILE_UPDATED_EVENT = "civicmirror:profile-updated";

export function notifyProfileUpdated(detail?: { username?: string }) {
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail }));
}
