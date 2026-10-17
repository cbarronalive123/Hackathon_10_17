"""StayLine desktop test GUI.

Place a test call from the ElevenLabs booking agent to your own phone, watch the
live transcript, and see the reservation details the agent captures.

Run the server first (python run.py), then:
    python gui.py
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from datetime import date
from pathlib import Path

import httpx
from PyQt6.QtCore import QDate, QThread, pyqtSignal
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QApplication,
    QDateEdit,
    QDoubleSpinBox,
    QFormLayout,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

ROOT = Path(__file__).resolve().parent
BASE = os.environ.get("STAYLINE_URL", "http://127.0.0.1:8010").rstrip("/")
SCRIPT_FILE = ROOT / "CALL_SCRIPT.md"

DEFAULT_HOTEL = "The Grand Meridian Hotel"
DEFAULT_SUITE = "Deluxe King Suite"
DEFAULT_RATE = 289.00

QSS = """
QMainWindow, QWidget { background: #0a0a0b; color: #ececf1; font-size: 13px; }
QGroupBox {
    background: #141416; border: 1px solid #2a2a30; border-radius: 10px;
    margin-top: 12px; padding: 12px 10px 10px 10px; font-weight: 600;
}
QGroupBox::title { subcontrol-origin: margin; left: 12px; padding: 0 4px; color: #e8c15a; }
QLabel#title { font-size: 20px; font-weight: 700; }
QLabel#title span { color: #e8c15a; }
QLabel#subtitle { color: #8b8b96; font-size: 11px; }
QLabel#callstatus { font-size: 15px; font-weight: 700; color: #e8c15a; }
QLabel#hint { color: #8b8b96; font-size: 11px; }
QLineEdit, QDateEdit, QDoubleSpinBox {
    background: #1b1b1f; border: 1px solid #2a2a30; border-radius: 6px;
    padding: 6px 8px; color: #ececf1; selection-background-color: #e8c15a;
}
QLineEdit#phone {
    font-size: 18px; font-weight: 700; letter-spacing: 1px; padding: 10px;
    border: 1px solid #e8c15a; border-radius: 8px;
}
QPushButton {
    background: #1b1b1f; color: #ececf1; border: 1px solid #2a2a30;
    border-radius: 6px; padding: 7px 12px;
}
QPushButton:hover { border-color: #e8c15a; }
QPushButton#call { background: #e8c15a; color: #141416; font-weight: 700; font-size: 15px; padding: 12px; border: none; }
QPushButton#call:hover { background: #f0cf70; }
QPushButton#call:disabled { background: #5c5233; color: #2a2a30; }
QPushButton#keypad { font-size: 15px; font-weight: 600; padding: 10px; }
QPlainTextEdit {
    background: #141416; border: 1px solid #2a2a30; border-radius: 8px;
    color: #ececf1; font-family: Consolas, monospace; font-size: 12px; padding: 8px;
}
QFormLayout QLabel { color: #8b8b96; font-size: 11px; }
QLabel#field { color: #ececf1; font-size: 13px; font-weight: 600; }
QLabel#ok { color: #4ade80; font-size: 11px; }
QLabel#bad { color: #f87171; font-size: 11px; }
"""


class TaskThread(QThread):
    done = pyqtSignal(object, object)

    def __init__(self, fn, parent=None):
        super().__init__(parent)
        self.fn = fn

    def run(self):
        try:
            self.done.emit(self.fn(), None)
        except Exception as exc:
            self.done.emit(None, exc)


class PollWorker(QThread):
    updated = pyqtSignal(dict, dict)

    def __init__(self, base: str, parent=None):
        super().__init__(parent)
        self.base = base
        self._stop = False

    def stop(self):
        self._stop = True

    def run(self):
        while not self._stop:
            health: dict = {}
            latest: dict = {}
            try:
                health = httpx.get(f"{self.base}/api/health", timeout=5).json()
                calls = httpx.get(f"{self.base}/api/calls", timeout=5).json().get("calls", [])
                if calls:
                    latest = calls[0]
            except Exception:
                pass
            self.updated.emit(health, latest)
            for _ in range(20):
                if self._stop:
                    return
                time.sleep(0.1)


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("StayLine — AI booking agent test console")
        self.resize(1180, 720)
        self._last_health: dict = {}
        self._active_call_id: int | None = None
        self.worker = PollWorker(BASE)
        self.worker.updated.connect(self.on_poll)
        self.worker.start()
        self._task: TaskThread | None = None
        self._build_ui()
        self._load_profile()

    def _build_ui(self):
        root = QWidget()
        layout = QVBoxLayout(root)
        layout.setSpacing(10)

        header = QHBoxLayout()
        title = QLabel(f"Stay<span style='color:#e8c15a'>Line</span>")
        title.setObjectName("title")
        subtitle = QLabel("AI phone booking agent — test console (call mode: test)")
        subtitle.setObjectName("subtitle")
        header.addWidget(title)
        header.addSpacing(12)
        header.addWidget(subtitle)
        header.addStretch(1)
        self.start_server_btn = QPushButton("Start server")
        self.start_server_btn.clicked.connect(self.start_server)
        header.addWidget(self.start_server_btn)
        script_btn = QPushButton("Open role-play script")
        script_btn.clicked.connect(self.open_script)
        header.addWidget(script_btn)
        layout.addLayout(header)

        self.health_label = QLabel("connecting to server…")
        self.health_label.setObjectName("hint")
        layout.addWidget(self.health_label)

        cols = QHBoxLayout()
        cols.addLayout(self._build_left(), 5)
        cols.addLayout(self._build_right(), 6)
        layout.addLayout(cols, 1)
        self.setCentralWidget(root)

    def _build_left(self) -> QVBoxLayout:
        col = QVBoxLayout()

        dialer_box = QGroupBox("Dialer — your phone rings, the AI agent speaks")
        dial = QVBoxLayout(dialer_box)
        self.phone_edit = QLineEdit()
        self.phone_edit.setObjectName("phone")
        self.phone_edit.setPlaceholderText("+1 555 010 0199")
        self.phone_edit.setText(os.environ.get("STAYLINE_TEST_NUMBER", ""))
        dial.addWidget(self.phone_edit)

        keypad = QGridLayout()
        keys = [
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            ["*", "0", "#"],
        ]
        for r, row in enumerate(keys):
            for c, key in enumerate(row):
                btn = QPushButton(key)
                btn.setObjectName("keypad")
                btn.clicked.connect(lambda _=False, k=key: self.phone_edit.setText(self.phone_edit.text() + k))
                keypad.addWidget(btn, r, c)
        plus_btn = QPushButton("+")
        plus_btn.setObjectName("keypad")
        plus_btn.clicked.connect(lambda: self.phone_edit.setText(self.phone_edit.text() + "+"))
        back_btn = QPushButton("⌫")
        back_btn.setObjectName("keypad")
        back_btn.clicked.connect(lambda: self.phone_edit.backspace())
        keypad.addWidget(plus_btn, 4, 0)
        keypad.addWidget(back_btn, 4, 1, 1, 2)
        dial.addLayout(keypad)

        self.call_btn = QPushButton("☎  CALL MY PHONE")
        self.call_btn.setObjectName("call")
        self.call_btn.clicked.connect(self.place_call)
        dial.addWidget(self.call_btn)

        self.hangup_btn = QPushButton("Hang up")
        self.hangup_btn.clicked.connect(self.hangup_call)
        self.hangup_btn.setEnabled(False)
        dial.addWidget(self.hangup_btn)
        hint = QLabel("Answer your phone and read from CALL_SCRIPT.md (role-play the hotel).")
        hint.setObjectName("hint")
        hint.setWordWrap(True)
        dial.addWidget(hint)
        col.addWidget(dialer_box)

        booking_box = QGroupBox("Booking scenario (what the agent asks for)")
        form = QFormLayout(booking_box)
        self.hotel_edit = QLineEdit(DEFAULT_HOTEL)
        self.suite_edit = QLineEdit(DEFAULT_SUITE)
        self.checkin_edit = QDateEdit(QDate.currentDate().addDays(30))
        self.checkout_edit = QDateEdit(QDate.currentDate().addDays(32))
        for w in (self.checkin_edit, self.checkout_edit):
            w.setCalendarPopup(True)
            w.setDisplayFormat("yyyy-MM-dd")
        self.rate_spin = QDoubleSpinBox()
        self.rate_spin.setRange(20, 10000)
        self.rate_spin.setValue(DEFAULT_RATE)
        self.rate_spin.setPrefix("$")
        self.rate_spin.setSuffix(" / night")
        form.addRow("Hotel", self.hotel_edit)
        form.addRow("Suite / room", self.suite_edit)
        form.addRow("Check-in", self.checkin_edit)
        form.addRow("Check-out", self.checkout_edit)
        form.addRow("Rate to quote", self.rate_spin)
        col.addWidget(booking_box)

        guest_box = QGroupBox("Guest profile (saved to the server)")
        gform = QFormLayout(guest_box)
        self.guest_name = QLineEdit()
        self.guest_name.setPlaceholderText("Jane Doe")
        self.guest_email = QLineEdit()
        self.guest_email.setPlaceholderText("jane@example.com")
        self.guest_phone = QLineEdit()
        self.guest_phone.setPlaceholderText("+15194760578")
        gform.addRow("Guest name", self.guest_name)
        gform.addRow("Email", self.guest_email)
        gform.addRow("Callback phone", self.guest_phone)
        col.addWidget(guest_box)
        col.addStretch(1)
        return col

    def _build_right(self) -> QVBoxLayout:
        col = QVBoxLayout()

        status_box = QGroupBox("Live call")
        sv = QVBoxLayout(status_box)
        self.call_status = QLabel("no call yet")
        self.call_status.setObjectName("callstatus")
        sv.addWidget(self.call_status)
        self.call_meta = QLabel("")
        self.call_meta.setObjectName("hint")
        sv.addWidget(self.call_meta)

        self.reservation_rows = [
            ("Confirmation #", "confirmation_number"),
            ("Dates", "dates"),
            ("Suite / room", "room_description"),
            ("Total price", "total_price"),
            ("Cancellation", "cancellation_policy"),
            ("Notes", "notes"),
        ]
        rform = QFormLayout()
        self.reservation_labels: dict[str, QLabel] = {}
        for label, key in self.reservation_rows:
            value = QLabel("—")
            value.setObjectName("field")
            rform.addRow(label, value)
            self.reservation_labels[key] = value
        sv.addLayout(rform)
        self.outcome_label = QLabel("Outcome: —")
        self.outcome_label.setObjectName("field")
        sv.addWidget(self.outcome_label)
        col.addWidget(status_box)

        transcript_box = QGroupBox("Live transcript")
        tv = QVBoxLayout(transcript_box)
        self.transcript = QPlainTextEdit()
        self.transcript.setReadOnly(True)
        self.transcript.setPlaceholderText("The conversation will appear here as it happens…")
        tv.addWidget(self.transcript)
        col.addWidget(transcript_box, 1)
        return col

    def _api(self, method: str, path: str, json_body: dict | None = None) -> dict:
        resp = httpx.request(method, f"{BASE}{path}", json=json_body, timeout=30)
        data = resp.json() if resp.content else {}
        if resp.status_code >= 400:
            raise RuntimeError(str(data.get("detail") or f"HTTP {resp.status_code}"))
        return data

    def _load_profile(self):
        def task():
            return self._api("GET", "/api/profile")

        self._run_task(task, self._on_profile)

    def _on_profile(self, profile: dict, error):
        if error or not profile:
            return
        self.guest_name.setText(profile.get("guest_name") or "")
        self.guest_email.setText(profile.get("guest_email") or "")
        self.guest_phone.setText(profile.get("guest_phone") or "")

    def _run_task(self, fn, callback):
        self._task = TaskThread(fn)
        self._task.done.connect(callback)
        self._task.start()

    def place_call(self):
        number = self.phone_edit.text().strip()
        if not number:
            QMessageBox.warning(self, "StayLine", "Enter your phone number in the dialer first.")
            return
        hotel = self.hotel_edit.text().strip() or DEFAULT_HOTEL
        suite = self.suite_edit.text().strip() or DEFAULT_SUITE
        checkin = self.checkin_edit.date().toString("yyyy-MM-dd")
        checkout = self.checkout_edit.date().toString("yyyy-MM-dd")
        rate = self.rate_spin.value()
        try:
            ci = date.fromisoformat(checkin)
            co = date.fromisoformat(checkout)
        except ValueError:
            QMessageBox.warning(self, "StayLine", "Invalid dates.")
            return
        nights = max(1, (co - ci).days)
        profile = {
            "guest_name": self.guest_name.text().strip(),
            "guest_email": self.guest_email.text().strip(),
            "guest_phone": self.guest_phone.text().strip(),
            "room_preference": suite,
            "budget_note": f"Up to ${rate + 60:.0f} per night",
        }

        def task():
            self._api("PUT", "/api/profile", profile)
            offer = {
                "hotel_id": "gui-test-hotel",
                "name": hotel,
                "address": "1 Meridian Plaza",
                "city": "New York",
                "room_name": suite,
                "board": "Room Only",
                "refundable": "RFN",
                "total": round(rate * nights, 2),
                "per_night": rate,
                "currency": "USD",
                "nights": nights,
                "checkin": checkin,
                "checkout": checkout,
                "adults": 2,
                "phone": None,
                "phone_source": "none",
            }
            return self._api(
                "POST",
                "/api/calls",
                {"hotel_id": "gui-test-hotel", "offer": offer, "mode": "test", "to_number": number},
            )

        self.call_btn.setEnabled(False)
        self.call_btn.setText("Placing call…")
        self._run_task(task, self._on_call_placed)

    def _on_call_placed(self, result, error):
        self.call_btn.setEnabled(True)
        self.call_btn.setText("☎  CALL MY PHONE")
        if error:
            QMessageBox.critical(
                self,
                "StayLine — call failed",
                f"{error}\n\nChecklist:\n"
                "• server running (python run.py)\n"
                "• ngrok running and PUBLIC_URL set in .env\n"
                "• Twilio creds + TWILIO_FROM_NUMBER set\n"
                "• ELEVENLABS_API_KEY set and scripts/setup_agents.py run",
            )
            return
        self.on_poll(self._last_health, result)

    def hangup_call(self):
        call_id = getattr(self, "_active_call_id", None)
        if not call_id:
            return

        def task():
            return self._api("POST", f"/api/calls/{call_id}/hangup")

        self._run_task(task, lambda r, e: None)

    def on_poll(self, health: dict, call: dict):
        self._last_health = health
        if not health:
            self.health_label.setText("server offline — press “Start server” or run: python run.py")
            self.start_server_btn.setEnabled(True)
            return
        self.start_server_btn.setEnabled(False)
        flags = [
            ("server", True),
            ("public URL", health.get("public_url_set")),
            ("Twilio", health.get("twilio_ready") and health.get("from_number")),
            ("ElevenLabs", health.get("elevenlabs_key")),
            ("booker agent", health.get("booker_agent")),
            ("liteAPI", health.get("liteapi")),
        ]
        self.health_label.setText("   ".join(("✓ " if ok else "✗ ") + name for name, ok in flags))

        if not call:
            return
        self._active_call_id = call.get("id")
        status = call.get("status", "")
        self.call_status.setText(f"Call #{call.get('id')} — {status.replace('_', ' ').upper()}")
        ctx = call.get("booking_context") or {}
        self.call_meta.setText(
            f"{ctx.get('hotel_name', '')} · {ctx.get('room_type', '')} · "
            f"{ctx.get('checkin', '')} → {ctx.get('checkout', '')} · dialing {call.get('to_number', '')}"
        )
        active = status in ("queued", "ringing", "in_progress")
        self.hangup_btn.setEnabled(bool(active and call.get("twilio_sid")))

        transcript = call.get("transcript") or []
        lines = []
        for turn in transcript:
            role = "AI (booker)" if turn.get("role") == "agent" else "HOTEL (you)"
            message = (turn.get("message") or "").strip()
            lines.append(f"[{role}]  {message}")
        peer = call.get("peer_transcript") or []
        if peer:
            lines.append("--- front desk side ---")
            for turn in peer:
                role = "FRONT DESK AI" if turn.get("role") == "agent" else "AI (booker)"
                lines.append(f"[{role}]  {(turn.get('message') or '').strip()}")
        self.transcript.setPlainText("\n\n".join(lines))
        self.transcript.verticalScrollBar().setValue(self.transcript.verticalScrollBar().maximum())

        reservation = call.get("reservation") or {}
        if reservation:
            for label, key in self.reservation_rows:
                value = reservation.get(key)
                if key == "dates" and not value:
                    dates = " → ".join(x for x in [reservation.get("checkin"), reservation.get("checkout")] if x)
                    value = dates or None
                self.reservation_labels[key].setText(str(value) if value else "—")
        outcome = call.get("outcome") or {}
        if outcome.get("outcome"):
            reason = outcome.get("reason") or ""
            self.outcome_label.setText(f"Outcome: {outcome['outcome']}" + (f" — {reason}" if reason else ""))
        elif call.get("summary"):
            self.outcome_label.setText(f"Summary: {call['summary']}")

    def start_server(self):
        subprocess.Popen(
            [sys.executable, "run.py"],
            cwd=str(ROOT),
            creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == "nt" else 0,
        )

    def open_script(self):
        if SCRIPT_FILE.exists():
            try:
                os.startfile(SCRIPT_FILE)
                return
            except OSError:
                pass
        QMessageBox.information(self, "StayLine", f"Script file not found:\n{SCRIPT_FILE}")

    def closeEvent(self, event):
        self.worker.stop()
        self.worker.wait(2000)
        super().closeEvent(event)


def main() -> int:
    app = QApplication(sys.argv)
    app.setStyleSheet(QSS)
    font = QFont("Segoe UI", 10)
    app.setFont(font)
    window = MainWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
