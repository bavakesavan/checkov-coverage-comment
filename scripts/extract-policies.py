#!/usr/bin/env python3
"""
Fetch the prisma-cloud-docs repo from GitHub, extract policy details from
.adoc files, and write a JSON file keyed by Checkov ID for fast lookups.

Usage:
    python3 extract-policies.py
    python3 extract-policies.py --output /path/to/policies.json
"""

import re
import json
import argparse
import subprocess
import tempfile
import shutil
from pathlib import Path

DOCS_REPO = 'https://github.com/hlxsites/prisma-cloud-docs'
POLICY_REF_PATH = 'docs/en/enterprise-edition/policy-reference'

# Matches URLs like: https://github.com/.../File.py[CKV_ALI_8]
CHECKOV_LINK_RE = re.compile(r'https?://\S+\[([A-Z0-9_]+)\]')
# Matches plain Checkov IDs like: CKV_ALI_8, CKV3_SAST_250, CKV2_AWS_1
CHECKOV_ID_RE = re.compile(r'\b(CKV[0-9A-Z_]+)\b')


def extract_table_value(lines: list[str], field: str) -> str | None:
    """
    In an AsciiDoc table section, find a row like:
        |Field Name
        |value
    Returns the stripped value string, or None if not found.
    """
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.lower() == f'|{field.lower()}':
            for j in range(i + 1, min(i + 4, len(lines))):
                val = lines[j].strip()
                if val:
                    return val.lstrip('|').strip()
    return None


def parse_checkov_id(raw: str) -> str | None:
    """Extract just the ID from a raw cell value (may contain a URL link)."""
    m = CHECKOV_LINK_RE.search(raw)
    if m:
        return m.group(1)
    m = CHECKOV_ID_RE.search(raw)
    if m:
        return m.group(1)
    return None


def parse_policy_file(path: Path) -> dict | None:
    """Parse a single .adoc policy file and return a policy record, or None."""
    text = path.read_text(encoding='utf-8', errors='replace')
    lines = text.splitlines()

    # Skip index/table files that list multiple policies
    if any('|Policy|Checkov ID' in l or '|Policy |Checkov ID' in l for l in lines[:60]):
        return None

    # Must have a Checkov ID row. Some files use "Checkov Check ID" instead of "Checkov ID".
    has_checkov = any('|Checkov ID' in l or '|Checkov Check ID' in l for l in lines)
    if not has_checkov:
        return None

    title = None
    for line in lines:
        if line.startswith('== ') and not line.startswith('=== '):
            title = line[3:].strip()
            break

    checkov_raw = extract_table_value(lines, 'Checkov ID') or extract_table_value(lines, 'Checkov Check ID')
    if not checkov_raw:
        return None
    checkov_id = parse_checkov_id(checkov_raw)
    if not checkov_id:
        return None

    severity = extract_table_value(lines, 'Severity')
    subtype = extract_table_value(lines, 'Subtype')

    frameworks_raw = extract_table_value(lines, 'Frameworks')
    frameworks: list[str] = []
    if frameworks_raw:
        frameworks = [f.strip() for f in re.split(r'[,\n]', frameworks_raw) if f.strip()]

    return {
        'checkovId': checkov_id,
        'title': title,
        'severity': severity,
        'subtype': subtype,
        'frameworks': frameworks if frameworks else None,
    }


def main():
    parser = argparse.ArgumentParser(description='Fetch prisma-cloud-docs and extract policy details')
    parser.add_argument(
        '--output',
        default=str(Path(__file__).parent.parent / 'data' / 'policies.json'),
        help='Output JSON file path (default: ../data/policies.json)',
    )
    args = parser.parse_args()

    tmpdir = tempfile.mkdtemp(prefix='prisma-cloud-docs-')
    try:
        print(f'Fetching {POLICY_REF_PATH} from {DOCS_REPO} (sparse checkout)...')
        subprocess.run(
            ['git', 'clone', '--depth', '1', '--filter=blob:none', '--sparse', '--quiet', DOCS_REPO, tmpdir],
            check=True,
        )
        subprocess.run(
            ['git', 'sparse-checkout', 'set', POLICY_REF_PATH],
            cwd=tmpdir,
            check=True,
            capture_output=True,
        )

        root = Path(tmpdir) / POLICY_REF_PATH
        adoc_files = list(root.rglob('*.adoc'))
        print(f'Scanning {len(adoc_files)} .adoc files...')

        policies: dict[str, dict] = {}
        skipped = 0
        duplicates = 0

        for path in sorted(adoc_files):
            record = parse_policy_file(path)
            if record is None:
                skipped += 1
                continue
            cid = record['checkovId']
            if cid in policies:
                duplicates += 1
                existing = policies[cid]
                if sum(v is not None for v in record.values()) > sum(v is not None for v in existing.values()):
                    policies[cid] = record
            else:
                policies[cid] = record

        output_path = Path(args.output)
        output_path.write_text(json.dumps(policies, indent=2, ensure_ascii=False), encoding='utf-8')

        print(f'Done.')
        print(f'  Policies extracted : {len(policies)}')
        print(f'  Files skipped      : {skipped}')
        print(f'  Duplicate IDs seen : {duplicates}')
        print(f'  Output written to  : {output_path}')

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == '__main__':
    main()
