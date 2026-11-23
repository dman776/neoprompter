import { createRoot } from 'react-dom/client';
import '../operator/ui/theme.css';
import '../operator/ui/ui.css';
import { Panel } from '../operator/ui/Panel';

// Placeholder: the Preferences categories arrive in later tickets.
createRoot(document.getElementById('root')!).render(
  <Panel title="Preferences">
    <p>General, Appearance, Output, Controls, Notifications and Network.</p>
  </Panel>,
);
