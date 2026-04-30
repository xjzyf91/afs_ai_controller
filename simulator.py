"""Standalone AFSIM data simulator — generates synthetic platform state over UDP JSON.

Usage: python -m afs_ai_controller.simulator [--port 9000] [--hz 5.0] [--blue 4] [--red 6]

Replaces a real AFSIM C++ UDP export plugin during development and testing.
"""

import argparse
import json
import math
import random
import socket
import time
from typing import List, Optional

# ── platform templates ──────────────────────────────────────────────

BLUE_TYPES = ["F-15E", "F-16C", "F/A-18E", "F-22A", "F-35A"]
RED_TYPES = ["Su-35S", "Su-30SM", "J-20", "J-16", "MiG-31"]
ALL_TYPES = BLUE_TYPES + RED_TYPES
WEAPON_POOLS = {
    "BLUE": ["AIM-120D", "AIM-120D", "AIM-9X", "AIM-9X"],
    "RED":  ["PL-15", "PL-15", "R-73", "R-77"],
}
SENSOR_RANGE_NM = {"fighter": 80.0, "striker": 60.0, "bomber": 50.0}

# bounding box (southwest USA area)
LAT_CENTER, LON_CENTER = 35.5, -117.5
BOX_SPREAD_DEG = 2.0  # degrees from center


def _random_platform(p_id: int, side: str) -> dict:
    """Generate one random platform near the center box."""
    types = BLUE_TYPES if side == "BLUE" else RED_TYPES
    name = f"{side}_{random.choice(types).replace('-','').replace('/','')}_{p_id:02d}"
    lat = LAT_CENTER + random.uniform(-BOX_SPREAD_DEG, BOX_SPREAD_DEG)
    lon = LON_CENTER + random.uniform(-BOX_SPREAD_DEG, BOX_SPREAD_DEG)
    alt_m = random.uniform(5000, 35000) * 0.3048  # ft → m
    heading = random.uniform(0, 360)
    speed_mps = random.uniform(200, 350)
    weapon_pool = WEAPON_POOLS[side]
    weapons = random.sample(weapon_pool, random.randint(1, len(weapon_pool)))

    return {
        "id": p_id,
        "name": name,
        "side": side,
        "type": random.choice(types),
        "alive": True,
        "lat": lat,
        "lon": lon,
        "alt_m": alt_m,
        "heading_deg": heading,
        "pitch_deg": 0.0,
        "roll_deg": 0.0,
        "speed_mps": speed_mps,
        "damage": 0.0,
        "fuel_kg": random.uniform(2000, 5000),
        "weapons": weapons,
        "weapon_count": len(weapons),
        "sensor_range_nm": SENSOR_RANGE_NM.get("fighter", 80.0),
        "categories": ["fighter"],
    }


