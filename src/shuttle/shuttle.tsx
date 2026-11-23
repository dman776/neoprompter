import { createRoot } from 'react-dom/client';
import '../operator/ui/theme.css';
import '../operator/ui/ui.css';
import { Panel } from '../operator/ui/Panel';

// Placeholder: the ring, jog wheel and buttons arrive in a later ticket.
createRoot(document.getElementById('root')!).render(
  <Panel title="Virtual shuttle">
    <p>The Virtual shuttle arrives here.</p>
  </Panel>,
);
