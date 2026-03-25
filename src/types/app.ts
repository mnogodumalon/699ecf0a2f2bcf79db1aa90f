// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Rechnung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    rechnungsnummer?: string;
    rechnungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    betrag?: number;
    lieferant?: string;
    kategorie?: LookupValue;
    rechnungsdatei?: string;
    bezahlt?: boolean;
    zahlungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    notizen?: string;
  };
}

export const APP_IDS = {
  RECHNUNG: '699ecef9a5f7a7df385d883f',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'rechnung': {
    kategorie: [{ key: "buero", label: "Büromaterial" }, { key: "it_software", label: "IT & Software" }, { key: "reise", label: "Reisekosten" }, { key: "marketing", label: "Marketing" }, { key: "miete", label: "Miete & Nebenkosten" }, { key: "versicherung", label: "Versicherungen" }, { key: "sonstiges", label: "Sonstiges" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'rechnung': {
    'rechnungsnummer': 'string/text',
    'rechnungsdatum': 'date/date',
    'betrag': 'number',
    'lieferant': 'string/text',
    'kategorie': 'lookup/select',
    'rechnungsdatei': 'file',
    'bezahlt': 'bool',
    'zahlungsdatum': 'date/date',
    'notizen': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateRechnung = StripLookup<Rechnung['fields']>;