"""QWebEngineView wrapper embedding the CesiumJS 3D globe in PySide6.

Provides a Qt widget that loads cesium/index.html and exposes methods
to push data and receive selection events via WebSocket.
"""

import json
import logging
import os
from typing import Optional

from PySide6.QtCore import QUrl, Signal, QObject
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel

logger = logging.getLogger(__name__)


class TacticalMapBridge(QObject):
    """Qt-JS bridge object exposed via QWebChannel for direct calls."""

    platform_selected = Signal(int)

    def __init__(self, parent=None):
        super().__init__(parent)

    def selectPlatform(self, pid: int) -> None:
        """Called from JS when user clicks a platform entity."""
        self.platform_selected.emit(pid)


class TacticalMapWidget(QWebEngineView):
    """Embedded CesiumJS 3D globe widget."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._bridge: Optional[TacticalMapBridge] = None
        self._page_loaded = False
        self._pending_messages: list = []
        self._setup()

    def _setup(self) -> None:
        """Configure the web engine and load the Cesium page."""
        # enable WebGL and local file access
        settings = self.settings()
        settings.setUnknownUrlSchemePolicy(
            settings.UnknownUrlSchemePolicy.AllowUnknownUrlSchemesFromUserInteraction
        )

        # set up QWebChannel for Qt↔JS direct bridge
        self._channel = QWebChannel(self)
        self._bridge = TacticalMapBridge(self)
        self._channel.registerObject("qtBridge", self._bridge)
        self.page().setWebChannel(self._channel)

        # find the HTML file relative to this module
        html_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "cesium",
            "index.html",
        )
        if os.path.exists(html_path):
            url = QUrl.fromLocalFile(html_path)
            self.setUrl(url)
            logger.info("Loading Cesium from: %s", html_path)

        self.loadFinished.connect(self._on_load_finished)

    def _on_load_finished(self, ok: bool) -> None:
        """Flush any messages queued before the page was ready."""
        if ok:
            self._page_loaded = True
            logger.info("Cesium page loaded successfully")
            for msg in self._pending_messages:
                self._push_to_js(msg)
            self._pending_messages.clear()
        else:
            logger.error("Cesium page failed to load")

    def push_platform_state(self, message: dict) -> None:
        """Push a platform_state message to the Cesium page via JS."""
        self._push_js_message(message)

    def push_action_command(self, message: dict) -> None:
        """Push an action_command message to the Cesium page."""
        self._push_js_message(message)

    def _push_js_message(self, message: dict) -> None:
        """Execute JavaScript to inject a message as if from WebSocket."""
        js = (
            "if (typeof handleMessage === 'function') {"
            f"  handleMessage({json.dumps(message)});"
            "}"
        )
        if self._page_loaded:
            self.page().runJavaScript(js)
        else:
            self._pending_messages.append(message)

    def _push_to_js(self, message: dict) -> None:
        """Internal: actually run the JS (page is known loaded)."""
        self._push_js_message(message)
