"""Provider-independent document storage abstraction for NyayaSetu.

Supports:
1. LocalStorageProvider: Offline, fast filesystem storage for development and automated pytest suites.
2. CloudflareR2StorageProvider: Production cloud object storage with S3-compatible API, SigV4 presigned URLs,
   and $0/GB bandwidth egress fees.
"""

from abc import ABC, abstractmethod
import asyncio
import io
import os
from pathlib import Path
from typing import Any, BinaryIO, Dict, Optional, Union

from app.core.config import Settings, settings
from app.core.errors import NotFoundException
from app.core.logging import logger


class BaseStorageProvider(ABC):
    """Abstract interface for document and evidence file storage."""

    @property
    @abstractmethod
    def backend_name(self) -> str:
        """Identifier name of the storage backend (e.g. 'local', 'r2')."""
        pass

    @property
    def supports_presigned_urls(self) -> bool:
        """Whether this provider can generate direct, short-lived presigned download URLs."""
        return False

    @abstractmethod
    async def upload(
        self,
        key: str,
        content: Union[bytes, BinaryIO],
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, str]] = None,
    ) -> str:
        """Upload document bytes or binary stream to storage under the given object key.

        Returns:
            str: The canonical storage key.
        """
        pass

    @abstractmethod
    async def download(self, key: str) -> bytes:
        """Download and return full binary content for the given storage key.

        Raises:
            NotFoundException: If the object does not exist.
        """
        pass

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete object at the given storage key.

        Returns:
            bool: True if deleted or already non-existent, False on error.
        """
        pass

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if an object exists at the given storage key."""
        pass

    @abstractmethod
    async def generate_download_url(
        self,
        key: str,
        expiry_seconds: int = 900,
        filename: Optional[str] = None,
        inline: bool = False,
    ) -> Optional[str]:
        """Generate a short-lived download URL if supported by the provider.

        Returns:
            Optional[str]: Presigned URL if supported, None otherwise.
        """
        pass

    @abstractmethod
    def get_local_path(self, key: str) -> Optional[Path]:
        """Return the local filesystem Path if stored locally on disk, otherwise None."""
        pass


class LocalStorageProvider(BaseStorageProvider):
    """Local filesystem storage provider for offline development and test execution."""

    def __init__(self, base_dir: Optional[Path] = None):
        if base_dir:
            self.base_dir = Path(base_dir).resolve()
        else:
            # Default vault location: backend/storage/vault
            self.base_dir = (
                Path(__file__).resolve().parent.parent.parent / "storage" / "vault"
            )
        self.base_dir.mkdir(parents=True, exist_ok=True)

    @property
    def backend_name(self) -> str:
        return "local"

    @property
    def supports_presigned_urls(self) -> bool:
        return False

    def _resolve_path(self, key: str) -> Path:
        """Resolve a storage key into an absolute local path preventing directory traversal."""
        # Clean relative key
        clean_key = key.replace("\\", "/").lstrip("/")
        # If key starts with 'vault/', strip prefix since base_dir is already the vault root
        if clean_key.startswith("vault/"):
            clean_key = clean_key[len("vault/") :]
        resolved = (self.base_dir / clean_key).resolve()
        # Ensure path does not escape base_dir
        if not str(resolved).startswith(str(self.base_dir)):
            raise ValueError(f"Security error: Storage key '{key}' resolves outside vault directory.")
        return resolved

    async def upload(
        self,
        key: str,
        content: Union[bytes, BinaryIO],
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, str]] = None,
    ) -> str:
        target_path = self._resolve_path(key)
        target_path.parent.mkdir(parents=True, exist_ok=True)

        if isinstance(content, bytes):
            data = content
        else:
            data = content.read()

        def _write():
            with open(target_path, "wb") as f:
                f.write(data)

        await asyncio.to_thread(_write)
        return key

    async def download(self, key: str) -> bytes:
        target_path = self._resolve_path(key)
        if not target_path.is_file():
            raise NotFoundException(message=f"Document with key '{key}' not found in local vault.")

        def _read():
            with open(target_path, "rb") as f:
                return f.read()

        return await asyncio.to_thread(_read)

    async def delete(self, key: str) -> bool:
        try:
            target_path = self._resolve_path(key)
            if target_path.is_file():
                await asyncio.to_thread(target_path.unlink)
            return True
        except Exception as exc:
            logger.warning(f"Failed to delete local vault file '{key}': {exc}")
            return False

    async def exists(self, key: str) -> bool:
        try:
            target_path = self._resolve_path(key)
            return await asyncio.to_thread(target_path.is_file)
        except Exception:
            return False

    async def generate_download_url(
        self,
        key: str,
        expiry_seconds: int = 900,
        filename: Optional[str] = None,
        inline: bool = False,
    ) -> Optional[str]:
        # Local filesystem cannot generate external presigned URLs.
        # Callers fall back to internal token streaming endpoint.
        return None

    def get_local_path(self, key: str) -> Optional[Path]:
        try:
            return self._resolve_path(key)
        except Exception:
            return None


