"""Runs the real Anthropic SDK against a fake HTTP transport: no key, no network."""
import json
import sys
from pathlib import Path

import anthropic
import httpx2 as httpx
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
import app as storymind

PACKAGE = {
    "overall_summary": {"logline": "Elena returns.", "narrative": "She comes home.", "bullets": ["Elena returns."],
                        "tone": "Gothic", "conflict": "Inheritance", "ending_type": "Cliffhanger", "setting": "Thornwood Manor"},
    "timeline": {"plot_beats": [{"beat_number": 1, "type": "Arrival", "characters": ["Elena"],
                                 "text": "Elena enters the manor.", "evidence": "Elena stepped through"}]},
    "characters": {"cards": [{"name": "Elena", "role": "Protagonist", "emotional_state": "Uneasy",
                              "key_actions": ["Returns"], "relationships": [{"to": "Marcus", "nature": "Old friend"}],
                              "change_in_chapter": "Stops running."}]},
    "lore": {"items": []},
    "open_threads": ["What ends here?"],
    "story_state": "Elena is back at Thornwood.",
}
CHAPTER = "Elena stepped through the rusted iron gates of Thornwood Manor."


def use_fake_api(monkeypatch, stop_reason="end_turn", status=200, text=json.dumps(PACKAGE)):
    sent = {}

    def handler(request):
        sent.update(json.loads(request.content))
        if status != 200:
            return httpx.Response(status, json={"type": "error", "error": {"type": "api_error", "message": "boom"}})
        return httpx.Response(200, json={
            "id": "msg_1", "type": "message", "role": "assistant", "model": storymind.MODEL,
            "content": [{"type": "text", "text": text}], "stop_reason": stop_reason,
            "stop_sequence": None, "usage": {"input_tokens": 1, "output_tokens": 1},
        })

    fake = anthropic.Anthropic(api_key="test", max_retries=0, http_client=httpx.Client(transport=httpx.MockTransport(handler)))
    monkeypatch.setattr(storymind, "client", fake)
    return sent


@pytest.fixture
def web():
    return storymind.app.test_client()


def test_returns_package_the_frontend_can_render(web, monkeypatch):
    sent = use_fake_api(monkeypatch)
    res = web.post("/api/analyze", json={"text": CHAPTER, "output_language": "vi", "story_so_far": "Before: nothing."})
    assert res.status_code == 200, res.json
    body = res.json
    assert body["overall_summary"]["narrative"] == "She comes home."
    assert body["timeline"]["plot_beats"][0]["evidence"]
    assert body["characters"]["cards"][0]["relationships"][0]["to"] == "Marcus"
    assert body["story_state"] and body["open_threads"]
    assert body["meta"] == {"word_count": 10, "char_count": len(CHAPTER), "analyzer": storymind.MODEL}
    user_prompt = sent["messages"][0]["content"]
    assert CHAPTER in user_prompt and "Vietnamese" in user_prompt and "Before: nothing." in user_prompt
    assert "output_config" in sent  # the JSON schema was really sent


@pytest.mark.parametrize("body,status", [
    ({"text": "short"}, 400),
    ({"text": 123}, 400),
    ({}, 400),
    ({"text": "x" * (storymind.MAX_CHARS + 1)}, 413),
])
def test_bad_input_is_rejected_before_any_api_call(web, monkeypatch, body, status):
    sent = use_fake_api(monkeypatch)
    res = web.post("/api/analyze", json=body)
    assert res.status_code == status and res.json["error"]
    assert not sent


def test_non_json_body(web):
    assert web.post("/api/analyze", data="hello").status_code == 400


@pytest.mark.parametrize("kwargs,status", [
    ({"stop_reason": "refusal", "text": ""}, 422),
    ({"stop_reason": "max_tokens", "text": json.dumps(PACKAGE)[:40]}, 502),
    ({"status": 500}, 502),
    ({"status": 401}, 502),
    ({"status": 429}, 429),
])
def test_api_failures_become_clear_errors(web, monkeypatch, kwargs, status):
    use_fake_api(monkeypatch, **kwargs)
    res = web.post("/api/analyze", json={"text": CHAPTER})
    assert res.status_code == status and res.json["error"]


def test_missing_key_is_reported(web, monkeypatch):
    monkeypatch.setattr(storymind, "client", None)
    for var in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"):
        monkeypatch.delenv(var, raising=False)
    res = web.post("/api/analyze", json={"text": CHAPTER})
    assert res.status_code == 503 and "ANTHROPIC_API_KEY" in res.json["error"]


def test_frontend_is_served(web):
    assert b"StoryMind" in web.get("/").data
    assert web.get("/app.js").status_code == 200
