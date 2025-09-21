## Связка «Группа ⇔ Предметы» group_subjects

`GET /orgs/:orgId/groups/:groupId/subjects?q=&source=&page=&limit= `
получить список предметов группы

`POST /orgs/:orgId/groups/:groupId/subjects`
добавить предмет в группу

`DELETE /orgs/:orgId/groups/:groupId/subjects/:subjectId`
удалить предмет из группы

### Получить список предметов группы:

`GET /orgs/:orgId/groups/:groupId/subjects?q=&source=&page=&limit=`

суперадмин, админ, сотрудник учебной организации, преподаватель, студент

`q` - поиск по `subjects.name/short_code`  
 `source` - `direction|manual`, фильтрация по методу назначения  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число
  - `q` - строка (если передали)
  - `source` - `direction|manual`
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit`- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `groupId` существует и принадлежит той же организации

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `q` - `string[0..100]` - `trim`
    - `source` - `direction|manual`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `q` - `string[0..100]` - `trim`
    - `source` - `direction|manual`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "total": 1,
  "page": 1,
  "limit": 50,
  "group_subjects": [
    {
      "group": {
        "id": 112,
        "direction_id": 108,
        "name": "Web-Development-2025-10",
        "code": "281025-wdm"
      },
      "subject": {
        "id": 108,
        "name": "React",
        "short_code": "react"
      },
      "source": "direction",
      "added_at": "2025-09-02T10:11:12Z"
    }
  ]
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
  "message": "Permission denied: You are not allowed to view list of subjects of the group in this organization."
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
SET @page  = GREATEST(COALESCE(:page, 1), 1);
SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
SET @offset = (@page - 1) * @limit;

--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка группы
SELECT 1 FROM groups
WHERE id = :group_id AND org_id = :org_id LIMIT 1;

--total
SELECT COUNT(*) AS total
FROM group_subjects
JOIN subjects ON subjects.id = group_subjects.subject_id
WHERE group_subjects.org_id = :org_id
  AND group_subjects.group_id = :group_id
  AND (COALESCE(NULLIF(TRIM(:source), ''), NULL) IS NULL OR group_subjects.source = :source)
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR subjects.name LIKE CONCAT('%', :q, '%')
    OR subjects.short_code LIKE CONCAT('%', :q, '%')
  );

--page
SELECT
  groups.id            AS group_id,
  groups.direction_id  AS group_direction_id,
  groups.name          AS group_name,
  groups.code          AS group_code,
  subjects.id          AS subject_id,
  subjects.name          AS subject_name,
  subjects.short_code    AS subject_short_code,
  group_subjects.source,
  group_subjects.added_at
FROM group_subjects
JOIN subjects ON subjects.id = group_subjects.subject_id
JOIN groups ON groups.id = group_subjects.group_id AND groups.org_id = :org_id
WHERE group_subjects.org_id  = :org_id
  AND group_subjects.group_id = :group_id
  AND (COALESCE(NULLIF(TRIM(:source), ''), NULL) IS NULL OR group_subjects.source = :source)
  AND (
        COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
        OR subjects.name       LIKE CONCAT('%', :q, '%')
        OR subjects.short_code LIKE CONCAT('%', :q, '%')
      )
ORDER BY subjects.name ASC, subjects.id ASC
LIMIT @limit OFFSET @offset;

```

### Добавить предмет в группу:

`POST /orgs/:orgId/groups/:groupId/subjects`

суперадмин, админ

Ручное наполнение ("source": "manual") Автоматическое наполнение будет происходить когда группу определяем в направление, в котором уже выбраны предметы для изучения

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "subject_id": 108,
  "source": "manual"
}
```

- **Бизнес-правила:**

  - `group_id` принадлежит той же организации
  - `subject_id` принадлежит той же организации
  - Запрещены дубли `(group_id,subject_id)` уникально
  - Ручное наполнение (`source='manual'`)
  - Если `source='direction'`, должна существовать активная запись в `direction_subjects` для `groups.direction_id` и `subject_id`

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
    - `subject_id` - /^\[1-9\]\d{0,9}\$/ - обязательное поле
    - `source` - `manual|direction`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `subject_id` - /^\[1-9\]\d{0,9}\$/ - обязательное поле
    - `source` - `manual|direction`

  - DB:

    - `(group_id,subject_id)` - `UNIQUE` проверка уникальности

- **Responses**:

  - **201 Created** предмет в группу добавлен

```json
{
  "group": {
    "id": 112,
    "direction_id": 108,
    "name": "Web-Development-2025-10",
    "code": "281025-wdm"
  },
  "subject": {
    "id": 108,
    "name": "React",
    "short_code": "react"
  },
  "source": "manual",
  "added_at": "2025-09-02T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: groupId must be integer" }
