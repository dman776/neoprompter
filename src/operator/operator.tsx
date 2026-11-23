import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import './ui/ui.css';
import './ui/key.css';
import './run.css';
import './lock.css';
import './shell.css';
import './editor.css';
import './library.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App bridge={window.neoprompter} />);
