import { createRoot } from 'react-dom/client';
import '../operator/ui/theme.css';
import '../operator/ui/ui.css';
import { Panel } from '../operator/ui/Panel';
import { useCoreState } from '../operator/useCoreState';
import { useTheme } from '../operator/ui/useTheme';

// Placeholder: the ring, jog wheel and buttons arrive in a later ticket.
function Shuttle() {
  // Shows the theme the Operator chose.
  useTheme(useCoreState(window.neoprompter)?.theme);
  return (
    <Panel title="Virtual shuttle">
      <p>The Virtual shuttle arrives here.</p>
    </Panel>
  );
}

createRoot(document.getElementById('root')!).render(<Shuttle />);
