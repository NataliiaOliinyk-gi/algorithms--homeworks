## Справочник правил penguin_rules

`GET /orgs/:orgId/penguin-rules?q=&is_active=&page=&limit=` получить список правил

`GET /orgs/:orgId/penguin-rules/:id` получить правило

`POST /orgs/:orgId/penguin-rules` создать правило

`PUT` /orgs/:orgId/penguin-rules/:id` изменить правило

`DELETE` /orgs/:orgId/penguin-rules/:id` удалить правило

### Получить список правил:

`GET /orgs/:orgId/penguin-rules?q=&is_active=&page=&limit=`

суперадмин, админ, сотрудник учебной организации, преподаватель

`q` - поиск по `code/title`  
 `is_active` — 0\|1 опционально, по умолчанию все  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `q` - строка (если передали)
  - `is_active` - 0\|1
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit`- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `q` - `string[0..100]` - `trim`
    - `only_active` - 0\|1
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `q` - `string[0..100]` - `trim`
    - `only_active` - 0\|1
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "total": 1,
  "page": 1,
  "limit": 50,
  "penguin_rules": [
    {
      "id": 115,
      "code": "HOMEWORK",
      "title": "Homework completed",
      "default_delta": 3,
      "is_active": true,
      "description": "Award for completed homework",
      "created_at": "2025-09-02T10:11:12Z",
      "updated_at": "2025-09-02T10:11:12Z"
    }
  ]
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

- **401 Unauthorized** отсутствует Authorization

```json
{ "message": "Authorization header missing" }
```

- **401 Unauthorized** токен просрочен

```json
{ "message": "jwt expired" }
```

- **403 Forbidden** отказано в доступе

```json
{
  "message": "Permission denied: You are not allowed to view rules in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

- **SQL**

```sql
SET @page  = GREATEST(COALESCE(:page, 1), 1);
SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
SET @offset = (@page - 1) * @limit;

--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверки фильтров, если параметр передан

--Проверка группы
SELECT 1 FROM groups
WHERE id = :group_id AND org_id = :org_id
LIMIT 1;

--total
SELECT COUNT(*) AS total
FROM penguin_rules
WHERE org_id = :org_id
   AND (COALESCE(:is_active, -1) = -1 OR is_active = :is_active)
   AND (
     COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
     OR code  LIKE CONCAT('%', :q, '%')
     OR title LIKE CONCAT('%', :q, '%')
   );

--page
SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
FROM penguin_rules
WHERE org_id = :org_id
  AND (COALESCE(:is_active, -1) = -1 OR is_active = :is_active)
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR code  LIKE CONCAT('%', :q, '%')
    OR title LIKE CONCAT('%', :q, '%')
  )
ORDER BY is_active DESC, title ASC, id ASC
LIMIT @limit OFFSET @offset;

```

### Получить правило:

`GET /orgs/:orgId/penguin-rules/:id`

суперадмин, админ, сотрудник учебной организации, учитель

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `id` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**

```json
{
  "id": 115,
  "code": "HOMEWORK",
  "title": "Homework completed",
  "default_delta": 3,
  "is_active": true,
  "description": "Award for completed homework",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: id must be integer" }
```

- **401 Unauthorized** отсутствует Authorization

```json
{ "message": "Authorization header missing" }
```

- **401 Unauthorized** токен просрочен

```json
{ "message": "jwt expired" }
```

- **403 Forbidden** отказано в доступе

```json
{
  "message": "Permission denied: You are not allowed to view rules in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Rule not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Выборка
SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
FROM penguin_rules
WHERE org_id = :org_id AND id = :id
LIMIT 1;

```

### Создать правило:

`POST /orgs/:orgId/penguin-rules`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "code": "BONUS",
  "title": "Bonus points",
  "default_delta": 5,
  "is_active": true,
  "description": "Special bonus"
}
```

- **Path / Query params:**

  - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `code` уникален в рамках организации `(org_id, code)`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$, `toLowerCase()`, `trim`, обязательное поле
    - `title` - `string[1..150]`, `trim`, обязательное поле
    - `default_delta` - `smallint` целое, обязательное поле
    - `is_active` - `boolean`
    - `description` - `string[0..1000]`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$, `toLowerCase()`, `trim`, обязательное поле
    - `title` - `string[1..150]`, `trim`, обязательное поле
    - `default_delta` - `smallint` целое, обязательное поле
    - `is_active` - `boolean`
    - `description` - `string[0..1000]`

  - DB:

    - `(org_id, code)` - `UNIQUE` проверка уникальности

- **Responses**:

  - **201 Created** правило создано

```json
{
  "id": 108,
  "code": "BONUS",
  "title": "Bonus points",
  "default_delta": 5,
  "is_active": true,
  "description": "Special bonus",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "code is required" }
