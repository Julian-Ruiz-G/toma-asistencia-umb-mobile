import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function FilterChips({ options, value, onChange, colors }) {
  return (
    <View style={styles.chipsWrap}>
      {options.map((opt) => {
        const id = opt.id ?? opt.label;
        const active = String(value) === String(id);
        return (
          <Pressable
            key={String(id)}
            onPress={() => onChange(active ? '' : id)}
            style={[
              styles.chip,
              { borderColor: colors.border, backgroundColor: colors.surface },
              active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null,
            ]}
          >
            <Text style={[styles.chipText, { color: active ? colors.white : colors.textSecondary }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function HBarChart({ items, colors, emptyText = 'Sin datos para graficar.' }) {
  const rows = (items || []).slice(0, 30);
  const max = Math.max(1, ...rows.map((r) => Number(r.count) || 0));
  if (!rows.length) {
    return <Text style={[styles.empty, { color: colors.muted }]}>{emptyText}</Text>;
  }
  return (
    <View style={styles.vGap}>
      {rows.map((row) => {
        const count = Number(row.count) || 0;
        const pct = Math.max(6, Math.round((count / max) * 100));
        return (
          <View key={row.label} style={styles.hRow}>
            <Text numberOfLines={1} style={[styles.hLabel, { color: colors.textSecondary }]}>{row.label}</Text>
            <View style={[styles.hTrack, { backgroundColor: colors.surface }]}>
              <View style={[styles.hFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.hCount, { color: colors.text }]}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function WeekBars({ days, colors }) {
  const rows = days || [];
  const max = Math.max(1, ...rows.map((d) => Number(d.total) || 0));
  if (!rows.length) {
    return <Text style={[styles.empty, { color: colors.muted }]}>Aún no hay asistencia de esta semana.</Text>;
  }
  return (
    <View style={styles.weekRow}>
      {rows.map((d) => {
        const total = Number(d.total) || 0;
        const h = Math.max(total ? 10 : 4, Math.round((total / max) * 88));
        const present = Number(d.asistencia) || 0;
        const late = Number(d.retardo) || 0;
        const absent = Number(d.inasistencia) || 0;
        const stack = present + late + absent || 1;
        return (
          <View key={d.date || d.label} style={styles.weekCol}>
            <View style={[styles.weekTrack, { backgroundColor: colors.surface }]}>
              <View style={[styles.weekStack, { height: h }]}>
                {present ? <View style={{ flex: present / stack, backgroundColor: colors.successStrong, borderTopLeftRadius: 7, borderTopRightRadius: 7 }} /> : null}
                {late ? <View style={{ flex: late / stack, backgroundColor: colors.warningStrong }} /> : null}
                {absent ? <View style={{ flex: absent / stack, backgroundColor: colors.dangerStrong, borderBottomLeftRadius: 7, borderBottomRightRadius: 7 }} /> : null}
                {!total ? <View style={{ height: 4, borderRadius: 7, backgroundColor: colors.border }} /> : null}
              </View>
            </View>
            <Text style={[styles.weekLabel, { color: colors.muted }]}>{d.label}</Text>
            <Text style={[styles.weekValue, { color: colors.text }]}>{total}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function StatusBreakdown({ present = 0, late = 0, absent = 0, colors }) {
  const total = present + late + absent;
  const parts = [
    { key: 'ok', label: 'Asistencia', value: present, color: colors.successStrong },
    { key: 'late', label: 'Retardo', value: late, color: colors.warningStrong },
    { key: 'no', label: 'Falla', value: absent, color: colors.dangerStrong },
  ];
  return (
    <View style={styles.vGap}>
      <View style={[styles.stackBar, { backgroundColor: colors.surface }]}>
        {total <= 0 ? (
          <View style={[styles.stackSeg, { flex: 1, backgroundColor: colors.border }]} />
        ) : (
          parts.filter((p) => p.value > 0).map((p, idx, arr) => (
            <View
              key={p.key}
              style={[
                styles.stackSeg,
                {
                  flex: p.value,
                  backgroundColor: p.color,
                  borderTopLeftRadius: idx === 0 ? 999 : 0,
                  borderBottomLeftRadius: idx === 0 ? 999 : 0,
                  borderTopRightRadius: idx === arr.length - 1 ? 999 : 0,
                  borderBottomRightRadius: idx === arr.length - 1 ? 999 : 0,
                },
              ]}
            />
          ))
        )}
      </View>
      <View style={styles.legendRow}>
        {parts.map((p) => (
          <View key={p.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: p.color }]} />
            <Text style={[styles.legendText, { color: colors.muted }]}>{p.label} {p.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontWeight: '800', fontSize: 12 },
  empty: { fontSize: 13, fontWeight: '700' },
  vGap: { gap: 10 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hLabel: { width: 92, fontSize: 12, fontWeight: '800' },
  hTrack: { flex: 1, height: 10, borderRadius: 999, overflow: 'hidden' },
  hFill: { height: 10, borderRadius: 999 },
  hCount: { width: 28, textAlign: 'right', fontSize: 12, fontWeight: '900' },
  weekRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  weekCol: { flex: 1, alignItems: 'center', gap: 4 },
  weekTrack: { width: '100%', height: 96, borderRadius: 12, justifyContent: 'flex-end', overflow: 'hidden' },
  weekStack: { width: '70%', alignSelf: 'center', borderRadius: 7, overflow: 'hidden' },
  weekLabel: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  weekValue: { fontSize: 11, fontWeight: '900' },
  stackBar: { height: 12, borderRadius: 999, overflow: 'hidden', flexDirection: 'row' },
  stackSeg: { height: 12 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: '800' },
});
