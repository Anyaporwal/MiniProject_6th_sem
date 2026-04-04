# builds day/night hotspot polygons from Nagpur crime CSV using DBSCAN (ML)
# writes GeoJSON into frontend/public/ for the React app to load

from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
import json
import math

# ---- paths ----
from pathlib import Path

# ---- Root path ----
ROOT = Path(__file__).resolve().parents[1]

# CSV input
CSV_PATH = ROOT / "data" / "nagpur_crime.csv"

# GeoJSON output directly in data folder
DATA_FOLDER = ROOT / "data"  # just "data" folder at root
DATA_FOLDER.mkdir(parents=True, exist_ok=True)

OUT_DAY = DATA_FOLDER / "hotspots_day_ml.geojson"
OUT_NIGHT = DATA_FOLDER / "hotspots_night_ml.geojson"

print("Day file path:", OUT_DAY)
print("Night file path:", OUT_NIGHT)

# ---- settings (tuned for Nagpur dataset) ----
EPS_METERS = 200
MIN_SAMPLES = 2
MIN_BUF_M = 80
MAX_BUF_M = 180

# ---- helpers ----
def is_night(hour):
    if pd.isna(hour):
        return False
    return (hour >= 21) or (hour <= 4)


def meters_to_deg_lat(m):
    return m / 111320.0


def meters_to_deg_lng(m, lat_deg):
    return m / (111320.0 * math.cos(math.radians(lat_deg)))


def square_polygon(lon, lat, halfsize_m):
    dlat = meters_to_deg_lat(halfsize_m)
    dlng = meters_to_deg_lng(halfsize_m, lat)

    return [
        [lon - dlng, lat - dlat],
        [lon + dlng, lat - dlat],
        [lon + dlng, lat + dlat],
        [lon - dlng, lat + dlat],
        [lon - dlng, lat - dlat],
    ]


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0

    lat1, lon1, lat2, lon2 = map(
        np.radians,
        [lat1, lon1, lat2, lon2]
    )

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        np.sin(dlat / 2) ** 2
        + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    )

    return 2 * R * np.arcsin(np.sqrt(a))


# ---- DBSCAN clustering ----
def cluster_hotspots_dbscan(df):

    if df.empty:
        return []

    pts = df[["LAT", "LON"]].to_numpy()

    eps_deg = EPS_METERS / 111320.0

    db = DBSCAN(
        eps=eps_deg,
        min_samples=MIN_SAMPLES,
        metric="euclidean"
    ).fit(pts)

    labels = db.labels_
    features = []

    for label in set(labels):

        if label == -1:
            continue

        cluster_pts = pts[labels == label]

        center_lat = float(cluster_pts[:, 0].mean())
        center_lon = float(cluster_pts[:, 1].mean())

        dists = np.array([
            haversine_m(center_lat, center_lon, lat, lon)
            for lat, lon in cluster_pts
        ])

        half_m = np.percentile(dists, 80) * 0.5
        half_m = max(MIN_BUF_M, min(MAX_BUF_M, half_m))

        poly = square_polygon(center_lon, center_lat, half_m)

        features.append({
            "type": "Feature",
            "properties": {
                "center_lat": center_lat,
                "center_lng": center_lon,
                "count": int(len(cluster_pts)),
                "half_m": int(half_m)
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [poly]
            }
        })

    return features


# ---- main ----
def main():

    usecols = ["latitude", "longitude", "hour"]

    df = pd.read_csv(CSV_PATH, usecols=usecols)

    df = df.rename(columns={
        "latitude": "LAT",
        "longitude": "LON",
        "hour": "HOUR"
    })

    # remove missing values
    df = df.dropna()

    # remove invalid coordinates
    df = df[(df["LAT"] != 0) & (df["LON"] != 0)]

    # keep only Nagpur region
    df = df[
        (df["LAT"].between(20.9, 21.4)) &
        (df["LON"].between(78.8, 79.3))
    ]

    # debug output
    print("Latitude range:", df["LAT"].min(), "-", df["LAT"].max())
    print("Longitude range:", df["LON"].min(), "-", df["LON"].max())

    # classify day/night
    df["IS_NIGHT"] = df["HOUR"].apply(is_night)

    day = df[~df["IS_NIGHT"]][["LAT", "LON"]]
    night = df[df["IS_NIGHT"]][["LAT", "LON"]]

    print("Day crimes:", len(day))
    print("Night crimes:", len(night))

    # build hotspots
    day_feats = cluster_hotspots_dbscan(day)
    night_feats = cluster_hotspots_dbscan(night)

    print("Day hotspots:", len(day_feats))
    print("Night hotspots:", len(night_feats))

    # write GeoJSON files
    OUT_DAY.write_text(json.dumps({
        "type": "FeatureCollection",
        "features": day_feats
    }))

    OUT_NIGHT.write_text(json.dumps({
        "type": "FeatureCollection",
        "features": night_feats
    }))

    print(f"✅ wrote {OUT_DAY}")
    print(f"✅ wrote {OUT_NIGHT}")


if __name__ == "__main__":
    main()