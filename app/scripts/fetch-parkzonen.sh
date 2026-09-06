#!/usr/bin/env bash
# Fetch the authoritative Berlin parking-zone data.
#
# Source: Geodateninfrastruktur Berlin, WFS 2.0.0.
# Licence: Datenlizenz Deutschland Zero 2.0 (no attribution required).
#
# The service asks for EPSG:4326 explicitly: the server reprojects from its
# native EPSG:25833 and emits GeoJSON-conformant lon/lat, so no client-side
# reprojection is needed.
#
# Note on TLS: gdi.berlin.de is signed by the "Telekom Security TLS RSA Root
# 2023", which is missing from some container images' trust stores. If curl
# reports a self-signed certificate in the chain, append a current Mozilla root
# bundle (e.g. python -c 'import certifi; print(certifi.where())') to the system
# CA file and pass it via --cacert. Do not disable verification.
set -euo pipefail

BASE="https://gdi.berlin.de/services/wfs/parkraumbewirtschaftung"
OUT="${1:-parkzonen.geojson}"

curl -fsS --max-time 120 \
  "${BASE}?service=WFS&version=2.0.0&request=GetFeature\
&typeNames=parkraumbewirtschaftung:parkzonen\
&outputFormat=application/json\
&srsName=urn:ogc:def:crs:EPSG::4326" \
  -o "$OUT"

echo "Wrote $OUT ($(wc -c < "$OUT") bytes)"
