import { useSyncExternalStore } from "react";

const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};
export function useOnlineStatus() {
  // This is a browser connectivity hint, not proof that the API is healthy.
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
