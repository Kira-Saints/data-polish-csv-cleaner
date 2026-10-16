"""Central limits and constants.

Vercel serverless functions accept request and response bodies of at most
4.5 MB, so the limits below stay safely under that ceiling.
"""

MAX_FILE_BYTES = 3 * 1024 * 1024  # uploaded file size limit
MAX_ROWS = 20_000
MAX_COLUMNS = 100
MAX_OUTPUT_COLUMNS = 120
MAX_CELL_CHARS = 10_000
MAX_HEADER_CHARS = 200
MAX_OPTIONS_CHARS = 200_000
MAX_RESPONSE_CSV_BYTES = 3_500_000  # processed CSV returned inside the JSON response

PREVIEW_ROWS = 20
PROCESSED_PREVIEW_ROWS = 50

ALLOWED_EXTENSIONS = (".csv", ".tsv")
DELIMITER_CANDIDATES = (",", ";", "\t", "|")

# Values (compared case-insensitively, after trimming) treated as "missing"
# in addition to blank cells.
MISSING_TOKENS = frozenset({"n/a", "null", "nan", "none", "#n/a"})
