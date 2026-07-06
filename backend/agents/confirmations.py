import asyncio
import sys
from typing import Dict, Any

class ConfirmationManager:
    def __init__(self):
        self.pending: Dict[str, Dict[str, Any]] = {}
        print(f"[ConfirmationManager] Initialized instance {id(self)}", file=sys.stderr, flush=True)

    def create_pending(self, command_id: str, command: str) -> asyncio.Event:
        event = asyncio.Event()
        self.pending[command_id] = {
            "event": event,
            "approved": False,
            "command": command
        }
        print(f"[ConfirmationManager {id(self)}] Created pending confirmation: {command_id} for command '{command}'. Current pending keys: {list(self.pending.keys())}", file=sys.stderr, flush=True)
        return event

    def resolve(self, command_id: str, approved: bool):
        print(f"[ConfirmationManager {id(self)}] Resolving confirmation: {command_id} (approved={approved}). Current pending keys: {list(self.pending.keys())}", file=sys.stderr, flush=True)
        if command_id in self.pending:
            self.pending[command_id]["approved"] = approved
            self.pending[command_id]["event"].set()
        else:
            print(f"[ConfirmationManager {id(self)}] ERROR: {command_id} not found in pending keys!", file=sys.stderr, flush=True)

confirmation_manager = ConfirmationManager()