```

```json
{ "message": "subject_id is required" }
```

- **401 Unauthorized** отсутствует Authorization

```json
{ "message": "Authorization header missing" }
```

- **401 Unauthorized** токен просрочен

```json
{ "message": "jwt expired" }
```

> {“message”: ””}

- **403 Forbidden** отказано в доступе

```json
{
  "message": "Permission denied: You are not allowed to create a subject of the group in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Group not found" }
```

```json
{ "message": "Subject not found" }
```

- **409 Conflict** дубликат

```json
{
  "message": "Duplicate subject in group: this subject is already attached to the group"
}
```

- **409 Conflict** нет активной связки с направлением

```json
{
  "message": "Cannot add with source='direction': the subject is not active for this group's direction. Add it to the direction first or use source='manual'."
}
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка группы
SELECT 1 FROM groups
WHERE id = :group_id AND org_id = :org_id LIMIT 1;

--Проверка предмета
SELECT 1 FROM subjects
WHERE id = :subject_id AND org_id = :org_id LIMIT 1;

--Проверка уникальности
SELECT 1
FROM group_subjects
WHERE org_id = :org_id AND group_id = :group_id AND subject_id = :subject_id
LIMIT 1;
--если вернулось 1 => 409 Conflict


--Проверка при source='direction' подтвердить активную связь направления с предметом
SELECT 1
FROM groups
JOIN direction_subjects
  ON direction_subjects.direction_id = groups.direction_id
 AND direction_subjects.subject_id   = :subject_id
WHERE groups.id = :group_id
  AND groups.org_id = :org_id
  AND direction_subjects.effective_to IS NULL
LIMIT 1;
--если не вернулось 1 и source='direction' => 409 Conflict

--Добавление предмета
INSERT INTO group_subjects (org_id, group_id, subject_id, added_at, source)
VALUES (:org_id, :group_id, :subject_id, NOW(), COALESCE(:source,'manual'));

--Для ответа
SELECT
  groups.id           AS group_id,
  groups.direction_id AS group_direction_id,
  groups.name         AS group_name,
  groups.code         AS group_code,
  subjects.id           AS subject_id,
  subjects.name         AS subject_name,
  subjects.short_code   AS subject_short_code,
  group_subjects.source,
  group_subjects.added_at
FROM group_subjects
JOIN groups ON groups.id = group_subjects.group_id
JOIN subjects ON subjects.id = group_subjects.subject_id
WHERE group_subjects.org_id = :org_id
  AND group_subjects.group_id = :group_id
  AND group_subjects.subject_id = :subject_id
LIMIT 1;

```

### Удалить предмет из группы:

`DELETE /orgs/:orgId/groups/:groupId/subjects/:subjectId`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число
  - `subjectId` - целое число
  - `effective_from` - `YYYY-MM-DD`

- **Бизнес-правила:**

  - Нельзя удалить предмет из группы, если есть `teaching_assignments` для этой пары `(group_id,subject_id)`

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**

```json
{
  "group": {
    "id": 112,
    "direction_id": 108,
    "name": "Web-Development-2025-10",
    "code": "281025-wdm"
  },
  "subject": {
    "id": 108,
    "name": "React",
    "short_code": "react"
  },
  "removed": true
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: groupId must be integer" }
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
  "message": "Permission denied: You are not allowed to remove a subject of the group in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Group not found" }
```

```json
{ "message": "Subject not found" }
```

- **409 Conflict** есть связи

```json
{
  "message": "Cannot remove subject from group: there are teaching assignments for this group and subject. Remove those assignments first."
}
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка наличия зависимостей
SELECT COUNT(*) AS refs
FROM teaching_assignments
WHERE org_id = :org_id AND group_id = :group_id AND subject_id = :subject_id;
--если refs > 0 => 409 Conflict

--Получить запись для ответа до удаления
SELECT
  groups.id           AS group_id,
  groups.direction_id AS group_direction_id,
  groups.name         AS group_name,
  groups.code         AS group_code,
  subjects.id           AS subject_id,
  subjects.name         AS subject_name,
  subjects.short_code   AS subject_short_code,
  group_subjects.source,
  group_subjects.added_at
FROM group_subjects
JOIN groups ON groups.id = group_subjects.group_id
JOIN subjects ON subjects.id = group_subjects.subject_id
WHERE group_subjects.org_id = :org_id
  AND group_subjects.group_id = :group_id
  AND group_subjects.subject_id = :subject_id
LIMIT 1;

--Удаление предмета из группы
DELETE FROM group_subjects
WHERE org_id = :org_id AND group_id = :group_id AND subject_id = :subject_id;

```
