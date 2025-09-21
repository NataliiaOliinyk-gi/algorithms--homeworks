## Группы

`GET /orgs/:orgId/groups?q=&status=&direction_id=&page=&limit=` получить список групп

`GET /orgs/:orgId/groups/:groupId` получить группу по id

`POST /orgs/:orgId/groups` создать группу

`PUT /orgs/:orgId/groups/:groupId` редактировать группу

`DELETE /orgs/:orgId/groups/:groupId` удалить группу

### Получить список групп:

`GET /orgs/:orgId/groups?q=&status=&direction_id=&page=&limit=`

суперадмин, админ, сотрудник учебной организации, учитель

`q` - поиск по `name/code`  
 `status` - `planned |active | archived` - фильтр по статусу группы  
 `direction_id` - фильтр по направлению  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `q` - строка (если передали)
  - `status` - один из `planned |active | archived` (если передали)
  - `direction_id` - целое число (если передали)
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
    - `status` - `planned |active | archived`
    - `direction_id` - /^\[1-9\]\d{0,9}\$/
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `q` - `string[0..100]` - `trim`
    - `status` - `planned |active | archived`
    - `direction_id` - /^\[1-9\]\d{0,9}\$/
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "total": 1,
  "page": 1,
  "limit": 50,
  "groups": [
    {
      "id": 108,
      "direction_id": 12,
      "name": "Web-Development-2025-10",
      "code": "281025-wdm",
      "status": "planned",
      "avatar_url": null,
      "start_date": "2025-10-28",
      "end_date": "2026-08-15",
      "created_by": 1054,
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
  "message": "Permission denied: You are not allowed to view groups in this organization."
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
FROM groups
WHERE org_id = :org_id
  AND (COALESCE(NULLIF(TRIM(:status), ''), NULL) IS NULL OR status = :status)
  AND (COALESCE(:direction_id, 0) = 0 OR direction_id = :direction_id)
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR name LIKE CONCAT('%', :q, '%')
    OR code LIKE CONCAT('%', :q, '%')
  );

--page
SELECT id, direction_id, name, code, status, avatar_url,
       start_date, end_date, created_at, updated_at, created_by
FROM groups
WHERE org_id = :org_id
  AND (COALESCE(NULLIF(TRIM(:status), ''), NULL) IS NULL OR status = :status)
  AND (COALESCE(:direction_id, 0) = 0 OR direction_id = :direction_id)
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR name LIKE CONCAT('%', :q, '%')
    OR code LIKE CONCAT('%', :q, '%')
  )
ORDER BY created_at DESC, id DESC
LIMIT @limit OFFSET @offset;

