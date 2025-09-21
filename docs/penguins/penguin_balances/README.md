## Балансы penguin_balances

`GET /orgs/:orgId/students/:studentId/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=`  
получить баланс студента

`GET /orgs/:orgId/my/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=`  
получить свой баланс пингвинов (студент для себя)

`GET /orgs/:orgId/penguins/leaderboard?groupId=&subjectId=&directionId=&page=&limit=`  
получить лидборд (топ студентов)

### Получить баланс студента по id:

`GET /orgs/:orgId/students/:studentId/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=`

суперадмин, админ, преподаватель, сотрудник организации

`studentId` - id студента  
 `groupId` - фильтр по группе (опционально)  
 `subjectId` - фильтр по предмету (опционально)  
 `directionId` - фильтр по направлению (опционально)  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `studentId` - целое число
  - `groupId` - целое число
  - `subjectId` - целое число
  - `directionId` - целое число
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit`- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - Студент принадлежит этой организации

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `studentId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `studentId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "total": 1,
  "page": 1,
  "limit": 50,
  "balances": [
    {
      "group": {
        "id": 510,
        "code": "281025-wdm",
        "name": "Web-Development-2025-10"
      },
      "subject": {
        "id": 108,
        "name": "React"
      },
      "direction": {
        "id": 8,
        "name": "Web Development"
      },
      "total": 15
    }
  ]
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "Invalid path parameter: studentId must be integer" }
```

```json
{ "message": "Invalid path parameter: groupId must be integer" }
```

```json
{ "message": "Invalid path parameter: subjectId must be integer" }
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
  "message": "Permission denied: You are not allowed to view this student's penguin balances in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Student not found" }
```

```json
{ "message": "Group not found" }
```

```json
{ "message": "Subject not found" }
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

--Проверка студента
SELECT 1 FROM users
JOIN user_roles ON user_roles.org_id = :org_id AND user_roles.user_id = users.id AND user_roles.revoked_at IS NULL
JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'student'
WHERE users.id = :student_id AND users.status <> 'deleted'
LIMIT 1;


--total
SELECT COUNT(*) AS total
FROM penguin_balances
JOIN groups ON groups.id = penguin_balances.group_id
JOIN subjects ON subjects.id = penguin_balances.subject_id
JOIN directions ON directions.id = penguin_balances.direction_id
WHERE penguin_balances.org_id = :org_id
  AND penguin_balances.student_id = :student_id
  AND (:group_id IS NULL OR penguin_balances.group_id = :group_id)
  AND (:subject_id IS NULL OR penguin_balances.subject_id = :subject_id)
  AND (:direction_id IS NULL OR penguin_balances.direction_id = :direction_id);

--page
SELECT
  penguin_balances.total,
  groups.id AS group_id, groups.code AS group_code, groups.name AS group_name,
  subjects.id AS subject_id, subjects.name AS subject_name,
  directions.id AS direction_id, directions.name AS direction_name
FROM penguin_balances
JOIN groups ON groups.id = penguin_balances.group_id
JOIN subjects ON subjects.id = penguin_balances.subject_id
JOIN directions ON directions.id = penguin_balances.direction_id
WHERE penguin_balances.org_id = :org_id
  AND penguin_balances.student_id = :student_id
  AND (:group_id IS NULL OR penguin_balances.group_id = :group_id)
  AND (:subject_id IS NULL OR penguin_balances.subject_id = :subject_id)
  AND (:direction_id IS NULL OR penguin_balances.direction_id = :direction_id)
ORDER BY penguin_balances.total DESC, subjects.name ASC, groups.name ASC
LIMIT @limit OFFSET @offset;

```

### Получить свой баланс пингвинов:

`GET /orgs/:orgId/my/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=`

студент (для себя)

