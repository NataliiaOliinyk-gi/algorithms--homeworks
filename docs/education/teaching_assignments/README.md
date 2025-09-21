## Назначения преподавателей teaching_assignments

`GET /orgs/:orgId/teaching-assignments?groupId=&teacherId=&subjectId=&page=&limit=`
получить список назначений

`GET /orgs/:orgId/teaching-assignments/:id` получить назначение

`POST /orgs/:orgId/teaching-assignments` создать назначение

`PUT /orgs/:orgId/teaching-assignments/:id` изменить назначение

`DELETE /orgs/:orgId/teaching-assignments/:id` удалить назначение

### Получить список назначений:

`GET /orgs/:orgId/teaching-assignments?groupId=&teacherId=&subjectId=&page=&limit=`

суперадмин, админ, сотрудник учебной организации, преподаватель

`groupId` - фильтр по группе (опционально)  
 `teacherId` - фильтр по преподавателю (опционально)  
 `subjectId` - фильтр по предмету (опционально)  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число
  - `teacherId` - целое число
  - `subjectId` - целое число
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit`- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `groupId` существует и принадлежит той же организации
  - `subjectId` существует и принадлежит той же организации
  - `teacherId` преподаватель должен иметь активную роль `teacher` в этой организации

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `teacherId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `teacherId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "total": 1,
  "page": 1,
  "limit": 50,
  "teaching_assignments": [
    {
      "id": 7001,
      "teacher": {
        "id": 1054,
        "full_name": "Ivan Petrov"
      },
      "subject": {
        "id": 108,
        "name": "React"
      },
      "group": {
        "id": 510,
        "code": "281025-wdm",
        "name": "Web-Development-2025-10"
      },
      "assigned_at": "2025-09-02T10:11:12Z"
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
{ "message": "Invalid path parameter: teacherId must be integer" }
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
  "message": "Permission denied: You are not allowed to view teaching assignments in this organization."
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
{ "message": "Teacher not found" }
```

```json
{ "message": "Subject not found" }
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

--Проверка роли преподавателя
SELECT 1
FROM user_roles
JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'teacher'
WHERE user_roles.org_id = :org_id AND user_roles.user_id = :teacher_id AND user_roles.revoked_at IS NULL
LIMIT 1;

--Проверка предмета
SELECT 1 FROM subjects
WHERE id = :subject_id AND org_id = :org_id
LIMIT 1;

--total
SELECT COUNT(*) AS total
FROM teaching_assignments
JOIN users ON users.id = teaching_assignments.teacher_id
JOIN subjects ON subjects.id = teaching_assignments.subject_id
JOIN groups ON groups.id = teaching_assignments.group_id
WHERE teaching_assignments.org_id = :org_id
  AND users.status <> 'deleted'
  AND ( :group_id   IS NULL
OR teaching_assignments.group_id = :group_id )
  AND ( :teacher_id IS NULL
OR teaching_assignments.teacher_id = :teacher_id )
  AND ( :subject_id IS NULL
OR teaching_assignments.subject_id = :subject_id );

--page
SELECT
  teaching_assignments.id, teaching_assignments.assigned_at,
  users.id AS teacher_id, users.full_name AS teacher_name,
  subjects.id AS subject_id, subjects.name AS subject_name,
  groups.id AS group_id, groups.code,groups.name AS group_name
FROM teaching_assignments
JOIN users ON users.id = teaching_assignments.teacher_id
JOIN subjects ON subjects.id = teaching_assignments.subject_id
JOIN groups ON groups.id = teaching_assignments.group_id
WHERE teaching_assignments.org_id = :org_id
  AND users.status <> 'deleted'
  AND ( :group_id   IS NULL
OR teaching_assignments.group_id = :group_id )
  AND ( :teacher_id IS NULL
OR teaching_assignments.teacher_id = :teacher_id )
  AND ( :subject_id IS NULL
OR teaching_assignments.subject_id = :subject_id )
ORDER BY teaching_assignments.id DESC
LIMIT :limit OFFSET :offset;

```

