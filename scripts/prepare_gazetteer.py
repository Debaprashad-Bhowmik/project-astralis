"""Convert the USGS lunar center-point KMZ into the browser feature catalog."""

import argparse
import json
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


def gazetteer(path):
    with ZipFile(path) as archive:
        kml = next(name for name in archive.namelist() if name.lower().endswith(".kml"))
        document = ET.fromstring(archive.read(kml))
    result = []
    for point in document.findall(".//{*}Placemark"):
        fields = {node.attrib["name"]: node.text for node in point.findall(".//{*}SimpleData")}
        if fields["approval"] != "Adopted by IAU":
            continue
        longitude, latitude = map(float, point.findtext(".//{*}Point/{*}coordinates").split(",")[:2])
        result.append(dict(id=int(fields["link"].rsplit("/", 1)[-1]), name=point.findtext("{*}name"),
                           kind=fields["type"].split(",")[0], lat=round(latitude, 5), lon=round(longitude, 5),
                           diameter=round(float(fields["diameter"] or 0), 2)))
    return sorted(result, key=lambda item: (item["name"].casefold(), item["id"]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kmz", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/gazetteer.json"))
    args = parser.parse_args()
    features = gazetteer(args.kmz)
    args.output.write_text(json.dumps(features, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(features):,} IAU-approved lunar features")
