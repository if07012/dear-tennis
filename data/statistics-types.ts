// ============================================
// STATISTICS TYPES
// ============================================
// Schema for the admin-editable "Statistics" strip on the home page. The
// section has no heading — it's a fixed banner — so only items are persisted.
//
// Sheet schema (created on first save):
//   statistics_items: id,value,label,suffix,order,createdAt

export type Statistic = {
  id: string;
  value: number;
  label: string;
  suffix?: string;
  order: number;
  createdAt?: string;
};

export type StatisticsContent = {
  items: Statistic[];
};

export const STATISTICS_ITEM_HEADERS = [
  'id',
  'value',
  'label',
  'suffix',
  'order',
  'createdAt',
] as const;