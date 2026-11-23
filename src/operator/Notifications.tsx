import { NOTIFICATION_PALETTE, type Command, type Notification } from '../core';

interface NotificationsProps {
  notifications: Notification[];
  dispatch: (command: Command) => void;
}

/** A colored Notification fills the banner with its palette color and a readable text color. */
function colorStyle(n: Notification): React.CSSProperties | undefined {
  const c = NOTIFICATION_PALETTE.find((p) => p.name === n.color);
  return c ? { background: c.bg, color: c.fg } : undefined;
}

/**
 * Notifications, drawn as an overlay over the content. The overlay is
 * `position: fixed`, so showing or dismissing one never moves or resizes the layout. The core
 * owns the list and the auto-disappear timer; this only renders it and sends Dismiss.
 */
export function Notifications({ notifications, dispatch }: NotificationsProps) {
  return (
    <div className="notifications" data-testid="notifications" aria-live="polite">
      {notifications.map((n) => (
        <div
          className="notification"
          role="status"
          key={n.id}
          data-color={n.color}
          style={colorStyle(n)}
        >
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
