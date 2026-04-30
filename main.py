"""Entry point for the AFSIM AI Secondary Development System.

Usage:
    python -m afs_ai_controller.main [--simulator] [--recv-port 9000] [--send-port 9001]
                                     [--ws-port 9010] [--aggressiveness 0.5] [--range 40]

If --simulator is passed, launch the data simulator in a subprocess for testing.
"""

import argparse
import logging
import multiprocessing
import signal
import sys
import subprocess

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt

from .comm_manager import CommManager
from .tactical_agent import TacticalAgent
from .ui import TacticalUI

logger = logging.getLogger(__name__)


def parse_args():
    p = argparse.ArgumentParser(description="AFSIM AI Controller")
    p.add_argument("--simulator", action="store_true", help="Launch data simulator subprocess")
    p.add_argument("--recv-port", type=int, default=9000, help="UDP receive port")
    p.add_argument("--send-port", type=int, default=9001, help="UDP send port")
    p.add_argument("--ws-port", type=int, default=9010, help="WebSocket server port")
    p.add_argument("--aggressiveness", type=float, default=0.5)
    p.add_argument("--range", type=float, default=40.0, help="Engagement range (nm)")
    p.add_argument("--threat", type=float, default=0.5, help="Threat sensitivity")
    p.add_argument("--side", default="BLUE", help="Friendly side (BLUE/RED)")
    p.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    return p.parse_args()


def launch_simulator(recv_port: int) -> multiprocessing.Process:
    """Launch simulator.py as a subprocess."""
    import subprocess
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sim_path = os.path.join(script_dir, "simulator.py")
    proc = subprocess.Popen(
        [sys.executable, sim_path, "--port", str(recv_port), "--hz", "5.0"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    logger.info("Simulator launched (PID=%s)", proc.pid)
    return proc


def main():
    args = parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.WARNING,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    # allow Ctrl+C to work
    signal.signal(signal.SIGINT, signal.SIG_DFL)

    # create Qt application (must be first, before other Qt objects)
    app = QApplication(sys.argv)
    app.setApplicationName("AFSIM AI Controller")
    app.setStyle("Fusion")

    # create components
    comm = CommManager(
        recv_port=args.recv_port,
        send_port=args.send_port,
        ws_port=args.ws_port,
    )
    agent = TacticalAgent(
        aggressiveness=args.aggressiveness,
        engagement_range_nm=args.range,
        threat_sensitivity=args.threat,
        friendly_side=args.side,
    )

    # launch simulator if requested
    sim_proc = None
    if args.simulator:
        sim_proc = launch_simulator(args.recv_port)

    # start communication layer
    comm.start()

    # build and show UI
    ui = TacticalUI(comm, agent)
    ui.show()

    # run Qt event loop (blocking)
    try:
        exit_code = app.exec()
    finally:
        comm.stop()
        if sim_proc:
            sim_proc.terminate()
            try:
                sim_proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                sim_proc.kill()
            logger.info("Simulator process terminated.")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
