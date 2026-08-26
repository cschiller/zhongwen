#!/usr/bin/env python3
"""
Verify the files produced by build_jyutping_data.py, using ports of the actual
runtime code: ZhongwenDictionary.find() from dict.js and the entry regex from
content.js. Indices are exercised through the real binary search, in UTF-16
code-unit space, against the files exactly as fetch().text() would deliver them.

    python3 tools/verify_jyutping_data.py
"""

import re
import sys
import random
from pathlib import Path

# Resolved from this file's location, so the script runs from any directory.
TOOLS = Path(__file__).resolve().parent
SOURCES = TOOLS / 'sources'
DATA = TOOLS.parent / 'data'

OFFSET_WIDTH = 8

CEDICT_LINE = re.compile(r'^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s*/(.*)/\s*$')
CANTO_LINE = re.compile(
    r'^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s*\{([^}]*)\}\s*(?:/(.*)/)?(?:\s*#.*)?\s*$')

failures = []


def check(name, ok, detail=''):
    print(('  PASS  ' if ok else '  FAIL  ') + name + (f'  {detail}' if detail else ''))
    if not ok:
        failures.append(name)


def read_js_text(path):
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


def norm_pinyin(p):
    return p.replace(' ', '').lower()


class JsString:
    """A JS string: indexable by UTF-16 code unit, with find() semantics."""

    def __init__(self, text):
        self.text = text
        self.buf = text.encode('utf-16-le')
        self.length = len(self.buf) // 2

    def sub(self, a, b=None):
        # JS substring() clamps past the end and tolerates a lone surrogate;
        # surrogatepass reproduces that rather than raising.
        end = min(b, self.length) * 2 if b is not None else None
        return self.buf[a * 2:end].decode('utf-16-le', errors='surrogatepass')

    def index_of_nl(self, frm):
        i = self.buf.find('\n'.encode('utf-16-le'), frm * 2)
        return -1 if i < 0 else i // 2

    def last_index_of_nl(self, before):
        i = self.buf.rfind('\n'.encode('utf-16-le'), 0, before * 2 + 2)
        return -1 if i < 0 else i // 2

    def find(self, needle):
        """Port of ZhongwenDictionary.find() from dict.js."""
        nk = needle.encode('utf-16-be', errors='surrogatepass')
        nlen = len(needle.encode('utf-16-le')) // 2
        beg, end = 0, self.length - 1
        while beg < end:
            mi = (beg + end) // 2
            i = self.last_index_of_nl(mi) + 1
            mis = self.sub(i, i + nlen)
            mk = mis.encode('utf-16-be', errors='surrogatepass')
            if nk < mk:
                end = i - 1
            elif nk > mk:
                beg = self.index_of_nl(mi + 1) + 1
            else:
                return self.sub(i, self.index_of_nl(mi + 1))
        return None


def u16_key(s):
    return s.encode('utf-16-be', errors='surrogatepass')


def data_lines(text):
    return [l for l in text.split('\n') if l.strip() and not l.startswith('#')]


def lookup_jyutping(idx, offset):
    """The exact operation dict.js will perform."""
    hit = idx.find(str(offset).zfill(OFFSET_WIDTH) + '\t')
    return hit[OFFSET_WIDTH + 1:] if hit else None


