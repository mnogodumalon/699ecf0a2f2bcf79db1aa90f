import type { Rechnung } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; }
}

interface RechnungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Rechnung | null;
  onEdit: (record: Rechnung) => void;
}

export function RechnungViewDialog({ open, onClose, record, onEdit }: RechnungViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>View Rechnung</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rechnungsnummer</Label>
            <p className="text-sm">{record.fields.rechnungsnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rechnungsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.rechnungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Betrag (EUR)</Label>
            <p className="text-sm">{record.fields.betrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Lieferant/Aussteller</Label>
            <p className="text-sm">{record.fields.lieferant ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kategorie</Label>
            <Badge variant="secondary">{record.fields.kategorie?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rechnung hochladen</Label>
            {record.fields.rechnungsdatei ? (
              <div className="relative w-full rounded-lg bg-muted overflow-hidden border">
                <img src={record.fields.rechnungsdatei} alt="" className="w-full h-auto object-contain" />
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rechnung bereits bezahlt</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.bezahlt ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.bezahlt ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zahlungsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.zahlungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notizen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.notizen ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}