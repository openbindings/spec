"""RFC 7303 character encoding subset, with no XML parsing/entity expansion."""
import codecs
import re
from probe import Unsupported,Unroutable

SUPPORTED={'utf-8','utf-16','utf-16-le','utf-16-be','iso8859-1','ascii'}

def codec(name):
    try:canonical=codecs.lookup(name).name
    except LookupError as e:raise Unsupported('unavailable XML codec') from e
    if canonical not in SUPPORTED:raise Unsupported('XML codec outside declared probe capabilities')
    return canonical

def declaration(text):
    match=re.match(r'''^<\?xml\s+[^?]*?\bencoding\s*=\s*(['"])([^'"]+)\1''',text)
    return match.group(2) if match else None

def decode_characters(data,charset=None):
    # Test the longer BOM first. UTF-32 is recognized but not a probe capability.
    for signature,encoding in [(codecs.BOM_UTF32_BE,'utf-32-be'),(codecs.BOM_UTF32_LE,'utf-32-le'),
        (codecs.BOM_UTF8,'utf-8'),(codecs.BOM_UTF16_BE,'utf-16-be'),(codecs.BOM_UTF16_LE,'utf-16-le')]:
        if data.startswith(signature):return data[len(signature):].decode(codec(encoding))
    if charset:return data.decode(codec(charset))
    # The ASCII-compatible declaration subset and UTF-16 signatures suffice for
    # our fixtures; no EBCDIC/UTF-32 autodetection or XML well-formedness claim.
    sniff='utf-16-be' if data.startswith(b'\x00<\x00?') else 'utf-16-le' if data.startswith(b'<\x00?\x00') else 'latin-1'
    prefix=data[:512].decode(sniff)
    encoding=declaration(prefix) or 'utf-8'
    return data.decode(codec(encoding))

def encode_characters(text,charset=None):
    encoding=codec(charset or declaration(text) or 'utf-8')
    try:return text.encode(encoding)
    except UnicodeError as e:raise Unroutable('supplied characters not representable by required XML codec') from e
