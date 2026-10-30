"""Server-side client for NVIDIA Nemotron on Nebius Token Factory.

The API key is read from the NEBIUS_API_KEY environment variable only. It is
never returned to the browser, written to a file or included in error text.
The browser sends a small list of summary figures; this module builds the
prompt itself so the endpoint cannot be used as a general relay.
"""

import json
import math
import os
import re
import urllib.error
import urllib.request

ENDPOINT = 'https://api.tokenfactory.nebius.com/v1/chat/completions'
DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b'
# Reasoning models spend tokens before the visible answer; keep headroom.
MAX_TOKENS = 2500
MAX_FIGURES = 16
MAX_LABEL = 80
MAX_UNIT = 12


class NemotronError(Exception):
    """A user-presentable failure. Messages never contain the key."""


def load_key(environ=None):
    environ = os.environ if environ is None else environ
    key = (environ.get('NEBIUS_API_KEY') or '').strip()
    return key or None


def model_name(environ=None):
    environ = os.environ if environ is None else environ
    return (environ.get('NEBIUS_MODEL') or DEFAULT_MODEL).strip() or DEFAULT_MODEL


def validate_figures(payload):
    """Accept only labelled finite numbers, so prompts stay bounded and plain."""
    if not isinstance(payload, dict) or not isinstance(payload.get('figures'), list):
        raise NemotronError('Send a JSON object with a "figures" list.')
    figures = payload['figures']
    if not 1 <= len(figures) <= MAX_FIGURES:
        raise NemotronError(f'Send between 1 and {MAX_FIGURES} figures.')
    clean = []
    for item in figures:
        if not isinstance(item, dict):
            raise NemotronError('Each figure must be an object.')
        label, unit = item.get('label'), item.get('unit')
        existing, proposed = item.get('existing'), item.get('proposed')
        if not isinstance(label, str) or not 0 < len(label) <= MAX_LABEL:
            raise NemotronError('Each figure needs a short label.')
        if not isinstance(unit, str) or len(unit) > MAX_UNIT:
            raise NemotronError('Each figure needs a short unit.')
        for value in (existing, proposed):
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise NemotronError('Figure values must be finite numbers.')
        clean.append({'label': label, 'unit': unit,
                      'existing': round(float(existing), 2), 'proposed': round(float(proposed), 2)})
    return clean


def build_messages(figures):
    lines = []
    for f in figures:
        unit = f' {f["unit"]}' if f['unit'] else ''
        lines.append(f'- {f["label"]}: existing {f["existing"]}{unit}; proposed {f["proposed"]}{unit}')
    system = (
        'You read one conceptual rain-runoff comparison from a local planning workbench. '
        'The workbench uses invented starting conditions and a simplified surface-water model. '
        'Use only the figures given. Quote them exactly as written. Do not compute new numbers, '
        'sums, differences or percentages, and do not add numbers that are not in the list. '
        'Write plain English without headings or bullet points, in three short paragraphs: '
        '(1) what the proposed change does to the water budget, using the figures; '
        '(2) what this comparison cannot show, such as whether the model is right for a real site; '
        '(3) one measurement someone could take to test the difference, naming the quantity, the place '
        'and the time to measure it. Write small counts in words. Do not name software or model versions.'
    )
    user = 'Figures from the saved comparison:\n' + '\n'.join(lines)
    return [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]


_THINK = re.compile(r'<think>.*?</think>', re.S | re.I)


def extract_answer(data):
    try:
        message = data['choices'][0]['message']
        content = message.get('content')
    except (KeyError, IndexError, TypeError, AttributeError):
        raise NemotronError('Nebius returned an unexpected response shape.')
    if not isinstance(content, str):
        raise NemotronError('Nebius returned no answer text.')
    text = _THINK.sub('', content).strip()
    if not text:
        raise NemotronError('Nebius returned an empty answer; try again.')
    return text


def call_nemotron(figures, api_key, model=None, opener=urllib.request.urlopen, timeout=120):
    model = model or DEFAULT_MODEL
    body = json.dumps({
        'model': model,
        'messages': build_messages(figures),
        'max_tokens': MAX_TOKENS,
        'temperature': 0.2,
    }).encode('utf-8')
    request = urllib.request.Request(
        ENDPOINT, data=body, method='POST',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json',
                 'Accept': 'application/json'})
    try:
        with opener(request, timeout=timeout) as response:
            data = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as error:
        # Status only: the response body is not echoed back.
        raise NemotronError(f'Nebius Token Factory returned HTTP {error.code}.')
    except (urllib.error.URLError, TimeoutError, OSError):
        raise NemotronError('Could not reach Nebius Token Factory.')
    except ValueError:
        raise NemotronError('Nebius returned data that is not JSON.')
    return {'model': model, 'text': extract_answer(data)}
