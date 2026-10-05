"""Upstream-derived observations against the existing bounded interpreters.

serialization.json is independent of their algorithms. These are regression
checks, not a declaration that the interpreters implement all of any kind.
"""
import copy
from email import policy
from email.parser import BytesParser
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from urllib.parse import parse_qsl, unquote, urlsplit

HERE = Path(__file__).resolve().parent
KIND_ROOT = HERE.parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


P30 = load('authority30', KIND_ROOT / 'openapi-3.0/interpreter.py')
P31 = load('authority31', KIND_ROOT / 'openapi-3.1/interpreter.py')
P32 = load('probe', KIND_ROOT / 'openapi-3.2/probe.py')
sys.modules['probe'] = P32
sys.path.insert(0, str(KIND_ROOT / 'openapi-3.2'))
PARTS = load('authority_multipart', KIND_ROOT / 'openapi-3.2/multipart_probe.py')


def artifact(version='3.2.1', path='/probe', method='post', **operation):
    return {'openapi': version, 'info': {'title': 'Authority witness', 'version': '1'},
            'servers': [{'url': 'https://wire.example'}],
            'paths': {path: {method: {'responses': {'200': {'description': 'OK'}}, **operation}}}}


def target(path='/probe', method='post'):
    return '/paths/' + path.replace('~', '~0').replace('/', '~1') + '/' + method


def obi(document):
    return {'openbindings': '0.2.0', 'operations': {'call': {}},
            'sources': {'api': {'kind': 'openbindings.openapi-3.1@1', 'content': {'document': document}}},
            'bindings': {'http': {'operation': 'call', 'source': 'api', 'content': {'target': target()}}}}


def request32(parameters, values, path='/probe'):
    doc = artifact(path=path, parameters=parameters)
    return P32.request(P32.Source({'document': doc}), {'target': target(path)}, {'parameters': values})[0]


