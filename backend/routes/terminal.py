"""WebSocket-backed PTY terminal (event-driven, no busy polling)."""
from __future__ import annotations

import asyncio
import fcntl
import os
import pty
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
        os.chdir(WORKSPACE_DIR)
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["PS1"] = "\\[\\e[38;5;208m\\]forge\\[\\e[0m\\] \\W $ "
        os.execvpe("/bin/bash", ["/bin/bash", "--norc", "-i"], env)
        return

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue[bytes | None] = asyncio.Queue()

    def _set_winsize(rows: int, cols: int):
        try:
            fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
        except OSError:
            pass

    _set_winsize(30, 100)

    # Make pty non-blocking so we can read in the event-loop callback
    flags = fcntl.fcntl(fd, fcntl.F_GETFL)
    fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    def _on_readable():
        try:
            data = os.read(fd, 4096)
            if data:
                queue.put_nowait(data)
            else:
                queue.put_nowait(None)
        except BlockingIOError:
            return
        except OSError:
            queue.put_nowait(None)

    loop.add_reader(fd, _on_readable)

    async def _sender():
        while True:
            data = await queue.get()
            if data is None:
                return
            try:
                await ws.send_text(data.decode(errors="replace"))
            except Exception:
                return

    sender_task = asyncio.create_task(_sender())
    try:
        while True:
            msg = await ws.receive_json()
            kind = msg.get("type")
            if kind == "input":
                try:
                    os.write(fd, msg.get("data", "").encode())
                except OSError:
                    break
            elif kind == "resize":
                _set_winsize(int(msg.get("rows", 30)), int(msg.get("cols", 100)))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        try:
            loop.remove_reader(fd)
        except Exception:
            pass
        queue.put_nowait(None)
        try:
            await asyncio.wait_for(sender_task, timeout=1.0)
        except Exception:
            sender_task.cancel()
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
