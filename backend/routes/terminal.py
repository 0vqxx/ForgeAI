"""WebSocket-backed PTY terminal."""
from __future__ import annotations

import asyncio
import fcntl
import os
import pty
import select
import signal
import struct
import termios

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

WORKSPACE_DIR = os.environ.get("WORKSPACE_DIR", "/app/workspace")

router = APIRouter(tags=["terminal"])


@router.websocket("/api/terminal/ws")
async def terminal_ws(ws: WebSocket):
    await ws.accept()
    pid, fd = pty.fork()
    if pid == 0:
        # Child: exec bash inside workspace
        os.chdir(WORKSPACE_DIR)
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["PS1"] = "\\[\\e[38;5;79m\\]bloom\\[\\e[0m\\] \\W $ "
        os.execvpe("/bin/bash", ["/bin/bash", "--norc", "-i"], env)
        # unreachable
        return

    loop = asyncio.get_event_loop()

    def _set_winsize(rows: int, cols: int):
        try:
            fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
        except OSError:
            pass

    _set_winsize(30, 100)

    async def read_pty():
        try:
            while True:
                await loop.run_in_executor(None, lambda: select.select([fd], [], [], 0.05))
                try:
                    data = os.read(fd, 4096)
                except OSError:
                    break
                if not data:
                    break
                try:
                    await ws.send_text(data.decode(errors="replace"))
                except Exception:
                    break
        except Exception:
            pass

    reader_task = asyncio.create_task(read_pty())
    try:
        while True:
            msg = await ws.receive_json()
            kind = msg.get("type")
            if kind == "input":
                os.write(fd, msg.get("data", "").encode())
            elif kind == "resize":
                _set_winsize(int(msg.get("rows", 30)), int(msg.get("cols", 100)))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        reader_task.cancel()
        try:
            os.kill(pid, signal.SIGHUP)
        except ProcessLookupError:
            pass
        try:
            os.close(fd)
        except OSError:
            pass
        try:
            os.waitpid(pid, os.WNOHANG)
        except ChildProcessError:
            pass
