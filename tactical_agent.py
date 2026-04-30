"""Utility-based tactical AI agent for AFSIM platform control.

Evaluates platform state and outputs MOVE / FIRE / HOLD decisions using
response curves instead of linear thresholds — producing realistic decision
gradients that avoid brittle behavior at range boundaries.

Pure computation module — no I/O or threading dependencies.
"""

import math
from typing import Dict, List, Optional, Tuple

import numpy as np

# ── response curves ──────────────────────────────────────────────


def curve_linear(x: np.ndarray) -> np.ndarray:
    """Identity: u = x."""
    return np.clip(x, 0.0, 1.0)


def curve_sigmoid(x: np.ndarray, midpoint: float = 0.5, steepness: float = 6.0) -> np.ndarray:
    """S-curve centered at `midpoint` with configurable steepness."""
    return 1.0 / (1.0 + np.exp(-steepness * (x - midpoint)))


def curve_logistic(x: np.ndarray, midpoint: float = 0.3, steepness: float = 8.0) -> np.ndarray:
    """Diminishing returns — rises fast then plateaus."""
    return 1.0 / (1.0 + np.exp(-steepness * (x - midpoint)))


def curve_inverse_logistic(x: np.ndarray, midpoint: float = 0.5, steepness: float = 6.0) -> np.ndarray:
    """Inverse logistic — stays low then drops fast (threat proximity)."""
    return 1.0 - 1.0 / (1.0 + np.exp(-steepness * (x - midpoint)))


# ── constants ────────────────────────────────────────────────────

EARTH_RADIUS_NM = 3440.065
HOLD_THRESHOLD_BASE = 0.15  # minimum utility to override HOLD


