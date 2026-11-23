import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import './ui/ui.css';
import './shell.css';
import './editor.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App bridge={window.neoprompter} />);