class PlatformSimulator:
    """Generates and streams synthetic platform state over UDP."""

    def __init__(self, num_blue: int = 4, num_red: int = 6, update_hz: float = 5.0):
        self.num_blue = num_blue
        self.num_red = num_red
        self.update_hz = update_hz
        self._seq = 0
        self._platforms: List[dict] = []
        self._next_id = 0
        self._running = False

    def _generate_initial_platforms(self) -> None:
        """Create initial platform set."""
        self._platforms.clear()
        self._next_id = 0
        for _ in range(self.num_blue):
            self._next_id += 1
            self._platforms.append(_random_platform(self._next_id, "BLUE"))
        for _ in range(self.num_red):
            self._next_id += 1
            self._platforms.append(_random_platform(self._next_id, "RED"))

    def _update_platforms(self) -> None:
        """Move platforms along heading with random walk perturbations."""
        dt = 1.0 / self.update_hz
        for p in self._platforms:
            if not p["alive"]:
                continue

            # perturb heading +/- 15 deg per tick
            p["heading_deg"] += random.uniform(-15, 15)
            p["heading_deg"] %= 360

            # perturb speed +/- 25 m/s per tick, clamp
            p["speed_mps"] += random.uniform(-25, 25)
            p["speed_mps"] = max(150, min(450, p["speed_mps"]))

            # move along heading
            heading_rad = math.radians(p["heading_deg"])
            dist_m = p["speed_mps"] * dt
            dist_deg = dist_m / 111320.0  # rough degrees latitude
            p["lat"] += dist_deg * math.cos(heading_rad)
            p["lon"] += (dist_deg * math.sin(heading_rad)) / math.cos(math.radians(p["lat"]))

            # slight altitude wander
            p["alt_m"] += random.uniform(-100, 100)
            p["alt_m"] = max(1000, min(40000 * 0.3048, p["alt_m"]))

            # fuel burn
            p["fuel_kg"] = max(0, p["fuel_kg"] - random.uniform(0, 5) * dt)

    def _maybe_generate_combat_events(self) -> List[dict]:
        """When platforms are close and opposing, emit combat events."""
        events = []
        friendlies = [p for p in self._platforms if p["side"] == "BLUE" and p["alive"]]
        hostiles = [p for p in self._platforms if p["side"] == "RED" and p["alive"]]

        for f in friendlies:
            if not f["weapons"]:
                continue
            for h in hostiles:
                dist = _haversine_nm(f["lat"], f["lon"], h["lat"], h["lon"])
                if dist < 30 and random.random() < 0.12:
                    events.append({
                        "msg_type": "event",
                        "event": "WEAPON_LAUNCH",
                        "shooter_id": f["id"],
                        "target_id": h["id"],
                        "weapon": f["weapons"][0],
                        "dist_nm": round(dist, 1),
                        "timestamp": time.time(),
                    })
                    # chance target is killed
                    if random.random() < 0.35:
                        h["alive"] = False
                        h["damage"] = 100.0
                        events.append({
                            "msg_type": "event",
                            "event": "PLATFORM_KILLED",
                            "shooter_id": f["id"],
                            "target_id": h["id"],
                            "timestamp": time.time(),
                        })
                    break  # one engagement per friendly per tick

        return events

    def build_message(self) -> bytes:
        """Construct the full platform_state JSON message."""
        self._seq += 1
        msg = {
            "msg_type": "platform_state",
            "seq": self._seq,
            "timestamp": time.time(),
            "platforms": self._platforms,
        }
        return json.dumps(msg).encode("utf-8")

    def run(self, target_host: str = "127.0.0.1", target_port: int = 9000) -> None:
        """Main loop: update, pack, send. Blocks until KeyboardInterrupt."""
        self._generate_initial_platforms()
        self._running = True
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        interval = 1.0 / self.update_hz
        print(f"[simulator] {len(self._platforms)} platforms @ {self.update_hz} Hz "
              f"→ {target_host}:{target_port}")

        try:
            while self._running:
                self._update_platforms()
                events = self._maybe_generate_combat_events()

                payload = self.build_message()
                sock.sendto(payload, (target_host, target_port))

                for evt in events:
                    evt_payload = json.dumps(evt).encode("utf-8")
                    sock.sendto(evt_payload, (target_host, target_port))

                time.sleep(interval)
        except KeyboardInterrupt:
            print("\n[simulator] stopped.")
        finally:
            sock.close()
            self._running = False


def _haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in nautical miles."""
    r = 3440.065  # earth radius in nautical miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def main():
    p = argparse.ArgumentParser(description="AFSIM data simulator")
    p.add_argument("--port", type=int, default=9000)
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--hz", type=float, default=5.0)
    p.add_argument("--blue", type=int, default=4)
    p.add_argument("--red", type=int, default=6)
    args = p.parse_args()
    sim = PlatformSimulator(num_blue=args.blue, num_red=args.red, update_hz=args.hz)
    sim.run(target_host=args.host, target_port=args.port)


if __name__ == "__main__":
    main()
