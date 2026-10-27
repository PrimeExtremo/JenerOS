package runtime

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Only root workers construct this client. jenerd cannot open the socket.
type client struct{ http *http.Client }

func newClient(socket string) *client {
	return &client{&http.Client{Transport: &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", socket)
		},
	}, Timeout: 25 * time.Minute}}
}

type response struct {
	Type      string          `json:"type"`
	Operation string          `json:"operation"`
	Metadata  json.RawMessage `json:"metadata"`
}

type incusError int

func (e incusError) Error() string { return fmt.Sprintf("App engine request failed (%d).", e) }
func missing(err error) bool      { return errors.Is(err, incusError(404)) }

func (c *client) call(ctx context.Context, method, path string, body any, out any) error {
	var data []byte
	var err error
	if body != nil {
		data, err = json.Marshal(body)
		if err != nil {
			return err
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, "http://unix"+path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := c.http.Do(req)
	if err != nil {
		return errors.New("Cannot reach the app engine.")
	}
	defer res.Body.Close()
	var envelope response
	if err := json.NewDecoder(io.LimitReader(res.Body, 8<<20)).Decode(&envelope); err != nil {
		return errors.New("Invalid app engine response.")
	}
	if res.StatusCode >= 400 || envelope.Type == "error" {
		return incusError(res.StatusCode)
	}
	if envelope.Type == "async" {
		u, err := url.Parse(envelope.Operation)
		if err != nil || u.IsAbs() || !strings.HasPrefix(u.Path, "/1.0/operations/") {
			return errors.New("Invalid app operation.")
		}
		u.Path += "/wait"
		q := u.Query()
		original, err := url.Parse(path)
		if err != nil {
			return err
		}
		if q.Get("project") == "" && original.Query().Get("project") != "" {
			q.Set("project", original.Query().Get("project"))
		}
		q.Set("timeout", "-1")
		u.RawQuery = q.Encode()
		var op struct {
			StatusCode int             `json:"status_code"`
			Metadata   json.RawMessage `json:"metadata"`
		}
		if err := c.call(ctx, "GET", u.String(), nil, &op); err != nil {
			return err
		}
		if op.StatusCode != 200 {
			// Incus errors may contain env values. Never publish them.
			return errors.New("The app engine could not finish this step. Check its private logs.")
		}
		envelope.Metadata = op.Metadata
	}
	if out != nil {
		return json.Unmarshal(envelope.Metadata, out)
	}
	return nil
}

func project(id string) string { return "jener-" + id }
func instancePath(id, service string) string {
	return "/1.0/instances/" + service + "?project=" + project(id)
}
func statePath(id, service string) string {
	return "/1.0/instances/" + service + "/state?project=" + project(id)
}

type instanceState struct {
	Status    string    `json:"status"`
	StartedAt time.Time `json:"started_at"`
	CPU       struct {
		Usage uint64 `json:"usage"`
	} `json:"cpu"`
	Memory struct {
		Usage uint64 `json:"usage"`
	} `json:"memory"`
}
