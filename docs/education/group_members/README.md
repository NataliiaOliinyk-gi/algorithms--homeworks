## Участники групп group_members

`GET /orgs/:orgId/groups/:groupId/members?q=&status=&page=&limit=` получить список студентов группы

`GET /orgs/:orgId/groups/:groupId/members/:studentId` получить одного участника

`POST /orgs/:orgId/groups/:groupId/members` добавить студента в группу

`PUT /orgs/:orgId/groups/:groupId/members/:studentId` изменить статус/даты

`DELETE /orgs/:orgId/groups/:groupId/members/:studentId` исключить студента из группы

### Получить список студентов группы:

`GET /orgs/:orgId/groups/:groupId/members?q=&status=&page=&limit=`

суперадмин, админ, сотрудник учебной организации, преподаватель, студент

`q` - поиск по `users.full_name/email`  
 `status` - `active|inactive|archived` по умолчанию все, кроме `archived`  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице, по умолчанию 50, ≤ 200

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число
  - `q` - строка (если передали)
  - `status` - `active|inactive|archived`, по умолчанию все, кроме `archived`
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
    - `status` - `active|inactive|archived`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `q` - `string[0..100]` - `trim`
    - `status` - `active|inactive|archived`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "total": 1,
  "page": 1,
  "limit": 50,
  "group_members": [
    {
      "group": {
        "id": 112,
        "direction_id": 108,
        "name": "Web-Development-2025-10",
        "code": "281025-wdm"
      },
      "student": {
        "id": 3001,
        "email": "student@example.com",
        "full_name": "Alice Student",
        "status": "active"
      },
      "membership": {
        "status": "active",
        "joined_at": "2025-09-10T09:00:00Z",
        "left_at": null
      }
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
  "message": "Permission denied: You are not allowed to view list of members of the group in this organization."
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
WHERE id = :group_id AND org_id = :org_id
LIMIT 1;

--total
SELECT COUNT(*) AS total
FROM group_members
JOIN users ON users.id = group_members.student_id
JOIN groups ON groups.id = group_members.group_id
WHERE groups.id = :group_id
  AND groups.org_id = :org_id
  AND (
        (COALESCE(NULLIF(TRIM(:status), ''), NULL) IS NULL AND group_members.status <> 'archived')
     OR (COALESCE(NULLIF(TRIM(:status), ''), NULL) IS NOT NULL AND group_members.status = :status)
      )

  AND users.status <> 'deleted'
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR users.full_name LIKE CONCAT('%', :q, '%')
    OR users.email     LIKE CONCAT('%', :q, '%')
  );

--page
SELECT
  groups.id            AS group_id,
  groups.direction_id  AS group_direction_id,
  groups.name          AS group_name,
  groups.code          AS group_code,
  users.id             AS student_id,
  users.email,
  users.full_name,
  users.status         AS user_status,
  group_members.status AS membership_status,
  group_members.joined_at,
  group_members.left_at
FROM group_members
JOIN users ON users.id = group_members.student_id
JOIN groups ON groups.id = group_members.group_id
WHERE groups.id = :group_id
  AND groups.org_id = :org_id
  AND users.status <> 'deleted'
  AND (
        (COALESCE(NULLIF(TRIM(:status), ''), NULL) IS NULL AND group_members.status <> 'archived')
     OR (COALESCE(NULLIF(TRIM(:status), ''), NULL) IS NOT NULL AND group_members.status = :status)
      )
  AND (
        COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
     OR users.full_name LIKE CONCAT('%', :q, '%')
     OR users.email     LIKE CONCAT('%', :q, '%')
      )
ORDER BY users.full_name ASC, users.id ASC
LIMIT @limit OFFSET @offset;

```

### Получить одного участника:

`GET /orgs/:orgId/groups/:groupId/members/:studentId`

суперадмин, админ, сотрудник учебной организации, учитель, студент

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число
  - `studentId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `studentId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `studentId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

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
  "student": {
    "id": 3001,
    "email": "student@example.com",
    "full_name": "Alice Student",
    "status": "active"
  },
  "membership": {
    "status": "active",
    "joined_at": "2025-09-10T09:00:00Z",
    "left_at": null
  }
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
{ "message": "Invalid path parameter: studentId must be integer" }
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
  "message": "Permission denied: You are not allowed to view а member of the group in this organization"
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
{ "message": "Student not found" }
```

```json
{ "message": "Group member not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1
FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка группы
SELECT 1
FROM groups
WHERE id = :group_id AND org_id = :org_id
LIMIT 1;

--Выборка
SELECT
  groups.id            	AS group_id,
  groups.direction_id  	AS group_direction_id,
  groups.name          	AS group_name,
  groups.code          	AS group_code,
  users.id            	AS student_id,
  users.email,
  users.full_name,
  users.status        	AS user_status,
  group_members.status    	AS membership_status,
  group_members.joined_at,
  group_members.left_at
FROM group_members
JOIN users ON users.id = group_members.student_id
JOIN groups ON groups.id = group_members.group_id
WHERE groups.id = :group_id
  AND groups.org_id = :org_id
  AND group_members.student_id = :student_id
LIMIT 1;

```

### Добавить студента в группу:

`POST /orgs/:orgId/groups/:groupId/members`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "student_id": 3001,
  "joined_at": "2025-09-10T09:00:00Z"
}
```

- **Бизнес-правила:**

  - Студент должен иметь активную роль `student` в этой организации
  - Лимит плана: в группе активных студентов не больше, чем `subscription_plans.max_students_per_group`, учитываем `status='active'`
  - Повторное добавление - обновить существующую запись до `status='active'`, `left_at=NULL` (идемпотентность)

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
    - `student_id` - /^\[1-9\]\d{0,9}\$/ - обязательное поле

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `student_id` - /^\[1-9\]\d{0,9}\$/ - обязательное поле, число

- **Responses**:

  - **201 Created** студент в группу добавлен

```json
{
  "group": {
    "id": 112,
    "direction_id": 108,
    "name": "Web-Development-2025-10",
    "code": "281025-wdm"
  },
  "student": {
    "id": 3001,
    "email": "student@example.com",
    "full_name": "Alice Student",
    "status": "active"
  },
  "membership": {
    "status": "active",
    "joined_at": "2025-09-10T09:00:00Z",
    "left_at": null
  }
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
{ "message": "student_id is required" }
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
  "message": "Permission denied: You are not allowed to add а member of the group in this organization."
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
{ "message": "Student not found" }
```

- **409 Conflict** превышен лимит (согласно тарифного плана)

```json
{ "message": "Plan limits exceeded for group members." }
```

- **409 Conflict** нет активной роли student в организации

```json
{
  "message": "User does not have an active 'student' role in this organization."
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

--Проверка роли студента
SELECT 1
FROM user_roles
JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'student'
WHERE user_roles.org_id = :org_id AND user_roles.user_id = :student_id AND user_roles.revoked_at IS NULL
LIMIT 1;

--Проверка лимита группы
SELECT
  subscription_plans.max_students_per_group AS max_allowed,
  (SELECT COUNT(*) FROM group_members WHERE group_id = :group_id AND status = 'active') AS currently_used,
  EXISTS(
    SELECT 1 FROM group_members
    WHERE group_id = :group_id AND student_id = :student_id AND status = 'active'
  ) AS is_already_active
FROM org_subscriptions
JOIN subscription_plans ON subscription_plans.id = org_subscriptions.plan_id
WHERE org_subscriptions.org_id = :org_id AND org_subscriptions.is_current = 1
LIMIT 1;
--если is_already_active=0 и currently_used >= max_allowed => 409

--Добавление/реактивация
INSERT INTO group_members (group_id, student_id, status, joined_at, left_at)
VALUES (:group_id, :student_id, 'active', COALESCE(:joined_at, NOW()), NULL)
ON DUPLICATE KEY UPDATE
  status    = 'active',
  joined_at = COALESCE(VALUES(joined_at), joined_at),
  left_at   = NULL;

--Ответ
SELECT
  groups.id            	AS group_id,
  groups.direction_id  	AS group_direction_id,
  groups.name          	AS group_name,
  groups.code          	AS group_code,
  users.id            	AS student_id,
  users.email,
  users.full_name,
  users.status        	AS user_status,
  group_members.status  AS membership_status,
  group_members.joined_at,
  group_members.left_at
FROM group_members
JOIN users ON users.id = group_members.student_id
JOIN groups ON groups.id = group_members.group_id
WHERE groups.id = :group_id
  AND groups.org_id = :org_id
  AND group_members.student_id = :student_id
LIMIT 1;

```

### Обновить статус/даты:

`PUT /orgs/:orgId/groups/:groupId/members/:studentId`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "status": "inactive",
  "left_at": "2026-01-20T10:00:00Z"
}
```

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число
  - `studentId` - целое число

- **Бизнес-правила:**

  - Если переводим в `active`, также проверяем лимит плана

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `student_id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `status` - `active / inactive / archived`
    - `left_at` - `YYYY-MM-DD`
    - `joined_at` - `YYYY-MM-DD`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `student_id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `status` - `active / inactive / archived`
    - `left_at` - `YYYY-MM-DD`
    - `joined_at` - `YYYY-MM-DD`

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
  "student": {
    "id": 3001,
    "email": "student@example.com",
    "full_name": "Alice Student",
    "status": "active"
  },
  "membership": {
    "status": "active",
    "joined_at": "2025-09-10T09:00:00Z",
    "left_at": null
  }
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
{ "message": "Invalid path parameter: studentId must be integer" }
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
  "message": "Permission denied: You are not allowed to edit а member of the group in this organization."
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
{ "message": "Student not found" }
```

```json
{ "message": "Group member not found" }
```

- **409 Conflict** превышен лимит

```json
{ "message": "Plan limits exceeded for group members." }
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

--Проверка роли студента
SELECT 1
FROM user_roles
JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'student'
WHERE user_roles.org_id = :org_id AND user_roles.user_id = :student_id AND user_roles.revoked_at IS NULL
LIMIT 1;

--Проверка лимита группы если :status = 'active'
SELECT
  subscription_plans.max_students_per_group AS max_allowed,
  (SELECT COUNT(*) FROM group_members WHERE group_id = :group_id AND status = 'active') AS currently_used,
  EXISTS(
    SELECT 1 FROM group_members
    WHERE group_id = :group_id AND student_id = :student_id AND status = 'active'
  ) AS is_already_active
FROM org_subscriptions
JOIN subscription_plans ON subscription_plans.id = org_subscriptions.plan_id
WHERE org_subscriptions.org_id = :org_id AND org_subscriptions.is_current = 1
LIMIT 1;
-- если is_already_active=0 и currently_used >= max_allowed => 409

--Обновление
UPDATE group_members
SET status    = COALESCE(:status, status),
    joined_at = COALESCE(:joined_at, joined_at),
    left_at   = COALESCE(
                  CASE
                    WHEN :status = 'archived' THEN COALESCE(:left_at, NOW())
                    ELSE :left_at
                  END,
                  left_at
                )
WHERE group_id   = :group_id
  AND student_id = :student_id
  AND EXISTS (SELECT 1 FROM groups WHERE groups.id = :group_id AND groups.org_id = :org_id);

--Ответ
SELECT
  groups.id            	AS group_id,
  groups.direction_id  	AS group_direction_id,
  groups.name          	AS group_name,
  groups.code          	AS group_code,
  users.id            	AS student_id,
  users.email,
  users.full_name,
  users.status        	AS user_status,
  group_members.status  AS membership_status,
  group_members.joined_at,
  group_members.left_at
FROM group_members
JOIN users ON users.id = group_members.student_id
JOIN groups ON groups.id = group_members.group_id
WHERE groups.id = :group_id
  AND groups.org_id = :org_id
  AND group_members.student_id = :student_id
LIMIT 1;

```

### Исключить студента из группы:

`DELETE /orgs/:orgId/groups/:groupId/members/:studentId`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число
  - `studentId` - целое число

- **Бизнес-правила:**

  - Мягкая архивация: `status='archived'`

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `student_id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `student_id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

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
  "student": {
    "id": 3001,
    "email": "student@example.com",
    "full_name": "Alice Student",
    "status": "active"
  },
  "membership": {
    "status": "active",
    "joined_at": "2025-09-10T09:00:00Z",
    "left_at": "2026-01-20T10:00:00Z"
  }
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
{ "message": "Invalid path parameter: studentId must be integer" }
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
  "message": "Permission denied: You are not allowed to remove а member of the group in this organization."
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
{ "message": "Student not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Архивация
UPDATE group_members
JOIN groups ON groups.id = group_members.group_id
SET group_members.status  = 'archived',
    group_members.left_at = COALESCE(gm.left_at, NOW())
WHERE group_members.group_id   = :group_id
  AND group_members.student_id = :student_id
  AND groups.org_id      = :org_id;

--Ответ
SELECT
  groups.id            	AS group_id,
  groups.direction_id  	AS group_direction_id,
  groups.name          	AS group_name,
  groups.code          	AS group_code,
  users.id            	AS student_id,
  users.email,
  users.full_name,
  users.status        	AS user_status,
  group_members.status    	AS membership_status,
  group_members.joined_at,
  group_members.left_at
FROM group_members
JOIN users ON users.id = group_members.student_id
JOIN groups ON groups.id = group_members.group_id
WHERE groups.id = :group_id
  AND groups.org_id = :org_id
  AND group_members.student_id = :student_id
LIMIT 1;

```
