package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
)

type action struct {
	Type string `json:"type"`
}
type timelineEvent struct {
	Event       string `json:"event"`
	Action      *int   `json:"action"`
	Index       *int   `json:"index"`
	Disposition string `json:"disposition"`
	Cause       string `json:"cause"`
}
type peerEvent struct {
	ID    string `json:"id"`
	After struct {
		Action *int `json:"action"`
	} `json:"after"`
	Type       string `json:"type"`
	DataBase64 string `json:"dataBase64"`
	EndStream  bool   `json:"endStream"`
	Headers    []struct {
		Name   string   `json:"name"`
		Values []string `json:"values"`
	} `json:"headers"`
}
type nativeMessage struct {
	CompressedFlag              int    `json:"compressedFlag"`
	DecodedLength               int    `json:"decodedLength"`
	DecodedPayloadBase64        string `json:"decodedPayloadBase64"`
	FrameBase64                 string `json:"frameBase64"`
	LengthMatchesEncodedPayload bool   `json:"lengthMatchesEncodedPayload"`
	GzipMemberValid             *bool  `json:"gzipMemberValid"`
}
type observedMetadata struct {
	Name  string `json:"name"`
	Value any    `json:"value"`
}

type alternative struct {
	Disposition string          `json:"disposition"`
	Timeline    []timelineEvent `json:"timeline"`
	Native      struct {
		RequestMessages  []nativeMessage    `json:"requestMessages"`
		LeadingMetadata  []observedMetadata `json:"leadingMetadata"`
		TrailingMetadata []observedMetadata `json:"trailingMetadata"`
	} `json:"native"`
}
type scenario struct {
	ID    string `json:"id"`
	Given struct {
		Invocation struct {
			Actions []action `json:"actions"`
		} `json:"invocation"`
		Peer struct {
			Events []peerEvent `json:"events"`
		} `json:"peer"`
	} `json:"given"`
	Expected []alternative `json:"expected"`
}
type corpus struct {
	Format    string     `json:"format"`
	Scenarios []scenario `json:"scenarios"`
}
type summary struct {
	Format              string `json:"format"`
	CorpusSHA256        string `json:"corpusSha256"`
	ScenarioCount       int    `json:"scenarioCount"`
	ActionCount         int    `json:"actionCount"`
	PeerDataBytes       int    `json:"peerDataBytes"`
	SemanticOutputCount int    `json:"semanticOutputCount"`
	TerminalCount       int    `json:"terminalCount"`
}

