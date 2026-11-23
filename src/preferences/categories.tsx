import type { ComponentType } from 'react';
import type { Command, CoreState } from '../core';
import { AppearancePage } from './AppearancePage';

/** What every category page receives: the core state and a way to send commands. */
export interface PageProps {
  state: CoreState;
  dispatch: (command: Command) => void;
}

export interface Category {
  id: string;
  label: string;
  /** Short line under the category's title. */
  subtitle: string;
  /** The category's settings. Omitted until the category has some: a placeholder shows instead. */
  Page?: ComponentType<PageProps>;
}

/**
 * The Preferences categories, in navigation order. To fill a category, set its `Page`: that is
 * the only change needed.
 */
export const CATEGORIES: Category[] = [
  { id: 'general', label: 'General', subtitle: 'Theme and startup' },
  {
    id: 'appearance',
    label: 'Appearance',
    subtitle: 'What the Talent sees',
    Page: AppearancePage,
  },
  { id: 'output', label: 'Output', subtitle: 'Where the Output appears' },
  { id: 'controls', label: 'Controls', subtitle: 'ShuttleXPress buttons' },
  { id: 'notifications', label: 'Notifications', subtitle: 'How long a Notification shows' },
  { id: 'network', label: 'Network', subtitle: 'The Producer page and Companion' },
];
