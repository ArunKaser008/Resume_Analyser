
import json
import logging
from functools import lru_cache

from google import genai

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

            if not response_text or not response_text.strip():
                raise AIResponseError(
                    "Gemini returned an empty response."
                )

            # Remove Markdown JSON fences if present.
            response_text = response_text.strip()

            if response_text.startswith("```"):
                response_text = response_text.removeprefix("```json")
                response_text = response_text.removeprefix("```")
                response_text = response_text.removesuffix("```")
                response_text = response_text.strip()

            try:
                result = json.loads(response_text)
            except json.JSONDecodeError as exc:
                logger.exception("Gemini returned invalid JSON.")
                raise AIResponseError(
                    "Gemini returned an invalid JSON response."
                ) from exc

            if not isinstance(result, dict):
                raise AIResponseError(
                    "Gemini response must be a JSON object."
                )

            return result

        except (AIConfigurationError, AIResponseError):
            raise

        except Exception as exc:
            logger.exception("Gemini API request failed.")

            raise AIResponseError(
                "Failed to generate a response using Gemini."
            ) from exc