class CloudflareR2StorageProvider(BaseStorageProvider):
    """Cloudflare R2 storage provider using S3-compatible API and SigV4 authentication."""

    def __init__(
        self,
        endpoint_url: str = "",
        bucket_name: str = "",
        access_key_id: str = "",
        secret_access_key: str = "",
        region: str = "auto",
        presigned_expiry_seconds: int = 900,
        s3_client: Optional[Any] = None,
        account_id: Optional[str] = None,
    ):
        self.endpoint_url = endpoint_url.strip() if endpoint_url else ""
        if not self.endpoint_url and account_id:
            self.endpoint_url = f"https://{account_id.strip()}.r2.cloudflarestorage.com"
        self.bucket_name = bucket_name.strip()
        self.access_key_id = access_key_id.strip()
        self.secret_access_key = secret_access_key.strip()
        self.region = region.strip() if region else "auto"
        self.presigned_expiry_seconds = presigned_expiry_seconds

        if s3_client is not None:
            self._s3_client = s3_client
        else:
            import boto3
            from botocore.config import Config

            self._s3_client = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                config=Config(signature_version="s3v4"),
                region_name=self.region,
            )

    @property
    def backend_name(self) -> str:
        return "r2"

    @property
    def supports_presigned_urls(self) -> bool:
        return True

    async def upload(
        self,
        key: str,
        content: Union[bytes, BinaryIO],
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, str]] = None,
    ) -> str:
        clean_key = key.replace("\\", "/").lstrip("/")
        extra_args: Dict[str, Any] = {"ContentType": content_type}
        if metadata:
            extra_args["Metadata"] = metadata

        if isinstance(content, bytes):
            body_stream = io.BytesIO(content)
        else:
            body_stream = content

        def _upload():
            self._s3_client.upload_fileobj(
                Fileobj=body_stream,
                Bucket=self.bucket_name,
                Key=clean_key,
                ExtraArgs=extra_args,
            )

        await asyncio.to_thread(_upload)
        return clean_key

    async def download(self, key: str) -> bytes:
        import botocore.exceptions

        clean_key = key.replace("\\", "/").lstrip("/")

        def _download():
            try:
                response = self._s3_client.get_object(
                    Bucket=self.bucket_name,
                    Key=clean_key,
                )
                return response["Body"].read()
            except botocore.exceptions.ClientError as exc:
                code = exc.response.get("Error", {}).get("Code", "")
                if code in ("NoSuchKey", "404", "NotFound"):
                    raise NotFoundException(message=f"Document with key '{clean_key}' was not found in storage.")
                raise

        return await asyncio.to_thread(_download)

    async def delete(self, key: str) -> bool:
        import botocore.exceptions

        clean_key = key.replace("\\", "/").lstrip("/")

        def _delete():
            try:
                self._s3_client.delete_object(
                    Bucket=self.bucket_name,
                    Key=clean_key,
                )
                return True
            except botocore.exceptions.ClientError as exc:
                logger.warning(f"Error deleting object '{clean_key}' from R2: {exc}")
                return False

        return await asyncio.to_thread(_delete)

    async def exists(self, key: str) -> bool:
        import botocore.exceptions

        clean_key = key.replace("\\", "/").lstrip("/")

        def _exists():
            try:
                self._s3_client.head_object(
                    Bucket=self.bucket_name,
                    Key=clean_key,
                )
                return True
            except botocore.exceptions.ClientError:
                return False

        return await asyncio.to_thread(_exists)

    async def generate_download_url(
        self,
        key: str,
        expiry_seconds: int = 900,
        filename: Optional[str] = None,
        inline: bool = False,
    ) -> Optional[str]:
        clean_key = key.replace("\\", "/").lstrip("/")
        params: Dict[str, Any] = {
            "Bucket": self.bucket_name,
            "Key": clean_key,
        }

        disposition = "inline" if inline else "attachment"
        if filename:
            # Escape double quotes in filename
            safe_name = filename.replace('"', '\\"')
            params["ResponseContentDisposition"] = f'{disposition}; filename="{safe_name}"'
        else:
            params["ResponseContentDisposition"] = disposition

        def _presign():
            return self._s3_client.generate_presigned_url(
                ClientMethod="get_object",
                Params=params,
                ExpiresIn=expiry_seconds or self.presigned_expiry_seconds,
            )

        return await asyncio.to_thread(_presign)

    def get_local_path(self, key: str) -> Optional[Path]:
        return None


# Module-level provider instance caching and dependency-injection helper
_storage_provider_singleton: Optional[BaseStorageProvider] = None


def get_storage_provider(settings_obj: Optional[Settings] = None) -> BaseStorageProvider:
    """Resolve and return active storage provider based on application configuration."""
    global _storage_provider_singleton
    cfg = settings_obj or settings

    if _storage_provider_singleton is not None:
        return _storage_provider_singleton

    provider_name = cfg.effective_storage_provider

    if cfg.is_testing:
        return LocalStorageProvider()

    if provider_name == "r2":
        return CloudflareR2StorageProvider(
            endpoint_url=cfg.effective_storage_endpoint_url or "",
            bucket_name=cfg.effective_storage_bucket,
            access_key_id=cfg.effective_storage_access_key_id,
            secret_access_key=cfg.effective_storage_secret_access_key,
            region=cfg.effective_storage_region,
            presigned_expiry_seconds=cfg.STORAGE_PRESIGNED_EXPIRY_SECONDS,
            account_id=cfg.R2_ACCOUNT_ID,
        )

    return LocalStorageProvider()


def set_storage_provider(provider: Optional[BaseStorageProvider]) -> None:
    """Explicitly override storage provider (used for testing or dependency injection)."""
    global _storage_provider_singleton
    _storage_provider_singleton = provider


def get_storage() -> BaseStorageProvider:
    """FastAPI dependency for injecting the configured storage provider."""
    return get_storage_provider()