### Получить назначение:

`GET /orgs/:orgId/teaching-assignments/:id`

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
  "id": 7001,
  "teacher": {
    "id": 1054,
    "full_name": "Ivan Petrov"
  },
  "subject": {
    "id": 108,
    "name": "React"
  },
  "group": {
    "id": 510,
    "code": "281025-wdm",
    "name": "Web-Development-2025-10"
  },
  "assigned_at": "2025-09-02T10:11:12Z"
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
  "message": "Permission denied: You are not allowed to view this teaching assignment in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Teaching assignment not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Выборка
SELECT
  teaching_assignments.id, teaching_assignments.assigned_at,
  users.id AS teacher_id, users.full_name AS teacher_name,
  subjects.id AS subject_id, subjects.name AS subject_name,
  groups.id AS group_id, groups.code, groups.name AS group_name
FROM teaching_assignments
JOIN users ON users.id = teaching_assignments.teacher_id
JOIN subjects ON subjects.id = teaching_assignments.subject_id
JOIN groups ON groups.id = teaching_assignments.group_id
WHERE teaching_assignments.org_id = :org_id
  AND teaching_assignments.id = :id
  AND users.status <> 'deleted'
LIMIT 1;

```

### Создать назначение:

`POST /orgs/:orgId/teaching-assignments`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "teacher_id": 1054,
  "subject_id": 108,
  "group_id": 510,
  "assigned_at": "2025-09-02T10:11:12Z"
}
```

- **Бизнес-правила:**

  - Преподаватель имеет активную роль `teacher` в этой организации
  - `group_id` принадлежит той же организации
  - `subject_id` принадлежит той же организации и должен быть назначен группе (`group_subjects` содержит `(group_id,subject_id)`)
  - Уникальность `(teacher_id, subject_id, group_id)`

- **Path / Query params:**

  - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `teacher_id` - /^\[1-9\]\d{0,9}\$/ - обязательное поле
    - `subject_id` - /^\[1-9\]\d{0,9}\$/ - обязательное поле
    - `group_id` - /^\[1-9\]\d{0,9}\$/ - обязательное поле
    - `assigned_at` - `YYYY-MM-DD`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `teacher_id` - /^\[1-9\]\d{0,9}\$/ - обязательное поле
    - `subject_id` - /^\[1-9\]\d{0,9}\$/ - обязательное поле
    - `group_id` - /^\[1-9\]\d{0,9}\$/ - обязательное поле
    - `assigned_at` - `YYYY-MM-DD`

  - DB:

    - `(teacher_id, subject_id, group_id)` - `UNIQUE` проверка уникальности
    - `(group_id,subject_id)` - `group_subjects` проверка связи

- **Responses**:

  - **201 Created** преподаватель назначен на предмет группе

```json
{
  "id": 7001,
  "teacher": {
    "id": 1054,
    "full_name": "Ivan Petrov"
  },
  "subject": {
    "id": 108,
    "name": "React"
  },
  "group": {
    "id": 510,
    "code": "281025-wdm",
    "name": "Web-Development-2025-10"
  },
  "assigned_at": "2025-09-02T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "teacher_id is require" }
```

```json
{ "message": "subject_id is required" }
```

```json
{ "message": "group_id is required" }
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
  "message": "Permission denied: You are not allowed to create teaching assignments in this organization."
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
{ "message": "Teacher not found" }
```

```json
{ "message": "Subject not found" }
```

- **409 Conflict** нет активной роли teacher в организации

```json
{
  "message": "User does not have an active 'teacher' role in this organization."
}
```

- **409 Conflict** у предмета нет активной связки с группой

```json
{
  "message": "Subject is not assigned to the target group. Add the subject to the group before creating the teaching assignment"
}
```

- **409 Conflict** дубликат

