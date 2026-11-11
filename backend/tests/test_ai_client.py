from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from pydantic import BaseModel

from app.services.ai_client import AIClient, AIConfigurationError, AIResponseError


def test_generate_json_retries_transient_ai_response_failures():
    with (
        patch.object(
            AIClient,
            "_generate_json_once",
            side_effect=[AIResponseError("temporary"), {"result": "ok"}],
        ) as generate_once,
        patch("app.services.ai_client.time.sleep") as sleep,
    ):
        response = AIClient.generate_json("system", "user")

    assert response == {"result": "ok"}
    assert generate_once.call_count == 2
    sleep.assert_called_once_with(0.2)


def test_generate_json_does_not_retry_missing_ai_configuration():
    with (
        patch.object(
            AIClient,
            "_generate_json_once",
            side_effect=AIConfigurationError("missing key"),
        ) as generate_once,
        pytest.raises(AIConfigurationError),
    ):
        AIClient.generate_json("system", "user")

    generate_once.assert_called_once()


def test_generate_structured_json_uses_native_schema_and_parses_fenced_json():
    class ResponseSchema(BaseModel):
        result: str

    generate_content = Mock(
        return_value=SimpleNamespace(text='```json\n{"result":"ok"}\n```')
    )
    with patch(
        "app.services.ai_client.get_gemini_client",
        return_value=SimpleNamespace(
            models=SimpleNamespace(generate_content=generate_content)
        ),
    ):
        response = AIClient.generate_structured_json(
            "system",
            "user",
            ResponseSchema,
        )

    assert response == {"result": "ok"}
    request = generate_content.call_args.kwargs
    assert request["contents"] == "user"
    assert request["config"].response_mime_type == "application/json"
    assert request["config"].response_schema is ResponseSchema
    assert request["config"].store is False
