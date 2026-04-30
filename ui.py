"""PySide6 operator control panel for the AFSIM AI controller.

Embeds a CesiumJS 3D globe, platform list, action display, parameter sliders,
control buttons, and a color-coded log window. All real-time updates driven
by a QTimer at 200ms.
"""

import json
import logging
import time
from collections import deque
from typing import Optional

from PySide6.QtCore import Qt, QTimer, Signal, Slot
from PySide6.QtGui import QColor, QBrush, QFont, QTextCursor
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QMainWindow,
    QPlainTextEdit,
    QPushButton,
    QSlider,
    QSplitter,
    QStatusBar,
    QTableView,
    QVBoxLayout,
    QWidget,
)

from .comm_manager import CommManager
from .tactical_agent import TacticalAgent
from .tactical_map import TacticalMapWidget

logger = logging.getLogger(__name__)

UPDATE_INTERVAL_MS = 200
MAX_LOG_LINES = 500
MAX_ACTION_HISTORY = 100

# column definitions
PLATFORM_COLS = [
    ("ID", 50), ("Name", 140), ("Side", 50), ("Type", 70),
    ("Lat", 70), ("Lon", 70), ("Alt(ft)", 70), ("Speed(kts)", 80),
    ("Damage%", 70), ("Weapons", 80), ("Status", 60),
]
ACTION_COLS = [
    ("Time", 80), ("ID", 40), ("Action", 60),
    ("Target", 60), ("Params", 200),
]


class _PlatformTableModel:
    """Simple data model backing the platform QTableView."""
    def __init__(self):
        self._data: list[dict] = []

    def update(self, platforms: list[dict]) -> None:
        self._data = sorted(platforms, key=lambda p: (p.get("side", ""), p.get("id", 0)))

    def row_count(self) -> int:
        return len(self._data)

    def data(self, row: int, col: int):
        if row >= len(self._data):
            return ""
        p = self._data[row]
        keys = ["id", "name", "side", "type", "lat", "lon",
                "alt_ft", "speed_kts", "damage", "weapon_count", "status"]
        key = keys[col] if col < len(keys) else ""
        if key == "alt_ft":
            return f"{p.get('alt_m', 0) * 3.28084:.0f}"
        if key == "speed_kts":
            return f"{p.get('speed_mps', 0) * 1.94384:.0f}"
        if key == "status":
            return "ALIVE" if p.get("alive") else "DEAD"
        if key in ("lat", "lon"):
            return f"{p.get(key, 0):.3f}"
        return str(p.get(key, ""))


class _ActionTableModel:
    """Data model for the action history table."""
    def __init__(self):
        self._actions: deque = deque(maxlen=MAX_ACTION_HISTORY)

    def add_actions(self, actions: list[dict], timestamp: float) -> None:
        for a in actions:
            self._actions.appendleft({
                "time": time.strftime("%H:%M:%S", time.localtime(timestamp)),
                "id": a.get("id", ""),
                "action": a.get("action", ""),
                "target": a.get("parameters", {}).get("target_id", ""),
                "params": json.dumps(a.get("parameters", {}), sort_keys=True),
                "action_type": a.get("action", ""),
            })

    def row_count(self) -> int:
        return len(self._actions)

    def data(self, row: int, col: int):
        if row >= len(self._actions):
            return ""
        a = self._actions[row]
        keys = ["time", "id", "action", "target", "params"]
        return str(a.get(keys[col] if col < len(keys) else "", ""))

    def row_color(self, row: int) -> Optional[QColor]:
        if row >= len(self._actions):
            return None
        t = self._actions[row].get("action_type", "")
        if t == "FIRE":
            return QColor(255, 200, 200)
        if t == "MOVE":
            return QColor(200, 220, 255)
        return QColor(220, 220, 220)