```

### Получить группу по id:

`GET /orgs/:orgId/groups/:groupId`

суперадмин, админ, сотрудник учебной организации, учитель, студент

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**

```json
{
  "id": 108,
  "direction_id": 12,
  "name": "Web-Development-2025-10",
  "code": "281025-wdm",
  "status": "planned",
  "avatar_url": null,
  "start_date": "2025-10-28",
  "end_date": "2026-08-15",
  "created_by": 1054,
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: groupId must be integer" }
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
  "message": "Permission denied: You are not allowed to view groups in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Group not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Выборка
SELECT id, direction_id, name, code, status, avatar_url, start_date, end_date, created_at, updated_at, created_by
FROM groups
WHERE id = :group_id AND org_id = :org_id
LIMIT 1;

```

### Создать группу:

`POST /orgs/:orgId/groups`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "direction_id": 12,
  "name": "Web-Development-2025-10",
  "code": "281025-wdm",
  "status": "planned",
  "avatar_url": null,
  "start_date": "2025-10-28",
  "end_date": "2026-08-15"
}
```

- **Назначение:** создать учебную группу в организации, при создании группа прикрепляется к направлению, и получает набор предметов, которые соответствуют этому направлению

- **Path / Query params:**

  - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `direction_id` должен существовать и принадлежать той же организации
  - `code` уникален в рамках организации `(org_id, code)`
  - Лимит тарифа - количество групп `(planned + active)` не должно превышать `subscription_plans.max_groups`
  - `end_date ≥ start_date` (если обе заданы)
  - `created_by` берем из JWT
  - Поля:
    - `code` обязательное поле
    - `name` обязательное поле
  - Автонаполнение `group_subjects` из `direction_subjects` `(source='direction')` на момент создания

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `direction_id` - /^\[1-9\]\d{0,9}\$/ обязательное поле
    - `name` - `string[1..100]`, `trim` - обязательное поле
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$, `toLowerCase()`, `trim` - обязательное поле
    - `status` - `planned|active|archived` (по умолчанию `active`)
    - `start_date` - `YYYY-MM-DD`
    - `end_date` - `YYYY-MM-DD`
    - `end_date >= start_date`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `direction_id`- /^\[1-9\]\d{0,9}\$/ обязательное поле
    - `name` - `string[1..100]`, `trim` - обязательное поле
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$, `toLowerCase()`, `trim` - обязательное поле
    - `status` - `planned|active|archived` (по умолчанию `active`)
    - `start_date` - `YYYY-MM-DD`
    - `end_date` - `YYYY-MM-DD`
    - `end_date >= start_date`

  - DB:

    - `(org_id, code)` - `UNIQUE` проверка уникальности

- **Responses**:

  - **201 Created** группа создана

```json
{
  "id": 108,
  "direction_id": 12,
  "name": "Web-Development-2025-10",
  "code": "281025-wdm",
  "status": "planned",
  "avatar_url": null,
  "start_date": "2025-10-28",
  "end_date": "2026-08-15",
  "created_by": 1054,
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
  "message": "Permission denied: You are not allowed to create a group in this organization."
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
{ "message": "Groups code '281025-wdm' is already in use in this organization" }
```

- **409 Conflict** превышен лимит (согласно тарифного плана)

```json
{ "message": "Plan limits exceeded for groups." }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка направления - принадлежит той же организации
SELECT 1 FROM directions
WHERE id = :direction_id AND org_id = :org_id LIMIT 1;

--Проверка лимита плана по группам
SELECT subscription_plans.max_groups AS max_allowed,
       (
         SELECT COUNT(*)
         FROM groups
         WHERE groups.org_id = :org_id
           AND groups.status IN ('planned','active')
       ) AS currently_used
FROM org_subscriptions
JOIN subscription_plans ON subscription_plans.id = org_subscriptions.plan_id
WHERE org_subscriptions.org_id = :org_id AND org_subscriptions.is_current = 1
LIMIT 1;
--Если currently_used >= max_allowed => 409

--Проверка уникальности кода группы
SELECT id FROM groups
WHERE org_id = :org_id AND code = :code LIMIT 1;

--Создание группы
INSERT INTO groups
  (org_id, direction_id, name, code, status, avatar_url, start_date, end_date, created_at, updated_at, created_by)
VALUES
  (:org_id, :direction_id, :name, :code, COALESCE(:status, 'active'), :avatar_url, :start_date, :end_date, NOW(), NOW(), :created_by);

--Автонаполнение предметов группы
SET @group_id = LAST_INSERT_ID();

INSERT INTO group_subjects (org_id, group_id, subject_id, added_at, source)
SELECT :org_id, @group_id, direction_subjects.subject_id, NOW(), 'direction'
FROM direction_subjects
JOIN subjects ON subjects.id = direction_subjects.subject_id
WHERE subjects.org_id     = :org_id
  AND direction_subjects.direction_id = :direction_id
  AND direction_subjects.effective_to IS NULL;
  -- Если важно учитывать дату начала группы:
  AND direction_subjects.effective_from <= COALESCE(:start_date, CURDATE())


--Для ответа
SELECT id, direction_id, name, code, status, avatar_url, start_date, end_date, created_at, updated_at, created_by
FROM groups WHERE id = LAST_INSERT_ID();

```

### Редактировать группу:

`PUT /orgs/:orgId/groups/:groupId`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "direction_id": 12,
  "name": "Web-Development-2025-10",
  "code": "281025-wdm",
  "status": "planned",
  "avatar_url": null,
  "start_date": "2025-10-28",
  "end_date": "2026-08-15"
}
```

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `direction_id` должен существовать и принадлежать той же организации
  - `code` уникален в рамках организации `(org_id, code)`
  - `end_date ≥ start_date` (если обе заданы)
  - Смена `status` допустима (`planned` -\> `active` -\> `archived`)  
    _Архивация группы_ — это перевод в `status='archived'`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `name` - `string[1..100]`, `trim` - обязательное поле
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$, `toLowerCase()`, `trim`
    - `status` - `planned|active|archived` (по умолчанию `active`)
    - `start_date` - `YYYY-MM-DD`
    - `end_date` - `YYYY-MM-DD`
    - `end_date >= start_date`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `name` - `string[1..100]`, `trim` - обязательное поле
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$, `toLowerCase()`, `trim`
    - `status` - `planned|active|archived` (по умолчанию `active`)
    - `start_date` - `YYYY-MM-DD`
    - `end_date` - `YYYY-MM-DD`
    - `end_date >= start_date`

  - DB:

    - `(org_id, code)` - `UNIQUE` проверка уникальности

- **Responses**:

  - **200 OK**

```json
{
  "id": 108,
  "direction_id": 12,
  "name": "Web-Development-2025-10",
  "code": "281025-wdm",
  "status": "planned",
  "avatar_url": null,
  "start_date": "2025-10-28",
  "end_date": "2026-08-15",
  "created_by": 1054,
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: groupId must be integer" }
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
  "message": "Permission denied: You are not allowed to edit a group in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Direction not found" }
