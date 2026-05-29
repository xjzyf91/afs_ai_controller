<<<<<<< HEAD
# AFSIM AI Controller

External tactical AI and operator console for AFSIM v2.9.0 — transforms AFSIM from script-driven behavior into an adaptive, AI-driven controllable system.

## Architecture

```
Simulator/AFSIM ──UDP JSON──> CommManager ──queue──> TacticalAgent
                                  │    │                  │
                                  │    │ WebSocket        ▼
                                  │    ▼              Action dicts
                                  │  CesiumJS             │
                                  │  (3D globe)           ▼
                                  ▼                  CommManager ──UDP──> Sim/AFSIM
                              UI (PySide6)
```

## Components

| Module | Role |
|--------|------|
| `simulator.py` | Standalone data source — generates synthetic platform state over UDP JSON |
| `comm_manager.py` | Thread-safe UDP listener + WebSocket server + JSON transport |
| `tactical_agent.py` | Utility-based AI — response curves (sigmoid, logistic) for FIRE/MOVE/HOLD decisions |
| `tactical_map.py` | QWebEngineView wrapper embedding CesiumJS 3D globe |
| `cesium/index.html` | CesiumJS frontend — 3D WGS84 globe with platform entities, range rings, effects |
| `ui.py` | PySide6 operator console — platform table, action display, parameter sliders, log |
| `main.py` | Entry point — wiring, CLI arguments, lifecycle |

## Quick Start

### 1. Install dependencies

```bash
pip install pyside6 numpy websockets
```

### 2. Cesium ion token

Get a free token at [ion.cesium.com](https://ion.cesium.com) and replace the default in `cesium/index.html`:

```js
Cesium.Ion.defaultAccessToken = 'your-token-here';
```

### 3. Launch

```bash
# with built-in data simulator
python -m afs_ai_controller.main --simulator

# custom parameters
python -m afs_ai_controller.main --simulator --aggressiveness 0.8 --range 60 --threat 0.7

# connect to external AFSIM UDP feed (no simulator)
python -m afs_ai_controller.main --recv-port 9000 --send-port 9001
```

### 4. CLI options

| Option | Default | Description |
|--------|---------|-------------|
| `--simulator` | off | Launch data simulator subprocess |
| `--recv-port` | 9000 | UDP receive port |
| `--send-port` | 9001 | UDP send port (actions) |
| `--ws-port` | 9010 | WebSocket server port (CesiumJS) |
| `--aggressiveness` | 0.5 | AI aggressiveness 0.0–1.0 |
| `--range` | 40 | Engagement range (nm) |
| `--threat` | 0.5 | Threat sensitivity 0.0–1.0 |
| `--side` | BLUE | Friendly side (BLUE/RED) |
| `--verbose` | off | Enable debug logging |

## UI Controls

- **Start AI / Stop AI** — toggle tactical agent
- **AI Mode checkbox** — manual override indicator
- **Aggressiveness slider** (0.0–1.0) — shifts offensive curve midpoints
- **Engagement Range slider** (5–200 nm) — sets sigmoid centers
- **Threat Sensitivity slider** (0.0–1.0) — scales flee response

## Wire Protocol

### Platform State (incoming UDP)

```json
{
  "msg_type": "platform_state",
  "seq": 1,
  "timestamp": 1704067200.123,
  "platforms": [{
    "id": 1, "name": "BLUE_F15_01", "side": "BLUE", "type": "F-15E",
    "alive": true, "lat": 35.69, "lon": -117.84, "alt_m": 10000.0,
    "heading_deg": 45.0, "speed_mps": 250.0, "damage": 0.0,
    "weapons": ["AIM-120D", "AIM-9X"], "weapon_count": 2,
    "sensor_range_nm": 80.0
  }]
}
```

### Action Command (outgoing UDP)

```json
{
  "msg_type": "action_command",
  "seq": 42,
  "timestamp": 1704067200.57,
  "actions": [
    {"id": 1, "action": "FIRE", "parameters": {"target_id": 5, "weapon_type": "AIM-120D", "quantity": 1}},
    {"id": 3, "action": "MOVE", "parameters": {"lat": 36.0, "lon": -117.0, "alt_m": 15000.0, "reason": "CHASE"}},
    {"id": 4, "action": "HOLD", "parameters": {"reason": "NO_THREAT"}}
  ]
}
```

## Production Path

Replace `simulator.py` with a real AFSIM C++ plugin that broadcasts platform state via UDP JSON. AFSIM has the infrastructure ready:

- **UDP:** `GenUDP_IO` / `PakUDP_IO` in `src/tools/genio/`
- **External control:** `WsfPlatform::SetIsExternallyControlled(true)`
- **Event pipe:** `wsf.utpack` defines platform state messages (`MsgEntityState`, `MsgPlatformInfo`)

The plugin would subscribe to simulation observers, pack platform data as JSON, and send via `GenUDP_IO` to the controller's receive port.

## License

Distribution Statement F — CUI//REL TO USA ONLY. See repository CLAUDE.md for details.

pip install numpy -i https://pypi.tuna.tsinghua.edu.cn/simple
pip install websockets
pip install pyside6 -i https://pypi.tuna.tsinghua.edu.cn/simple
=======
# afs_ai_controller
afs_ai_controller
>>>>>>> 22afd16f86d92079dc16246848f0fc9e1b446646
