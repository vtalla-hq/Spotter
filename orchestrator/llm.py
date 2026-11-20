"""The model behind the nodes. Claude by default; LLM_PROVIDER=groq uses Groq's
OpenAI-compatible API, like Spotter's Ask tab does.

Two calls cover every node:
  structured(system, prompt, Schema) -> Schema instance   (plan, reflect)
  choose_tool(system, prompt, tools) -> (text, name, args) (act)
"""

import json
import os

from pydantic import BaseModel


class Refused(RuntimeError):
    pass


class Claude:
    def __init__(self):
        import anthropic

        self.client = anthropic.Anthropic(max_retries=5)
        self.model = os.getenv("CLAUDE_MODEL", "claude-opus-5-5")
        self.base = dict(
            model=self.model,
            max_tokens=16000,
            # on a safety decline, the API re-runs the request on a fallback model it picks
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        self.effort = {"effort": os.getenv("CLAUDE_EFFORT", "medium")}

    @staticmethod
    def _check(r):
        if r.stop_reason == "refusal":
            raise Refused(getattr(r.stop_details, "explanation", None) or "Model declined")

    def structured(self, system: str, prompt: str, schema: type[BaseModel]) -> BaseModel:
        r = self.client.beta.messages.parse(
            **self.base, system=system, messages=[{"role": "user", "content": prompt}], output_format=schema, output_config=self.effort
        )
        self._check(r)
        return r.parsed_output

    def choose_tool(self, system: str, prompt: str, tools) -> tuple[str, str | None, dict]:
        r = self.client.beta.messages.create(
            **self.base,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            tools=[{"name": t.name, "description": t.description, "input_schema": t.json_schema()} for t in tools],
            tool_choice={"type": "auto", "disable_parallel_tool_use": True},
            output_config=self.effort,
        )
        self._check(r)
        text = "".join(b.text for b in r.content if b.type == "text")
        use = next((b for b in r.content if b.type == "tool_use"), None)
        return text, use and use.name, (use.input if use else {})


class OpenAICompat:
    def __init__(self):
        import openai

        self.client = openai.OpenAI(base_url=os.getenv("AI_BASE_URL", "https://api.groq.com/openai/v1"), api_key=os.getenv("GROQ_API_KEY", ""), max_retries=5)
        self.model = os.getenv("AI_MODEL", "openai/gpt-oss-120b")

    def _chat(self, system, prompt, **kw):
        r = self.client.chat.completions.create(
            model=self.model, messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}], **kw
        )
        return r.choices[0].message

    def structured(self, system, prompt, schema):
        # a forced "respond" tool, not response_format: gpt-oss tries to call tools
        # (e.g. to open URLs it sees) even in JSON mode, which Groq rejects with a 400
        import openai

        fn = {"name": "respond", "description": "Give your answer.", "parameters": schema.model_json_schema()}
        for attempt in range(3):
            try:
                msg = self._chat(system, prompt, tools=[{"type": "function", "function": fn}], tool_choice={"type": "function", "function": {"name": "respond"}})
                return schema.model_validate_json(msg.tool_calls[0].function.arguments)
            except openai.BadRequestError as e:  # it still sometimes calls a tool it saw in the prompt
                if attempt == 2:
                    raise
                prompt += f"\n\n(Your last reply failed: {e.message[:200]}. The only tool here is `respond`.)"

    def choose_tool(self, system, prompt, tools):
        msg = self._chat(
            system,
            prompt,
            tools=[{"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.json_schema()}} for t in tools],
            parallel_tool_calls=False,
        )
        call = (msg.tool_calls or [None])[0]
        if not call:
            return msg.content or "", None, {}
        return msg.content or "", call.function.name, json.loads(call.function.arguments or "{}")


def get_llm():
    return OpenAICompat() if os.getenv("LLM_PROVIDER", "anthropic") == "groq" else Claude()
