module github.com/openbindings/spec/conformance/runners/go

go 1.25.12

toolchain go1.25.13

require (
	github.com/openbindings/openbindings-go v0.2.0
	github.com/openbindings/openbindings-go/schemaeval v0.0.0
)

require (
	github.com/dlclark/regexp2/v2 v2.7.1 // indirect
	github.com/santhosh-tekuri/jsonschema/v6 v6.0.3 // indirect
	golang.org/x/text v0.39.0 // indirect
)

// The runner builds against the SDK checked out beside the spec repository
// (spec CI checks it out at the pinned commit).
replace (
	github.com/openbindings/openbindings-go => ../../../../openbindings-go
	github.com/openbindings/openbindings-go/schemaeval => ../../../../openbindings-go/schemaeval
)
