export function dispatchEmailInBackground(task: () => Promise<void>) {
  // We dispatch after the primary HR mutation succeeds so notification
  // delivery never rolls back a successful business action.
  setTimeout(() => {
    void task();
  }, 0);
}
