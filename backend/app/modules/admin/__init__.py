"""Administrative & Operations Control Module."""


def __getattr__(name: str):
    if name == "admin_router":
        from app.modules.admin.router import router
        return router
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ["admin_router"]
