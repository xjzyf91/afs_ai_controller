"""Thread-safe communication manager — UDP listener + WebSocket server + JSON transport.

Receives AFSIM platform state via UDP, provides a thread-safe queue for consumers,
broadcasts state to WebSocket clients (CesiumJS), and sends action commands back.

Thread model:
  - _rx_thread:    blocking UDP recvfrom → queue.put()
  - _ws_thread:    asyncio event loop for WebSocket server
  - main thread:   drains queue, calls send_action()
"""

import asyncio
import json
import logging
import queue
import socket
import threading
from typing import Any, Callable, Dict, List, Optional

import websockets
from websockets.server import WebSocketServerProtocol

logger = logging.getLogger(__name__)

MAX_QUEUE_SIZE = 10000
DEFAULT_RECV_PORT = 9000
DEFAULT_SEND_PORT = 9001
DEFAULT_WS_PORT = 9010


class CommManager:
    """Thread-safe UDP + WebSocket communication manager."""

    def __init__(
        self,
        recv_host: str = "127.0.0.1",
        recv_port: int = DEFAULT_RECV_PORT,
        send_host: str = "127.0.0.1",
        send_port: int = DEFAULT_SEND_PORT,
        ws_host: str = "127.0.0.1",
        ws_port: int = DEFAULT_WS_PORT,
        buffer_size: int = 65536,
    ):
        self._recv_addr = (recv_host, recv_port)
        self._send_addr = (send_host, send_port)
        self._ws_host = ws_host
        self._ws_port = ws_port
        self._buffer_size = buffer_size

        # shared state
        self._queue: queue.Queue = queue.Queue(maxsize=MAX_QUEUE_SIZE)
        self._stop_event = threading.Event()
        self._lock = threading.Lock()

        # threads
        self._rx_thread: Optional[threading.Thread] = None
        self._ws_thread: Optional[threading.Thread] = None

        # socket (created on start)
        self._recv_sock: Optional[socket.socket] = None
        self._send_sock: Optional[socket.socket] = None

        # WebSocket clients
        self._ws_clients: set = set()
        self._ws_server = None
        self._ws_loop = None

        # callbacks
        self._on_data_callbacks: List[Callable[[dict], None]] = []

    # ── lifecycle ───────────────────────────────────────────────

    def start(self) -> None:
        """Bind sockets and start background threads."""
        # UDP receive socket
        self._recv_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._recv_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._recv_sock.bind(self._recv_addr)
        self._recv_sock.settimeout(0.5)

        # UDP send socket
        self._send_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

        self._stop_event.clear()

        self._rx_thread = threading.Thread(target=self._recv_loop, daemon=True, name="comm-rx")
        self._rx_thread.start()

        self._ws_thread = threading.Thread(target=self._run_ws_server, daemon=True, name="comm-ws")
        self._ws_thread.start()

        logger.info("CommManager started: UDP rx=%s, tx=%s, WS=%s",
                     self._recv_addr, self._send_addr, (self._ws_host, self._ws_port))

    def stop(self) -> None:
        """Signal stop, join threads, close sockets."""
        self._stop_event.set()
        for t in (self._rx_thread, self._ws_thread):
            if t and t.is_alive():
                t.join(timeout=2.0)
        for s in (self._recv_sock, self._send_sock):
            if s:
                try:
                    s.close()
                except OSError:
                    pass
        logger.info("CommManager stopped.")

    def is_running(self) -> bool:
        return not self._stop_event.is_set()

    # ── data receive ─────────────────────────────────────────────

    def _recv_loop(self) -> None:
        """Background thread: UDP recvfrom → JSON parse → queue.put()."""
        while not self._stop_event.is_set():
            try:
                raw, addr = self._recv_sock.recvfrom(self._buffer_size)
                logger.debug(f"Received raw data from {addr}: {raw}")
                parsed = self.deserialize(raw)
                if parsed is not None:
                    logger.debug(f"Parsed message: {parsed}")
                    try:
                        self._queue.put(parsed, timeout=0.1)
                    except queue.Full:
                        logger.warning("Queue full, dropping packet from %s", addr)
                else:
                    logger.debug(f"Failed to parse JSON from {addr}: {raw}")
            except socket.timeout:
                continue
            except json.JSONDecodeError:
                logger.debug("Invalid JSON received")
            except OSError:
                if not self._stop_event.is_set():
                    logger.exception("UDP receive error")
                break
            except Exception:
                logger.exception("Unexpected error in receive loop")

    def receive_data(self, timeout: float = 0.0) -> Optional[dict]:
        """Non-blocking pop from queue. Returns None if empty."""
        try:
            return self._queue.get(timeout=timeout) if timeout > 0 else self._queue.get_nowait()
        except queue.Empty:
            return None

    def drain(self) -> List[dict]:
        """Drain all available messages from the queue."""
        messages = []
        while True:
            msg = self.receive_data(timeout=0)
            if msg is None:
                break
            messages.append(msg)
        return messages

    def get_queue_size(self) -> int:
        """Approximate queue depth for UI monitoring."""
        return self._queue.qsize()

    def on_data(self, callback: Callable[[dict], None]) -> None:
        """Register a callback invoked (on main thread via drain) for each message."""
        self._on_data_callbacks.append(callback)

    # ── data transmit ────────────────────────────────────────────

    def send_action(self, action_dict: dict) -> bool:
        """Serialize and send an action command dict via UDP."""
        try:
            payload = self.serialize(action_dict)
            with self._lock:
                self._send_sock.sendto(payload, self._send_addr)
            return True
        except (OSError, TypeError) as e:
            logger.error("send_action failed: %s", e)
            return False

    # ── serialization ────────────────────────────────────────────

    @staticmethod
    def serialize(data: dict) -> bytes:
        """dict → UTF-8 JSON bytes."""
        return json.dumps(data, ensure_ascii=False).encode("utf-8")

    @staticmethod
    def deserialize(raw: bytes) -> Optional[dict]:
        """UTF-8 JSON bytes → dict. Returns None on parse failure."""
        try:
            return json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

    # ── WebSocket server ─────────────────────────────────────────

    def _run_ws_server(self) -> None:
        """Run asyncio WebSocket server in this (background) thread."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        self._ws_loop = loop
        try:
            loop.run_until_complete(self._start_ws_server())
        except OSError as e:
            logger.warning("WebSocket server could not start: %s", e)
        finally:
            self._ws_loop = None
            loop.close()

    async def _start_ws_server(self) -> None:
        """Start websockets server and run until stop event."""
        self._ws_server = await websockets.serve(
            self._ws_handler,
            self._ws_host,
            self._ws_port,
        )
        logger.info("WebSocket server listening on ws://%s:%s", self._ws_host, self._ws_port)
        # poll until stopped
        while not self._stop_event.is_set():
            await asyncio.sleep(0.5)
        self._ws_server.close()
        await self._ws_server.wait_closed()

    async def _ws_handler(self, websocket: WebSocketServerProtocol) -> None:
        """Handle a single WebSocket client connection."""
        self._ws_clients.add(websocket)
        logger.info("WS client connected (%d total)", len(self._ws_clients))
        try:
            async for message in websocket:
                # clients may send selection events or commands
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    continue
                if data.get("type") == "platform_selected":
                    for cb in self._on_data_callbacks:
                        cb(data)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self._ws_clients.discard(websocket)
            logger.info("WS client disconnected (%d remaining)", len(self._ws_clients))

    async def broadcast_ws(self, message: dict) -> None:
        """Broadcast a JSON message to all connected WebSocket clients."""
        if not self._ws_clients:
            return
        payload = json.dumps(message, ensure_ascii=False)
        # websockets.broadcast is safe to call from any thread
        await asyncio.gather(
            *[client.send(payload) for client in self._ws_clients],
            return_exceptions=True,
        )

    def broadcast_sync(self, message: dict) -> None:
        """Thread-safe: schedule a WebSocket broadcast from any thread."""
        if not self._ws_clients or not self._ws_loop:
            return
        if self._ws_loop.is_closed():
            return
        asyncio.run_coroutine_threadsafe(
            self.broadcast_ws(message), self._ws_loop
        )
