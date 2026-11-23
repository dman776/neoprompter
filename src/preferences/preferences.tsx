import { createRoot } from 'react-dom/client';
import '../operator/ui/theme.css';
import '../operator/ui/ui.css';
import './preferences.css';
import { Preferences } from './PreferencesWindow';

createRoot(document.getElementById('root')!).render(<Preferences bridge={window.neoprompter} />);
