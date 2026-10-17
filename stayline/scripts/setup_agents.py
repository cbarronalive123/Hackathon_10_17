"""Create or update the two ElevenLabs agents used by StayLine.

Usage:
    python scripts/setup_agents.py            create/update both agents, write IDs to .env
    python scripts/setup_agents.py --list    list existing agents
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agent_specs import booker_agent_spec, frontdesk_agent_spec
from app.config import ENV_FILE, settings
from app.elevenlabs_api import ElevenLabsClient, ElevenLabsError

BOOKER_KEY = "ELEVENLABS_BOOKER_AGENT_ID"
FRONTDESK_KEY = "ELEVENLABS_FRONTDESK_AGENT_ID"


def write_env_value(key: str, value: str) -> None:
    if not ENV_FILE.exists():
        ENV_FILE.write_text(f"{key}={value}\n", encoding="utf-8")
        return
    lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
    pattern = re.compile(rf"^{re.escape(key)}=.*$")
    replaced = False
    for i, line in enumerate(lines):
        if pattern.match(line.strip()):
            lines[i] = f"{key}={value}"
            replaced = True
            break
    if not replaced:
        lines.append(f"{key}={value}")
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def upsert_agent(client: ElevenLabsClient, env_key: str, spec: dict, name: str) -> str | None:
    agent_id = getattr(settings, "booker_agent_id" if env_key == BOOKER_KEY else "frontdesk_agent_id")
    if agent_id:
        try:
            client.update_agent(agent_id, spec)
            print(f"updated {name}: {agent_id}")
            return agent_id
        except ElevenLabsError as exc:
            print(f"could not update {name} ({agent_id}): {exc}\ncreating a new one instead")
    result = client.create_agent(spec)
    new_id = result.get("agent_id") or result.get("id")
    if new_id:
        write_env_value(env_key, str(new_id))
        print(f"created {name}: {new_id}  (written to .env as {env_key})")
    else:
        print(f"created {name} but no agent id returned: {str(result)[:200]}")
    return new_id


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--list", action="store_true", help="list existing agents and exit")
    parser.add_argument("--recreate", action="store_true", help="ignore saved IDs and create fresh agents")
    args = parser.parse_args()

    if not settings.elevenlabs_api_key:
        print("ERROR: ELEVENLABS_API_KEY is not set in .env")
        return 1

    client = ElevenLabsClient(settings.elevenlabs_api_key, settings.elevenlabs_base)

    if args.list:
        try:
            agents = client.list_agents()
        except ElevenLabsError as exc:
            print(f"ERROR listing agents: {exc}")
            return 1
        if not agents:
            print("no agents found in this workspace")
        for a in agents:
            print(f"{a.get('agent_id') or a.get('id')}  {a.get('name', '')}")
        return 0

    if args.recreate:
        write_env_value(BOOKER_KEY, "")
        write_env_value(FRONTDESK_KEY, "")
        settings.booker_agent_id = ""
        settings.frontdesk_agent_id = ""

    if not settings.public_url:
        print("note: PUBLIC_URL is not set, agents will be created without server tools.")
        print("      re-run this script after starting ngrok to attach the booking tools.\n")

    booker_id = upsert_agent(client, BOOKER_KEY, booker_agent_spec(settings), "StayLine Booker")
    frontdesk_id = upsert_agent(client, FRONTDESK_KEY, frontdesk_agent_spec(settings), "StayLine Front Desk Sim")

    print("\nSummary:")
    print(f"  booker agent:    {booker_id}")
    print(f"  frontdesk agent: {frontdesk_id}")
    if booker_id and frontdesk_id:
        print("\nBoth agents ready. IDs are saved in .env, restart the server to pick them up.")
    return 0 if (booker_id and frontdesk_id) else 1


if __name__ == "__main__":
    raise SystemExit(main())