`groupId` - фильтр по группе (опционально)  
 `subjectId` - фильтр по предмету (опционально)  
 `directionId` - фильтр по направлению (опционально)  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число
  - `subjectId` - целое число
  - `directionId` - целое число
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit`- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - Студент принадлежит этой организации

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "total": 1,
  "page": 1,
  "limit": 50,
  "balances": [
    {
      "group": {
        "id": 510,
        "code": "281025-wdm",
        "name": "Web-Development-2025-10"
      },
      "subject": {
        "id": 108,
        "name": "React"
      },
      "direction": {
        "id": 8,
        "name": "Web Development"
      },
      "total": 15
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

```json
{ "message": "Invalid path parameter: subjectId must be integer" }
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
{ "message": "Permission denied: You can only view your own penguin balances." }
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Student not found" }
```

```json
{ "message": "Group not found" }
```

```json
{ "message": "Subject not found" }
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

--Проверка студента  (берем из JWT)
SELECT 1 FROM users
JOIN user_roles ON user_roles.org_id = :org_id AND user_roles.user_id = users.id AND user_roles.revoked_at IS NULL
JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'student'
WHERE users.id = :current_user_id AND users.status <> 'deleted'
LIMIT 1;


--total
SELECT COUNT(*) AS total
FROM penguin_balances
JOIN groups ON groups.id = penguin_balances.group_id
JOIN subjects ON subjects.id = penguin_balances.subject_id
JOIN directions ON directions.id = penguin_balances.direction_id
WHERE penguin_balances.org_id = :org_id
  AND penguin_balances.student_id = :current_user_id
  AND (:group_id IS NULL OR penguin_balances.group_id = :group_id)
  AND (:subject_id IS NULL OR penguin_balances.subject_id = :subject_id)
  AND (:direction_id IS NULL OR penguin_balances.direction_id = :direction_id);

--page
SELECT
  penguin_balances.total,
  groups.id AS group_id, groups.code AS group_code, groups.name AS group_name,
  subjects.id AS subject_id, subjects.name AS subject_name,
  directions.id AS direction_id, directions.name AS direction_name
FROM penguin_balances
JOIN groups ON groups.id = penguin_balances.group_id
JOIN subjects ON subjects.id = penguin_balances.subject_id
JOIN directions ON directions.id = penguin_balances.direction_id
WHERE penguin_balances.org_id = :org_id
  AND penguin_balances.student_id = :current_user_id
  AND (:group_id IS NULL OR penguin_balances.group_id = :group_id)
  AND (:subject_id IS NULL OR penguin_balances.subject_id = :subject_id)
  AND (:direction_id IS NULL OR penguin_balances.direction_id = :direction_id)
ORDER BY penguin_balances.total DESC, subjects.name ASC, groups.name ASC
LIMIT @limit OFFSET @offset;

