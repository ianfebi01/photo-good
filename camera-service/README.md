# Camera service

A small Python sidecar that owns the camera via [python-gphoto2](https://github.com/jim-easterbrook/python-gphoto2)
(a real libgphoto2 binding) and exposes it to the Next.js app over HTTP.

It replaces shelling out to the `gphoto2` CLI. Because it holds one camera
object in-process, it can call `camera.exit()` / `init()` to **rebind to a
reconnected camera without restarting anything** — so unplug/replug recovers on
its own, and the live preview never has to be torn down for a capture.

## Endpoints

| Method | Path       | Returns                                            |
| ------ | ---------- | -------------------------------------------------- |
| GET    | `/status`  | `{ "connected": bool, "model": str \| null }`      |
| GET    | `/preview` | `multipart/x-mixed-replace` MJPEG live view        |
| POST   | `/capture` | full-resolution `image/jpeg` bytes                 |

## Setup & run

```bash
pnpm camera:setup   # one-time: create venv + install python-gphoto2
pnpm camera         # start the service (default http://127.0.0.1:8088)
```

Run it alongside `pnpm dev` in a second terminal.

## Configuration

Environment variables (read by both the service and the Next.js app):

- `CAMERA_SERVICE_HOST` / `CAMERA_SERVICE_PORT` — bind address (default `127.0.0.1:8088`)
- `CAMERA_SERVICE_URL` — full base URL the Next.js app uses to reach the service
  (default `http://127.0.0.1:8088`)
- `PHOTOBOOTH_MOCK=1` — force the simulated camera (no service needed)

If the service is unreachable, the app automatically falls back to the mock
camera, so the UI still works without hardware.
