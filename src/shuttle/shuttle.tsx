import { createRoot } from 'react-dom/client';
import '../operator/ui/theme.css';
import '../operator/ui/ui.css';
import './shuttle.css';
import { VirtualShuttle } from './VirtualShuttle';

createRoot(document.getElementById('root')!).render(<VirtualShuttle bridge={window.neoprompter} />);