```json
{
  "message": "Duplicate assignment: this teacher is already assigned to this subject in this group."
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
WHERE id = :group_id AND org_id = :org_id
LIMIT 1;

--Проверка роли преподавателя
SELECT 1
FROM user_roles
JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'teacher'
WHERE user_roles.org_id = :org_id AND user_roles.user_id = :teacher_id AND user_roles.revoked_at IS NULL
LIMIT 1;

--Проверка предмета
SELECT 1 FROM subjects
WHERE id = :subject_id AND org_id = :org_id
LIMIT 1;

--Проверка предмета на назначение группе
SELECT 1 FROM group_subjects
WHERE org_id = :org_id
  AND group_id = :group_id
  AND subject_id = :subject_id
LIMIT 1;

--Проверка на уникальность
SELECT 1
FROM teaching_assignments
WHERE org_id = :org_id
  AND teacher_id = :teacher_id
  AND subject_id = :subject_id
  AND group_id   = :group_id
LIMIT 1;

--Создание назначения
INSERT INTO teaching_assignments (org_id, teacher_id, subject_id, group_id, assigned_at)
VALUES (:org_id, :teacher_id, :subject_id, :group_id, COALESCE(:assigned_at, NOW()));

--Для ответа
SELECT
  teaching_assignments.id, teaching_assignments.assigned_at,
  users.id AS teacher_id, users.full_name AS teacher_name,
  subjects.id AS subject_id, subjects.name AS subject_name,
  groups.id AS group_id, groups.code, groups.name AS group_name
FROM teaching_assignments
JOIN users ON users.id = teaching_assignments.teacher_id
JOIN subjects ON subjects.id = teaching_assignments.subject_id
JOIN groups ON groups.id = teaching_assignments.group_id
WHERE teaching_assignments.org_id = :org_id
  AND teaching_assignments.id = LAST_INSERT_ID()
LIMIT 1;

```

### Изменить назначение:

`PUT /orgs/:orgId/teaching-assignments/:id`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "teacher_id": 1054,
  "subject_id": 108,
  "group_id": 510,
  "assigned_at": "2025-09-02T10:11:12Z"
}
```

- **Path / Query params:**

  - `orgId` - целое число

- **Бизнес-правила:**

  - При изменении `teacher_id` снова проверить активную роль `teacher`
  - При изменении `group_id` проверить принадлежность организации
  - При изменении `subject_id` проверить принадлежность организации и связь `group_subjects`
  - Проверить уникальность `(teacher_id, subject_id, group_id)` после изменений

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `teacher_id` - /^\[1-9\]\d{0,9}\$/
    - `subject_id` - /^\[1-9\]\d{0,9}\$/
    - `group_id` - /^\[1-9\]\d{0,9}\$/
    - `assigned_at` - `YYYY-MM-DD`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `teacher_id` - /^\[1-9\]\d{0,9}\$/
    - `subject_id` - /^\[1-9\]\d{0,9}\$/
    - `group_id` - /^\[1-9\]\d{0,9}\$/
    - `assigned_at` - `YYYY-MM-DD`

  - DB:

    - `(teacher_id, subject_id, group_id)` - `UNIQUE` проверка уникальности
    - `(group_id,subject_id)` - `group_subjects` проверка связи

- **Responses**:

  - **200 OK**

```json
{
  "id": 7001,
  "teacher": {
    "id": 1054,
    "full_name": "Ivan Petrov"
  },
  "subject": {
    "id": 108,
    "name": "React"
  },
  "group": {
    "id": 510,
    "code": "281025-wdm",
    "name": "Web-Development-2025-10"
  },
  "assigned_at": "2025-09-02T10:11:12Z"
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "teacher_id must be integer" }
```

```json
{ "message": "subject_id must be integer" }
```

```json
{ "message": "group_id must be integer" }
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
  "message": "Permission denied: You are not allowed to edit teaching assignments in this organization."
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
{ "message": "Teacher not found" }
```

```json
{ "message": "Subject not found" }
```

- **409 Conflict** нет активной роли teacher в организации

```json
{
  "message": "User does not have an active 'teacher' role in this organization."
}
```

- **409 Conflict** у предмета нет активной связки с группой

```json
{
  "message": "Subject is not assigned to the target group. Add the subject to the group before creating the teaching assignment"
}
```

- **409 Conflict** дубликат

```json
{
  "message": "Duplicate assignment: this teacher is already assigned to this subject in this group."
}
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Текущее состояние
--чтобы подставить в проверки, если поле не меняем
SELECT teacher_id, subject_id, group_id
INTO @old_teacher_id, @old_subject_id, @old_group_id
FROM teaching_assignments
WHERE id = :id AND org_id = :org_id
LIMIT 1;

