// Shared layout and interaction defaults for the table editor.
export const TABLE_CONFIG = Object.freeze({
  defaultColumnWidth: 144,
  reconciledColumnWidth: 110,
  minGeneratedColumnWidth: 120,
  minColumnWidth: 48,
  minRowHeight: 28,
  resizeGripZone: 10,
  defaultRowHeight: 28,
  maxWidgetHeight: 450,
  rowHeightEstimate: 35,
  widgetHeightPadding: 80,
  fallbackTablePositionOffset: 10,
  scrollOffset: Object.freeze({ vertical: 10, horizontal: 16 }),
  interactionDelayMs: Object.freeze({
    renameFocus: 10,
    selectAll: 50,
    submenuClose: 150,
    copiedNotice: 1500
  }),
  parser: Object.freeze({ growthThreshold: 8192, tickBudgetMs: 30 })
})
