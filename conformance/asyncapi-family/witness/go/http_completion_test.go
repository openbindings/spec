package main

import (
	"bufio"
	"errors"
	"io"
	"net"
	"strings"
	"testing"
)

// RFC 9110 grammar literals, fixed before changing the parser. No primary
// evaluator is used as the expected-value generator.
func TestMediaTypeCompatibility(t *testing.T) {
	for _, tc := range []struct {
		value string
		valid bool
	}{
		{"text/plain", true}, {"application/vnd.example+json", true},
		{"text/plain; charset=utf-8", true}, {"text/plain \t;\t charset=utf-8", true},
		{`text/plain; a="x;y=z"`, true}, {`text/plain; a="x\"y"`, true},
		{`text/plain; a=""`, true}, {"text/plain; ;\t;", true},
		{"text/plain; charset=a; charset=b", true},
		{"text/plain; charset =utf-8", false}, {"text/plain; charset= utf-8", false},
		{"text/plain; charset\t=utf-8", false}, {"text/plain; charset=", false},
		{"text/plain; =utf-8", false}, {"text/plain; charset", false},
		{`text/plain; a="unterminated`, false}, {`text/plain; a="x\`, false},
		{"text/plain; a=\"x\x01y\"", false}, {"text/plain; a=\"x\x7fy\"", false},
		{"text /plain", false}, {"text/plain; a=x,y", false},
		{"text/plain; a=\"\xff\"", false},
	} {
		t.Run(tc.value, func(t *testing.T) {
			raw := "HTTP/1.1 204 No Content\r\nContent-Type: " + tc.value + "\r\n\r\n"
			resp, bytes, err := readHead(bufio.NewReader(strings.NewReader(raw)))
			valid := false
			if err == nil {
				_, valid = headValid(resp, bytes)
			}
			if valid != tc.valid {
				t.Fatalf("G05.media-grammar %q: got %t, want %t", tc.value, valid, tc.valid)
			}
		})
	}
}

func TestNumericApparatusLimit(t *testing.T) {
	_, _, err := readHead(bufio.NewReader(strings.NewReader("HTTP/1.1 304 Not Modified\r\nContent-Length: 9223372036854775808\r\n\r\n")))
	var limit witnessLimit
	if !errors.As(err, &limit) {
		t.Fatalf("numeric capacity is not a grammar failure: %v", err)
	}
}

func TestCompletionBeforePeerEOF(t *testing.T) {
	for _, tc := range []struct{ name, response, disposition string }{
		{"204", "HTTP/1.1 204 No Content\r\n\r\n", "complete"},
		{"200-zero", "HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n", "complete"},
		{"205-zero", "HTTP/1.1 205 Reset Content\r\nContent-Length: 0\r\n\r\n", "complete"},
		{"304-metadata", "HTTP/1.1 304 Not Modified\r\nContent-Length: 42\r\n\r\n", "error"},
		{"400-content", "HTTP/1.1 400 Bad Request\r\nContent-Length: 1\r\n\r\nx", "error"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			listener, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			defer listener.Close()
			release := make(chan struct{})
			defer close(release)
			peerError := make(chan error, 1)
			go func() {
				conn, err := listener.Accept()
				if err != nil {
					peerError <- err
					return
				}
				defer conn.Close()
				r := bufio.NewReader(conn)
				for {
					line, err := r.ReadString('\n')
					if err != nil {
						peerError <- err
						return
					}
					if line == "\r\n" {
						break
					}
				}
				_, err = io.WriteString(conn, tc.response)
				peerError <- err
				<-release // EOF cannot precede the actual invocation result.
			}()
			r := run(object{"given": baseGiven(t), "peerAddress": listener.Addr().String()})
			if err := <-peerError; err != nil {
				t.Fatal(err)
			}
			if r.Disposition != tc.disposition || r.Phase != "completion" || len(r.Outputs) != 0 {
				t.Fatalf("G04.framed-terminal-before-EOF: %#v", r)
			}
		})
	}
}