SET @new_teacher_id = COALESCE(:teacher_id, @old_teacher_id);
SET @new_subject_id = COALESCE(:subject_id, @old_subject_id);
SET @new_group_id   = COALESCE(:group_id,   @old_group_id);

--Проверки под новые значения

--Проверка группы
SELECT 1 FROM groups
WHERE id = @new_group_id AND org_id = :org_id
LIMIT 1;

--Проверка роли преподавателя
SELECT 1
FROM user_roles
JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'teacher'
WHERE user_roles.org_id = :org_id
   AND user_roles.user_id = @new_teacher_id
   AND user_roles.revoked_at IS NULL
LIMIT 1;

--Проверка предмета
SELECT 1 FROM subjects
WHERE id = @new_subject_id AND org_id = :org_id
LIMIT 1;

--Предмет назначен группе
SELECT 1 FROM group_subjects
WHERE org_id = :org_id
  AND group_id = @new_group_id
  AND subject_id = @new_subject_id
LIMIT 1;

--Уникальность на новые значения (исключая текущую запись)
SELECT 1
FROM teaching_assignments
WHERE org_id = :org_id
  AND teacher_id = @new_teacher_id
  AND subject_id = @new_subject_id
  AND group_id   = @new_group_id
  AND id <> :id
LIMIT 1;

--Обновление назначения
UPDATE teaching_assignments
SET teacher_id = @new_teacher_id,
    subject_id = @new_subject_id,
    group_id   = @new_group_id,
    assigned_at = COALESCE(:assigned_at, assigned_at)
WHERE id = :id AND org_id = :org_id;

--Для ответа
SELECT
  teaching_assignments.id, teaching_assignments.assigned_at,
  users.id AS teacher_id, users.full_name AS teacher_name,
  subjects.id AS subject_id, subjects.name AS subject_name,
  groups.id AS group_id, groups.code, groups.name AS group_name
FROM teaching_assignments
JOIN users ON users.id = teaching_assignments.teacher_id
JOIN subjects ON subjects.id = teaching_assignments.subject_id
JOIN groups ON groups.id = teaching_assignments.group_id
WHERE teaching_assignments.org_id = :org_id
  AND teaching_assignments.id = :id
LIMIT 1;

```

### Удалить назначение:

`DELETE /orgs/:orgId/teaching-assignments/:id`

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
  "id": 7001,
  "teacher": {
    "id": 1054,
    "full_name": "Ivan Petrov"
  },
  "subject": {
    "id": 108,
    "name": "React"
  },
  "group": {
    "id": 510,
    "code": "281025-wdm",
    "name": "Web-Development-2025-10"
  },
  "assigned_at": "2025-09-02T10:11:12Z"
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
  "message": "Permission denied: You are not allowed to remove teaching assignments in this organization."
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
{ "message": "Teacher not found" }
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

--Для ответа
SELECT
  teaching_assignments.id, teaching_assignments.assigned_at,
  users.id AS teacher_id, users.full_name AS teacher_name,
  subjects.id AS subject_id, subjects.name AS subject_name,
  groups.id AS group_id, groups.code, groups.name AS group_name
FROM teaching_assignments
JOIN users ON users.id = teaching_assignments.teacher_id
JOIN subjects ON subjects.id = teaching_assignments.subject_id
JOIN groups ON groups.id = teaching_assignments.group_id
WHERE teaching_assignments.org_id = :org_id
  AND teaching_assignments.id = :id
LIMIT 1;

--Удаление назначения
DELETE FROM teaching_assignments
WHERE id = :id AND org_id = :org_id;

```