class TacticalUI(QMainWindow):
    """Main operator control panel window."""

    log_signal = Signal(str, str)  # message, tag → thread-safe logging

    def __init__(
        self,
        comm_manager: CommManager,
        tactical_agent: TacticalAgent,
        parent=None,
    ):
        super().__init__(parent)
        self.comm = comm_manager
        self.agent = tactical_agent
        self._ai_enabled = False
        self._running = True
        self._platform_cache: dict = {}
        self._platform_model = _PlatformTableModel()
        self._action_model = _ActionTableModel()

        self._setup_window()
        self._setup_controls()
        self._setup_map()
        self._setup_tables()
        self._setup_sliders()
        self._setup_log()
        self._layout_all()
        self._connect_signals()

        # start update timer
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._update_loop)
        self._timer.start(UPDATE_INTERVAL_MS)

        self._log("System", "UI initialized. Press 'Start AI' to begin.", "#0f0")

    # ── window ──────────────────────────────────────────────────

    def _setup_window(self) -> None:
        self.setWindowTitle("AFSIM AI Controller — Tactical Command Panel")
        self.resize(1600, 900)
        self.setMinimumSize(1200, 700)

    def _setup_controls(self) -> None:
        self._btn_start = QPushButton("▶ Start AI")
        self._btn_stop = QPushButton("⏹ Stop AI")
        self._btn_stop.setEnabled(False)
        self._chk_ai_mode = QCheckBox("AI Mode")
        self._lbl_status = QLabel("Status: IDLE")
        self._lbl_status.setStyleSheet("font-weight: bold; color: #888;")
        self._lbl_queue = QLabel("Queue: 0")
        self._lbl_platforms = QLabel("Platforms: 0")

    def _setup_map(self) -> None:
        self._map_widget = TacticalMapWidget(self)

    def _setup_tables(self) -> None:
        # platform table
        self._platform_table = QTableView()
        self._platform_table.setModel(_QtTableAdapter(self._platform_model, PLATFORM_COLS))
        self._platform_table.setSelectionBehavior(QTableView.SelectionBehavior.SelectRows)
        self._platform_table.setAlternatingRowColors(True)
        self._platform_table.horizontalHeader().setStretchLastSection(True)
        self._platform_table.verticalHeader().setVisible(False)
        self._platform_table.setSortingEnabled(True)

        # action table
        self._action_table = QTableView()
        self._action_table.setModel(_QtActionAdapter(self._action_model, ACTION_COLS))
        self._action_table.setSelectionBehavior(QTableView.SelectionBehavior.SelectRows)
        self._action_table.horizontalHeader().setStretchLastSection(True)
        self._action_table.verticalHeader().setVisible(False)

    def _setup_sliders(self) -> None:
        self._sld_aggressiveness = QSlider(Qt.Orientation.Horizontal)
        self._sld_aggressiveness.setRange(0, 100)
        self._sld_aggressiveness.setValue(int(self.agent.aggressiveness * 100))
        self._lbl_agg = QLabel(f"Aggressiveness: {self.agent.aggressiveness:.2f}")

        self._sld_range = QSlider(Qt.Orientation.Horizontal)
        self._sld_range.setRange(5, 200)
        self._sld_range.setValue(int(self.agent.engagement_range_nm))
        self._lbl_range = QLabel(f"Engagement Range: {self.agent.engagement_range_nm:.0f} nm")

        self._sld_threat = QSlider(Qt.Orientation.Horizontal)
        self._sld_threat.setRange(0, 100)
        self._sld_threat.setValue(int(self.agent.threat_sensitivity * 100))
        self._lbl_threat = QLabel(f"Threat Sensitivity: {self.agent.threat_sensitivity:.2f}")

    def _setup_log(self) -> None:
        self._log_widget = QPlainTextEdit()
        self._log_widget.setReadOnly(True)
        self._log_widget.setMaximumBlockCount(MAX_LOG_LINES)
        font = QFont("Consolas", 10)
        self._log_widget.setFont(font)

    def _layout_all(self) -> None:
        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(4, 4, 4, 4)
        root.setSpacing(4)

        # control bar
        ctrl = QHBoxLayout()
        ctrl.addWidget(self._btn_start)
        ctrl.addWidget(self._btn_stop)
        ctrl.addWidget(self._chk_ai_mode)
        ctrl.addSpacing(20)
        ctrl.addWidget(self._lbl_status)
        ctrl.addStretch()
        ctrl.addWidget(self._lbl_queue)
        ctrl.addSpacing(12)
        ctrl.addWidget(self._lbl_platforms)
        root.addLayout(ctrl)

        # main splitter: map | right panel
        hsplit = QSplitter(Qt.Orientation.Horizontal)

        # left: 3D map
        hsplit.addWidget(self._map_widget)

        # right: platform + action tables
        right_panel = QSplitter(Qt.Orientation.Vertical)
        right_panel.addWidget(self._platform_table)
        right_panel.addWidget(self._action_table)
        hsplit.addWidget(right_panel)
        hsplit.setSizes([1050, 550])
        root.addWidget(hsplit, stretch=1)

        # sliders
        sld_layout = QHBoxLayout()
        sld_layout.addWidget(self._lbl_agg)
        sld_layout.addWidget(self._sld_aggressiveness, stretch=1)
        sld_layout.addSpacing(20)
        sld_layout.addWidget(self._lbl_range)
        sld_layout.addWidget(self._sld_range, stretch=1)
        sld_layout.addSpacing(20)
        sld_layout.addWidget(self._lbl_threat)
        sld_layout.addWidget(self._sld_threat, stretch=1)
        root.addLayout(sld_layout)

        # log
        root.addWidget(self._log_widget, stretch=0)
        self._log_widget.setFixedHeight(150)

    def _connect_signals(self) -> None:
        self._btn_start.clicked.connect(self._on_start_ai)
        self._btn_stop.clicked.connect(self._on_stop_ai)
        self._sld_aggressiveness.valueChanged.connect(self._on_aggressiveness_changed)
        self._sld_range.valueChanged.connect(self._on_range_changed)
        self._sld_threat.valueChanged.connect(self._on_threat_changed)
        self.log_signal.connect(self._append_log)

    # ── update loop ─────────────────────────────────────────────

    def _update_loop(self) -> None:
        """Called every 200ms by QTimer. Drains queue, runs agent, updates UI."""
        if not self._running:
            return

        try:
            # drain comm queue
            messages = self.comm.drain()
            has_platform_update = False

            for msg in messages:
                self.log_signal.emit(f"RX: {msg.get('msg_type', '?')} seq={msg.get('seq', '?')}", "rx")
                if msg.get("msg_type") == "platform_state":
                    platforms = msg.get("platforms", [])
                    self._platform_cache = {p["id"]: p for p in platforms}
                    self._platform_model.update(platforms)

                    qt_model = self._platform_table.model()
                    if qt_model is not None:
                        qt_model.layoutChanged.emit()

                    has_platform_update = True

                    # push to 3D map
                    self._map_widget.push_platform_state(msg)

                elif msg.get("msg_type") == "platform_selected":
                    pid = msg.get("platform_id")
                    if pid is not None:
                        self.log_signal.emit(f"Selected platform: {pid}", "select")

            # run AI if enabled and new data arrived
            if self._ai_enabled and has_platform_update and self._platform_cache:
                platform_list = list(self._platform_cache.values())
                actions = self.agent.evaluate(platform_list)
                if actions:
                    self._action_model.add_actions(actions, time.time())
                    self._action_table.viewport().update()

                    # send actions via comm
                    action_msg = {
                        "msg_type": "action_command",
                        "seq": self.agent._seq,
                        "timestamp": time.time(),
                        "actions": actions,
                    }
                    self.comm.send_action(action_msg)
                    self._map_widget.push_action_command(action_msg)

                    for a in actions:
                        self.log_signal.emit(
                            f"ACTION: id={a['id']} {a['action']} {a.get('parameters', {}).get('reason', '')}",
                            "decision",
                        )

            # update status bar counts
            self._lbl_queue.setText(f"Queue: {self.comm.get_queue_size()}")
            self._lbl_platforms.setText(f"Platforms: {len(self._platform_cache)}")
            self._platform_table.viewport().update()

        except Exception:
            logger.exception("Error in update loop")

    # ── control handlers ────────────────────────────────────────

    def _on_start_ai(self) -> None:
        self._ai_enabled = True
        self._chk_ai_mode.setChecked(True)
        self._btn_start.setEnabled(False)
        self._btn_stop.setEnabled(True)
        self._lbl_status.setText("Status: AI RUNNING")
        self._lbl_status.setStyleSheet("font-weight: bold; color: #0c0;")
        self._log("Control", "AI started — tactical agent active", "control")

    def _on_stop_ai(self) -> None:
        self._ai_enabled = False
        self._chk_ai_mode.setChecked(False)
        self._btn_start.setEnabled(True)
        self._btn_stop.setEnabled(False)
        self._lbl_status.setText("Status: AI STOPPED")
        self._lbl_status.setStyleSheet("font-weight: bold; color: #c00;")
        self._log("Control", "AI stopped — manual control mode", "control")

    def _on_aggressiveness_changed(self, value: int) -> None:
        v = value / 100.0
        self.agent.set_aggressiveness(v)
        self._lbl_agg.setText(f"Aggressiveness: {v:.2f}")
        self._log("Param", f"Aggressiveness → {v:.2f}", "param")

    def _on_range_changed(self, value: int) -> None:
        self.agent.set_engagement_range(float(value))
        self._lbl_range.setText(f"Engagement Range: {value} nm")
        self._log("Param", f"Engagement range → {value} nm", "param")

    def _on_threat_changed(self, value: int) -> None:
        v = value / 100.0
        self.agent.set_threat_sensitivity(v)
        self._lbl_threat.setText(f"Threat Sensitivity: {v:.2f}")
        self._log("Param", f"Threat sensitivity → {v:.2f}", "param")

    # ── logging ─────────────────────────────────────────────────

    def _log(self, tag: str, message: str, color: str = "#ccc") -> None:
        self.log_signal.emit(f"[{tag}] {message}", color)

    @Slot(str, str)
    def _append_log(self, message: str, color: str) -> None:
        ts = time.strftime("%H:%M:%S")
        line = f"{ts} {message}"
        self._log_widget.appendHtml(
            f'<span style="color:{color};">{_html_escape(line)}</span>'
        )
        # auto-scroll
        self._log_widget.moveCursor(QTextCursor.MoveOperation.End)

    # ── lifecycle ───────────────────────────────────────────────

    def closeEvent(self, event) -> None:
        self._running = False
        self._timer.stop()
        if self._ai_enabled:
            self._on_stop_ai()
        self.comm.stop()
        logger.info("UI shutdown complete")
        event.accept()


