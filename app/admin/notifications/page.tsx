import { canCurrentUserManageNotifications } from "../../../lib/auth/access";
import NotificationsAdminClient from "./NotificationsAdminClient";

export default async function NotificationsAdminPage() {
  const allowed = await canCurrentUserManageNotifications();

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to notification status.
      </div>
    );
  }

  return <NotificationsAdminClient />;
}
