package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	_ "google.golang.org/grpc/encoding/gzip"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/wrapperspb"
)

type stackContract interface{ openBindingsStack() }
type stackServer struct{}

func (*stackServer) openBindingsStack() {}

func unaryHandler(srv any, ctx context.Context, decode func(any) error, interceptor grpc.UnaryServerInterceptor) (any, error) {
	in := new(emptypb.Empty)
	if err := decode(in); err != nil {
		return nil, err
	}
	call := func(ctx context.Context, _ any) (any, error) {
		values := metadata.ValueFromIncomingContext(ctx, "x-openbindings")
		if len(values) != 1 || values[0] != "stack" {
			return nil, status.Error(codes.InvalidArgument, "metadata")
		}
		if compressed := metadata.ValueFromIncomingContext(ctx, "x-compress"); len(compressed) == 1 && compressed[0] == "gzip" {
			if err := grpc.SetSendCompressor(ctx, "gzip"); err != nil {
				return nil, err
			}
		}
		return wrapperspb.String("unary"), nil
	}
	if interceptor == nil {
		return call(ctx, in)
	}
	return interceptor(ctx, in, &grpc.UnaryServerInfo{Server: srv, FullMethod: "/openbindings.test.Stack/Unary"}, call)
}

func serverHandler(_ any, stream grpc.ServerStream) error {
	if err := stream.RecvMsg(new(emptypb.Empty)); err != nil {
		return err
	}
	for _, value := range []string{"server-0", "server-1"} {
		if err := stream.SendMsg(wrapperspb.String(value)); err != nil {
			return err
		}
	}
	return nil
}

func clientHandler(_ any, stream grpc.ServerStream) error {
	var values []string
	for {
		message := new(wrapperspb.StringValue)
		err := stream.RecvMsg(message)
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		values = append(values, message.Value)
	}
	return stream.SendMsg(wrapperspb.String(strings.Join(values, "+")))
}

func bidiHandler(_ any, stream grpc.ServerStream) error {
	for {
		message := new(wrapperspb.StringValue)
		err := stream.RecvMsg(message)
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		if err := stream.SendMsg(wrapperspb.String("echo:" + message.Value)); err != nil {
			return err
		}
	}
}

var stackDescription = grpc.ServiceDesc{
	ServiceName: "openbindings.test.Stack",
	HandlerType: (*stackContract)(nil),
	Methods:     []grpc.MethodDesc{{MethodName: "Unary", Handler: unaryHandler}},
	Streams: []grpc.StreamDesc{
		{StreamName: "Server", Handler: serverHandler, ServerStreams: true},
		{StreamName: "Client", Handler: clientHandler, ClientStreams: true},
		{StreamName: "Bidi", Handler: bidiHandler, ServerStreams: true, ClientStreams: true},
	},
}

func stackFail(format string, values ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", values...)
	os.Exit(1)
}