class TacticalAgent:
    """Utility-based tactical decision engine for AFSIM platforms."""

    def __init__(
        self,
        aggressiveness: float = 0.5,
        engagement_range_nm: float = 40.0,
        threat_sensitivity: float = 0.5,
        friendly_side: str = "BLUE",
    ):
        self.aggressiveness = aggressiveness       # 0.0–1.0
        self.engagement_range_nm = engagement_range_nm  # nm
        self.threat_sensitivity = threat_sensitivity    # 0.0–1.0
        self.friendly_side = friendly_side
        self._seq = 0

    # ── configuration ────────────────────────────────────────────

    def set_aggressiveness(self, value: float) -> None:
        self.aggressiveness = max(0.0, min(1.0, value))

    def set_engagement_range(self, range_nm: float) -> None:
        self.engagement_range_nm = max(5.0, min(200.0, range_nm))

    def set_threat_sensitivity(self, value: float) -> None:
        self.threat_sensitivity = max(0.0, min(1.0, value))

    def set_friendly_side(self, side: str) -> None:
        self.friendly_side = side

    # ── main entry point ─────────────────────────────────────────

    def evaluate(self, platforms: List[dict]) -> List[dict]:
        """Run full decision pipeline and return action list."""
        if not platforms:
            return []

        friendlies, hostiles = self._separate_sides(platforms)
        if not friendlies or not hostiles:
            # nothing to do — all platforms HOLD
            return [
                self._make_action(p["id"], "HOLD", {"reason": "NO_CONTACTS"})
                for p in friendlies
            ]

        threat_matrix = self._build_threat_matrix(friendlies, hostiles)

        actions = []
        for friendly in friendlies:
            action = self._decide_action(friendly, friendlies, hostiles, threat_matrix)
            actions.append(action)

        return actions

    # ── side separation ──────────────────────────────────────────

    def _separate_sides(self, platforms: List[dict]) -> Tuple[List[dict], List[dict]]:
        friendlies = [p for p in platforms if p["side"] == self.friendly_side and p["alive"]]
        hostiles = [p for p in platforms if p["side"] != self.friendly_side and p["alive"]]
        return friendlies, hostiles

    # ── threat matrix ────────────────────────────────────────────

    def _build_threat_matrix(
        self, friendlies: List[dict], hostiles: List[dict]
    ) -> Dict[int, List[dict]]:
        """For each friendly, build list of {hostile_id, distance, threat_score}."""
        matrix = {}
        for f in friendlies:
            threats = []
            for h in hostiles:
                dist = _haversine_nm(f["lat"], f["lon"], h["lat"], h["lon"])
                threat_score = self._threat_score(h, dist)
                threats.append({"hostile_id": h["id"], "distance_nm": dist, "threat_score": threat_score})
            # sort by threat (highest first)
            threats.sort(key=lambda t: t["threat_score"], reverse=True)
            matrix[f["id"]] = threats
        return matrix

    def _threat_score(self, hostile: dict, distance_nm: float) -> float:
        """Compute threat score for a single hostile relative to one friendly."""
        capability = (
            hostile.get("weapon_count", 0) * 0.3 +
            hostile.get("sensor_range_nm", 50) / 100.0 * 0.2 +
            0.5  # base
        )
        proximity = max(0.0, 1.0 - distance_nm / self.engagement_range_nm)
        return capability * proximity

    # ── action decision ──────────────────────────────────────────

    def _decide_action(
        self,
        platform: dict,
        friendlies: List[dict],
        hostiles: List[dict],
        threat_matrix: Dict[int, List[dict]],
    ) -> dict:
        """Score all actions for a single platform and pick the best."""
        threats = threat_matrix.get(platform["id"], [])
        nearest_threat = threats[0] if threats else None
        nearest_dist = nearest_threat["distance_nm"] if nearest_threat else float("inf")

        # compute utility components
        u_fire = self._utility_fire(platform, nearest_dist)
        u_chase = self._utility_chase(platform, nearest_dist, friendlies, hostiles)
        u_flee = self._utility_flee(platform, threats)
        u_hold = HOLD_THRESHOLD_BASE + (1.0 - self.aggressiveness) * 0.1

        scores = {"FIRE": u_fire, "CHASE": u_chase, "FLEE": u_flee, "HOLD": u_hold}
        best_action = max(scores, key=scores.get)

        if scores[best_action] < HOLD_THRESHOLD_BASE:
            best_action = "HOLD"

        return self._resolve_action(platform, best_action, nearest_threat, hostiles)

    def _resolve_action(
        self,
        platform: dict,
        action: str,
        nearest_threat: Optional[dict],
        hostiles: List[dict],
    ) -> dict:
        """Build the concrete action dict from the chosen action label."""
        if action == "FIRE" and nearest_threat:
            return self._make_action(platform["id"], "FIRE", {
                "target_id": nearest_threat["hostile_id"],
                "weapon_type": platform["weapons"][0] if platform.get("weapons") else "UNKNOWN",
                "quantity": 1,
                "dist_nm": round(nearest_threat["distance_nm"], 1),
            })
        elif action == "CHASE" and nearest_threat:
            target = next((h for h in hostiles if h["id"] == nearest_threat["hostile_id"]), None)
            if target:
                lat, lon, alt = self._compute_move_toward(platform, target)
                return self._make_action(platform["id"], "MOVE", {
                    "lat": lat, "lon": lon, "alt_m": alt,
                    "reason": "CHASE",
                    "target_id": nearest_threat["hostile_id"],
                })
            return self._make_action(platform["id"], "HOLD", {"reason": "NO_CHASE_TARGET"})
        elif action == "FLEE" and nearest_threat:
            lat, lon, alt = self._compute_move_away(platform, nearest_threat, hostiles)
            return self._make_action(platform["id"], "MOVE", {
                "lat": lat, "lon": lon, "alt_m": alt,
                "reason": "FLEE",
                "from_threat_id": nearest_threat["hostile_id"],
            })
        else:
            return self._make_action(platform["id"], "HOLD", {"reason": "LOW_UTILITY"})

    # ── utility functions ────────────────────────────────────────

    def _utility_fire(self, platform: dict, nearest_dist_nm: float) -> float:
        """Utility of firing at nearest hostile. Higher at close range."""
        if not platform.get("weapons") or nearest_dist_nm > self.engagement_range_nm * 1.2:
            return 0.0
        # proximity: 1.0 at 0nm, 0.0 at max range
        proximity = 1.0 - nearest_dist_nm / (self.engagement_range_nm * 1.2)
        x = np.array([proximity])
        distance_u = curve_sigmoid(x, midpoint=0.4, steepness=6.0)[0]
        weapon_factor = min(platform.get("weapon_count", 0) / 4.0, 1.0)
        return distance_u * weapon_factor * (0.3 + 0.7 * self.aggressiveness)

    def _utility_chase(
        self,
        platform: dict,
        nearest_dist_nm: float,
        friendlies: List[dict],
        hostiles: List[dict],
    ) -> float:
        """Utility of closing distance to hostile. Higher when enemy is somewhat far."""
        if nearest_dist_nm > self.engagement_range_nm * 1.5:
            return 0.0
        # chase peaks at ~0.5 normalized distance (mid-range), drops off when very close or very far
        norm_dist = nearest_dist_nm / (self.engagement_range_nm * 1.5)
        x = np.array([norm_dist])
        distance_u = curve_sigmoid(x, midpoint=0.4, steepness=4.0)[0]
        force_ratio = self._local_force_ratio(platform, friendlies, hostiles)
        fr_u = curve_logistic(np.array([force_ratio / 3.0]), midpoint=0.3, steepness=8.0)[0]
        return distance_u * fr_u * self.aggressiveness * 0.8

    def _utility_flee(self, platform: dict, threats: List[dict]) -> float:
        """Utility of fleeing from threats."""
        if not threats:
            return 0.0
        # aggregate threat: sum of individual threat scores weighted by proximity
        total_threat = sum(
            t["threat_score"] * (1.0 - min(t["distance_nm"] / self.engagement_range_nm, 1.0))
            for t in threats[:3]  # top 3 threats
        )
        threat_u = total_threat / max(len(threats[:3]), 1)
        return threat_u * (1.0 - self.aggressiveness) * self.threat_sensitivity

    # ── force ratio ──────────────────────────────────────────────

    def _local_force_ratio(
        self,
        platform: dict,
        friendlies: List[dict],
        hostiles: List[dict],
    ) -> float:
        """Count friendlies and hostiles within engagement range."""
        nearby_f = sum(
            1 for f in friendlies
            if f["id"] != platform["id"]
            and _haversine_nm(platform["lat"], platform["lon"], f["lat"], f["lon"])
            < self.engagement_range_nm
        )
        nearby_h = sum(
            1 for h in hostiles
            if _haversine_nm(platform["lat"], platform["lon"], h["lat"], h["lon"])
            < self.engagement_range_nm
        )
        return (1 + nearby_f) / max(nearby_h, 1)

    # ── movement geometry ────────────────────────────────────────

    def _compute_move_away(
        self,
        platform: dict,
        threat: dict,
        hostiles: List[dict],
    ) -> Tuple[float, float, float]:
        """Compute a position ~5nm directly away from the highest-threat hostile."""
        target_hostile = next(
            (h for h in hostiles if h["id"] == threat["hostile_id"]), None
        )
        if not target_hostile:
            return platform["lat"], platform["lon"], platform["alt_m"]

        bearing = _bearing_deg(
            target_hostile["lat"], target_hostile["lon"],
            platform["lat"], platform["lon"],
        )
        # flee 5 nm further in the away direction
        lat, lon = _point_at_distance(
            platform["lat"], platform["lon"], bearing, 5.0
        )
        return lat, lon, platform["alt_m"]

    def _compute_move_toward(
        self,
        platform: dict,
        target: dict,
    ) -> Tuple[float, float, float]:
        """Compute a position along the bearing toward the target (midpoint)."""
        dist = _haversine_nm(platform["lat"], platform["lon"], target["lat"], target["lon"])
        bearing = _bearing_deg(platform["lat"], platform["lon"], target["lat"], target["lon"])
        # move halfway to target, or 10nm, whichever is less
        move_dist = min(dist * 0.5, 10.0)
        lat, lon = _point_at_distance(platform["lat"], platform["lon"], bearing, move_dist)
        return lat, lon, platform["alt_m"]

    # ── helpers ──────────────────────────────────────────────────

    def _make_action(self, platform_id: int, action: str, parameters: dict) -> dict:
        self._seq += 1
        return {
            "id": platform_id,
            "action": action,
            "parameters": parameters,
            "seq": self._seq,
        }


# ── geographic utilities (numpy-accelerated) ─────────────────────


def _haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in nautical miles (vectorized-safe scalar)."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return 2 * EARTH_RADIUS_NM * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing from (lat1,lon1) to (lat2,lon2) in degrees."""
    dlon = math.radians(lon2 - lon1)
    y = math.sin(dlon) * math.cos(math.radians(lat2))
    x = (math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) -
         math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dlon))
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def _point_at_distance(
    lat: float, lon: float, bearing_deg: float, dist_nm: float
) -> Tuple[float, float]:
    """Destination point given start, bearing, and distance (nm)."""
    r = EARTH_RADIUS_NM
    brng = math.radians(bearing_deg)
    d_r = dist_nm / r
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    lat2 = math.asin(
        math.sin(lat1) * math.cos(d_r) +
        math.cos(lat1) * math.sin(d_r) * math.cos(brng)
    )
    lon2 = lon1 + math.atan2(
        math.sin(brng) * math.sin(d_r) * math.cos(lat1),
        math.cos(d_r) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), math.degrees(lon2)
