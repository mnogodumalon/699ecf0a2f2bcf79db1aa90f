import { useState, useMemo, useRef } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Rechnung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Plus, Euro, Clock, CheckCircle2, TrendingUp, Pencil, Trash2, FileText, Camera, Loader2, X, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RechnungDialog } from '@/components/dialogs/RechnungDialog';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { extractFromPhoto, fileToDataUri } from '@/lib/ai';

const KATEGORIE_LABELS: Record<string, string> = {
  buero: 'Büromaterial',
  it_software: 'IT & Software',
  reise: 'Reisekosten',
  marketing: 'Marketing',
  miete: 'Miete & Nebenkosten',
  versicherung: 'Versicherungen',
  sonstiges: 'Sonstiges',
};

const KATEGORIE_COLORS: Record<string, string> = {
  buero: 'var(--primary)',
  it_software: '#6366f1',
  reise: '#8b5cf6',
  marketing: '#ec4899',
  miete: '#f59e0b',
  versicherung: '#10b981',
  sonstiges: '#6b7280',
};

function formatEur(v: number | undefined) {
  if (v == null) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

function getKategorie(r: Rechnung): string {
  const k = r.fields.kategorie;
  if (!k) return 'sonstiges';
  if (typeof k === 'object' && 'key' in k) return (k as any).key;
  return String(k);
}

export default function DashboardOverview() {
  const { rechnung, loading, error, fetchAll } = useDashboardData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Rechnung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Rechnung | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'offen' | 'bezahlt'>('all');
  const [detailRecord, setDetailRecord] = useState<Rechnung | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [prefillValues, setPrefillValues] = useState<Record<string, unknown> | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // KPI calculations
  const stats = useMemo(() => {
    const total = rechnung.reduce((s, r) => s + (r.fields.betrag ?? 0), 0);
    const bezahlt = rechnung.filter(r => r.fields.bezahlt);
    const offen = rechnung.filter(r => !r.fields.bezahlt);
    const bezahltSum = bezahlt.reduce((s, r) => s + (r.fields.betrag ?? 0), 0);
    const offenSum = offen.reduce((s, r) => s + (r.fields.betrag ?? 0), 0);
    return { total, bezahltSum, offenSum, bezahltCount: bezahlt.length, offenCount: offen.length };
  }, [rechnung]);

  // Category chart data
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    rechnung.forEach(r => {
      const k = getKategorie(r);
      map[k] = (map[k] ?? 0) + (r.fields.betrag ?? 0);
    });
    return Object.entries(map)
      .map(([key, value]) => ({ key, name: KATEGORIE_LABELS[key] ?? key, value }))
      .sort((a, b) => b.value - a.value);
  }, [rechnung]);

  // Filtered list
  const filtered = useMemo(() => {
    if (activeFilter === 'offen') return rechnung.filter(r => !r.fields.bezahlt);
    if (activeFilter === 'bezahlt') return rechnung.filter(r => r.fields.bezahlt);
    return rechnung;
  }, [rechnung, activeFilter]);

  const handlePhotoScan = async (file: File) => {
    setScanLoading(true);
    setScanError(null);
    try {
      const uri = await fileToDataUri(file);
      const extracted = await extractFromPhoto<{
        rechnungsnummer: string | null;
        rechnungsdatum: string | null;
        betrag: number | null;
        lieferant: string | null;
        kategorie: string | null;
        notizen: string | null;
      }>(uri, JSON.stringify({
        rechnungsnummer: 'string — invoice/receipt number',
        rechnungsdatum: 'string — invoice date as YYYY-MM-DD or null',
        betrag: 'number — total amount in EUR (numeric only, no currency symbol)',
        lieferant: 'string — supplier/issuer name',
        kategorie: 'string — one of: buero, it_software, reise, marketing, miete, versicherung, sonstiges',
        notizen: 'string — any additional notes or null',
      }));

      // Map kategorie key to {key, label} lookup object
      const katKey = extracted.kategorie && Object.keys(KATEGORIE_LABELS).includes(extracted.kategorie)
        ? extracted.kategorie : 'sonstiges';

      setPrefillValues({
        rechnungsnummer: extracted.rechnungsnummer ?? undefined,
        rechnungsdatum: extracted.rechnungsdatum ?? undefined,
        betrag: extracted.betrag ?? undefined,
        lieferant: extracted.lieferant ?? undefined,
        kategorie: katKey,
        notizen: extracted.notizen ?? undefined,
      });
      setEditRecord(null);
      setDialogOpen(true);
    } catch {
      setScanError('Foto konnte nicht ausgelesen werden. Bitte erneut versuchen.');
    } finally {
      setScanLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteRechnungEntry(deleteTarget.record_id);
    setDeleteTarget(null);
    fetchAll();
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Rechnungsübersicht</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{rechnung.length} Rechnungen insgesamt</p>
        </div>
        <Button
          onClick={() => { setEditRecord(null); setPrefillValues(undefined); setDialogOpen(true); }}
          className="gap-2"
        >
          <Plus size={16} />
          Neue Rechnung
        </Button>
      </div>

      {/* Photo Scan Hero */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handlePhotoScan(file);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={scanLoading}
          className="w-full group relative overflow-hidden rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-all duration-200 p-8 flex flex-col items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className={`w-16 h-16 rounded-2xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-all duration-200 ${scanLoading ? 'animate-pulse' : ''}`}>
            {scanLoading
              ? <Loader2 size={30} className="text-primary animate-spin" />
              : <Camera size={30} className="text-primary" />
            }
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">
              {scanLoading ? 'Rechnung wird ausgelesen…' : 'Rechnung fotografieren oder hochladen'}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {scanLoading ? 'KI liest die Daten aus — einen Moment…' : 'Foto, Screenshot oder PDF — KI füllt das Formular automatisch aus'}
            </p>
          </div>
        </button>
        {scanError && (
          <p className="text-sm text-destructive mt-2 text-center">{scanError}</p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Gesamtbetrag"
          value={formatEur(stats.total)}
          description="Alle Rechnungen"
          icon={<Euro size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offen"
          value={formatEur(stats.offenSum)}
          description={`${stats.offenCount} ausstehend`}
          icon={<Clock size={18} className="text-amber-500" />}
        />
        <StatCard
          title="Bezahlt"
          value={formatEur(stats.bezahltSum)}
          description={`${stats.bezahltCount} beglichen`}
          icon={<CheckCircle2 size={18} className="text-emerald-500" />}
        />
        <StatCard
          title="Kategorien"
          value={String(chartData.length)}
          description="Verschiedene Typen"
          icon={<TrendingUp size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Main Content: Chart + Invoice List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Chart */}
        <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Ausgaben nach Kategorie</h2>
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText size={32} className="mb-2 opacity-40" />
              <span className="text-sm">Keine Daten</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [formatEur(v), 'Betrag']}
                  contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={KATEGORIE_COLORS[entry.key] ?? 'var(--primary)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Invoice List */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 px-5 pt-4 pb-3 border-b border-border">
            {(['all', 'offen', 'bezahlt'] as const).map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeFilter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {f === 'all' ? 'Alle' : f === 'offen' ? 'Offen' : 'Bezahlt'}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeFilter === f ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {f === 'all' ? rechnung.length : f === 'offen' ? stats.offenCount : stats.bezahltCount}
                </span>
              </button>
            ))}
          </div>

          {/* List */}
          <div className="divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText size={36} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">Keine Rechnungen</p>
                <p className="text-xs mt-1">Klicke auf „Neue Rechnung" um zu starten</p>
              </div>
            ) : (
              filtered.map(r => {
                const kat = getKategorie(r);
                const bezahlt = r.fields.bezahlt === true;
                return (
                  <div
                    key={r.record_id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/40 transition-colors group cursor-pointer"
                    onClick={() => setDetailRecord(r)}
                  >
                    {/* Category Color Dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: KATEGORIE_COLORS[kat] ?? 'var(--muted-foreground)' }}
                    />

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {r.fields.lieferant || r.fields.rechnungsnummer || '—'}
                        </span>
                        {r.fields.rechnungsnummer && r.fields.lieferant && (
                          <span className="text-xs text-muted-foreground font-mono">{r.fields.rechnungsnummer}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">{KATEGORIE_LABELS[kat] ?? kat}</span>
                        {r.fields.rechnungsdatum && (
                          <span className="text-xs text-muted-foreground">· {formatDate(r.fields.rechnungsdatum)}</span>
                        )}
                      </div>
                    </div>

                    {/* Amount + Status */}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-foreground">{formatEur(r.fields.betrag)}</div>
                      <Badge
                        variant={bezahlt ? 'default' : 'secondary'}
                        className={`text-[10px] mt-0.5 ${bezahlt ? 'bg-emerald-500/15 text-emerald-700 border-emerald-200' : 'bg-amber-500/15 text-amber-700 border-amber-200'}`}
                      >
                        {bezahlt ? 'Bezahlt' : 'Offen'}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setEditRecord(r); setPrefillValues(undefined); setDialogOpen(true); }}
                        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(r)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Detail Side Panel */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setDetailRecord(null)}
          />
          {/* Panel */}
          <div className="w-full max-w-lg bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {detailRecord.fields.lieferant || detailRecord.fields.rechnungsnummer || 'Rechnung'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {KATEGORIE_LABELS[getKategorie(detailRecord)] ?? getKategorie(detailRecord)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditRecord(detailRecord); setPrefillValues(undefined); setDetailRecord(null); setDialogOpen(true); }}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Bearbeiten"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setDetailRecord(null)}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto">
              {/* Info Fields */}
              <div className="px-6 py-5 space-y-4">
                <DetailRow label="Rechnungsnummer" value={detailRecord.fields.rechnungsnummer} />
                <DetailRow label="Rechnungsdatum" value={detailRecord.fields.rechnungsdatum ? formatDate(detailRecord.fields.rechnungsdatum) : undefined} />
                <DetailRow label="Zahlungsdatum" value={detailRecord.fields.zahlungsdatum ? formatDate(detailRecord.fields.zahlungsdatum) : undefined} />
                <DetailRow label="Lieferant" value={detailRecord.fields.lieferant} />
                <DetailRow label="Betrag" value={detailRecord.fields.betrag != null ? formatEur(detailRecord.fields.betrag) : undefined} highlight />
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">Status</span>
                  <Badge
                    className={`text-xs ${detailRecord.fields.bezahlt ? 'bg-emerald-500/15 text-emerald-700 border-emerald-200' : 'bg-amber-500/15 text-amber-700 border-amber-200'}`}
                  >
                    {detailRecord.fields.bezahlt ? 'Bezahlt' : 'Offen'}
                  </Badge>
                </div>
                {detailRecord.fields.notizen && (
                  <div className="py-2">
                    <span className="text-xs text-muted-foreground font-medium block mb-1">Notizen</span>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{detailRecord.fields.notizen}</p>
                  </div>
                )}
              </div>

              {/* PDF / File Viewer */}
              {detailRecord.fields.rechnungsdatei ? (
                <div className="px-6 pb-6">
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border">
                      <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <FileText size={13} className="text-primary" />
                        Rechnungsdatei
                      </span>
                      <div className="flex items-center gap-2">
                        <a
                          href={detailRecord.fields.rechnungsdatei}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={12} />
                          Öffnen
                        </a>
                        <a
                          href={detailRecord.fields.rechnungsdatei}
                          download
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          <Download size={12} />
                          Download
                        </a>
                      </div>
                    </div>
                    {/* Embedded PDF or image */}
                    {detailRecord.fields.rechnungsdatei.match(/\.(pdf)(\?|$)/i) ? (
                      <iframe
                        src={detailRecord.fields.rechnungsdatei}
                        className="w-full h-[480px] bg-white"
                        title="Rechnungs-PDF"
                      />
                    ) : detailRecord.fields.rechnungsdatei.match(/\.(png|jpe?g|gif|webp|bmp)(\?|$)/i) ? (
                      <img
                        src={detailRecord.fields.rechnungsdatei}
                        alt="Rechnungsdatei"
                        className="w-full object-contain max-h-[480px] bg-muted/30"
                      />
                    ) : (
                      /* Unknown type — try iframe, falls back gracefully */
                      <iframe
                        src={detailRecord.fields.rechnungsdatei}
                        className="w-full h-[480px] bg-white"
                        title="Rechnungsdatei"
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-6 pb-6">
                  <div className="rounded-xl border border-dashed border-border p-6 flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText size={28} className="opacity-30" />
                    <p className="text-sm">Keine Datei hinterlegt</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <RechnungDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); setPrefillValues(undefined); }}
        onSubmit={async (fields) => {
          if (editRecord) {
            await LivingAppsService.updateRechnungEntry(editRecord.record_id, fields);
          } else {
            await LivingAppsService.createRechnungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editRecord ? editRecord.fields : prefillValues}
        enablePhotoScan={AI_PHOTO_SCAN['Rechnung']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Rechnung löschen"
        description={`Soll die Rechnung von „${deleteTarget?.fields.lieferant || deleteTarget?.fields.rechnungsnummer || '—'}" wirklich gelöscht werden?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className={`text-sm ${highlight ? 'font-bold text-foreground' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="lg:col-span-2 h-72 rounded-2xl" />
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">{error.message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>Erneut versuchen</Button>
    </div>
  );
}
