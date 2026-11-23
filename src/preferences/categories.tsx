import type { ComponentType } from 'react';
import type { Command, CoreState } from '../core';
import type { PreferencesBridge } from '../operator/useCoreState';
import { AppearanceSample, ColorsTab, PresetsTab, ReadingLineTab, TextTab } from './AppearancePage';
import { ControlsPage } from './ControlsPage';
import { GeneralPage } from './GeneralPage';
import { ConnectionTab, QuickMessagesTab } from './NetworkPage';
import { NotificationsPage } from './NotificationsPage';
import { OutputPage } from './OutputPage';

/** What every category page receives: the core state and a way to send commands. */
export interface PageProps {
  state: CoreState;
  /** For what only the main process knows (the displays); most pages just dispatch. */
  bridge: PreferencesBridge;
  dispatch: (command: Command) => void;
}

/** One tab of a category: its label in the tab strip and the settings it shows. */
export interface Tab {
  id: string;
  label: string;
  Page: ComponentType<PageProps>;
}

export interface Category {
  id: string;
  label: string;
  /** Short line under the category's title. */
  subtitle: string;
  /** The category's settings, when it has no tabs. Omitted until it has some: a placeholder shows. */
  Page?: ComponentType<PageProps>;
  /**
   * The category's settings split into tabs, so none of them needs scrolling. A category has
   * either `tabs` or a single `Page`.
   */
  tabs?: Tab[];
  /** Stays fixed under the title, above the tabs (Appearance pins its sample here). */
  Pinned?: ComponentType<{ state: CoreState }>;
}

/**
 * The Preferences categories, in navigation order. To fill a category, set its `Page` (or its
 * `tabs`): that is the only change needed.
 */
export const CATEGORIES: Category[] = [
  { id: 'general', label: 'General', subtitle: 'Theme and startup', Page: GeneralPage },
  {
    id: 'appearance',
    label: 'Appearance',
    subtitle: 'What the Talent sees',
    Pinned: AppearanceSample,
    tabs: [
      { id: 'text', label: 'Text', Page: TextTab },
      { id: 'colors', label: 'Colors', Page: ColorsTab },
      { id: 'reading-line', label: 'Reading line', Page: ReadingLineTab },
      { id: 'presets', label: 'Presets', Page: PresetsTab },
    ],
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
    tabs: [
      { id: 'connection', label: 'Connection', Page: ConnectionTab },
      { id: 'quick-messages', label: 'Quick messages', Page: QuickMessagesTab },
    ],
  },
];
