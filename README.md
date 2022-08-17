# Rocket.Chat.Omnichannel.Load

Tool to flood RocketChat omnichannel queue with requests. This tool will use Widget endpoints to artificially create visitors. At the end of the run, it will show some execution stats (time to request, average time, etc)

## Usage

```
node index.js [ATTEMPTS] [DELAY] [DEPARTMENT]
```

Attempts = The number of "visitors" to create
Delay = The amount of time between one visitor creation and another
Department = The department the visitors should be assigned to (empty for "default" department)

## Environment

`HOST` env should be set to the URL of the API. Default is `http://localhost:3000/` (ending dash is required for now)
`ATTEMPTS` env overrides the param with same name
`DELAY` env overrides the param with same name
`DEPARTMENT` env overrides the param with same name

## The load

- Creates visitor
- Visitor creates a room (starts a conversation)
- Visitors sends a message to room (conversation put in queue by server)
- Visitor reads messages after sending
- Visitor sends a 2nd message
- Visitor reads messages a second time

## With docker
```
❯ docker build --build-arg delay=10 --build-arg attempts=10 -t omnichannel-visitor-load:latest .
❯ docker run omnichannel-visitor-load:latest
```
