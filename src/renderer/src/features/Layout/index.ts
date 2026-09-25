/**
 * =========================================================================
 * Layout Feature Barrel (`index.ts`)
 * =========================================================================
 *
 * Clean architectural barrel exporting the core application layout components:
 * MainLayout, TitleBar, TabBar, TabContentPane, StatusBar, AppModals,
 * and their strongly-typed TypeScript interfaces.
 * =========================================================================
 */

export { TitleBar } from './TitleBar'
export type { TitleBarProps } from './TitleBar'

export { TabBar } from './TabBar'
export type { TabBarProps } from './TabBar'

export { TabContentPane } from './TabContentPane'
export type { TabContentPaneProps } from './TabContentPane'

export { StatusBar } from './StatusBar'
export type { StatusBarProps } from './StatusBar'

export { MainLayout } from './MainLayout'
export { default as AppModals } from './AppModals'
