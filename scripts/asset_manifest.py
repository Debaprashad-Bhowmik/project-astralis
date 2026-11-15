"""Record or verify SHA-256 hashes for release data and display assets.

Only files Git considers tracked or non-ignored are included, so local downloads
and superseded textures do not enter the release manifest. No dependencies beyond
Python's standard library and Git are needed.
"""

import argparse
import hashlib
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs" / "asset-manifest.sha256"


def entries():
    names = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "assets", "data"],
        cwd=ROOT,
    ).decode("utf-8").split("\0")
    result = []
    for name in sorted(set(filter(None, names))):
        path = ROOT / name
        with path.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        result.append(f"{digest}  {name}")
    return "\n".join(result) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    options = parser.parse_args()
    expected = entries()
    if options.check:
        if not MANIFEST.exists() or MANIFEST.read_text(encoding="utf-8") != expected:
            raise SystemExit("Bundled files differ from docs/asset-manifest.sha256. Review sources and regenerate deliberately.")
        print(f"Verified {len(expected.splitlines())} bundled files.")
    else:
        MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(expected, encoding="utf-8", newline="\n")
        print(f"Recorded {len(expected.splitlines())} bundled files.")


if __name__ == "__main__":
    main()
