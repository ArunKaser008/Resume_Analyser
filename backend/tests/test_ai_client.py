from unittest.mock import patch

import pytest

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
