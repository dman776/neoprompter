import type { ComponentType } from 'react';
import type { Command, CoreState } from '../core';
import type { PreferencesBridge } from '../operator/useCoreState';
import { AppearancePage, AppearanceSample } from './AppearancePage';
import { ControlsPage } from './ControlsPage';
import { GeneralPage } from './GeneralPage';
import { NetworkPage } from './NetworkPage';
import { NotificationsPage } from './NotificationsPage';
import { OutputPage } from './OutputPage';

/** What every category page receives: the core state and a way to send commands. */
export interface PageProps {
  state: CoreState;
  /** For what only the main process knows (the displays); most pages just dispatch. */
  bridge: PreferencesBridge;
  dispatch: (command: Command) => void;
}

export interface Category {
  id: string;
  label: string;
  /** Short line under the category's title. */
  subtitle: string;
  /** The category's settings. Omitted until the category has some: a placeholder shows instead. */
  Page?: ComponentType<PageProps>;
  /** Stays fixed under the title while the settings scroll (Appearance pins its sample here). */
  Pinned?: ComponentType<{ state: CoreState }>;
}

/**
 * The Preferences categories, in navigation order. To fill a category, set its `Page`: that is
 * the only change needed.
 */
export const CATEGORIES: Category[] = [
  { id: 'general', label: 'General', subtitle: 'Theme and startup', Page: GeneralPage },
  {
    id: 'appearance',
    label: 'Appearance',
    subtitle: 'What the Talent sees',
    Page: AppearancePage,
    Pinned: AppearanceSample,
  },
  { id: 'output', label: 'Output', subtitle: 'Where the Output appears', Page: OutputPage },
  {
    id: 'controls',
    label: 'Controls',
    subtitle: 'ShuttleXPress buttons',
    Page: ControlsPage,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    subtitle: 'How long a Notification shows',
    Page: NotificationsPage,
  },
  {
    id: 'network',
    label: 'Network',
    subtitle: 'The Producer page and Companion',
    Page: NetworkPage,
  },
];
