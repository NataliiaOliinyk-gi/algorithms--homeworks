## Связка «Направление ⇔ Предметы» direction_subjects

`GET /orgs/:orgId/directions/:directionId/subjects?q=&only_active=&page=&limit=`  
 получить список предметов направления

`GET /orgs/:orgId/directions/:directionId/subjects/:subjectId?effective_from=`  
 получить одну запись (текущую или по дате начала)

`POST /orgs/:orgId/directions/:directionId/subjects`  
 добавить предмет в направление (c датой начала действия)

`PUT /orgs/:orgId/directions/:directionId/subjects/:subjectId?effective_from=`  
 правка записи (флага/сортира/даты окончания)

`DELETE /orgs/:orgId/directions/:directionId/subjects/:subjectId?effective_from=`  
 «закрыть» запись (поставить effective_to)

### Получить список предметов направления:

`GET /orgs/:orgId/directions/:directionId/subjects?q=&only_active=&page=&limit=`

суперадмин, админ, сотрудник учебной организации, преподаватель, студент

`q` - поиск по `subjects.name/short_code`  
 `only_active` - `0|1` (по умолчанию 1 — показывать только текущие записи с `effective_to IS NULL`)  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `directionId` - целое число
  - `q` - строка (если передали)
  - `only_active` - `0|1` , по умолчанию 1
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit`- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `direction_id` существует и принадлежит той же организации

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `q` - `string[0..100]` - `trim`
    - `only_active` - 0\|1
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `q` - `string[0..100]` - `trim`
    - `only_active` - 0\|1
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "total": 3,
  "page": 1,
  "limit": 50,
  "direction_subjects": [
    {
      "subject": {
        "id": 108,
        "name": "React",
        "short_code": "react"
      },
      "mandatory": true,
      "sort_order": 10,
      "effective_from": "2025-10-01",
      "effective_to": null
    }
  ]
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
  "message": "Permission denied: You are not allowed to view list of subjects of the direction in this organization."
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
SET @page  = GREATEST(COALESCE(:page, 1), 1);
SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
SET @offset = (@page - 1) * @limit;

--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка направления
SELECT 1 FROM directions
WHERE id = :direction_id AND org_id = :org_id LIMIT 1;

--total
SELECT COUNT(*) AS total
FROM direction_subjects
JOIN subjects ON subjects.id = direction_subjects.subject_id
WHERE subjects.org_id = :org_id
  AND direction_subjects.direction_id = :direction_id
  AND (COALESCE(:only_active, 1) = 0 OR direction_subjects.effective_to IS NULL)
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR subjects.name LIKE CONCAT('%', :q, '%')
    OR subjects.short_code LIKE CONCAT('%', :q, '%')
  );

--page
SELECT
  subjects.id AS subject_id, subjects.name, subjects.short_code,
  direction_subjects.mandatory, direction_subjects.sort_order, direction_subjects.effective_from, direction_subjects.effective_to
FROM direction_subjects
JOIN subjects ON subjects.id = direction_subjects.subject_id
WHERE subjects.org_id = :org_id
  AND direction_subjects.direction_id = :direction_id
  AND (COALESCE(:only_active, 1) = 0 OR direction_subjects.effective_to IS NULL)
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR subjects.name LIKE CONCAT('%', :q, '%')
    OR subjects.short_code LIKE CONCAT('%', :q, '%')
  )
ORDER BY direction_subjects.sort_order IS NULL, direction_subjects.sort_order ASC, subjects.name ASC, subjects.id ASC
LIMIT :limit OFFSET :offset;

```

### Получить одну запись (текущую или по дате начала):

`GET /orgs/:orgId/directions/:directionId/subjects/:subjectId?effective_from=YYYY-MM-DD`