```

### Получить лидборд (топ студентов):

`GET /orgs/:orgId/penguins/leaderboard?groupId=&subjectId=&directionId=&page=&limit=`

суперадмин, админ, преподаватель, сотрудник организации, студент

Один из фильтров обязателен:  
 `groupId+subjectId` - фильтр по группе и по предмету  
 `directionId+subjectId` - фильтр по направлению и предмету  
 `directionId` - фильтр по направлению и всем предметам суммарно  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число
  - `subjectId` - целое число
  - `directionId` - целое число
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
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "total": 1,
  "page": 1,
  "limit": 50,
  "leaderboard": [
    {
      "student": {
        "id": 3001,
        "full_name": "Alice Student"
      },
      "group": {
        "id": 510,
        "code": "281025-wdm",
        "name": "Web-Development-2025-10"
      },
      "subject": {
        "id": 108,
        "name": "React"
      },
      "total": 15
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

```json
{ "message": "Invalid path parameter: groupId must be integer" }
```

```json
{ "message": "Invalid path parameter: subjectId must be integer" }
```

```json
{
  "message": "At least one leaderboard scope is required groupId+subjectId or directionId+subjectId"
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
  "message": "Permission denied: You are not allowed to view this resource in this organization."
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

--Проверка группы
SELECT 1 FROM groups
WHERE id = :group_id AND org_id = :org_id
LIMIT 1;

--Проверка предмета
SELECT 1 FROM subjects
WHERE id = :subject_id AND org_id = :org_id
LIMIT 1;

--Проверка направления
SELECT 1 FROM directions
WHERE id = :direction_id AND org_id = :org_id
LIMIT 1;

--Вариант по groupId+subjectId

--total
SELECT COUNT(*) AS total
FROM penguin_balances
JOIN users ON users.id = penguin_balances.student_id
WHERE penguin_balances.org_id = :org_id
  AND penguin_balances.group_id = :group_id
  AND penguin_balances.subject_id = :subject_id
  AND users.status <> 'deleted';

--page
SELECT penguin_balances.student_id,
  users.full_name AS student_name,
  penguin_balances.group_id, groups.code, groups.name AS group_name,
  penguin_balances.subject_id, subjects.name AS subject_name,
  penguin_balances.total
FROM penguin_balances
JOIN users ON users.id = penguin_balances.student_id
JOIN groups ON groups.id = penguin_balances.group_id
JOIN subjects ON subjects.id = penguin_balances.subject_id
WHERE penguin_balances.org_id = :org_id
  AND penguin_balances.group_id = :group_id
  AND penguin_balances.subject_id = :subject_id
  AND users.status <> 'deleted'
ORDER BY penguin_balances.total DESC, users.full_name ASC, penguin_balances.student_id ASC
LIMIT @limit OFFSET @offset;

--Вариант по directionId+subjectId

--total
SELECT COUNT(*) AS total
FROM penguin_balances
JOIN users ON users.id = penguin_balances.student_id
WHERE penguin_balances.org_id = :org_id
  AND penguin_balances.direction_id = :direction_id
  AND penguin_balances.subject_id = :subject_id
  AND users.status <> 'deleted';

--page
SELECT penguin_balances.student_id,
  users.full_name AS student_name,
  penguin_balances.direction_id, directions.code, directions.name AS direction_name,
  penguin_balances.subject_id, subjects.name AS subject_name,
  penguin_balances.total
FROM penguin_balances
JOIN users ON users.id = penguin_balances.student_id
JOIN directions ON directions.id = penguin_balances.direction_id
JOIN subjects ON subjects.id = penguin_balances.subject_id
WHERE penguin_balances.org_id = :org_id
  AND penguin_balances.direction_id = :direction_id
  AND penguin_balances.subject_id = :subject_id
  AND users.status <> 'deleted'
ORDER BY penguin_balances.total DESC, users.full_name ASC, penguin_balances.student_id ASC
LIMIT @limit OFFSET @offset;

--Вариант по directionId

--total
SELECT COUNT(*) AS total
FROM (
  SELECT penguin_balances.student_id
  FROM penguin_balances
  JOIN users
    ON users.id = penguin_balances.student_id
   AND users.status <> 'deleted'
  WHERE penguin_balances.org_id = :org_id
    AND penguin_balances.direction_id = :direction_id
  GROUP BY penguin_balances.student_id
) t;

--page
SELECT
  penguin_balances.student_id,
  users.full_name AS student_name,
  penguin_balances.direction_id,
  directions.code AS direction_code,
  directions.name AS direction_name,
  SUM(penguin_balances.total) AS total
FROM penguin_balances
JOIN users
  ON users.id = penguin_balances.student_id
 AND users.status <> 'deleted'
JOIN directions
  ON directions.id = penguin_balances.direction_id
 AND directions.org_id = :org_id
WHERE penguin_balances.org_id = :org_id
  AND penguin_balances.direction_id = :direction_id
GROUP BY
  penguin_balances.student_id, users.full_name,
  penguin_balances.direction_id, directions.code, directions.name
ORDER BY total DESC, users.full_name ASC, penguin_balances.student_id ASC
LIMIT @limit OFFSET @offset;

```