# ── Qt model adapters ────────────────────────────────────────────

def _QtTableAdapter(data_model, columns):
    """Create a QAbstractTableModel from our simple model + column defs."""
    from PySide6.QtCore import QAbstractTableModel, QModelIndex

    class Adapter(QAbstractTableModel):
        def rowCount(self_adapter, parent=None):
            return data_model.row_count()

        def columnCount(self_adapter, parent=None):
            return len(columns)

        def data(self_adapter, index, role=Qt.ItemDataRole.DisplayRole):
            if not index.isValid():
                return None
            row, col = index.row(), index.column()
            if role == Qt.ItemDataRole.DisplayRole:
                return data_model.data(row, col)
            if role == Qt.ItemDataRole.BackgroundRole:
                c = data_model.row_color(row) if hasattr(data_model, 'row_color') else None
                if c:
                    return QBrush(c)
            return None

        def headerData(self_adapter, section, orientation, role):
            if orientation == Qt.Orientation.Horizontal and role == Qt.ItemDataRole.DisplayRole:
                return columns[section][0] if section < len(columns) else ""
            return None

    return Adapter()


def _QtActionAdapter(data_model, columns):
    """QAbstractTableModel for action table with color-coded rows."""
    from PySide6.QtCore import QAbstractTableModel

    class Adapter(QAbstractTableModel):
        def rowCount(inner_self, parent=None):
            return data_model.row_count()
        def columnCount(inner_self, parent=None):
            return len(columns)
        def data(inner_self, index, role=Qt.ItemDataRole.DisplayRole):
            if not index.isValid():
                return None
            row, col = index.row(), index.column()
            if role == Qt.ItemDataRole.DisplayRole:
                return data_model.data(row, col)
            if role == Qt.ItemDataRole.BackgroundRole:
                c = data_model.row_color(row)
                if c:
                    return QBrush(c)
            return None
        def headerData(inner_self, section, orientation, role):
            if orientation == Qt.Orientation.Horizontal and role == Qt.ItemDataRole.DisplayRole:
                return columns[section][0] if section < len(columns) else ""
            return None

    return Adapter()


def _html_escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
