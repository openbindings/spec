# Versioning and topology ruling

## Decision

The publication unit is one binding specification, `openbindings.grpc@1`, over a
closed set of Protobuf syntaxes and Editions. Do not publish proto2-, proto3-,
or Edition-named gRPC siblings.

## Why this is consistent with the OpenAPI and AsyncAPI families

OpenAPI artifacts carry one artifact-wide edition marker whose edition changes
the structure and meaning of the entire document. Their binding specifications
therefore divide by upstream line. This proof does not rely on the in-flight,
unsealed AsyncAPI work.

A Protobuf `FileDescriptorSet` is a repeated set of file descriptors. Each
file independently carries `syntax` or `edition`, and one method's transitive
type closure may legally cross files using different syntaxes or Editions.
The method's request/response types and `client_streaming` / `server_streaming`
flags remain one descriptor-defined target. Splitting the binding identifier
by syntax would make a single ordinary service closure require several
simultaneous binding authorities and would not correspond to an artifact-wide
version boundary.

The one-ID decision is therefore unique to Protobuf's per-file mixed-edition
descriptor model, not an inconsistency in project naming.

## Frozen accepted domain

Revision 1 enumerates exact accepted upstream inputs. The closed syntax domain
is proto2, proto3, Edition 2023, Edition 2024, and Edition 2026 under Protobuf
36.1, the current stable upstream release when this work began, with additional
construct-level exclusions stated normatively.

Adding, removing, or replacing an Edition, source carriage, transport protocol,
compression coding, reflection protocol, shared-module revision, authority
pin, or previously excluded construct after publication changes the accepted
domain or its required/permitted/refused behavior and requires another opaque
binding identifier under OBI-B-03. So does any other observable semantic
change. Errata and clarifications retain the identifier only when they preserve
the accepted domain and every observable meaning exactly.

## Related specifications

- gRPC-Web is a separate binding because its transport/framing/capability
  model differs.
- Connect is a separate binding because its wire protocol and outcome rules
  differ, even when it uses the same Protobuf service schema.
- JSON-RPC is a separate binding; an abstract "RPC" binding would erase the
  target, framing, lifecycle, and classification facts OBI-B-02 requires.
- The shared Protobuf correspondence module is normative reusable content but
  not a legal `sources[*].bindingSpec` value.
