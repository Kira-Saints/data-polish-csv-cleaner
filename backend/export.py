"""CSV serialisation with spreadsheet formula-injection protection.

Mitigation: any cell starting with =, +, -, @, tab or carriage return gets a
leading apostrophe so spreadsheet apps show it as text. Plain numbers such as
-12.5 or +3 are left alone so ordinary numeric data is not altered.
"""

import csv
import io
import re

_DANGEROUS_START = ("=", "+", "-", "@", "\t", "\r")
_PLAIN_NUMBER = re.compile(r"^[+-]?(\d+(\.\d*)?|\.\d+)$")


def protect_cell(value: str) -> tuple[str, bool]:
    if value and value[0] in _DANGEROUS_START:
        if value[0] in "+-" and _PLAIN_NUMBER.match(value.strip()):
            return value, False
        return "'" + value, True
    return value, False


def to_csv(columns: list[str], rows: list[list[str]]) -> tuple[str, int]:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n", quoting=csv.QUOTE_MINIMAL)
    protected = 0

    def safe_row(values: list[str]) -> list[str]:
        nonlocal protected
        out = []
        for v in values:
            safe, changed = protect_cell(v)
            protected += changed
            out.append(safe)
        return out

    writer.writerow(safe_row(columns))
    for row in rows:
        writer.writerow(safe_row(row))
    return buffer.getvalue(), protected