```

```json
{ "message": "Group not found" }
```

- **409 Conflict** дубликат

```json
{ "message": "Groups code '281025-wdm' is already in use in this organization" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка направления - принадлежит той же организации (если меняем)
SELECT 1 FROM directions
WHERE id = :direction_id AND org_id = :org_id LIMIT 1;

--Проверка уникальности кода группы (если меняем)
SELECT id FROM groups
WHERE org_id = :org_id AND code = :code LIMIT 1;

--Обновление
UPDATE groups
SET direction_id = COALESCE(:direction_id, direction_id),
    name         = COALESCE(:name, name),
    code         = COALESCE(:code, code),
    status       = COALESCE(:status, status),
    avatar_url   = COALESCE(:avatar_url, avatar_url),
    start_date   = COALESCE(:start_date, start_date),
    end_date     = COALESCE(:end_date, end_date),
    updated_at   = NOW()
WHERE id = :group_id AND org_id = :org_id;

```

### Удалить группу:

`DELETE /orgs/:orgId/groups/:groupId`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число

- **Бизнес-правила:**

  - физически не удаляем - выполняем мягкое удаление: `status='archived'` История участников/назначений/оценок сохраняется
  - при архивации группа перестает учитываться в лимите `max_groups` (так как считаем только `planned\|active`)

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**

```json
{
  "id": 108,
  "code": "281025-wdm",
  "status": "archived",
  "archived_at": "2025-09-02T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: subjectId must be integer" }
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
  "message": "Permission denied: You are not allowed to remove a subject in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Subject not found" }
```

- **409 Conflict** есть связи

```json
{ "message": "Subject is in use" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Архивация группы
UPDATE groups
SET status = 'archived',
    end_date = COALESCE(end_date, CURDATE()),
    updated_at = NOW()
WHERE id = :group_id AND org_id = :org_id;

SELECT id, code, 'archived' AS status, NOW() AS archived_at
FROM groups WHERE id = :group_id AND org_id = :org_id;

```
