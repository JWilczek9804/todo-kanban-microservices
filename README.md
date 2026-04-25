# TaskFlow

- System zarządzania zadaniami (To-Do) z bazą Redis: Prosta aplikacja w Pythonie (Flask/FastAPI) wykorzystująca Redisa jako magazyn danych w pamięci podręcznej
- Mikroserwisowy system logowania (REST + Docker): Rozdzielenie logiki autoryzacji (OAuth2/JWT) od głównej aplikacji na dwa osobne kontenery Dockerowe.

W skrócie: Logowanie mailem + hasłem, otrzymujesz tablicę Kanban (To Do / In Progress / Done), drag&drop'em przeciągasz karty myszką, dodajesz nowe lub usuwasz.

## Zawartość

Trzy kontenery + dwa Redisy spięte przez docker-compose:

- `auth-service` (FastAPI, port 8001) — rejestracja, logowanie, JWT (access + refresh), wylogowanie
- `task-service` (FastAPI, port 8000) — CRUD na zadaniach, każdy user widzi tylko swoje
- `frontend` (Next.js 16, port 3000) — UI + warstwa BFF (route handlery `/api/*`)
- `redis-auth` — userzy i refresh tokeny
- `redis-tasks` — zadania

## Jak uruchomić

Wymagania: Docker Desktop. Uruchamianie jedną komendą

```bash
docker compose up -d --build
```

Potem otwórz <http://localhost:3000>, rejestracja konta i gotowe.

Przy pierwszym buildzie tworzenie zajmuje ~5 minut.

### Zatrzymanie

```bash
docker compose down # zostawia dane w Redisie
docker compose down -v # czyści wszystko, łącznie z userami
```

## Zmienne środowiskowe

Trzymane są w pliku `.env` w roocie:

```
JWT_SECRET_KEY=******
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

## Endpointy

### auth-service (8001)

(http://localhost:8001/docs)

```
POST /register      { email, first_name, last_name, password }
POST /token         OAuth2 form: username=<email>&password=...
POST /refresh       { refresh_token }
POST /verify        { token }            -> sprawdza access token
POST /logout        { refresh_token }    -> 204
```

### task-service (8000)

(http://localhost:8000/docs)

```
GET    /tasks?status=todo
POST   /tasks       { title, description?, status? }
GET    /tasks/{id}
PATCH  /tasks/{id}  { title?, description?, status? }
DELETE /tasks/{id}
```

Statusy: `todo` | `in_progress` | `done`.

## Struktura repo

```
auth-service/         # FastAPI + redis.asyncio
  app/
    main.py
    security.py       # JWT, bcrypt
    redis_client.py
    schemas.py
    routers/auth.py

task-service/         # FastAPI + redis + httpx (woła /verify)
  app/
    main.py
    security.py       # get_current_user przez auth-service
    schemas.py
    services/         # logika biznesowa
      task_service.py
      dependencies.py
    routers/tasks.py  # tylko handlery HTTP

frontend/             # Next.js App Router
  app/
    api/              # BFF — login/logout/me/tasks
    login/
    register/
    page.tsx          # tablica Kanban
  components/
    KanbanBoard.tsx
    NavBar.tsx
  lib/
    api.ts            # klient po stronie przeglądarki
    server-auth.ts    # cookies, refresh, /verify

docker-compose.yml
```

## Co znajduje sie w Redisach

**redis-auth:**

- `user:{email}` — Hash: `id`, `email`, `first_name`, `last_name`, `hashed_pw`, `created_at`
- `refresh:{jti}` — String z TTL

**redis-tasks:**

- `task:{user_id}:{task_id}` — JSON zadania
- `tasks:{user_id}` — Set z `task_id`'kami (indeks per user)

Podgląd z hosta:

```bash
docker exec -it taskflow-redis-auth redis-cli
docker exec -it taskflow-redis-tasks redis-cli
```

A potem `KEYS *`, `HGETALL user:...`, `SMEMBERS tasks:...` itd.
