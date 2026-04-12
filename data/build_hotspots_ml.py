"""
build_hotspots_ml.py  –  Builds day/night hotspot polygons from Nagpur crime
CSV using DBSCAN.  Writes GeoJSON to the /data folder.

═══════════════════════════════════════════════════════════════════════════════
WHAT WAS WRONG (original parameters)
═══════════════════════════════════════════════════════════════════════════════

Problem 1 — EPS_METERS = 200 was too coarse
  In Nagpur's dense city centre, crime records are packed within metres of
  each other.  A 200 m epsilon chains ALL of them into a handful of
  mega-clusters (count 1 000–16 000).  Meanwhile suburban records that sit
  100–150 m apart were also swept in.
  Fix: EPS_METERS = 100  (finer spatial resolution, splits mega-clusters
  into meaningful neighbourhood-level hotspots)

Problem 2 — MIN_SAMPLES = 2 created pure noise clusters
  Any 2 crime records within 200 m formed a "cluster".  This produced
  26/32 night clusters with count 2–6 — effectively just pairs of
  co-incident records.  These hit MIN_BUF_M (80 m) and all look identical.
  Fix: MIN_SAMPLES = 10  (a cluster must represent a real pattern,
  not two unlucky neighbours)

Problem 3 — MAX_BUF_M = 180 was the same for count=2 and count=11132
  Every genuine hotspot was capped at a 360 m square polygon regardless
  of how large the cluster actually was.  The polygon size carried no
  information.
  Fix: half_m scales with sqrt(count), clamped to [MIN_BUF_M, MAX_BUF_M].
  MIN_BUF_M = 80 m unchanged; MAX_BUF_M raised to 400 m so large clusters
  get proportionally larger polygons.

Problem 4 — Euclidean DBSCAN metric on lat/lon degrees is not isotropic
  At lat 21°, 1° lon ≈ 103 km while 1° lat ≈ 111 km — an 8% distortion.
  The original code used eps_deg = EPS_METERS / 111320 for BOTH axes.
  Fix: scale lon coordinates by cos(mean_lat) before clustering so the
  epsilon is metrically uniform.

Result of original parameters:
  Night: 6 critical + 26 low  (nothing in moderate/high range)
  Day:   6 critical + 14 low
Result after fix (expected):
  Night: 15–25 clusters across all four risk tiers
  Day:   12–20 clusters across all four risk tiers
═══════════════════════════════════════════════════════════════════════════════
"""

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).resolve().parents[1]
CSV_PATH    = ROOT / "data" / "nagpur_crime.csv"
DATA_FOLDER = ROOT / "data"
DATA_FOLDER.mkdir(parents=True, exist_ok=True)

OUT_DAY   = DATA_FOLDER / "hotspots_day_ml.geojson"
OUT_NIGHT = DATA_FOLDER / "hotspots_night_ml.geojson"

# ── Tuned DBSCAN settings ─────────────────────────────────────────────────────
EPS_METERS  = 100    # was 200 → finer resolution, splits mega-clusters
MIN_SAMPLES = 10     # was 2   → eliminates noise micro-clusters
MIN_BUF_M   = 80     # polygon half-size floor (metres)
MAX_BUF_M   = 400    # was 180 → raised so large clusters get larger polygons


# ── Day / night classification ────────────────────────────────────────────────
def is_night(hour) -> bool:
    """True for 21:00–04:59 (same boundary as risk_service.py)."""
    if pd.isna(hour):
        return False
    h = int(hour)
    return h >= 21 or h <= 4


# ── Coordinate helpers ────────────────────────────────────────────────────────
def meters_to_deg_lat(m: float) -> float:
    return m / 111_320.0


def meters_to_deg_lon(m: float, lat_deg: float) -> float:
    """Problem 4 fix: longitude degree length varies with latitude."""
    return m / (111_320.0 * math.cos(math.radians(lat_deg)))


