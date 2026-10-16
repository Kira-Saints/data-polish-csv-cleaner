"""Structured API errors that never expose internals."""


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: list[str] | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []


def error_body(code: str, message: str, details: list[str] | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or []}}
