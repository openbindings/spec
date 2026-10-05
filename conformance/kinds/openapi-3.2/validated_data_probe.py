"""One optional validated-data route for text/plain; not a schema engine."""
from probe import Unsupported, Unroutable, encode

def encode_checked_text(declaration,value,validator=None,claimed_type=None):
    """Use a separately supplied validation capability before deriving a type.

    The callback must evaluate the entire governing schema for the provided value.
    The test supplies an independent exact predicate for one finite schema domain.
    A bare success flag or unverified caller-provided type is never sufficient.
    """
    if validator is None:
        # Ordinary carriage still applies its static inspection. An ambiguous
        # union remains unsupported despite the apparent Python value type.
        return encode('text/plain',declaration,value)
    if validator(declaration['schema'],value) is not True:
        raise Unroutable('independent schema validation failed')
    if type(value) is str:needed='string'
    elif type(value) in (int,float):needed='number'
    else:raise Unsupported('checked-data fixture supports string or number only')
    if claimed_type is not None and claimed_type!=needed:
        raise Unroutable('claimed type disagrees with independently validated data')
    # Validation supplies only the needed type determination. Media serialization
    # is still the ordinary scalar bridge rule; no application coercion occurs.
    return encode('text/plain',{'schema':{'type':needed}},value)
