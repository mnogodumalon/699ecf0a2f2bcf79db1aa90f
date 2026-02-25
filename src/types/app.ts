// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export interface Rechnung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    rechnungsnummer?: string;
    rechnungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    betrag?: number;
    lieferant?: string;
    kategorie?: 'buero' | 'it_software' | 'reise' | 'marketing' | 'miete' | 'versicherung' | 'sonstiges';
    rechnungsdatei?: string;
    bezahlt?: boolean;
    zahlungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    notizen?: string;
  };
}

export const APP_IDS = {
  RECHNUNG: '699ecef9a5f7a7df385d883f',
} as const;

// Helper Types for creating new records
export type CreateRechnung = Rechnung['fields'];