import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Rechnung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Plus, Euro, Clock, CheckCircle2, TrendingUp, Pencil, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RechnungDialog } from '@/components/dialogs/RechnungDialog';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
          onClick={() => { setEditRecord(null); setDialogOpen(true); }}
          className="gap-2"
        >
          <Plus size={16} />
          Neue Rechnung
        </Button>
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
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/40 transition-colors group"
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
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => { setEditRecord(r); setDialogOpen(true); }}
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

      {/* Dialogs */}
      <RechnungDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); }}
        onSubmit={async (fields) => {
          if (editRecord) {
            await LivingAppsService.updateRechnungEntry(editRecord.record_id, fields);
          } else {
            await LivingAppsService.createRechnungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editRecord?.fields}
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