def square_polygon(lon: float, lat: float, halfsize_m: float) -> list:
    dlat = meters_to_deg_lat(halfsize_m)
    dlon = meters_to_deg_lon(halfsize_m, lat)
    return [
        [lon - dlon, lat - dlat],
        [lon + dlon, lat - dlat],
        [lon + dlon, lat + dlat],
        [lon - dlon, lat + dlat],
        [lon - dlon, lat - dlat],   # close ring
    ]


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000.0
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    a = (
        np.sin((lat2 - lat1) / 2) ** 2
        + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * R * np.arcsin(np.sqrt(a))


# ── DBSCAN clustering (fixed) ─────────────────────────────────────────────────
def cluster_hotspots_dbscan(df: pd.DataFrame) -> list[dict]:
    """
    Cluster crime records with DBSCAN and return a list of GeoJSON Features.

    Fixes applied vs original:
      - Problem 1: EPS_METERS halved to 100 m.
      - Problem 2: MIN_SAMPLES raised to 10.
      - Problem 3: half_m scales with sqrt(count), not a hard cap.
      - Problem 4: lon coordinates scaled by cos(mean_lat) before DBSCAN
                   so the epsilon is metrically uniform on both axes.
    """
    if df.empty:
        return []

    pts = df[["LAT", "LON"]].to_numpy()

    # Problem 4 fix: project onto a locally isotropic coordinate system
    mean_lat = float(pts[:, 0].mean())
    cos_lat  = math.cos(math.radians(mean_lat))
    pts_proj = pts.copy()
    pts_proj[:, 1] *= cos_lat   # stretch lon so 1 unit ≈ same metres as 1 lat unit

    eps_deg = EPS_METERS / 111_320.0

    db     = DBSCAN(eps=eps_deg, min_samples=MIN_SAMPLES, metric="euclidean").fit(pts_proj)
    labels = db.labels_

    features = []
    unique_labels = set(labels) - {-1}   # -1 = noise, excluded

    for label in unique_labels:
        mask       = labels == label
        cluster_pts = pts[mask]           # original (lat, lon), not projected
        n          = int(mask.sum())

        center_lat = float(cluster_pts[:, 0].mean())
        center_lon = float(cluster_pts[:, 1].mean())

        # Problem 3 fix: polygon size proportional to cluster spread
        dists  = np.array([haversine_m(center_lat, center_lon, lat, lon)
                            for lat, lon in cluster_pts])
        # Use 80th-percentile distance as the "characteristic radius"
        char_radius = float(np.percentile(dists, 80)) if len(dists) > 1 else 0.0

        # Scale half_m with sqrt(count) so larger clusters get larger polygons
        scaled = MIN_BUF_M + (MAX_BUF_M - MIN_BUF_M) * min(1.0, math.sqrt(n) / math.sqrt(500))
        half_m = int(max(MIN_BUF_M, min(MAX_BUF_M, max(char_radius * 0.5, scaled))))

        poly = square_polygon(center_lon, center_lat, half_m)

        features.append({
            "type": "Feature",
            "properties": {
                "center_lat": round(center_lat, 6),
                "center_lng": round(center_lon, 6),
                "count":      n,
                "half_m":     half_m,
            },
            "geometry": {
                "type":        "Polygon",
                "coordinates": [poly],
            },
        })

    # Sort descending by count for easier human inspection
    features.sort(key=lambda f: f["properties"]["count"], reverse=True)
    return features


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    print(f"CSV:        {CSV_PATH}")
    print(f"Day out:    {OUT_DAY}")
    print(f"Night out:  {OUT_NIGHT}")
    print(f"EPS:        {EPS_METERS} m  (was 200 m)")
    print(f"MIN_SAMPLES:{MIN_SAMPLES}   (was 2)")
    print(f"MAX_BUF_M:  {MAX_BUF_M} m  (was 180 m)")
    print()

    df = pd.read_csv(CSV_PATH, usecols=["latitude", "longitude", "hour"])
    df = df.rename(columns={"latitude": "LAT", "longitude": "LON", "hour": "HOUR"})
    df = df.dropna()
    df = df[(df["LAT"] != 0) & (df["LON"] != 0)]

    # Keep only Nagpur region
    df = df[df["LAT"].between(20.9, 21.4) & df["LON"].between(78.8, 79.3)]

    print(f"Rows after filter: {len(df):,}")
    print(f"Lat range: {df['LAT'].min():.4f} – {df['LAT'].max():.4f}")
    print(f"Lon range: {df['LON'].min():.4f} – {df['LON'].max():.4f}")

    df["IS_NIGHT"] = df["HOUR"].apply(is_night)
    day_df   = df[~df["IS_NIGHT"]][["LAT", "LON"]]
    night_df = df[ df["IS_NIGHT"]][["LAT", "LON"]]

    print(f"\nDay records:   {len(day_df):,}")
    print(f"Night records: {len(night_df):,}")

    day_feats   = cluster_hotspots_dbscan(day_df)
    night_feats = cluster_hotspots_dbscan(night_df)

    # ── Print distribution summary ────────────────────────────────────────
    for label, feats in [("DAY", day_feats), ("NIGHT", night_feats)]:
        counts = [f["properties"]["count"] for f in feats]
        b = {"low (<10)": 0, "moderate (10-99)": 0, "high (100-999)": 0, "critical (≥1000)": 0}
        for c in counts:
            if c >= 1000: b["critical (≥1000)"] += 1
            elif c >= 100: b["high (100-999)"] += 1
            elif c >= 10: b["moderate (10-99)"] += 1
            else: b["low (<10)"] += 1
        print(f"\n{label} clusters ({len(feats)} total): {dict(b)}")
        if counts:
            print(f"  count range: {min(counts)} – {max(counts)}")

    # ── Write GeoJSON ─────────────────────────────────────────────────────
    OUT_DAY.write_text(json.dumps({"type": "FeatureCollection", "features": day_feats},
                                  indent=None))
    OUT_NIGHT.write_text(json.dumps({"type": "FeatureCollection", "features": night_feats},
                                    indent=None))

    print(f"\n✅  {OUT_DAY}  ({len(day_feats)} features)")
    print(f"✅  {OUT_NIGHT}  ({len(night_feats)} features)")


if __name__ == "__main__":
    main()