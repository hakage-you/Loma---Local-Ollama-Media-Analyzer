export interface SearchNode {
  type: 'TAG' | 'AND' | 'OR' | 'NOT' | 'GROUP';
  value?: string;
  children?: SearchNode[];
  left?: SearchNode;
  right?: SearchNode;
}

export function parseSearchQuery(query: string): SearchNode | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // トークナイザー
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (inQuotes) {
      current += char;
    } else if (char === '(' || char === ')') {
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      tokens.push(char);
    } else if (char === ' ') {
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    tokens.push(current.trim());
  }

  if (tokens.length === 0) return null;

  // トークン配列から暗黙的な AND を補間
  const processedTokens: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    processedTokens.push(token);

    if (i < tokens.length - 1) {
      const next = tokens[i + 1];
      const isCurrentOperand = token !== 'AND' && token !== 'OR' && token !== 'NOT' && token !== '(';
      const isNextOperand = next !== 'AND' && next !== 'OR' && next !== ')';

      if (isCurrentOperand && isNextOperand) {
        processedTokens.push('AND');
      }
    }
  }

  // 簡易再帰パーサー
  let index = 0;

  function parseExpr(): SearchNode | null {
    let left = parseTerm();
    if (!left) return null;

    while (index < processedTokens.length && processedTokens[index] === 'OR') {
      index++; // consume OR
      const right = parseTerm();
      if (!right) break;
      left = {
        type: 'OR',
        left,
        right,
      };
    }
    return left;
  }

  function parseTerm(): SearchNode | null {
    let left = parseFactor();
    if (!left) return null;

    while (index < processedTokens.length && processedTokens[index] === 'AND') {
      index++; // consume AND
      const right = parseFactor();
      if (!right) break;
      left = {
        type: 'AND',
        left,
        right,
      };
    }
    return left;
  }

  function parseFactor(): SearchNode | null {
    if (index >= processedTokens.length) return null;

    const token = processedTokens[index];

    if (token === 'NOT') {
      index++;
      const operand = parseFactor();
      if (!operand) return null;
      return {
        type: 'NOT',
        left: operand,
      };
    }

    if (token === '(') {
      index++; // consume (
      const expr = parseExpr();
      if (index < processedTokens.length && processedTokens[index] === ')') {
        index++; // consume )
      }
      return expr ? { type: 'GROUP', children: expr ? [expr] : [] } : null;
    }

    index++;
    let cleanVal = token.startsWith('#') ? token.slice(1) : token;
    if (cleanVal.startsWith('"') && cleanVal.endsWith('"')) {
      cleanVal = cleanVal.slice(1, -1);
    }
    return {
      type: 'TAG',
      value: cleanVal,
    };
  }

  return parseExpr();
}

// タグチップが手動追加された場合に AND で自動結合する
export function combineTagsWithQuery(query: string, selectedTags: string[]): string {
  if (selectedTags.length === 0) return query;

  const tagTokens = selectedTags.map((t) => (t.includes(' ') ? `"${t}"` : `#${t}`));
  const tagsExpr = tagTokens.join(' AND ');

  if (!query.trim()) {
    return tagsExpr;
  }

  return `(${query.trim()}) AND (${tagsExpr})`;
}