func fail(format string, args ...any) { fmt.Fprintf(os.Stderr, format+"\n", args...); os.Exit(1) }
func canonicalBase64(value string) []byte {
	b, err := base64.StdEncoding.DecodeString(value)
	if err != nil || base64.StdEncoding.EncodeToString(b) != value {
		fail("noncanonical Base64 %q", value)
	}
	return b
}
func legalResponseHeaderBlock(headers []struct {
	Name   string   `json:"name"`
	Values []string `json:"values"`
}, trailers bool) bool {
	regularSeen := false
	namePattern := regexp.MustCompile(`^(?::[a-z]+|[0-9a-z_.-]+)$`)
	for _, header := range headers {
		if !namePattern.MatchString(header.Name) || len(header.Values) == 0 {
			return false
		}
		if strings.HasPrefix(header.Name, ":") {
			if trailers || header.Name != ":status" || regularSeen {
				return false
			}
		} else {
			regularSeen = true
		}
		if trailers {
			if strings.HasPrefix(header.Name, "grpc-") && header.Name != "grpc-status" && header.Name != "grpc-message" && header.Name != "grpc-status-details-bin" {
				return false
			}
			if header.Name == "content-type" || header.Name == "te" {
				return false
			}
		} else {
			allowed := header.Name == "grpc-encoding" || header.Name == "grpc-accept-encoding" || header.Name == "grpc-status" || header.Name == "grpc-message" || header.Name == "grpc-status-details-bin"
			if strings.HasPrefix(header.Name, "grpc-") && !allowed {
				return false
			}
			if header.Name == "te" {
				return false
			}
		}
	}
	_, err := inboundMetadata(headers, trailers)
	return err == nil
}
func metadataBase64(value string) ([]byte, error) {
	if strings.ContainsAny(value, "-_") {
		return nil, fmt.Errorf("nonstandard Base64")
	}
	encoding := base64.RawStdEncoding
	if len(value)%4 == 0 {
		encoding = base64.StdEncoding
	}
	data, err := encoding.DecodeString(value)
	if err != nil || encoding.EncodeToString(data) != value {
		return nil, fmt.Errorf("noncanonical Base64")
	}
	return data, nil
}
func inboundMetadata(headers []struct {
	Name   string   `json:"name"`
	Values []string `json:"values"`
}, trailers bool) ([]observedMetadata, error) {
	owned := map[string]bool{":status": true, "content-type": true, "te": true, "grpc-status": true, "grpc-message": true, "grpc-status-details-bin": true}
	if !trailers {
		owned["grpc-encoding"] = true
		owned["grpc-accept-encoding"] = true
	}
	grouped := map[string][]string{}
	for _, header := range headers {
		if strings.HasPrefix(header.Name, ":") || owned[header.Name] {
			continue
		}
		if strings.HasPrefix(header.Name, "grpc-") {
			return nil, fmt.Errorf("reserved response metadata")
		}
		grouped[header.Name] = append(grouped[header.Name], header.Values...)
	}
	names := make([]string, 0, len(grouped))
	for name := range grouped {
		names = append(names, name)
	}
	sort.Strings(names)
	out := make([]observedMetadata, 0, len(names))
	for _, name := range names {
		if strings.HasSuffix(name, "-bin") {
			parts := strings.Split(strings.Join(grouped[name], ","), ",")
			values := make([]string, 0, len(parts))
			for _, part := range parts {
				data, err := metadataBase64(part)
				if err != nil {
					return nil, err
				}
				values = append(values, base64.StdEncoding.EncodeToString(data))
			}
			out = append(out, observedMetadata{Name: name, Value: values})
			continue
		}
		for _, text := range grouped[name] {
			if text == "" {
				return nil, fmt.Errorf("empty response metadata")
			}
			for _, value := range []byte(text) {
				if value < 0x20 || value > 0x7e {
					return nil, fmt.Errorf("non-printable response metadata")
				}
			}
		}
		out = append(out, observedMetadata{Name: name, Value: strings.Join(grouped[name], ",")})
	}
	return out, nil
}
func main() {
	if len(os.Args) != 2 {
		fail("usage: go run runner.go protojson_strict.go <processor-grpc.json>")
	}
	raw, err := os.ReadFile(os.Args[1])
	if err != nil {
		fail("read: %v", err)
	}
	if _, err := parseStrictLosslessJSON(raw); err != nil {
		fail("json: %v", err)
	}
	var c corpus
	if err := json.Unmarshal(raw, &c); err != nil {
		fail("json: %v", err)
	}
	if c.Format != "openbindings.binding-spec-processor-scenarios@7" {
		fail("wrong format")
	}
	ids := map[string]bool{}
	actionsTotal, dataTotal, outputsTotal, terminalsTotal := 0, 0, 0, 0
	for _, sc := range c.Scenarios {
		if ids[sc.ID] {
			fail("duplicate scenario %s", sc.ID)
		}
		ids[sc.ID] = true
		actions := sc.Given.Invocation.Actions
		actionsTotal += len(actions)
		peerIDs := map[string]bool{}
		wire := []byte{}
		peerEnded := false
		responseStarted := false
		protocolExpected := true
		for _, alt := range sc.Expected {
			if alt.Disposition != "error" || len(alt.Timeline) == 0 || alt.Timeline[len(alt.Timeline)-1].Cause != "protocol" {
				protocolExpected = false
			}
		}
		for _, event := range sc.Given.Peer.Events {
			if peerEnded {
				fail("%s: peer effect after end of stream", sc.ID)
			}
			if peerIDs[event.ID] {
				fail("%s: duplicate peer id", sc.ID)
			}
			peerIDs[event.ID] = true
			if event.After.Action != nil && *event.After.Action >= len(actions) {
				fail("%s: peer trigger out of range", sc.ID)
			}
			if event.Type == "response-headers" {
				if !legalResponseHeaderBlock(event.Headers, false) && !protocolExpected {
					fail("%s: illegal initial response header block", sc.ID)
				}
				if responseStarted && !protocolExpected {
					fail("%s: duplicate initial response headers", sc.ID)
				}
				responseStarted = true
			}
			if event.Type == "trailers" && !legalResponseHeaderBlock(event.Headers, true) && !protocolExpected {
				fail("%s: illegal trailer block", sc.ID)
			}
			if (event.Type == "data" || event.Type == "trailers") && !responseStarted && !protocolExpected {
				fail("%s: response event precedes initial response headers", sc.ID)
			}
			if event.Type == "data" {
				chunk := canonicalBase64(event.DataBase64)
				dataTotal += len(chunk)
				wire = append(wire, chunk...)
				for len(wire) >= 5 {
					if wire[0] != 0 && wire[0] != 1 {
						fail("%s: invalid compressed flag", sc.ID)
					}
					length := int(binary.BigEndian.Uint32(wire[1:5]))
					if len(wire) < 5+length {
						break
					}
					wire = wire[5+length:]
				}
				if event.EndStream {
					peerEnded = true
				}
			}
			if event.Type == "trailers" || (event.Type == "response-headers" && event.EndStream) {
				peerEnded = true
			}
		}
		for _, alt := range sc.Expected {
			terminals := []timelineEvent{}
			outputs := []timelineEvent{}
			results := map[int]bool{}
			for _, event := range alt.Timeline {
				if event.Event == "terminal" {
					terminals = append(terminals, event)
				}
				if event.Event == "output" {
					outputs = append(outputs, event)
				}
				if (event.Event == "input-accepted" || event.Event == "input-rejected" || event.Event == "input-half-closed" || event.Event == "cancelled" || event.Event == "action-failed") && event.Action != nil {
					if results[*event.Action] {
						fail("%s: duplicate action result", sc.ID)
					}
					results[*event.Action] = true
				}
			}
			if len(terminals) != 1 || terminals[0].Disposition != alt.Disposition {
				fail("%s: terminal mismatch", sc.ID)
			}
			terminalsTotal++
			outputsTotal += len(outputs)
			sends := []timelineEvent{}
			for _, event := range alt.Timeline {
				if event.Event == "request-message" {
					sends = append(sends, event)
				}
			}
			if len(sends) != len(alt.Native.RequestMessages) {
				fail("%s: native request message count differs from timeline sends", sc.ID)
			}
			leading, trailing := []observedMetadata{}, []observedMetadata{}
			metadataValid := true
			for _, event := range sc.Given.Peer.Events {
				if event.Type != "response-headers" && event.Type != "trailers" {
					continue
				}
				trailers := event.Type == "trailers"
				if event.Type == "response-headers" {
					for _, header := range event.Headers {
						if header.Name == "grpc-status" {
							trailers = true
						}
					}
				}
				observed, err := inboundMetadata(event.Headers, trailers)
				if err != nil {
					metadataValid = false
					break
				}
				if trailers {
					trailing = append(trailing, observed...)
				} else {
					leading = append(leading, observed...)
				}
			}
			if !metadataValid && !protocolExpected {
				fail("%s: invalid response metadata", sc.ID)
			}
			if metadataValid && (!protocolExpected || len(alt.Native.LeadingMetadata) > 0 || len(alt.Native.TrailingMetadata) > 0) {
				if len(alt.Native.LeadingMetadata) != len(leading) {
					fail("%s: leading metadata evidence mismatch", sc.ID)
				}
				if len(leading) > 0 {
					left, _ := json.Marshal(alt.Native.LeadingMetadata)
					right, _ := json.Marshal(leading)
					if !bytes.Equal(left, right) {
						fail("%s: leading metadata evidence mismatch", sc.ID)
					}
				}
				if len(alt.Native.TrailingMetadata) != len(trailing) {
					fail("%s: trailing metadata evidence mismatch", sc.ID)
				}
				if len(trailing) > 0 {
					left, _ := json.Marshal(alt.Native.TrailingMetadata)
					right, _ := json.Marshal(trailing)
					if !bytes.Equal(left, right) {
						fail("%s: trailing metadata evidence mismatch", sc.ID)
					}
				}
			}
			for index, event := range sends {
				if event.Index == nil || *event.Index != index {
					fail("%s: native request messages are not exactly bound to ordered timeline sends", sc.ID)
				}
			}
			for index, event := range outputs {
				if event.Index == nil || *event.Index != index {
					fail("%s: output order", sc.ID)
				}
			}
			for index, act := range actions {
				if act.Type != "advance-clock" && act.Type != "await-output" && act.Type != "await-native" && !results[index] {
					fail("%s: missing action result %d", sc.ID, index)
				}
			}
			for _, message := range alt.Native.RequestMessages {
				var decoded []byte
				if message.DecodedPayloadBase64 != "" {
					decoded = canonicalBase64(message.DecodedPayloadBase64)
				}
				if decoded != nil && len(decoded) != message.DecodedLength {
					fail("%s: decoded request length mismatch", sc.ID)
				}
				if !message.LengthMatchesEncodedPayload {
					fail("%s: encoded request length is unproved", sc.ID)
				}
				if message.CompressedFlag == 1 && (message.GzipMemberValid == nil || !*message.GzipMemberValid) {
					fail("%s: compressed request gzip member is unproved", sc.ID)
				}
				if message.CompressedFlag == 0 && message.GzipMemberValid != nil {
					fail("%s: identity request claims gzip evidence", sc.ID)
				}
				if message.FrameBase64 != "" {
					frame := canonicalBase64(message.FrameBase64)
					if len(frame) < 5 || int(frame[0]) != message.CompressedFlag || int(binary.BigEndian.Uint32(frame[1:5])) != len(frame)-5 {
						fail("%s: request frame does not prove its flag and encoded length", sc.ID)
					}
					if message.CompressedFlag == 0 && decoded != nil && !bytes.Equal(frame[5:], decoded) {
						fail("%s: identity request frame differs from decoded payload", sc.ID)
					}
				}
			}
			if peerEnded && len(wire) != 0 && !(terminals[0].Cause == "protocol" && alt.Disposition == "error") {
				fail("%s: truncated frame not protocol failure", sc.ID)
			}
		}
	}
	digest := sha256.Sum256(raw)
	result := summary{"openbindings.grpc-runner-result@1", hex.EncodeToString(digest[:]), len(c.Scenarios), actionsTotal, dataTotal, outputsTotal, terminalsTotal}
	out, _ := json.Marshal(result)
	fmt.Println(string(out))
}