```

```json
{ "message": "title is required" }
```

```json
{ "message": "default_delta is required" }
```

- **401 Unauthorized** отсутствует Authorization

```json
{ "message": "Authorization header missing" }
```

- **401 Unauthorized** токен просрочен

```json
{ "message": "jwt expired" }
```

- **403 Forbidden** отказано в доступе

```json
{
  "message": "Permission denied: You are not allowed to create rules in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

- **409 Conflict** дубликат

```json
{ "message": "Rule code 'bonus' is already in use in this organization." }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка на уникальность кода
SELECT id FROM penguin_rules
WHERE org_id = :org_id AND code = :code
LIMIT 1;

--Создание правила
INSERT INTO penguin_rules (org_id, code, title, default_delta, is_active, description, created_at, updated_at)
VALUES (:org_id, :code, :title, :default_delta, COALESCE(:is_active, 1), :description, NOW(), NOW());

--Для ответа
SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
FROM penguin_rules
WHERE id = LAST_INSERT_ID();

```

### Изменить правило:

`PUT /orgs/:orgId/penguin-rules/:id`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "code": "BONUS",
  "title": "Bonus points",
  "default_delta": 5,
  "is_active": true,
  "description": "Special bonus"
}
```

- **Path / Query params:**

  - `orgId` - целое число
  - `id` - целое число

- **Бизнес-правила:**

  - При смене `code` проверить на уникальность `(org_id, code)`

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$, `toLowerCase()`, `trim`
    - `title` - `string[1..150]`, `trim`
    - `default_delta` - `smallint` целое
    - `is_active` - `boolean`
    - `description` - `string[0..1000]`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$, `toLowerCase()`, `trim`
    - `title` - `string[1..150]`, `trim`
    - `default_delta` - `smallint` целое
    - `is_active` - `boolean`
    - `description` - `string[0..1000]`

  - DB:

    - `(org_id, code)` - UNIQUE проверка уникальности

- **Responses**:

  - **200 OK**

```json
{
  "id": 108,
  "code": "BONUS",
  "title": "Bonus points",
  "default_delta": 5,
  "is_active": true,
  "description": "Special bonus",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: id must be integer" }
```

- **401 Unauthorized** отсутствует Authorization

```json
{ "message": "Authorization header missing" }
```

- **401 Unauthorized** токен просрочен

```json
{ "message": "jwt expired" }
```

- **403 Forbidden** отказано в доступе

```json
{
  "message": "Permission denied: You are not allowed to edit a rule in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Rule not found" }
```

- **409 Conflict** дубликат

```json
{ "message": "Rule code 'bonus' is already in use in this organization." }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка на уникальность кода, если меняем
SELECT id FROM penguin_rules
WHERE org_id = :org_id AND code = :code AND id <> :id
LIMIT 1;

--Обновление правила
UPDATE penguin_rules
SET code          = COALESCE(:code, code),
    title         = COALESCE(:title, title),
    default_delta = COALESCE(:default_delta, default_delta),
    is_active     = COALESCE(:is_active, is_active),
    description   = COALESCE(:description, description),
    updated_at    = NOW()
WHERE org_id = :org_id AND id = :id;

--Для ответа
SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
FROM penguin_rules
WHERE org_id = :org_id AND id = :id
LIMIT 1;

```

### Удалить правило:

`DELETE /orgs/:orgId/penguin-rules/:id`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `id` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - Правило не удаляем, а деактивируем `is_active=false`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**

```json
{
  "id": 108,
  "code": "BONUS",
  "title": "Bonus points",
  "default_delta": 5,
  "is_active": true,
  "description": "Special bonus",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: id must be integer" }
```

- **401 Unauthorized** отсутствует Authorization

```json
{ "message": "Authorization header missing" }
```

- **401 Unauthorized** токен просрочен

```json
{ "message": "jwt expired" }
```

- **403 Forbidden** отказано в доступе

```json
{
  "message": "Permission denied: You are not allowed to remove a rule in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Rule not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Деактивация правила
UPDATE penguin_rules
SET is_active = 0, updated_at = NOW()
WHERE org_id = :org_id AND id = :id;

--Для ответа
SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
FROM penguin_rules
WHERE org_id = :org_id AND id = :id
LIMIT 1;

```
