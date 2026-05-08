export function dispatchCalendarSyncInBackground(task: () => Promise<void>) {
  // Calendar sync runs after approval succeeds so Graph failures never roll
  // back the PTO workflow.
  setTimeout(() => {
    void task();
  }, 0);
}
