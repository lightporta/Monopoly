# Monopoly v4 wire protocol

All clients connect to `/ws` on the same HTTP(S) origin. JSON requests are
`{id: string, type: string, payload: object}`. IDs are unique per connection.
Replies are `{id, type: "ok", payload}` or
`{id, type: "error", payload: {code}}`; clients translate stable error codes.
The last 128 replies are cached per connection, so a retried ID never reapplies
a mutation. Game actions also require the latest revision.

Every room mutation broadcasts `{type: "snapshot", payload: {room, game}}`.
`room` is `{code, hostId, status, players, turnDeadline}`; status is `waiting`,
`playing` or `finished`. Players are `{id,name,connected,ready,isAI,difficulty}`.
`game` is null before start or the public shared-engine state; `seed` and
`rngState` are excluded. `turnDeadline` is an epoch millisecond timestamp, or null.

| Request        | Payload                                                               | Reply payload         |
| -------------- | --------------------------------------------------------------------- | --------------------- |
| `create`       | `{name}`                                                              | `{session, snapshot}` |
| `join`         | `{code,name}`                                                         | `{session, snapshot}` |
| `resume`       | `{code,playerId,token}`                                               | `{session, snapshot}` |
| `ready`        | `{ready: boolean}`                                                    | `{}`                  |
| `addBot`       | `{difficulty: "easy"\|"normal"\|"hard"}`                              | `{}`                  |
| `removeBot`    | `{playerId}`                                                          | `{}`                  |
| `removePlayer` | `{playerId}` (host removes a disconnected human before start/restart) | `{}`                  |
| `start`        | `{maxRounds: integer 10..100}` (optional, default 40)                 | `{}`                  |
| `action`       | `{revision,action}`                                                   | `{}`                  |
| `leave`        | `{}`                                                                  | `{}`                  |
| `ping`         | `{}`                                                                  | `{time}`              |

`session` is `{code,playerId,token}`. Store it per browser tab for reconnection;
tokens are private, never included in a broadcast. Resuming replaces any old
socket for the same seat. A socket belongs to at most one room. Use `leave`
before creating/joining another room.

Host can add/remove bots, start and restart finished games. All connected human
seats must be ready (host is ready by default). Every game uses 2–4 seats. The
host may accept new human seats after a game finishes, before restarting. Online
rolls use fresh private cryptographic entropy; deterministic seed replay applies
to offline games and engine simulations, not to the online server. The host
role migrates when its owner leaves or disconnects. A disconnection retains
the seat and token. A playing human seat has a fixed 60-second turn deadline;
after expiry the shared AI finishes that turn. Reconnecting resumes manual play
at the next turn. Leaving explicitly turns that seat into a bot and invalidates
the token. Automated turns are paced at 200 ms per action.

Rooms and sessions are in memory and disappear on process restart. Empty rooms
expire after 30 minutes, inactive rooms after 24 hours. There is no persistence
or cross-process coordination: deploy exactly one server process.

`TURN_TIMEOUT_MS` sets the human-turn timeout (default `60000`, integer
`1000`–`600000`). It is read from the server process environment at startup.

Common errors: `BAD_MESSAGE`, `UNKNOWN_TYPE`, `INVALID_NAME`, `INVALID_CODE`,
`ROOM_NOT_FOUND`, `ROOM_FULL`, `ALREADY_IN_ROOM`, `NOT_IN_ROOM`, `INVALID_SESSION`,
`NOT_HOST`, `NOT_READY`, `NOT_ENOUGH_PLAYERS`, `GAME_ACTIVE`, `GAME_NOT_ACTIVE`,
`STALE_REVISION`, `NOT_YOUR_TURN`, `INVALID_ACTION`, `RATE_LIMIT`, `SERVER_FULL`.
Shared engine errors retain their engine error code. Closed/replaced sockets
must reconnect with the stored session; do not replay unacknowledged actions
automatically after reconnecting.
