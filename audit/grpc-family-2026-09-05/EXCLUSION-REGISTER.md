# gRPC exclusion register

This register is informative; the binding document states each exclusion
normatively. A revisit trigger never promises a particular future revision.

| subject | disposition | rationale | reopen condition |
| --- | --- | --- | --- |
| gRPC-Web | outside this binding | different transport/framing surface | a dedicated gRPC-Web binding effort |
| Connect | outside this binding | different protocol and outcomes | governed by the Connect binding |
| JSON transcoding | excluded | not native gRPC invocation | demonstrated demand plus exact transcoding authority |
| xDS/service config/load balancing | excluded | deployment and policy system, not carried method identity | a project decision to admit a closed resolver/policy authority |
| resolver-specific target URI schemes | excluded | no closed portable resolution result | exact authority and demonstrated consumer need |
| DNS trailing dots, zone identifiers, IPvFuture, percent-encoded hosts, non-DNS reg-names | excluded | target, certificate-reference, SNI, and authority identities would otherwise diverge | exact semantics across those identities and demonstrated need |
| transparent retries and hedging | excluded | one invocation denotes one RPC; replay changes side effects | artifact-authorized semantics with portable safety evidence |
| arbitrary compression codings | excluded | coding registry/capability behavior is otherwise open | exact coding authority and cross-language implementation |
| custom option-driven application semantics | excluded | no generic portable interpretation | an incorporated option authority and complete correspondence |
| proto2 required / legacy-required | excluded | default-instance and partial-message behavior is not one portable operation-value correspondence | complete faithful correspondence and ecosystem need |
| groups / delimited message encoding / MessageSet | excluded | legacy wire forms complicate one closed JSON/binary bridge | complete authority/evidence and demonstrated need |
| user extensions in caller messages | excluded at the smallest extendee message closure | ProtoJSON and schema projection require a registry-specific surface | exact closed extension registry, faithful bidirectional value/schema projection, executable cross-language evidence, and demonstrated need |
| cross-field portable JSON-name collisions | excluded at the smallest ambiguous message closure | one admitted canonical-effective or original field spelling can otherwise denote two descriptor fields | updated exact authority, demonstrated need, and executable bidirectional value/schema evidence under a new module identifier |
| redundant upstream ProtoJSON caller spellings | excluded at the value-representation boundary; no type, semantic value, method, or cardinality is removed | default-lower-camel aliases of explicitly renamed fields, noncanonical numeric/Base64/map-key forms, and quoted numeric fallbacks lack one portable lossless cross-language contract while every semantic value retains a canonical form; well-known-type runtime input instead follows the exact module-pinned runtime domain, with a canonical schema subset | demonstrated consumer need plus an executable cross-language lossless contract under a new module identifier |
| Protobuf Editions after 2026 | excluded by the frozen accepted set | their feature defaults were not reviewed | exact upstream Edition adoption and demonstrated consumer need; OBI-B-03 then requires a new identifier |
| unresolved `Any` payload types | excluded per value | faithful ProtoJSON requires the embedded type descriptor | descriptor becomes available in the closed pool |
| ordinary-message `Any` alternatives colliding with reserved `@type` | excluded only from that closed `Any` union | the flattened ProtoJSON envelope cannot carry both meanings faithfully | updated exact envelope authority, demonstrated need, and executable collision-free bidirectional evidence under a new module identifier |
| raw protocol metadata as operation values | excluded | violates abstraction fidelity | never reopened under this identifier absent a new application contract |
| native status/details as successful outputs | excluded | method descriptor declares no such application result | explicit artifact-level result declaration authority |
