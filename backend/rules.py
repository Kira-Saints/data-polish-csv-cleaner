"""Pure value-level rules: emails, numbers and dates.

Everything here treats input strictly as data (regular expressions and
arithmetic only; nothing is ever evaluated or executed).
"""

import calendar
import re
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from .config import MISSING_TOKENS


def is_missing(value: str) -> bool:
    v = value.strip()
    return v == "" or v.lower() in MISSING_TOKENS


# ------------------------------------------------------------------------- emails
_LOCAL_CHARS = r"[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+"
_LOCAL_RE = re.compile(rf"^{_LOCAL_CHARS}(\.{_LOCAL_CHARS})*$")
_LABEL_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$")


def email_domain(value: str) -> str | None:
    """Return the lower-cased domain if `value` is a syntactically plausible
    email address, otherwise None. This does NOT check that the domain or
    mailbox exists."""
    v = value.strip()
    if not v or len(v) > 254 or v.count("@") != 1:
        return None
    local, domain = v.split("@")
    if not local or len(local) > 64 or not _LOCAL_RE.match(local):
        return None
    if len(domain) > 253:
        return None
    labels = domain.lower().split(".")
    if len(labels) < 2 or not all(_LABEL_RE.match(label) for label in labels):
        return None
    tld = labels[-1]
    if not ((tld.isalpha() and len(tld) >= 2) or tld.startswith("xn--")):
        return None
    return domain.lower()


# ------------------------------------------------------------------------ numbers
_PLAIN = re.compile(r"^\d+(\.\d+)?$")
_US = re.compile(r"^\d{1,3}(,\d{3})+(\.\d+)?$")
_EU = re.compile(r"^\d{1,3}(\.\d{3})+,\d+$")
_SPACED = re.compile(r"^\d{1,3}( \d{3})+([.,]\d+)?$")
_CURRENCY = ("$", "€", "£", "¥")
_SIGNS = ("+", "-")


def parse_number(value: str) -> Decimal | None:
    """Parse clearly recognisable numbers; return None otherwise.

    Accepted: 1234, 1234.5, 1,234.50, 1.234,50, 1 234, $12.50, (12.50), -7.
    Rejected (reported as invalid): ambiguous forms such as 12,5, scientific
    notation, text, and integers with leading zeros (IDs, ZIP codes).
    """
    s = value.strip().replace("\u00a0", " ").replace("\u202f", " ")
    if not s:
        return None
    negative = False
    if s.startswith("(") and s.endswith(")"):
        s, negative = s[1:-1].strip(), True
    sign = ""
    if s[:1] in _SIGNS:
        sign, s = s[0], s[1:].lstrip()
    if s[:1] in _CURRENCY:
        s = s[1:].lstrip()
    if not sign and s[:1] in _SIGNS:
        sign, s = s[0], s[1:].lstrip()

    if _PLAIN.match(s):
        clean = s
    elif _US.match(s):
        clean = s.replace(",", "")
    elif _EU.match(s):
        clean = s.replace(".", "").replace(",", ".")
    elif _SPACED.match(s):
        clean = s.replace(" ", "").replace(",", ".")
    else:
        return None

    if re.match(r"^0\d", clean) or len(clean) > 18:
        return None
    try:
        number = Decimal(clean)
    except InvalidOperation:
        return None
    return -number if (sign == "-" or negative) else number


def format_number(number: Decimal, places: int | None) -> str:
    if places is not None:
        number = number.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
    if number == 0:
        number = abs(number)
    return format(number, "f")


# --------------------------------------------------------------------------- dates
_MONTHS = {name.lower(): i for i, name in enumerate(calendar.month_name) if name}
_MONTHS.update({name.lower(): i for i, name in enumerate(calendar.month_abbr) if name})
_MONTHS["sept"] = 9

_ISO = re.compile(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$")
_NUMERIC = re.compile(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$")
_DMY_TEXT = re.compile(r"^(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([A-Za-z]{3,9})\.?[\s\-/.,]+(\d{4})$")
_MDY_TEXT = re.compile(r"^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$")


@dataclass
class DateResult:
    status: str  # "ok" | "ambiguous" | "invalid"
    value: date | None = None
    resolved: bool = False  # True when the user's explicit M/D or D/M rule was applied


def _make(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _result(d: date | None, resolved: bool = False) -> DateResult:
    return DateResult("ok", d, resolved) if d else DateResult("invalid")


def parse_date(value: str, ambiguous: str = "leave") -> DateResult:
    """Parse unambiguous dates. Purely numeric day/month pairs where both could
    be a month (e.g. 03/04/2026) are 'ambiguous' unless the user chose a rule."""
    s = " ".join(value.split())
    if not s:
        return DateResult("invalid")

    m = _ISO.match(s)
    if m:
        return _result(_make(int(m[1]), int(m[2]), int(m[3])))

    m = _NUMERIC.match(s)
    if m:
        a, b, year = int(m[1]), int(m[2]), int(m[3])
        if a > 12 and b > 12:
            return DateResult("invalid")
        if a > 12:
            return _result(_make(year, b, a))  # a must be the day
        if b > 12 or a == b:
            return _result(_make(year, a, b))  # b must be the day (or both equal)
        if ambiguous == "mdy":
            return _result(_make(year, a, b), resolved=True)
        if ambiguous == "dmy":
            return _result(_make(year, b, a), resolved=True)
        return DateResult("ambiguous")

    m = _DMY_TEXT.match(s)
    if m and m[2].lower() in _MONTHS:
        return _result(_make(int(m[3]), _MONTHS[m[2].lower()], int(m[1])))

    m = _MDY_TEXT.match(s)
    if m and m[1].lower() in _MONTHS:
        return _result(_make(int(m[3]), _MONTHS[m[1].lower()], int(m[2])))

    return DateResult("invalid")


def format_date(d: date, fmt: str) -> str:
    if fmt == "us":
        return f"{d.month:02d}/{d.day:02d}/{d.year:04d}"
    if fmt == "eu":
        return f"{d.day:02d}/{d.month:02d}/{d.year:04d}"
    return d.isoformat()
