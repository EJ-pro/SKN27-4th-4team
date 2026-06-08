"""
Run recommendation_service CLI from repo root or backend/.

Usage (from repo root):
  python backend/scripts/run_recommendation_cli.py --scenario 0
  python backend/scripts/run_recommendation_cli.py --list-scenarios

Equivalent (from backend/):
  python -m recommendation_service.cli --scenario 0
"""
from __future__ import annotations

import runpy
import sys
from pathlib import Path


def main() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    sys.argv[0] = str(backend_dir / "recommendation_service" / "cli.py")
    runpy.run_module("recommendation_service.cli", run_name="__main__")


if __name__ == "__main__":
    main()