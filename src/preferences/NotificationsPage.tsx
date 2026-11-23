import { Row, Slider } from './controls';
import type { PageProps } from './categories';

export function NotificationsPage({ state, dispatch }: PageProps) {
  return (
    <Row
      title="Notification time"
      help="How long each Notification stays before it disappears. It applies to the next one."
    >
      <Slider
        label="Notification time"
        value={Math.round(state.notificationDurationMs / 1000)}
        min={1}
        max={60}
        step={1}
        unit=" s"
        onChange={(seconds) => dispatch({ type: 'setNotificationDuration', ms: seconds * 1000 })}
      />
    </Row>
  );
}
