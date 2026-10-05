"""Import selected Kenney CC0 sounds; pip install numpy soundfile.
Usage: python scripts/audio/import-kenney.py /path/to/extracted-packs
The directory must contain casino/, interface/, rpg/ and *-LICENSE.txt.
Only selected files in the checked-in manifest are imported, never whole packs.
"""
from pathlib import Path
import json, sys
import numpy as np
import soundfile as sf

root = Path(__file__).resolve().parents[2]
manifest = json.loads((Path(__file__).parent / "assets.json").read_text())
source_root = Path(sys.argv[1])
for item in manifest["samples"]:
    data, rate = sf.read(source_root / item["pack"] / item["original"], always_2d=True)
    mono = data.mean(axis=1)
    audible = np.flatnonzero(np.abs(mono) > .001)
    if len(audible):
        mono = mono[max(0, audible[0] - int(rate * .004)):min(len(mono), audible[-1] + int(rate * .02))]
    peak = np.max(np.abs(mono)) if len(mono) else 0
    if not np.isfinite(peak) or peak == 0:
        raise ValueError("Silent or invalid source: " + item["original"])
    mono *= .60 / peak
    fade = min(int(rate * .003), len(mono) // 2)
    mono[:fade] *= np.linspace(0, 1, fade)
    mono[-fade:] *= np.linspace(1, 0, fade)
    output = root / "public" / item["src"].lstrip("/")
    output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(output, mono, rate, subtype="PCM_16")
    item["duration"] = round(len(mono) / rate, 3)
    print(output.relative_to(root), item["duration"], "s")
license_dir = root / "public" / manifest["assetRoot"] / "licenses"
license_dir.mkdir(parents=True, exist_ok=True)
for pack in {item["pack"] for item in manifest["samples"]}:
    (license_dir / ("Kenney-" + pack + ".txt")).write_bytes((source_root / (pack + "-LICENSE.txt")).read_bytes())
(root / "public" / manifest["assetRoot"] / "manifest.json").write_text(json.dumps(manifest["samples"], ensure_ascii=False, indent=2) + "\n")
