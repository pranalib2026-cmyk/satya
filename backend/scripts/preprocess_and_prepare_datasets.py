#!/usr/bin/env python3
"""Phase 3 & 4 CLI: Preprocess raw external datasets and prepare RAG-ready chunks."""

from pathlib import Path
import json
import sys

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.modules.legal_knowledge.external_dataset_pipeline import preprocess_all_datasets


def main() -> int:
    satya_root = backend_dir.parent
    audit = preprocess_all_datasets(satya_root)
    print(json.dumps({
        "total_documents_processed": audit["total_documents_processed"],
        "total_chunks_generated": audit["total_chunks_generated"],
        "chunks_by_dataset": audit["chunks_by_dataset"],
        "duplicates_removed": audit["duplicates_removed"],
        "outdated_or_superseded_records": audit["outdated_or_superseded_records"],
        "corrupted_or_incomplete_count": len(audit["corrupted_or_incomplete_records"]),
        "dataset_counts": audit["dataset_counts"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
