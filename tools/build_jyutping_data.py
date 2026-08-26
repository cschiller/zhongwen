#!/usr/bin/env python3
"""
Build script for converting cccanto dictionaries into indexable files for lookup.

Re-run whenever new versions of the cccanto OR cedict dictionaries are pulled in

    python3 tools/build_jyutping_data.py

CCCanto dictionaries are pulled from https://cantonese.org/download.html and placed
into tools/sources. The following outputs are generated and placed into /data
alongside the cedict dictionaries

    File                   Format
    cedict-jyutping.idx    <offset>\\t<jyutping>   offsets into cedict_ts.u8

Call with --download to automatically download the latest cantonese dictionaries
"""

import argparse
import io
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

# Resolved from this file's location, so the script runs from any directory.
TOOLS = Path(__file__).resolve().parent
SOURCES = TOOLS / 'sources'
DATA = TOOLS.parent / 'data'

CEDICT = DATA / 'cedict_ts.u8'
READINGS = SOURCES / 'cccedict-canto-readings.txt'
CCCANTO = SOURCES / 'cccanto-webdist.txt'

UNIHAN = SOURCES / 'Unihan_Readings.txt'

OUT_CEDICT_JYUTPING = DATA / 'cedict-jyutping.idx'

# Source for cantonese dictionaries
DOWNLOAD_PAGE = 'https://cantonese.org/download.html'
DOWNLOADS = {
    READINGS: re.compile(r'cccedict-canto-readings-(\d+)\.zip', re.IGNORECASE),
    CCCANTO: re.compile(r'cccanto-(\d+)\.zip', re.IGNORECASE),
}

OFFSET_WIDTH = 8
MAX_MALFORMED = 5

USER_AGENT = 'zhongwen-build-jyutping-data/1.0'
MIN_DOWNLOAD_ENTRIES = 10000

# Dictionary Formatting:

# traditional simplified [pinyin] /defs/
CEDICT_LINE = re.compile(r'^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s*/(.*)/\s*$')

# traditional simplified [pinyin] {jyutping} [/defs/] [# trailing comment]
CANTO_LINE = re.compile(r'^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s*\{([^}]*)\}\s*(?:/(.*)/)?(?:\s*#.*)?\s*$')


def u16_len(s):
    """Length of s in UTF-16 code units, i.e. its JavaScript .length."""
    return len(s.encode('utf-16-le')) // 2


def u16_key(s):
    """Sort key reproducing JavaScript string comparison."""
    return s.encode('utf-16-be')


def norm_pinyin(p):
    """Join key against the Cantonese sources; they differ from cedict on both
    spacing and capitalisation, so both are folded away."""
    return p.replace(' ', '').lower()


def pad(offset):
    s = str(offset)
    if len(s) > OFFSET_WIDTH:
        sys.exit(f'offset {offset} exceeds OFFSET_WIDTH={OFFSET_WIDTH}')
    return s.zfill(OFFSET_WIDTH)


def rel(path):
    """Path relative to the project root, for readable output."""
    return path.relative_to(TOOLS.parent)


def read_js_text(path):
    """Read a file the way fetch().text() would: no newline translation."""
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


