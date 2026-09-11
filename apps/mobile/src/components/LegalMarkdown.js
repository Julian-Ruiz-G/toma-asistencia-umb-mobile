import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

function renderInline(text, keyPrefix) {
  const nodes = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(
        <Text key={`${keyPrefix}-t-${i}`}>{text.slice(last, match.index)}</Text>
      );
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <Text key={`${keyPrefix}-b-${i}`} style={styles.bold}>
          {token.slice(2, -2)}
        </Text>
      );
    } else {
      nodes.push(
        <Text key={`${keyPrefix}-i-${i}`} style={styles.italic}>
          {token.slice(1, -1)}
        </Text>
      );
    }
    last = match.index + token.length;
    i += 1;
  }
  if (last < text.length) {
    nodes.push(<Text key={`${keyPrefix}-t-end`}>{text.slice(last)}</Text>);
  }
  return nodes;
}

function parseBlocks(source) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  const flushParagraph = (buf) => {
    const text = buf.join(' ').trim();
    if (text) blocks.push({ type: 'p', text });
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', text: trimmed.slice(2).trim() });
      i += 1;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3).trim() });
      i += 1;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: trimmed.slice(4).trim() });
      i += 1;
      continue;
    }
    if (trimmed.startsWith('> ')) {
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (bullet || numbered) {
      const items = [];
      const kind = numbered ? 'ol' : 'ul';
      while (i < lines.length) {
        const t = lines[i].trim();
        const b = t.match(/^[-*]\s+(.+)$/);
        const n = t.match(/^\d+\.\s+(.+)$/);
        if (kind === 'ul' && b) items.push(b[1]);
        else if (kind === 'ol' && n) items.push(n[1]);
        else if (!t) break;
        else break;
        i += 1;
      }
      blocks.push({ type: kind, items });
      continue;
    }

    const para = [trimmed];
    i += 1;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (
        !t ||
        t.startsWith('#') ||
        /^---+$/.test(t) ||
        t.startsWith('> ') ||
        /^[-*]\s+/.test(t) ||
        /^\d+\.\s+/.test(t)
      ) {
        break;
      }
      para.push(t);
      i += 1;
    }
    flushParagraph(para);
  }

  return blocks;
}

export default function LegalMarkdown({ content }) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <View>
      {blocks.map((block, idx) => {
        if (block.type === 'hr') {
          return <View key={idx} style={styles.hr} />;
        }
        if (block.type === 'h1') {
          return (
            <Text key={idx} style={styles.h1}>
              {block.text}
            </Text>
          );
        }
        if (block.type === 'h2') {
          return (
            <Text key={idx} style={styles.h2}>
              {block.text}
            </Text>
          );
        }
        if (block.type === 'h3') {
          return (
            <Text key={idx} style={styles.h3}>
              {block.text}
            </Text>
          );
        }
        if (block.type === 'quote') {
          return (
            <View key={idx} style={styles.quote}>
              <Text style={styles.quoteText}>{renderInline(block.text, `q-${idx}`)}</Text>
            </View>
          );
        }
        if (block.type === 'ul' || block.type === 'ol') {
          return (
            <View key={idx} style={styles.list}>
              {block.items.map((item, j) => (
                <View key={j} style={styles.li}>
                  <Text style={styles.marker}>
                    {block.type === 'ol' ? `${j + 1}.` : '•'}
                  </Text>
                  <Text style={styles.liText}>{renderInline(item, `li-${idx}-${j}`)}</Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={idx} style={styles.p}>
            {renderInline(block.text, `p-${idx}`)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 28,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 22,
    marginBottom: 8,
    lineHeight: 22,
  },
  h3: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginTop: 14,
    marginBottom: 6,
    lineHeight: 21,
  },
  p: {
    fontSize: 14.5,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 10,
  },
  bold: {
    fontWeight: '800',
    color: '#111827',
  },
  italic: {
    fontStyle: 'italic',
  },
  list: {
    marginBottom: 12,
    gap: 6,
  },
  li: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 4,
  },
  marker: {
    width: 22,
    fontSize: 14.5,
    lineHeight: 22,
    color: '#6B7280',
    fontWeight: '700',
  },
  liText: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 22,
    color: '#374151',
  },
  hr: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 18,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: '#9CA3AF',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4B5563',
  },
});
