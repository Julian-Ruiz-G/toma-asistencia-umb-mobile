import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Polyline } from 'react-native-svg';

export function FilterChips({ options, value, onChange, colors, exclusive = false }) {
  return (
    <View style={styles.chipsWrap}>
      {options.map((opt, index) => {
        const id = opt.id ?? opt.label;
        const active = String(value) === String(id);
        return (
          <Pressable
            key={`${String(id)}-${index}`}
            onPress={() => {
              if (exclusive) onChange(id);
              else onChange(active ? '' : id);
            }}
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

export function HBarChart({
  items,
  colors,
  emptyText = 'Sin datos para graficar.',
  maxItems = 30,
  collapsible = false,
  selectedLabel,
  onSelect,
  labelWidth = 92,
  compact = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const all = items || [];
  const limit = collapsible && !expanded ? Math.min(5, maxItems) : maxItems;
  const rows = all.slice(0, limit);
  const max = Math.max(1, ...all.map((r) => Number(r.count) || 0));
  const barH = compact ? 6 : 8;
  if (!all.length) {
    return <Text style={[styles.empty, { color: colors.muted }]}>{emptyText}</Text>;
  }
  return (
    <View style={[styles.vGap, compact ? { gap: 8 } : null]}>
      {rows.map((row, index) => {
        const count = Number(row.count) || 0;
        const pct = Math.max(5, Math.round((count / max) * 100));
        const selected = selectedLabel != null && String(selectedLabel) === String(row.label);
        const Row = onSelect ? Pressable : View;
        return (
          <Row
            key={`${row.label || 'fila'}-${index}`}
            onPress={onSelect ? () => onSelect(selected ? '' : row.label, selected ? null : row) : undefined}
            style={styles.hRow}
          >
            <Text
              numberOfLines={1}
              style={[styles.hLabel, {
                width: labelWidth,
                fontSize: compact ? 11 : 12,
                color: selected ? colors.text : colors.textSecondary,
              }]}
            >
              {row.label}
            </Text>
            <View style={[styles.hTrack, { height: barH, backgroundColor: colors.surface }]}>
              <View style={[styles.hFill, {
                height: barH,
                width: `${pct}%`,
                backgroundColor: selected ? colors.primaryDark : colors.primary,
              }]} />
            </View>
            <Text style={[styles.hCount, { color: colors.text }]}>{count}</Text>
          </Row>
        );
      })}
      {collapsible && all.length > 5 ? (
        <Pressable onPress={() => setExpanded((v) => !v)}>
          <Text style={[styles.more, { color: colors.primary }]}>
            {expanded ? 'Ver menos' : `Ver más (${all.length - 5})`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function WeekBars({ days, colors, selectedDate, onSelect }) {
  const rows = days || [];
  const max = Math.max(1, ...rows.map((d) => Number(d.total) || 0));
  if (!rows.length) {
    return <Text style={[styles.empty, { color: colors.muted }]}>Aún no hay asistencia de esta semana.</Text>;
  }
  return (
    <View style={styles.weekRow}>
      {rows.map((d, index) => {
        const total = Number(d.total) || 0;
        const h = Math.max(total ? 10 : 4, Math.round((total / max) * 88));
        const present = Number(d.asistencia) || 0;
        const late = Number(d.retardo) || 0;
        const absent = Number(d.inasistencia) || 0;
        const stack = present + late + absent || 1;
        const selected = selectedDate != null && String(selectedDate) === String(d.date || d.label);
        const Col = onSelect ? Pressable : View;
        return (
          <Col
            key={`${d.date || d.label || 'dia'}-${index}`}
            onPress={onSelect ? () => onSelect(selected ? '' : (d.date || d.label)) : undefined}
            style={styles.weekCol}
          >
            <View style={[styles.weekTrack, {
              backgroundColor: colors.surface,
              borderWidth: selected ? 1 : 0,
              borderColor: colors.primary,
            }]}>
              <View style={[styles.weekStack, { height: h, opacity: selectedDate && !selected ? 0.45 : 1 }]}>
                {present ? <View style={{ flex: present / stack, backgroundColor: colors.successStrong, borderTopLeftRadius: 7, borderTopRightRadius: 7 }} /> : null}
                {late ? <View style={{ flex: late / stack, backgroundColor: colors.warningStrong }} /> : null}
                {absent ? <View style={{ flex: absent / stack, backgroundColor: colors.dangerStrong, borderBottomLeftRadius: 7, borderBottomRightRadius: 7 }} /> : null}
                {!total ? <View style={{ height: 4, borderRadius: 7, backgroundColor: colors.border }} /> : null}
              </View>
            </View>
            <Text style={[styles.weekLabel, { color: selected ? colors.text : colors.muted }]}>{d.label}</Text>
            <Text style={[styles.weekValue, { color: colors.text }]}>{total}</Text>
          </Col>
        );
      })}
    </View>
  );
}

export function VBarChart({ items, colors, emptyText = 'Sin datos para graficar.', selectedLabel, onSelect, compact = true }) {
  const rows = items || [];
  const max = Math.max(1, ...rows.map((r) => Number(r.count) || 0));
  const trackH = compact ? 76 : 88;
  const barW = compact ? 10 : 14;
  if (!rows.length) {
    return <Text style={[styles.empty, { color: colors.muted }]}>{emptyText}</Text>;
  }
  return (
    <View style={styles.vBarRow}>
      {rows.map((row, index) => {
        const count = Number(row.count) || 0;
        const h = Math.max(count ? 6 : 2, Math.round((count / max) * (trackH - 4)));
        const selected = selectedLabel != null && String(selectedLabel) === String(row.label);
        const Col = onSelect ? Pressable : View;
        return (
          <Col
            key={`${row.label || 'col'}-${index}`}
            onPress={onSelect ? () => onSelect(selected ? '' : row.label) : undefined}
            style={styles.vBarCol}
          >
            <Text style={[styles.vBarValue, { color: colors.text }]}>{count}</Text>
            <View style={[styles.vBarTrack, {
              height: trackH,
              width: barW,
              backgroundColor: colors.surface,
            }]}>
              <View style={[styles.vBarFill, {
                height: h,
                width: barW,
                backgroundColor: selected ? colors.primaryDark : colors.primary,
              }]} />
            </View>
            <Text numberOfLines={2} style={[styles.vBarLabel, { color: selected ? colors.text : colors.muted }]}>
              {row.label}
            </Text>
          </Col>
        );
      })}
    </View>
  );
}

export function DonutChart({
  segments,
  colors,
  size = 112,
  thickness = 12,
  centerLabel = 'Total',
  selectedKey,
  onSelect,
}) {
  const parts = (segments || []).filter((s) => Number(s.value) > 0);
  const total = (segments || []).reduce((n, s) => n + (Number(s.value) || 0), 0);
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  const cx = size / 2;
  const selected = (segments || []).find((s) => s.key === selectedKey) || null;
  const centerValue = selected ? Number(selected.value) || 0 : total;
  const centerText = selected ? selected.label : centerLabel;

  if (total <= 0) {
    return <Text style={[styles.empty, { color: colors.muted }]}>Aún no hay registros para mostrar.</Text>;
  }

  let offset = 0;
  return (
    <View style={styles.donutWrap}>
      <View style={{ width: size, height: size, alignSelf: 'center' }}>
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cx}
            r={radius}
            stroke={colors.surface}
            strokeWidth={thickness}
            fill="none"
          />
          {parts.map((s) => {
            const len = (Number(s.value) / total) * circ;
            const rotation = -90 + (offset / circ) * 360;
            offset += len;
            const active = selectedKey === s.key;
            return (
              <G key={s.key} rotation={rotation} originX={cx} originY={cx}>
                <Circle
                  cx={cx}
                  cy={cx}
                  r={radius}
                  stroke={s.color}
                  strokeWidth={active ? thickness + 1.5 : thickness}
                  strokeDasharray={`${Math.max(0.01, len)} ${circ}`}
                  strokeLinecap="butt"
                  fill="none"
                  opacity={selectedKey && !active ? 0.4 : 1}
                />
              </G>
            );
          })}
        </Svg>
        <View pointerEvents="none" style={styles.donutCenter}>
          <Text style={[styles.donutValue, { color: colors.text }]}>{centerValue}</Text>
          <Text numberOfLines={1} style={[styles.donutHint, { color: colors.muted }]}>{centerText}</Text>
        </View>
      </View>
      <View style={styles.donutLegend}>
        {(segments || []).map((s) => {
          const value = Number(s.value) || 0;
          const pct = total ? Math.round((value / total) * 100) : 0;
          const active = selectedKey === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => onSelect?.(active ? '' : s.key)}
              style={[styles.donutLegendItem, active ? { backgroundColor: colors.surface } : null]}
            >
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>{s.label}</Text>
              <Text style={[styles.donutLegendCount, { color: colors.text }]}>{value} · {pct}%</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MiniLine({ points, colors, emptyText = 'Sin datos para graficar.', height = 92 }) {
  const rows = points || [];
  const max = Math.max(1, ...rows.map((p) => Number(p.count) || 0));
  const width = Math.max(160, rows.length * 28);
  const padX = 8;
  const padY = 10;
  const innerH = height - padY * 2;
  const innerW = width - padX * 2;
  const coords = rows.map((p, i) => {
    const x = padX + (rows.length <= 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
    const y = padY + innerH - ((Number(p.count) || 0) / max) * innerH;
    return `${x},${y}`;
  }).join(' ');

  if (!rows.length) {
    return <Text style={[styles.empty, { color: colors.muted }]}>{emptyText}</Text>;
  }

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Polyline
          points={coords}
          fill="none"
          stroke={colors.primary}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.lineLabels}>
        {rows.map((p, index) => (
          <View key={`${p.label || p.date || index}`} style={styles.lineLabelCol}>
            <Text style={[styles.weekValue, { color: colors.text }]}>{Number(p.count) || 0}</Text>
            <Text numberOfLines={1} style={[styles.weekLabel, { color: colors.muted }]}>{p.label}</Text>
          </View>
        ))}
      </View>
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
          parts.filter((p) => p.value > 0).map((p, idx, arr) => {
            const segmentFlex = p.value;
            return (
            <View
              key={p.key}
              style={[
                styles.stackSeg,
                {
                  flex: segmentFlex,
                  backgroundColor: p.color,
                  borderTopLeftRadius: idx === 0 ? 999 : 0,
                  borderBottomLeftRadius: idx === 0 ? 999 : 0,
                  borderTopRightRadius: idx === arr.length - 1 ? 999 : 0,
                  borderBottomRightRadius: idx === arr.length - 1 ? 999 : 0,
                },
              ]}
            />
            );
          })
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
  more: { fontWeight: '800', fontSize: 12, marginTop: 2 },
  vGap: { gap: 10 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hLabel: { width: 92, fontSize: 12, fontWeight: '800' },
  hTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  hFill: { height: 8, borderRadius: 999 },
  hCount: { width: 36, textAlign: 'right', fontSize: 12, fontWeight: '900' },
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
  vBarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 },
  vBarCol: { flex: 1, alignItems: 'center', gap: 6, minWidth: 0 },
  vBarTrack: { borderRadius: 999, justifyContent: 'flex-end', overflow: 'hidden' },
  vBarFill: { borderRadius: 999 },
  vBarLabel: { fontSize: 9, fontWeight: '800', textAlign: 'center' },
  vBarValue: { fontSize: 10, fontWeight: '800' },
  donutWrap: { alignItems: 'center', gap: 14, width: '100%' },
  donutCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  donutValue: { fontSize: 20, fontWeight: '900' },
  donutHint: { marginTop: 2, fontSize: 11, fontWeight: '800' },
  donutLegend: { width: '100%', gap: 4 },
  donutLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  donutLegendCount: { fontSize: 12, fontWeight: '900' },
  lineLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  lineLabelCol: { flex: 1, alignItems: 'center', minWidth: 0 },
});