def ssl_context():
    """Certificate verification is never disabled here; if the trust store is
    unusable the download fails loudly instead of falling back to plaintext."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def http_get(url):
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=60, context=ssl_context()) as response:
            return response.read()
    except urllib.error.URLError as error:
        reason = getattr(error, 'reason', error)
        sys.exit(f'could not fetch {url}: {reason}')


def discover_downloads():
    """Find the current archive URL for each source on the download page."""
    print(f'reading {DOWNLOAD_PAGE}')
    html = http_get(DOWNLOAD_PAGE).decode('utf-8', errors='replace')
    hrefs = re.findall(r'href=["\']([^"\']+\.zip)["\']', html, re.IGNORECASE)

    found = {}
    for target, pattern in DOWNLOADS.items():
        matches = [(int(m.group(1)), h) for h in hrefs
                   if (m := pattern.fullmatch(h.rsplit('/', 1)[-1]))]
        if not matches:
            sys.exit(f'no link matching {pattern.pattern} on {DOWNLOAD_PAGE}')
        version, href = max(matches)          # filenames are dated: YYMMDD
        found[target] = (urllib.parse.urljoin(DOWNLOAD_PAGE, href), version)
    return found


def extract_text(archive_bytes, url):
    """Pull the single .txt out of a downloaded zip; its name varies by release."""
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as zf:
        names = [n for n in zf.namelist()
                 if n.lower().endswith('.txt') and not n.startswith('__MACOSX')]
        if len(names) != 1:
            sys.exit(f'expected exactly one .txt in {url}, found {names}')
        return names[0], zf.read(names[0]).decode('utf-8')


def download_sources():
    """Refresh tools/sources/ from cantonese.org. Existing files are kept as .bak."""
    SOURCES.mkdir(parents=True, exist_ok=True)

    for target, (url, version) in discover_downloads().items():
        print(f'\n{rel(target)}')
        print(f'  from    : {url}')

        member, text = extract_text(http_get(url), url)

        # If new file unparsable, exit and continue to use existing
        entries = sum(1 for line in text.split('\n')
                      if CANTO_LINE.match(line.rstrip('\r')))
        if entries < MIN_DOWNLOAD_ENTRIES:
            sys.exit(f'  only {entries} parsable entries in {member}; refusing to install')

        if target.exists():
            if target.read_bytes() == text.encode('utf-8'):
                print(f'  version : {version} (unchanged)')
                continue
            backup = target.with_suffix(target.suffix + '.bak')
            backup.write_bytes(target.read_bytes())
            print(f'  previous: kept as {rel(backup)}  <-- local edits are in here')

        # newline='' keeps whatever line endings upstream shipped, byte for byte.
        with open(target, 'w', encoding='utf-8', newline='') as f:
            f.write(text)
        print(f'  version : {version}')
        print(f'  member  : {member}  ({entries} entries)')


def scan_cedict():
    """Offsets of every cedict entry, plus the lookup tables built from them."""
    text = read_js_text(CEDICT)
    by_key = defaultdict(list)   # (trad, norm pinyin) -> [offset]
    simp_by_key = {}             # (trad, norm pinyin) -> simplified form
    offset = 0
    count = 0
    for line in text.split('\n'):
        stripped = line.rstrip('\r')
        if not stripped.startswith('#'):
            m = CEDICT_LINE.match(stripped)
            if m:
                trad, simp, pinyin, _defs = m.groups()
                by_key[(trad, norm_pinyin(pinyin))].append(offset)
                simp_by_key[(trad, norm_pinyin(pinyin))] = simp
                count += 1
        offset += u16_len(line) + 1   # + 1 for the '\n' that split() removed
    return by_key, simp_by_key, count


def read_readings():
    """(trad, norm pinyin) -> jyutping, from the CC-CEDICT readings list."""
    out = {}
    conflicts = 0
    for raw in read_js_text(READINGS).split('\n'):
        line = raw.rstrip('\r')
        if line.startswith('#') or not line.strip():
            continue
        m = CANTO_LINE.match(line)
        if not m:
            sys.exit(f'unparsed readings line: {line!r}')
        trad, _simp, pinyin, jyutping, _defs = m.groups()
        key = (trad, norm_pinyin(pinyin))
        if key in out and out[key] != jyutping:
            conflicts += 1
        out.setdefault(key, jyutping)
    return out, conflicts


def read_cccanto():
    """(trad, norm pinyin) -> jyutping, from CC-Canto.

    Read for its readings only. CC-Canto is also a dictionary in its own right,
    of words cedict does not contain, but shipping that is a separate change —
    see tools/reference/. Here every line counts the same whether or not it
    carries a definition.
    """
    out = {}
    unparsed = []
    for raw in read_js_text(CCCANTO).split('\n'):
        line = raw.rstrip('\r')
        if line.startswith('#') or not line.strip():
            continue
        m = CANTO_LINE.match(line)
        if not m:
            unparsed.append(line)
            continue
        trad, _simp, pinyin, jyutping, _defs = m.groups()
        out.setdefault((trad, norm_pinyin(pinyin)), jyutping)
    # Skip malformed lines, but treat a large count as a regex regression
    # rather than a data defect and refuse to build.
    if unparsed:
        sys.stdout.flush()   # keep these in order with the stdout progress above
        for line in unparsed[:10]:
            print(f'  SKIPPED malformed: {line!r}', file=sys.stderr)
        if len(unparsed) > MAX_MALFORMED:
            sys.exit(f'{len(unparsed)} unparsed CC-Canto lines '
                     f'(> {MAX_MALFORMED}); aborting')
        print(f'  ({len(unparsed)} malformed line(s) skipped)', file=sys.stderr)
    return out


def read_unihan():
    """character -> Cantonese reading, from the Unihan kCantonese field."""
    if not UNIHAN.exists():
        return {}
    out = {}
    for raw in read_js_text(UNIHAN).split('\n'):
        line = raw.rstrip('\r')
        if line.startswith('#') or not line.strip():
            continue
        fields = line.split('\t')
        if len(fields) == 3 and fields[1] == 'kCantonese':
            # A handful of code points list several readings; take the first.
            out[chr(int(fields[0][2:], 16))] = fields[2].split()[0]
    return out


def write_offset_index(path, pairs):
    """pairs: iterable of (offset, jyutping). Sorted numerically via padding."""
    lines = sorted((f'{pad(o)}\t{j}' for o, j in pairs), key=u16_key)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        for line in lines:
            f.write(line + '\n')
    return len(lines)


def main():
    parser = argparse.ArgumentParser(description='Generate the Jyutping lookup data for Zhongwen.')
    parser.add_argument(
        '--download', action='store_true',
        help='pull dictionaries from cantonese.org before generating. '
             'Any existing source file saved as .bak for backup'
    )
    args = parser.parse_args()

    if args.download:
        download_sources()
        print()

    for path in (CEDICT, READINGS, CCCANTO):
        if not path.exists():
            sys.exit(f'missing {rel(path)}'
                     + ('  (try --download)' if path.parent == SOURCES else ''))

    ced_by_key, ced_simp, ced_count = scan_cedict()
    readings, read_conflicts = read_readings()
    supplement = read_cccanto()

    print(f'cedict entries                : {ced_count}')
    print(f'readings-list keys            : {len(readings)}'
          f'{f" ({read_conflicts} conflicts ignored)" if read_conflicts else ""}')
    print(f'CC-Canto reading keys         : {len(supplement)}')

    # ---- cedict-jyutping.idx ---------------------------------------------
    # Primary source is the readings list; CC-Canto fills the gaps it leaves,
    # and Unihan is a last resort for lone characters neither one covers.
    unihan = read_unihan()

    pairs = []
    from_readings = from_supplement = from_unihan = 0
    polyphonic = 0
    # How many distinct pinyin readings cedict gives each single character, so
    # the ambiguous ones can be counted rather than silently glossed over.
    pinyin_count = defaultdict(set)
    for trad, pinyin in ced_by_key:
        if len(trad) == 1:
            pinyin_count[trad].add(pinyin)

    for key, offsets in ced_by_key.items():
        trad = key[0]
        jyutping = readings.get(key)
        if jyutping is not None:
            from_readings += 1
        else:
            jyutping = supplement.get(key)
            if jyutping is not None:
                from_supplement += 1
            elif len(trad) == 1:
                # Last resort for a lone character: the Unihan reading, looked
                # up under either script. Unihan is per character and knows
                # nothing of senses, so a character cedict reads several ways
                # gets the same Cantonese reading on all of them.
                jyutping = unihan.get(trad) or unihan.get(ced_simp.get(key, ''))
                if jyutping is None:
                    continue
                from_unihan += 1
                if len(pinyin_count[trad]) > 1:
                    polyphonic += 1
            else:
                continue
        for o in offsets:
            pairs.append((o, jyutping))

    n = write_offset_index(OUT_CEDICT_JYUTPING, pairs)
    print(f'\n{rel(OUT_CEDICT_JYUTPING)}')
    print(f'  entries with a reading      : {n} / {ced_count} '
          f'({100 * n / ced_count:.1f}%)')
    print(f'    from readings list        : {from_readings} keys')
    print(f'    from CC-Canto             : {from_supplement} keys')
    if unihan:
        print(f'    from Unihan (1 char only) : {from_unihan} keys'
              f'  ({polyphonic} on characters cedict reads more than one way)')
    else:
        print(f'    Unihan layer skipped      : {rel(UNIHAN)} not present')

if __name__ == '__main__':
    main()
