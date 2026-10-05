"""Shared test transport to upstream JSONata, not an SDK implementation."""
import atexit
import decimal
import json
from pathlib import Path
import subprocess
import threading

class InvalidExpression(Exception): pass
class EvaluationFailure(Exception): pass
class NumericLimit(Exception): pass

_worker = None
_lock = threading.Lock()

def _close():
    global _worker
    if _worker is not None:
        _worker.stdin.close()
        try: _worker.wait(timeout=2)
        except subprocess.TimeoutExpired:
            _worker.kill()
            _worker.wait()
        _worker.stdout.close()
        _worker = None

atexit.register(_close)

def _exchange(message):
    global _worker
    with _lock:
        if _worker is None:
            _worker = subprocess.Popen(['node', str(Path(__file__).with_name('runner.mjs'))],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        _worker.stdin.write(json.dumps(message, allow_nan=False) + '\n')
        _worker.stdin.flush()
        line = _worker.stdout.readline()
        if not line:
            raise RuntimeError('JSONata test evaluator exited; run npm ci in conformance/kinds/jsonata')
        result = json.loads(line)
    if result.get('error') == 'invalid': raise InvalidExpression('JSONata expression string required')
    if result.get('error'): raise EvaluationFailure('JSONata evaluation failed or returned a non-JSON value')
    return result

def validate(expression):
    _exchange({'expression': expression, 'check': True})

def _input(value):
    if isinstance(value, dict): return {k: _input(v) for k, v in value.items()}
    if isinstance(value, list): return [_input(v) for v in value]
    if type(value) is int and abs(value) > 2**53 - 1:
        raise NumericLimit('reference bridge limits integer inputs to the interoperable range')
    if isinstance(value, decimal.Decimal):
        converted = float(value)
        if not value.is_finite() or decimal.Decimal(str(converted)) != value:
            raise NumericLimit('reference bridge cannot preserve decimal input')
        return converted
    return value

def evaluate(expression, value, absent):
    message = {'expression': expression, 'present': value is not absent}
    if message['present']: message['value'] = _input(value)
    result = _exchange(message)
    return result['value'] if result['present'] else absent
