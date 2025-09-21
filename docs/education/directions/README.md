## Направления

`GET /orgs/:orgId/directions?q=&page=&limit= ` получить список направлений

`GET /orgs/:orgId/directions/:directionId` получить направление по id

`POST /orgs/:orgId/directions` создать направление

`PUT /orgs/:orgId/directions/:directionId` редактировать направление

`DELETE /orgs/:orgId/directions/:directionId` удалить направление

### Получить список направлений:

`GET /orgs/:orgId/directions?q=&page=&limit=`

суперадмин, админ, сотрудник учебной организации

`q` - поиск по `code/name`  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `q` - строка (если передали)
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
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `q` - `string[0..100]` - `trim`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "total": 1,
  "page": 1,
  "limit": 50,
  "directions": [
    {
      "id": 101,
      "code": "web-dev",
      "name": "Web Development",
      "description": "Web Development, Full-Stack",
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
  "message": "Permission denied: You are not allowed to view directions in this organization."
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

--total
SELECT COUNT(*) AS total
FROM directions
WHERE org_id = :org_id
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR code LIKE CONCAT('%', :q, '%')
    OR name LIKE CONCAT('%', :q, '%')
  );

--page
SELECT id, code, name, description, created_at, updated_at
FROM directions
WHERE org_id = :org_id
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR code LIKE CONCAT('%', :q, '%')
    OR name LIKE CONCAT('%', :q, '%')
  )
ORDER BY name ASC, id ASC
LIMIT @limit OFFSET @offset;

```

### Получить направление по id:

`GET /orgs/:orgId/directions/:directionId`

суперадмин, админ, сотрудник учебной организации, учитель, студент

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `directionId` - целое число

  - **Backend-правила:**

    - `orgId` из пути:
      - должен совпадать с `org` в JWT
      - для `superadmin` — любой `org`
    - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**

```json
{
  "id": 101,
  "code": "web-dev",
  "name": "Web Development",
  "description": "Web Development, Full-Stack",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: directionId must be integer" }
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
  "message": "Permission denied: You are not allowed to view directions in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Direction not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Выборка
SELECT id, code, name, description, created_at, updated_at
FROM directions
WHERE id = :direction_id AND org_id = :org_id
LIMIT 1;

```

### Создать направление:

`POST /orgs/:orgId/directions`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "code": "web-dev",
  "name": "Web Development",
  "description": "Web Development, Full-Stack"
}
```

- **Назначение:** создать учебное направление в организации

- **Path / Query params:**

  - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `code` уникален в рамках организации `(org_id, code)`
  - Поля:
    - `code` обязательное поле
    - `name` обязательное поле
    - `description` опциональное поле

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$ - `toLowerCase()`, `trim` - обязательное поле
    - `name` - `string[1..150]`, `trim` - обязательное поле
    - `description` - `string[0..1000]`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$ - `toLowerCase()`, `trim` - обязательное поле
    - `name` - `string[1..150]`, `trim` - обязательное поле
    - `description` - `string[0..1000]`

  - DB:

    - `(org_id, code)` - `UNIQUE` проверка уникальности

- **Responses**:

  - **201 Created** направление создано

```json
{
  "id": 101,
  "code": "web-dev",
  "name": "Web Development",
  "description": "Web Development, Full-Stack",
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
{ "message": "name is required" }
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
  "message": "Permission denied: You are not allowed to create a direction in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

- **409 Conflict** дубликат

```json
{ "message": "Direction code 'web-dev' is already in use in this organization" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка уникальности кода направления
SELECT id FROM directions
WHERE org_id = :org_id AND code = :code
LIMIT 1;

--Создание
INSERT INTO directions (org_id, code, name, description, created_at, updated_at)
VALUES (:org_id, :code, :name, :description, NOW(), NOW());

--Для ответа
SELECT id, code, name, description, created_at, updated_at
FROM directions
WHERE id = LAST_INSERT_ID();

```

### Редактировать направление:

`PUT /orgs/:orgId/directions/:directionId`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "code": "web-dev",
  "name": "Web Development",
  "description": "Web Development, Full-Stack"
}
```

- **Path / Query params:**

  - `orgId` - целое число
  - `directionId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `code` уникален в рамках организации `(org_id, code)`
  - Поля:
    - `code`
    - `name`
    - `description`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$ - `toLowerCase()`, `trim`
    - `name` - `string[1..150]`, `trim`
    - `description` - `string[0..1000]`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$ - `toLowerCase()`, `trim`
    - `name` - `string[1..150]`, `trim`
    - `description` - `string[0..1000]`

  - DB:

    - `(org_id, code)` - `UNIQUE` проверка уникальности

- **Responses**:

  - **200 OK**

```json
{
  "id": 101,
  "code": "web-dev",
  "name": "Web Development",
  "description": "Web Development, Full-Stack",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-03T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: directionId must be integer" }
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
  "message": "Permission denied: You are not allowed to edit a direction in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Direction not found" }
```

- **409 Conflict** дубликат

```json
{ "message": "Direction code 'web-dev' is already in use in this organization" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка уникальности нового кода направления
SELECT id FROM directions
WHERE org_id = :org_id AND code = :code AND id <> :direction_id
LIMIT 1;

--Обновление
UPDATE directions
SET code = COALESCE(:code, code),
    name = COALESCE(:name, name),
    description = COALESCE(:description, description),
    updated_at = NOW()
WHERE id = :direction_id AND org_id = :org_id;

```

### Удалить направление:

`DELETE /orgs/:orgId/directions/:directionId`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `directionId` - целое число

- **Бизнес-правила:**

  - Нельзя удалить, если есть ссылки (`groups, direction_subjects, teaching_assignments`)

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**

```json
{
  "id": 101,
  "code": "web-dev",
  "name": "Web Development",
  "description": "Web Development, Full-Stack",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-03T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: directionId must be integer" }
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
  "message": "Permission denied: You are not allowed to remove a direction in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Direction not found" }
```

- **409 Conflict** есть связи

```json
{ "message": "Direction is in use" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка на связи
SELECT
  (SELECT COUNT(*) FROM groups  WHERE direction_id = :direction_id) +
  (SELECT COUNT(*) FROM direction_subjects  WHERE direction_id = :direction_id) AS refs;

--Удаление
DELETE FROM directions
WHERE id = :direction_id AND org_id = :org_id;

```
