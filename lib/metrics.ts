/**
 * One config per metric. The six staff forms are generated from this rather
 * than hand-written, which is why there is a single /log/[metric] route instead
 * of six near-identical form functions.
 */

export type Field =
  | { kind: 'date'; name: string; label: string }
  | { kind: 'datetime'; name: string; label: string }
  | { kind: 'stepper'; name: string; label: string; min?: number; max?: number }
  | { kind: 'number'; name: string; label: string; placeholder?: string }
  | { kind: 'text'; name: string; label: string; placeholder?: string; optional?: boolean }
  | { kind: 'select'; name: string; label: string; options: string[] }
  | { kind: 'staff'; name: string; label: string }
  | { kind: 'generator'; name: string; label: string };

export type MetricConfig = {
  slug: string;
  label: string;
  table: string;
  accent: string;
  icon: string;
  fields: Field[];
  /** Live readout under the form, e.g. computed gallons. */
  derived?: (v: Record<string, string>) => string | null;
};

export const METRICS: Record<string, MetricConfig> = {
  garbage: {
    slug: 'garbage',
    label: 'Garbage',
    table: 'garbage_pickups',
    accent: '#047857',
    icon: '🗑',
    fields: [
      { kind: 'date', name: 'occurred_on', label: 'Date' },
      { kind: 'select', name: 'shift', label: 'Shift', options: ['Morning', 'Afternoon', 'Night'] },
      { kind: 'stepper', name: 'collections', label: 'Number of collections', min: 1, max: 50 },
    ],
  },
  water: {
    slug: 'water',
    label: 'Waste Water',
    table: 'wastewater_trips',
    accent: '#0369a1',
    icon: '💧',
    fields: [
      { kind: 'date', name: 'occurred_on', label: 'Date' },
      { kind: 'select', name: 'tank_capacity', label: 'Tank capacity', options: ['5000', '10000'] },
      { kind: 'stepper', name: 'trips', label: 'Number of trips', min: 1, max: 50 },
    ],
    derived: (v) =>
      `${(Number(v.tank_capacity || 0) * Number(v.trips || 0)).toLocaleString('en-US')} gal`,
  },
  fuel: {
    slug: 'fuel',
    label: 'Fuel',
    table: 'fuel_receipts',
    accent: '#b45309',
    icon: '⛽',
    fields: [
      { kind: 'date', name: 'occurred_on', label: 'Date' },
      { kind: 'select', name: 'fuel_type', label: 'Fuel type', options: ['Gas', 'Diesel'] },
      { kind: 'number', name: 'start_meter', label: 'Start meter', placeholder: '0' },
      { kind: 'number', name: 'end_meter', label: 'End meter', placeholder: '0' },
      { kind: 'staff', name: 'received_by', label: 'Who received the delivery' },
      { kind: 'text', name: 'delivery_note_no', label: 'Delivery note no.', optional: true },
    ],
    derived: (v) => {
      const net = Number(v.end_meter || 0) - Number(v.start_meter || 0);
      if (net < 0) return '⚠ End meter is below start meter';
      return `${net.toLocaleString('en-US')} units`;
    },
  },
  purchase: {
    slug: 'purchase',
    label: 'Purchase',
    table: 'purchases',
    accent: '#7c3aed',
    icon: '🧾',
    fields: [
      { kind: 'date', name: 'occurred_on', label: 'Date' },
      { kind: 'text', name: 'vendor', label: 'Vendor' },
      { kind: 'number', name: 'total_amount', label: 'Total amount (AED)', placeholder: '0.00' },
      { kind: 'select', name: 'payment_method', label: 'Payment method', options: ['Cash', 'Card'] },
      { kind: 'staff', name: 'purchased_by', label: 'Purchased by' },
    ],
  },
  generator: {
    slug: 'generator',
    label: 'Generator',
    table: 'generator_switches',
    accent: '#0d9488',
    icon: '⚡',
    fields: [
      { kind: 'datetime', name: 'switched_at', label: 'Switched at' },
      { kind: 'generator', name: 'generator_id', label: 'Generator' },
      { kind: 'number', name: 'diesel_level', label: 'Diesel level', placeholder: '250' },
      { kind: 'select', name: 'level_unit', label: 'Unit', options: ['litres', 'percent'] },
    ],
  },
  bottles: {
    slug: 'bottles',
    label: 'Water Bottles',
    table: 'water_bottle_receipts',
    accent: '#0891b2',
    icon: '🥤',
    fields: [
      { kind: 'date', name: 'occurred_on', label: 'Date' },
      { kind: 'stepper', name: 'bottles', label: 'Bottles received', min: 1, max: 5000 },
      { kind: 'staff', name: 'received_by', label: 'Received by' },
    ],
  },
};

export const METRIC_LIST = Object.values(METRICS);
