import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../operator/ui/theme.css';
import '../operator/ui/ui.css';
import { Panel } from '../operator/ui/Panel';
import { useCoreState } from '../operator/useCoreState';

// Placeholder: the ring, jog wheel and buttons arrive in a later ticket.
function Shuttle() {
  // Shows the theme the Operator chose.
  const theme = useCoreState(window.neoprompter)?.theme;
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <Panel title="Virtual shuttle">
      <p>The Virtual shuttle arrives here.</p>
    </Panel>
  );
}

createRoot(document.getElementById('root')!).render(<Shuttle />);