суперадмин, админ, сотрудник учебной организации, учитель, студент

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `directionId` - целое число
  - `subjectId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - если `effective_from` не передан — возвращаем «текущую», где `effective_to IS NULL`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

- **Responses**:

  - **200 OK**

```json
{
  "subject": {
    "id": 108,
    "name": "React",
    "short_code": "react"
  },
  "mandatory": true,
  "sort_order": 10,
  "effective_from": "2025-10-01",
  "effective_to": null
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
  "message": "Permission denied: You are not allowed to view a subject of the direction in this organization."
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
{ "message": "Subject not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Выборка
SELECT
  subjects.id AS subject_id, subjects.name, subjects.short_code,
  direction_subjects.mandatory, direction_subjects.sort_order, direction_subjects.effective_from, direction_subjects.effective_to
FROM direction_subjects
JOIN subjects ON subjects.id = direction_subjects.subject_id
WHERE subjects.org_id = :org_id
  AND direction_subjects.direction_id = :direction_id
  AND direction_subjects.subject_id = :subject_id
  AND (
    (:effective_from IS NULL AND direction_subjects.effective_to IS NULL)
    OR (:effective_from IS NOT NULL AND direction_subjects.effective_from = :effective_from)
  )
LIMIT 1;

```

### Добавить предмет в направление:

`POST /orgs/:orgId/directions/:directionId/subjects`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "subject_id": 108,
  "mandatory": true,
  "sort_order": 10,
  "effective_from": "2025-10-01"
}
```

- **Бизнес-правила:**

  - `directionId` принадлежит той же организации
  - `subject_id` принадлежит той же организации
  - Нельзя пересекать периоды для одной пары `(direction_id, subject_id)` (проверка перекрытия по датам)
  - `effective_from` обязателен;
  - `effective_to` не задается при создании (текущее состояние)
  - Синхронизация в группы: при создании записи добавляем этот предмет в активные группы данного направления в `group_subjects` c `source='direction'`

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
    - `effective_from` - `YYYY-MM-DD` - обязательное поле
    - `mandatory` - `boolean`
    - `sort_order` - число

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `effective_from` - `YYYY-MM-DD` - обязательное поле
    - `mandatory` - `boolean`
    - `sort_order` - число

  - DB:

    - `(direction_id, subject_id)` - проверка на пересечения

- **Responses**:

  - **201 Created** предмет в направление добавлен

```json
{
  "direction_id": 101,
  "subject_id": 108,
  "mandatory": true,
  "sort_order": 10,
  "effective_from": "2025-10-01",
  "effective_to": null
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: directionId must be integer" }
```

```json
{ "message": "effective_from is required" }
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
  "message": "Permission denied: You are not allowed to create a subject of the direction in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Direction not found" }
```

- **409 Conflict** пересечение периода

```json
{
  "message": "Period overlap: this subject is already assigned to the direction for an active or overlapping period. Close or adjust the existing period before creating a new one"
}
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка направления - принадлежит той же организации
SELECT 1 FROM directions
WHERE id = :direction_id AND org_id = :org_id
LIMIT 1;

--Проверка предмета - принадлежит той же организации
SELECT 1 FROM subjects
WHERE id = :subject_id AND org_id = :org_id
LIMIT 1;

-- нет пересечений (должно не находиться текущих/пересекающих)
SELECT 1
FROM direction_subjects
WHERE direction_id = :direction_id
  AND subject_id   = :subject_id
  AND (effective_to IS NULL OR effective_to >= :effective_from)
LIMIT 1;
--если вернулось 1 -> 409 Conflict (пересечение периода)

--Создание записи
INSERT INTO direction_subjects
(direction_id, subject_id, mandatory, sort_order, effective_from, effective_to)
VALUES (:direction_id, :subject_id, :mandatory, :sort_order, :effective_from, NULL);

--Синхронизация в группы
INSERT INTO group_subjects (org_id, group_id, subject_id, added_at, source)
SELECT :org_id, groups.id, :subject_id, NOW(), 'direction'
FROM groups
WHERE groups.org_id = :org_id
  AND groups.direction_id = :direction_id
  AND groups.status IN ('planned','active')
  AND NOT EXISTS (
    SELECT 1 FROM group_subjects
    WHERE group_subjects.group_id = groups.id AND group_subjects.subject_id = :subject_id);


--Для ответа
SELECT
  direction_subjects.direction_id,
  direction_subjects.subject_id,
  direction_subjects.mandatory,
  direction_subjects.sort_order,
  direction_subjects.effective_from,
  direction_subjects.effective_to
FROM direction_subjects
WHERE direction_subjects.direction_id = :direction_id
  AND direction_subjects.subject_id   = :subject_id
  AND direction_subjects.effective_from = :effective_from
LIMIT 1;

```

### Обновить запись:

`PUT /orgs/:orgId/directions/:directionId/subjects/:subjectId?effective_from=`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "subject_id": 108,
  "mandatory": false,
  "sort_order": 10,
  "effective_from": "2025-10-01"
}
```

- **Бизнес-правила:**

  - `effective_from` в `URL` идентифицирует версию записи, если не передан редактируем текущую, `effective_to IS NULL`
  - Запрещено менять `subject_id`, `direction_id` и сам `effective_from`
  - Если ставим `effective_to`, оно больше `effective_from` и не должно пересекаться со следующими версиями

- **Path / Query params:**

  - `orgId` - целое число
  - `directionId` - целое число
  - `effective_from` - `YYYY-MM-DD`

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `effective_from` - `YYYY-MM-DD`
    - `mandatory` - `boolean`
    - `sort_order` - число

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `effective_from` - `YYYY-MM-DD`
    - `mandatory` - `boolean`
    - `sort_order` - число

  - DB:

    - `(direction_id, subject_id)` - проверка на пересечения

- **Responses**:

  - **200 OK**

```json
{
  "direction_id": 101,
  "subject_id": 108,
  "mandatory": true,
  "sort_order": 10,
  "effective_from": "2025-10-01",
  "effective_to": null
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: directionId must be integer" }
```

```json
{
  "message": "Immutable field update is not allowed. You cannot change subject_id, direction_id or effective_from."
}
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
  "message": "Permission denied: You are not allowed to edit a subject of the direction in this organization."
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
{ "message": "Subject not found" }
```

- **409 Conflict** пересечение периода

```json
{ "message": "Groups code '281025-wdm' is already in use in this organization" }
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

--Проверка предмета - принадлежит той же организации
SELECT 1 FROM subjects
WHERE id = :subject_id AND org_id = :org_id LIMIT 1;

--Проверка нет пересечений (должно не находиться текущих/пересекающих)
SELECT 1
FROM direction_subjects
WHERE direction_id = :direction_id
  AND subject_id   = :subject_id
  AND (effective_to IS NULL OR effective_to >= :effective_from)
LIMIT 1;
--если вернулось 1 -> 409 Conflict (пересечение периода)

--Обновление
UPDATE direction_subjects
SET mandatory = COALESCE(:mandatory, mandatory),
    sort_order = COALESCE(:sort_order, sort_order),
    effective_to = COALESCE(:effective_to, effective_to)
WHERE direction_id = :direction_id
  AND subject_id   = :subject_id
  AND (
    (:effective_from IS NULL AND effective_to IS NULL)
    OR (:effective_from IS NOT NULL AND effective_from = :effective_from)
  );

```

### Закрыть запись:

`DELETE /orgs/:orgId/directions/:directionId/subjects/:subjectId?effective_from=`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `directionId` - целое число
  - `subjectId` - целое число
  - `effective_from` - `YYYY-MM-DD`

- **Бизнес-правила:**

  - Мягко закрываем: `effective_to = CURDATE()` (если запись текущая)

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**

```json
{
  "direction_id": 101,
  "subject_id": 108,
  "mandatory": true,
  "sort_order": 10,
  "effective_from": "2025-10-01",
  "effective_to": null
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: directionId must be integer" }
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
  "message": "Permission denied: You are not allowed to remove a subject of the direction in this organization."
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
{ "message": "Subject not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Закрыть запись
UPDATE direction_subjects
SET effective_to = COALESCE(effective_to, CURDATE())
WHERE direction_id = :direction_id
  AND subject_id   = :subject_id
  AND (
    (:effective_from IS NULL AND effective_to IS NULL)
    OR (:effective_from IS NOT NULL AND effective_from = :effective_from)
  );

--Удалить автосвязи там, где безопасно (нет назначений преподавателей)
DELETE group_subjects
FROM group_subjects
JOIN groups
  ON groups.id = group_subjects.group_id
LEFT JOIN teaching_assignments
  ON teaching_assignments.group_id = groups.id
 AND teaching_assignments.subject_id = group_subjects.subject_id
WHERE group_subjects.org_id = :org_id
  AND groups.direction_id = :direction_id
  AND group_subjects.subject_id = :subject_id
  AND group_subjects.source = 'direction'
  AND groups.status IN ('planned','active')
  AND teaching_assignments.id IS NULL;

--Перевести остальные в «ручные», заморозить в группах, где есть активность/TA: просто меняем источник
UPDATE group_subjects
JOIN groups
  ON groups.id = group_subjects.group_id
SET group_subjects.source = 'manual'
WHERE group_subjects.org_id = :org_id
  AND groups.direction_id = :direction_id
  AND group_subjects.subject_id = :subject_id
  AND group_subjects.source = 'direction';

```
