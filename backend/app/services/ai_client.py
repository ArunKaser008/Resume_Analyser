
import json
import logging
import re
import time
from functools import lru_cache

from google import genai
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIConfigurationError(Exception):
    """Raised when Gemini configuration is missing or invalid."""


class AIResponseError(Exception):
    """Raised when Gemini returns an invalid response."""


@lru_cache(maxsize=1)
def get_gemini_client() -> genai.Client:
    """Create and cache the Gemini client."""

    if not settings.gemini_api_key:
        raise AIConfigurationError(
            "GEMINI_API_KEY is not configured. Add it to your .env file."
        )

    api_key = settings.gemini_api_key.get_secret_value()

    if not api_key:
        raise AIConfigurationError(
            "GEMINI_API_KEY is empty. Add a valid API key to your .env file."
        )

    return genai.Client(api_key=api_key)


class AIClient:
    """Gemini AI client for resume-related operations."""

    @staticmethod
    def generate_json(
        system_prompt: str,
        user_prompt: str,
    ) -> dict:
        for attempt in range(3):
            try:
                return AIClient._generate_json_once(system_prompt, user_prompt)
            except AIConfigurationError:
                raise
            except AIResponseError as exc:
                if attempt == 2:
                    raise
                delay = 0.2 * (2 ** attempt)
                logger.warning(
                    "Gemini request failed; retrying in %.1f seconds (attempt %s/3).",
                    delay,
                    attempt + 1,
                    exc_info=exc,
                )
                time.sleep(delay)
        raise RuntimeError("AI retry loop exited without a result or error.")

    @staticmethod
    def _generate_json_once(
        system_prompt: str,
        user_prompt: str,
    ) -> dict:
        """
        Generate a JSON response using Gemini.

        Args:
            system_prompt: Instructions for Gemini.
            user_prompt: Resume data and optimization request.

        Returns:
            Parsed JSON dictionary.
        """

        try:
            client = get_gemini_client()

            interaction = client.interactions.create(
                model=settings.gemini_model,
                input=user_prompt,
                system_instruction=system_prompt,
                generation_config={
                    "temperature": 0.2,
                    "max_output_tokens": 8000,
                },
                store=False,
            )

            response_text = interaction.output_text

            return AIClient._parse_json_response(response_text)

        except (AIConfigurationError, AIResponseError):
            raise

        except Exception as exc:
            logger.exception("Gemini API request failed.")

            raise AIResponseError(
                "Failed to generate a response using Gemini."
            ) from exc

    @staticmethod
    def generate_structured_json(
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
    ) -> dict:
        """Generate one stateless response using Gemini's native JSON schema mode."""
        try:
            client = get_gemini_client()
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=user_prompt,
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.2,
                    max_output_tokens=8000,
                    response_mime_type="application/json",
                    response_schema=response_schema,
                    store=False,
                ),
            )
            return AIClient._parse_json_response(response.text)
        except (AIConfigurationError, AIResponseError):
            raise
        except Exception as exc:
            logger.exception("Gemini structured request failed.")
            raise AIResponseError(
                "Failed to generate a structured response using Gemini."
            ) from exc

    @staticmethod
    def _parse_json_response(response_text: str | None) -> dict:
        if not response_text or not response_text.strip():
            raise AIResponseError("Gemini returned an empty response.")

        cleaned_text = response_text.strip()
        fenced_json = re.fullmatch(
            r"```(?:json)?\s*(.*?)\s*```",
            cleaned_text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if fenced_json:
            cleaned_text = fenced_json.group(1).strip()

        try:
            result = json.loads(cleaned_text)
        except json.JSONDecodeError:
            decoder = json.JSONDecoder()
            object_start = cleaned_text.find("{")
            try:
                if object_start < 0:
                    raise ValueError("No JSON object found.")
                result, _ = decoder.raw_decode(cleaned_text[object_start:])
            except (json.JSONDecodeError, ValueError) as exc:
                raise AIResponseError(
                    "Gemini returned an invalid JSON response."
                ) from exc

        if not isinstance(result, dict):
            raise AIResponseError("Gemini response must be a JSON object.")

        return result
