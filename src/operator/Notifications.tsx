import type { Command, Notification } from '../core';

interface NotificationsProps {
  notifications: Notification[];
  dispatch: (command: Command) => void;
}

/**
 * Notifications from the Producer, drawn as an overlay over the content. The overlay is
 * `position: fixed`, so showing or dismissing one never moves or resizes the layout. The core
 * owns the list and the auto-disappear timer; this only renders it and sends Dismiss.
 */
export function Notifications({ notifications, dispatch }: NotificationsProps) {
  return (
    <div className="notifications" data-testid="notifications" aria-live="polite">
      {notifications.map((n) => (
        <div className="notification" role="status" key={n.id}>
          <span className="notification-source">From the Producer</span>
          <span className="notification-text">{n.text}</span>
          <button
            type="button"
            className="notification-dismiss"
            onClick={() => dispatch({ type: 'dismissNotification', id: n.id })}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
