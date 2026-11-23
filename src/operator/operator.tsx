import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import './ui/ui.css';
import './ui/key.css';
import './run.css';
import './shell.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App bridge={window.neoprompter} />);