func main() {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		stackFail("listen: %v", err)
	}
	server := grpc.NewServer()
	server.RegisterService(&stackDescription, &stackServer{})
	go server.Serve(listener)
	defer server.Stop()

	connection, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		stackFail("client: %v", err)
	}
	defer connection.Close()
	ctx, cancel := context.WithTimeout(metadata.NewOutgoingContext(context.Background(), metadata.Pairs("x-openbindings", "stack")), 5*time.Second)
	defer cancel()

	unary := new(wrapperspb.StringValue)
	if err := connection.Invoke(ctx, "/openbindings.test.Stack/Unary", new(emptypb.Empty), unary); err != nil || unary.Value != "unary" {
		stackFail("unary: %v %q", err, unary.Value)
	}
	gzipCtx := metadata.AppendToOutgoingContext(ctx, "x-compress", "gzip")
	gzipUnary := new(wrapperspb.StringValue)
	if err := connection.Invoke(gzipCtx, "/openbindings.test.Stack/Unary", new(emptypb.Empty), gzipUnary, grpc.UseCompressor("gzip")); err != nil || gzipUnary.Value != "unary" {
		stackFail("gzip unary: %v %q", err, gzipUnary.Value)
	}

	serverStream, err := connection.NewStream(ctx, &grpc.StreamDesc{ServerStreams: true}, "/openbindings.test.Stack/Server")
	if err != nil {
		stackFail("server stream: %v", err)
	}
	if err := serverStream.SendMsg(new(emptypb.Empty)); err != nil {
		stackFail("server send: %v", err)
	}
	if err := serverStream.CloseSend(); err != nil {
		stackFail("server close: %v", err)
	}
	var serverValues []string
	for {
		message := new(wrapperspb.StringValue)
		err := serverStream.RecvMsg(message)
		if err == io.EOF {
			break
		}
		if err != nil {
			stackFail("server receive: %v", err)
		}
		serverValues = append(serverValues, message.Value)
	}
	if strings.Join(serverValues, ",") != "server-0,server-1" {
		stackFail("server values: %v", serverValues)
	}

	clientStream, err := connection.NewStream(ctx, &grpc.StreamDesc{ClientStreams: true}, "/openbindings.test.Stack/Client")
	if err != nil {
		stackFail("client stream: %v", err)
	}
	for _, value := range []string{"a", "b"} {
		if err := clientStream.SendMsg(wrapperspb.String(value)); err != nil {
			stackFail("client send: %v", err)
		}
	}
	if err := clientStream.CloseSend(); err != nil {
		stackFail("client close: %v", err)
	}
	clientReply := new(wrapperspb.StringValue)
	if err := clientStream.RecvMsg(clientReply); err != nil || clientReply.Value != "a+b" {
		stackFail("client reply: %v %q", err, clientReply.Value)
	}
	if err := clientStream.RecvMsg(new(wrapperspb.StringValue)); err != io.EOF {
		stackFail("client terminal: %v", err)
	}

	bidi, err := connection.NewStream(ctx, &grpc.StreamDesc{ServerStreams: true, ClientStreams: true}, "/openbindings.test.Stack/Bidi")
	if err != nil {
		stackFail("bidi stream: %v", err)
	}
	for _, value := range []string{"x", "y"} {
		if err := bidi.SendMsg(wrapperspb.String(value)); err != nil {
			stackFail("bidi send: %v", err)
		}
		reply := new(wrapperspb.StringValue)
		if err := bidi.RecvMsg(reply); err != nil || reply.Value != "echo:"+value {
			stackFail("bidi receive: %v %q", err, reply.Value)
		}
	}
	if err := bidi.CloseSend(); err != nil {
		stackFail("bidi close: %v", err)
	}
	if err := bidi.RecvMsg(new(wrapperspb.StringValue)); err != io.EOF {
		stackFail("bidi terminal: %v", err)
	}

	missing := connection.Invoke(ctx, "/openbindings.test.Stack/Missing", new(emptypb.Empty), new(emptypb.Empty))
	if status.Code(missing) != codes.Unimplemented {
		stackFail("missing status: %v", missing)
	}

	fixtureRoot := filepath.Join("..", "..", "grpc-fixtures", "tls")
	readFixture := func(name string) []byte {
		value, err := os.ReadFile(filepath.Join(fixtureRoot, name))
		if err != nil {
			stackFail("TLS fixture %s: %v", name, err)
		}
		return value
	}
	caBytes := readFixture("ca.pem")
	serverCertificate, err := tls.X509KeyPair(readFixture("server.pem"), readFixture("server-key.pem"))
	if err != nil {
		stackFail("server identity: %v", err)
	}
	clientCertificate, err := tls.X509KeyPair(readFixture("client.pem"), readFixture("client-key.pem"))
	if err != nil {
		stackFail("client identity: %v", err)
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(caBytes) {
		stackFail("test CA")
	}
	tlsListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		stackFail("TLS listen: %v", err)
	}
	tlsServer := grpc.NewServer(grpc.Creds(credentials.NewTLS(&tls.Config{Certificates: []tls.Certificate{serverCertificate}, ClientAuth: tls.RequireAndVerifyClientCert, ClientCAs: pool, MinVersion: tls.VersionTLS13, MaxVersion: tls.VersionTLS13, NextProtos: []string{"h2"}})))
	tlsServer.RegisterService(&stackDescription, &stackServer{})
	go tlsServer.Serve(tlsListener)
	defer tlsServer.Stop()
	secureCredentials := credentials.NewTLS(&tls.Config{RootCAs: pool, ServerName: "api.example.com", Certificates: []tls.Certificate{clientCertificate}, MinVersion: tls.VersionTLS13, MaxVersion: tls.VersionTLS13, NextProtos: []string{"h2"}})
	secureConnection, err := grpc.NewClient(tlsListener.Addr().String(), grpc.WithTransportCredentials(secureCredentials))
	if err != nil {
		stackFail("TLS client: %v", err)
	}
	defer secureConnection.Close()
	secureReply := new(wrapperspb.StringValue)
	if err := secureConnection.Invoke(ctx, "/openbindings.test.Stack/Unary", new(emptypb.Empty), secureReply); err != nil || secureReply.Value != "unary" {
		stackFail("TLS unary: %v %q", err, secureReply.Value)
	}
	for label, config := range map[string]*tls.Config{
		"wrong-name":     {RootCAs: pool, ServerName: "wrong.example.com", Certificates: []tls.Certificate{clientCertificate}, MinVersion: tls.VersionTLS13, MaxVersion: tls.VersionTLS13, NextProtos: []string{"h2"}},
		"missing-client": {RootCAs: pool, ServerName: "api.example.com", MinVersion: tls.VersionTLS13, MaxVersion: tls.VersionTLS13, NextProtos: []string{"h2"}},
	} {
		candidate, err := grpc.NewClient(tlsListener.Addr().String(), grpc.WithTransportCredentials(credentials.NewTLS(config)))
		if err != nil {
			continue
		}
		candidateCtx, candidateCancel := context.WithTimeout(context.Background(), time.Second)
		failure := candidate.Invoke(candidateCtx, "/openbindings.test.Stack/Unary", new(emptypb.Empty), new(wrapperspb.StringValue))
		candidateCancel()
		candidate.Close()
		if failure == nil {
			stackFail("TLS %s unexpectedly succeeded", label)
		}
	}

	result := map[string]any{"format": "openbindings.grpc-real-stack-result@1", "runtime": "grpc-go", "unary": 1, "gzipUnary": 1, "serverOutputs": len(serverValues), "clientInputs": 2, "bidiInputs": 2, "bidiOutputs": 2, "status": "UNIMPLEMENTED", "tlsUnary": 1, "tlsFailures": 2}
	encoded, _ := json.Marshal(result)
	fmt.Println(string(encoded))
}
