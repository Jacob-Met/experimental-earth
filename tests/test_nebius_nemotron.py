"""Offline tests for the Nebius Token Factory adapter (no network)."""

import io
import json
import unittest
import urllib.error

import nebius_nemotron as nn

FIGS = [{'label': 'Water infiltrated', 'unit': 'L', 'existing': 500.251, 'proposed': 760.4}]
KEY = 'test-key-not-real-0123'


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def opener_returning(payload):
    def opener(request, timeout):
        opener.request = request
        return FakeResponse(json.dumps(payload).encode())
    return opener


class AdapterTests(unittest.TestCase):
    def test_key_comes_only_from_environment(self):
        self.assertIsNone(nn.load_key({}))
        self.assertIsNone(nn.load_key({'NEBIUS_API_KEY': '   '}))
        self.assertEqual(nn.load_key({'NEBIUS_API_KEY': ' abc \n'}), 'abc')

    def test_default_model_is_nemotron_super_and_overridable(self):
        self.assertEqual(nn.model_name({}), 'nvidia/nemotron-3-super-120b-a12b')
        self.assertEqual(nn.model_name({'NEBIUS_MODEL': 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B'}),
                         'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B')

    def test_validation_rejects_free_text_and_non_finite_values(self):
        with self.assertRaises(nn.NemotronError):
            nn.validate_figures({'prompt': 'anything'})
        bad = [{'label': 'x', 'unit': 'L', 'existing': float('nan'), 'proposed': 1}]
        with self.assertRaises(nn.NemotronError):
            nn.validate_figures({'figures': bad})
        with self.assertRaises(nn.NemotronError):
            nn.validate_figures({'figures': [{'label': 'x', 'unit': 'L', 'existing': True, 'proposed': 1}]})
        with self.assertRaises(nn.NemotronError):
            nn.validate_figures({'figures': FIGS * 17})

    def test_prompt_contains_figures_and_no_key(self):
        messages = nn.build_messages(nn.validate_figures({'figures': FIGS}))
        joined = ' '.join(m['content'] for m in messages)
        self.assertIn('Water infiltrated: existing 500.25 L; proposed 760.4 L', joined)
        self.assertNotIn(KEY, joined)

    def test_call_sends_bearer_key_and_returns_visible_content(self):
        opener = opener_returning({'choices': [{'message': {'content': '<think>x</think>\nInfiltration is 760.4 L.'}}]})
        result = nn.call_nemotron(nn.validate_figures({'figures': FIGS}), KEY, opener=opener)
        self.assertEqual(result, {'model': nn.DEFAULT_MODEL, 'text': 'Infiltration is 760.4 L.'})
        self.assertEqual(opener.request.get_header('Authorization'), f'Bearer {KEY}')
        body = json.loads(opener.request.data.decode())
        self.assertGreaterEqual(body['max_tokens'], 1500)
        self.assertEqual(opener.request.full_url, nn.ENDPOINT)

    def test_empty_or_odd_answers_are_errors(self):
        for payload in ({'choices': [{'message': {'content': None}}]}, {'choices': []}, {'choices': [{'message': {'content': '<think>only</think>'}}]}):
            with self.assertRaises(nn.NemotronError):
                nn.call_nemotron(FIGS, KEY, opener=opener_returning(payload))

    def test_http_errors_report_status_without_key_or_body(self):
        def failing(request, timeout):
            raise urllib.error.HTTPError(request.full_url, 401, 'Unauthorized', {}, io.BytesIO(KEY.encode()))
        with self.assertRaises(nn.NemotronError) as ctx:
            nn.call_nemotron(FIGS, KEY, opener=failing)
        self.assertIn('401', str(ctx.exception))
        self.assertNotIn(KEY, str(ctx.exception))


if __name__ == '__main__':
    unittest.main()