def main():
    cedict = JsString(read_js_text(DATA / 'cedict_ts.u8'))
    ced_jyutping = JsString(read_js_text(DATA / 'cedict-jyutping.idx'))

    # ---------------------------------------------------------------- sorting
    print('\nsort order (UTF-16 code units, as find() assumes)')
    lines = data_lines(ced_jyutping.text)
    check('cedict-jyutping.idx', lines == sorted(lines, key=u16_key))

    # ------------------------------------------------------- format integrity
    print('\nformat')
    jyutping_rows = data_lines(ced_jyutping.text)
    bad = [l for l in jyutping_rows if l.count('\t') != 1
           or len(l.split('\t')[0]) != OFFSET_WIDTH
           or not l.split('\t')[0].isdigit()
           or not l.split('\t')[1]]
    check('cedict-jyutping.idx rows well formed', not bad, f'{len(bad)} bad')
    check('padding width holds for every offset',
          all(len(l.split('\t')[0]) == OFFSET_WIDTH for l in jyutping_rows))
    check('no jyutping value contains a tab',
          not any('\t' in l.split('\t', 1)[1] for l in jyutping_rows))

    # ------------------------------------------- offsets resolve to line starts
    print('\noffset resolution (via the ported find())')
    random.seed(7)

    sample = random.sample(jyutping_rows, 3000)
    misses = []
    for row in sample:
        off = int(row.split('\t')[0])
        line = cedict.sub(off, cedict.index_of_nl(off)).rstrip('\r')
        at_start = off == 0 or cedict.sub(off - 1, off) == '\n'
        if not (at_start and CEDICT_LINE.match(line)):
            misses.append(row)
    check('cedict-jyutping offsets land on cedict entry starts (n=3000)',
          not misses, f'{len(misses)} bad')

    # ------------------------------------------------- readings are the truth
    print('\nreadings match the source data')
    truth = {}
    for raw in read_js_text(SOURCES / 'cccedict-canto-readings.txt').split('\n'):
        line = raw.rstrip('\r')
        if line.startswith('#') or not line.strip():
            continue
        m = CANTO_LINE.match(line)
        if m:
            truth.setdefault((m.group(1), norm_pinyin(m.group(3))), m.group(4))
    for raw in read_js_text(SOURCES / 'cccanto-webdist.txt').split('\n'):
        line = raw.rstrip('\r')
        if line.startswith('#') or not line.strip():
            continue
        m = CANTO_LINE.match(line)
        if m:
            truth.setdefault((m.group(1), norm_pinyin(m.group(3))), m.group(4))

    # Single-character entries the two dictionaries do not cover fall back to
    # the Unihan kCantonese reading, so that is a legitimate source too.
    unihan = {}
    unihan_path = SOURCES / 'Unihan_Readings.txt'
    if unihan_path.exists():
        for raw in read_js_text(unihan_path).split('\n'):
            line = raw.rstrip('\r')
            if line.startswith('#') or not line.strip():
                continue
            fields = line.split('\t')
            if len(fields) == 3 and fields[1] == 'kCantonese':
                unihan[chr(int(fields[0][2:], 16))] = fields[2].split()[0]

    wrong = []
    from_unihan = 0
    for row in sample:
        off, jyutping = row.split('\t')
        line = cedict.sub(int(off), cedict.index_of_nl(int(off))).rstrip('\r')
        m = CEDICT_LINE.match(line)
        trad, simp = m.group(1), m.group(2)
        want = truth.get((trad, norm_pinyin(m.group(3))))
        if want == jyutping:
            continue
        # Otherwise it must be the Unihan fallback, and only for one character.
        if len(trad) == 1 and jyutping in (unihan.get(trad), unihan.get(simp)):
            from_unihan += 1
            continue
        wrong.append((line[:44], jyutping, want))
    check('sampled readings come from a declared source (n=3000)',
          not wrong, f'{len(wrong)} unaccounted for'
                     f' ({from_unihan} legitimately from Unihan)')
    for w in wrong[:3]:
        print('        ', w)

    # A Unihan reading may only ever be used for a single character.
    overreach = []
    for row in jyutping_rows:
        off, jyutping = row.split('\t')
        line = cedict.sub(int(off), cedict.index_of_nl(int(off))).rstrip('\r')
        m = CEDICT_LINE.match(line)
        if len(m.group(1)) == 1:
            continue
        if truth.get((m.group(1), norm_pinyin(m.group(3)))) != jyutping:
            overreach.append(line[:50])
    check('no multi-character entry takes a reading from outside the dictionaries',
          not overreach, f'{len(overreach)} do')
    for o in overreach[:3]:
        print('        ', o)

    # ------------------------------------------------------------ end-to-end
    print('\nend-to-end: cedict entry -> jyutping (the dict.js code path)')
    shown = 0
    for row in random.sample(jyutping_rows, 400):
        off = int(row.split('\t')[0])
        line = cedict.sub(off, cedict.index_of_nl(off)).rstrip('\r')
        got = lookup_jyutping(ced_jyutping, off)
        if got != row.split('\t')[1]:
            check('round-trip mismatch at offset ' + str(off), False)
            break
        if shown < 5 and CEDICT_LINE.match(line):
            m = CEDICT_LINE.match(line)
            print(f'        {m.group(1)} [{m.group(3)}] -> {{{got}}}')
            shown += 1
    else:
        check('lookup_jyutping round-trips for every sampled offset (n=400)', True)

    print()
    if failures:
        print(f'FAILURES: {failures}')
        sys.exit(1)
    print('ALL CHECKS PASSED')


if __name__ == '__main__':
    main()