class AuthorityRegressions(unittest.TestCase):
    @staticmethod
    def parts(media, body):
        message = BytesParser(policy=policy.default).parsebytes(
            ('Content-Type: ' + media + '\r\nMIME-Version: 1.0\r\n\r\n').encode() + body)
        return [(part.get_param('name', header='content-disposition'), part.get_payload(decode=True))
                for part in message.iter_parts()]

    def test_32_named_members_follow_applicable_property_schemas(self):
        # OAS 3.2.1 §§4.14.5.1,4.15; JSON Schema 2020-12 object applicators.
        # Derived cases, using an independent MIME parser for observations.
        for schema in ({'additionalProperties': {'type': 'string'}},
                       {'patternProperties': {'^extra$': {'type': 'string'}}, 'additionalProperties': False},
                       {'allOf': [{'properties': {'extra': {'type': 'string'}}}, {'additionalProperties': {'type': 'string'}}]}):
            with self.subTest(schema=schema):
                declaration = {'schema': schema, 'encoding': {'extra': {'contentType': 'text/plain'},
                               'absent': {'contentType': 'unsupported/example'}}}
                self.assertEqual(self.parts(*PARTS.compose_form_data(declaration, {'extra': 'kept'})), [('extra', b'kept')])
        declaration = {'schema': {'properties': {'title': {'type': 'string'}}, 'additionalProperties': False},
                       'encoding': {'extra': {'contentType': 'text/plain'}}}
        with self.assertRaises(P32.Unroutable):
            PARTS.compose_form_data(declaration, {'extra': 'not dropped'})
        # An absent forbidden property does not poison a usable sibling.
        declaration = {'schema': {'properties': {'title': {'type': 'string'}, 'unused': False}},
                       'encoding': {'title': {'contentType': 'text/plain'}}}
        self.assertEqual(self.parts(*PARTS.compose_form_data(declaration, {'title': 'kept'})), [('title', b'kept')])

    def test_32_positional_form_data_names_order_and_unused_encoding(self):
        # OAS 3.2.1 §4.14.5.2: each item is a single-name/value object.
        declaration = {'schema': {'items': {'additionalProperties': {'type': 'string'}}},
                       'prefixEncoding': [{'contentType': 'text/plain'}, {'contentType': 'text/plain'},
                                          {'contentType': 'unsupported/unused'}]}
        self.assertEqual(self.parts(*PARTS.compose_positional(declaration,
                         [{'a': 'one'}, {'a': 'two'}], subtype='form-data')),
                         [('a', b'one'), ('a', b'two')])
        for item in ({}, {'a': 'one', 'b': 'two'}, 'unnamed'):
            with self.subTest(item=item), self.assertRaises(P32.Unroutable):
                PARTS.compose_positional(declaration, [item], subtype='form-data')

    def test_32_allof_retains_array_item_and_required_member_semantics(self):
        # Derived from OAS 3.2.1 Encoding + JSON Schema allOf conjunction.
        declaration = {'schema': {'allOf': [
            {'properties': {'a': {'type': 'array', 'items': {'type': 'string'}}}},
            {'properties': {'a': {'type': 'array', 'items': {'type': 'string'}}}}]},
            'encoding': {'a': {'contentType': 'application/json'}}}
        self.assertEqual(self.parts(*PARTS.compose_form_data(declaration, {'a': ['one', 'two']})),
                         [('a', b'"one"'), ('a', b'"two"')])
        declaration = {'schema': {'allOf': [
            {'properties': {'a': {'type': ['string', 'null']}}, 'required': ['a']}]},
            'encoding': {'a': {'contentType': 'text/plain'}}}
        with self.assertRaises(P32.Unsupported):
            PARTS.compose_form_data(declaration, {'a': None})

    def test_31_referenced_resource_retains_its_own_dialect(self):
        # OAS 3.1.2 default dialect and JSON Schema resource identity rules.
        base = 'https://spec.openapis.org/oas/3.1/dialect/base'
        foreign = 'https://example.test/unknown-dialect'
        for explicit, supported in [(None, False), (base, True)]:
            with self.subTest(resource_dialect=explicit):
                model = {'$id': 'https://wire.example/model', 'type': 'string'}
                if explicit is not None:
                    model['$schema'] = explicit
                declaration = {'schema': {'$schema': base, '$ref': 'https://wire.example/model'}}
                doc = artifact('3.1.2', requestBody={'content': {'text/plain': declaration}})
                doc['jsonSchemaDialect'] = foreign
                doc['components'] = {'schemas': {'Model': model}}
                interpreter = P31.Interpreter()
                if supported:
                    self.assertEqual(interpreter.prepare(obi(doc), 'http', {'body': 'hello'})['body'], b'hello')
                else:
                    with self.assertRaises(P31.Cannot) as caught:
                        interpreter.prepare(obi(doc), 'http', {'body': 'hello'})
                    self.assertEqual(caught.exception.category, 'capability')
                self.assertEqual(interpreter.r.schema_dialects[id(model)], explicit or foreign)

    def test_serialization_specimens_in_all_three_editions(self):
        fixture = json.loads((HERE / 'serialization.json').read_text())
        for case in fixture['cases']:
            for version in fixture['editions']:
                with self.subTest(case=case['id'], version=version, authority=case['authority']):
                    params = case.get('parameters', [case.get('parameter')])
                    values = case.get('values', {params[0]['name']: case.get('value')})
                    if version == '3.2':
                        path = '/probe/{color}' if 'expectedExpansion' in case else '/probe'
                        request = request32(params, values, path)
                        observed = (urlsplit(request['url']).path[len('/probe/'):]
                                    if 'expectedExpansion' in case else
                                    [list(pair) for pair in parse_qsl(urlsplit(request['url']).query, keep_blank_values=True)])
                    else:
                        if version == '3.0':
                            serialize = lambda p, v: P30.parameter(p, v, {}, None)
                        else:
                            serialize = lambda p, v: P31.serialize_parameter(p, v, {})
                        if 'expectedExpansion' in case:
                            observed = serialize(params[0], values[params[0]['name']])
                        else:
                            observed = [[unquote(k), unquote(v)] for p in params
                                        for k, v in serialize(p, values[p['name']])]
                    self.assertEqual(observed, case.get('expectedExpansion', case.get('expectedPairs')))

    def test_31_dialect_identity_and_root_resource_precedence(self):
        # OAS 3.1.2 §4.8.24.1 and §4.8.24.2.3; candidate §§1–3.
        base = 'https://spec.openapis.org/oas/3.1/dialect/base'
        dated = 'https://spec.openapis.org/oas/3.1/dialect/2024-11-10'
        foreign = 'https://example.test/unknown-dialect'
        for root, resource, supported in [(None, None, True), (base, None, True),
                (dated, None, True), (None, base, True), (None, dated, True),
                (foreign, None, False), (foreign, base, True), (base, foreign, False)]:
            with self.subTest(root=root, resource=resource):
                schema = {'type': 'string'}
                if resource is not None:
                    schema['$schema'] = resource
                doc = artifact('3.1.2', requestBody={'content': {'text/plain': {'schema': schema}}})
                if root is not None:
                    doc['jsonSchemaDialect'] = root
                before = copy.deepcopy(doc)
                interpreter = P31.Interpreter()
                if supported:
                    request = interpreter.prepare(obi(doc), 'http', {'body': 'hello'})
                    self.assertEqual(request['body'], b'hello')
                else:
                    with self.assertRaises(P31.Cannot) as caught:
                        interpreter.prepare(obi(doc), 'http', {'body': 'hello'})
                    self.assertEqual(caught.exception.category, 'capability')
                self.assertEqual(doc, before)
                # Uninspected JSON carriage remains usable with a foreign dialect.
                doc['paths']['/probe']['post']['requestBody']['content'] = {'application/json': {'schema': schema}}
                self.assertEqual(json.loads(P31.Interpreter().prepare(obi(doc), 'http', {'body': {'x': 1}})['body']), {'x': 1})

    def test_32_editions_and_dialect_context(self):
        # OAS 3.2.1 §§2.1, 4.1.1, 4.24.1 and 4.24.2.3; candidate §§1–3.
        default = 'https://spec.openapis.org/oas/3.2/dialect/2025-09-17'
        foreign = 'https://example.test/unknown-dialect'
        for version in ('3.2.0', '3.2.1'):
            for root, resource, supported in [(None, None, True), (default, None, True),
                    (None, default, True), (foreign, None, False),
                    (foreign, default, True), (default, foreign, False)]:
                with self.subTest(version=version, root=root, resource=resource):
                    schema = {'type': 'string'}
                    if resource is not None:
                        schema['$schema'] = resource
                    doc = artifact(version, requestBody={'content': {'text/plain': {'schema': schema}}})
                    if root is not None:
                        doc['jsonSchemaDialect'] = root
                    before = copy.deepcopy(doc)
                    source = P32.Source({'document': doc})
                    if supported:
                        req, _ = P32.request(source, {'target': target()}, {'body': 'hello'})
                        self.assertEqual(req['body'], b'hello')
                    else:
                        with self.assertRaises(P32.Unsupported):
                            P32.request(source, {'target': target()}, {'body': 'hello'})
                    self.assertEqual(doc, before)
                    doc['paths']['/probe']['post']['requestBody']['content'] = {'application/json': {'schema': schema}}
                    req, _ = P32.request(P32.Source({'document': doc}), {'target': target()}, {'body': {'x': 1}})
                    self.assertEqual(json.loads(req['body']), {'x': 1})
        with self.assertRaises(P32.Invalid):
            P32.Source({'document': artifact('3.2.2')})

    def test_32_query_preserves_method_and_body(self):
        # RFC 10008 §2 / OAS 3.2.1 Path Item.query; candidate §§1,3–4.
        doc = artifact(method='query', requestBody={'content': {'application/json': {}}})
        req, _ = P32.request(P32.Source({'document': doc}), {'target': target(method='query')}, {'body': {'search': 'x'}})
        self.assertEqual(req['method'], 'QUERY')
        self.assertEqual(json.loads(req['body']), {'search': 'x'})
        self.assertEqual(req['headers']['Content-Type'], 'application/json')

    def test_32_cookie_false_explode_rejects_declaration_even_when_omitted(self):
        # OAS 3.2.1 §4.12.2.2 explicitly prohibits the setting, independent of value.
        for style in ('form', 'cookie'):
            for typ in ('string', 'array', 'object'):
                with self.subTest(style=style, type=typ):
                    p = {'name': 'session', 'in': 'cookie', 'style': style,
                         'explode': False, 'schema': {'type': typ}}
                    with self.assertRaises(P32.Invalid):
                        request32([p], {})
        self.assertEqual(urlsplit(request32([{'name': 'session', 'in': 'cookie', 'style': 'cookie', 'explode': True}], {})['url']).path, '/probe')


if __name__ == '__main__':
    unittest.main(verbosity=2)
