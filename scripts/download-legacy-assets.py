import concurrent.futures
import hashlib
import io
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image, ImageOps


ROOT = pathlib.Path(__file__).resolve().parent.parent
PRIVATE_ROOT = (ROOT / "_private_reference").resolve()
PREPARED_DIR = PRIVATE_ROOT / "migration-work" / "prepared-production-data"
PREPARED_DATA = PREPARED_DIR / "prepared-data.json"
AVATAR_MANIFEST = PREPARED_DIR / "asset-manifest.json"
OUTPUT_ROOT = PRIVATE_ROOT / "migration-work" / "assets"
READY_ROOT = OUTPUT_ROOT / "ready"
RESULT_PATH = OUTPUT_ROOT / "asset-download-result.json"
ALLOWED_HOST = "wqnyoesvwnqfjqsbzmsi.supabase.co"
MAX_BYTES = 25 * 1024 * 1024
MAX_WORKERS = 8


def assert_private_path(target: pathlib.Path) -> None:
    resolved = target.resolve()
    if PRIVATE_ROOT != resolved and PRIVATE_ROOT not in resolved.parents:
        raise RuntimeError("Asset migration path must stay inside _private_reference.")


class RestrictedRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        parsed = urllib.parse.urlparse(new_url)
        if parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST:
            raise urllib.error.HTTPError(new_url, 403, "Redirect target is not allowed", headers, file_pointer)
        return super().redirect_request(request, file_pointer, code, message, headers, new_url)


OPENER = urllib.request.build_opener(RestrictedRedirectHandler())


def validate_source_url(value: str) -> str:
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST:
        raise ValueError("Source URL is outside the approved legacy Storage host.")
    if not parsed.path.startswith("/storage/v1/object/"):
        raise ValueError("Source URL is not a Supabase Storage object URL.")
    query_names = {name for name, _ in urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)}
    if parsed.username or parsed.password or parsed.fragment or not query_names.issubset({"t", "token"}):
        raise ValueError("Source URL contains unsupported credentials or query parameters.")
    return value


def content_url_entries(prepared: dict) -> list[dict]:
    entries: list[dict] = []

    def walk(value, path_parts, record):
        if isinstance(value, str):
            try:
                validate_source_url(value)
            except ValueError:
                return
            digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:20]
            safe_key = "".join(char if char.isalnum() or char in "-_" else "-" for char in record["key"])
            entries.append(
                {
                    "kind": "website_content",
                    "record_id": record["id"],
                    "content_key": record["key"],
                    "json_path": path_parts,
                    "source_url": value,
                    "target_bucket": "website-assets",
                    "target_path": f"migrated-content/{safe_key}/{digest}.webp",
                }
            )
            return
        if isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, path_parts + [index], record)
            return
        if isinstance(value, dict):
            for key, child in value.items():
                walk(child, path_parts + [key], record)

    for row in prepared.get("tables", {}).get("website_content", []):
        walk(row.get("content"), [], row)
    return entries


def normalize_avatar_entry(entry: dict) -> dict:
    source_url = validate_source_url(entry["source_url"])
    target_path = str(entry["target_path"]).replace("\\", "/").lstrip("/")
    if ".." in pathlib.PurePosixPath(target_path).parts:
        raise ValueError("Unsafe target path.")
    return {
        "kind": "avatar",
        "owner_type": entry["owner_type"],
        "owner_id": entry["owner_id"],
        "source_url": source_url,
        "target_bucket": "avatars",
        "target_path": target_path,
    }


def download_bytes(url: str) -> tuple[bytes, str]:
    request = urllib.request.Request(
        url,
        method="GET",
        headers={"User-Agent": "LPQ-ReadOnly-Asset-Migration/1.0", "Accept": "image/*"},
    )
    with OPENER.open(request, timeout=45) as response:
        content_type = response.headers.get_content_type()
        if not content_type.startswith("image/"):
            raise ValueError("Storage object is not an image.")
        declared_size = response.headers.get("Content-Length")
        if declared_size and int(declared_size) > MAX_BYTES:
            raise ValueError("Storage object exceeds the migration size limit.")
        payload = response.read(MAX_BYTES + 1)
        if len(payload) > MAX_BYTES:
            raise ValueError("Storage object exceeds the migration size limit.")
        if not payload:
            raise ValueError("Storage object is empty.")
        return payload, content_type


def convert_to_webp(payload: bytes, destination: pathlib.Path) -> dict:
    with Image.open(io.BytesIO(payload)) as source:
        source.load()
        image = ImageOps.exif_transpose(source)
        if getattr(image, "is_animated", False):
            image.seek(0)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, format="WEBP", quality=88, method=6)
        return {"width": image.width, "height": image.height}


def migrate_entry(entry: dict) -> dict:
    destination = READY_ROOT / entry["target_bucket"] / pathlib.PurePosixPath(entry["target_path"])
    assert_private_path(destination)
    try:
        payload, source_type = download_bytes(entry["source_url"])
        dimensions = convert_to_webp(payload, destination)
        output_bytes = destination.read_bytes()
        return {
            **entry,
            "status": "ready",
            "source_content_type": source_type,
            "output_bytes": len(output_bytes),
            "output_sha256": hashlib.sha256(output_bytes).hexdigest(),
            **dimensions,
        }
    except Exception as error:  # The safe result intentionally omits URL and payload.
        return {
            **{key: value for key, value in entry.items() if key != "source_url"},
            "status": "failed",
            "error_type": type(error).__name__,
            "error_message": str(error)[:240],
        }


def main() -> int:
    for target in (PREPARED_DATA, AVATAR_MANIFEST, OUTPUT_ROOT):
        assert_private_path(target)
    prepared = json.loads(PREPARED_DATA.read_text(encoding="utf-8"))
    avatar_entries = [normalize_avatar_entry(entry) for entry in json.loads(AVATAR_MANIFEST.read_text(encoding="utf-8"))]
    website_entries = content_url_entries(prepared)
    entries = avatar_entries + website_entries

    unique_entries = []
    seen_targets = set()
    for entry in entries:
        target_key = (entry["target_bucket"], entry["target_path"])
        if target_key in seen_targets:
            continue
        seen_targets.add(target_key)
        unique_entries.append(entry)

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        results = list(executor.map(migrate_entry, unique_entries))

    ready = [result for result in results if result["status"] == "ready"]
    failed = [result for result in results if result["status"] == "failed"]
    result_document = {
        "format_version": 1,
        "source_host": ALLOWED_HOST,
        "read_only": True,
        "requested": len(unique_entries),
        "ready": len(ready),
        "failed": len(failed),
        "results": results,
    }
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    RESULT_PATH.write_text(json.dumps(result_document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("Legacy asset read-only migration completed.")
    print(f"Requested: {len(unique_entries)}")
    print(f"Ready: {len(ready)}")
    print(f"Failed: {len(failed)}")
    print(f"Avatar ready: {sum(1 for item in ready if item['kind'] == 'avatar')}")
    print(f"Website asset ready: {sum(1 for item in ready if item['kind'] == 'website_content')}")
    return 0 if not failed else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Legacy asset migration failed safely: {type(error).__name__}", file=sys.stderr)
        raise SystemExit(1)
