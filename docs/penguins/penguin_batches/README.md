## Групповое начисление пингвинов penguin_batches

`POST /orgs/:orgId/penguins/batches`  
создать групповое начисление/списание и разнести по студентам

`GET /orgs/:orgId/penguins/batches?groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=`  
получить список групповых начислений

`GET /orgs/:orgId/penguins/batches/:id/students?page=&limit=`  
получить список студентов при групповом начислении

`GET /orgs/:orgId/penguins/batches/:id`  
получить групповое начисление по id

### Создать групповое начисление/списание и разнести по студентам:

`POST /orgs/:orgId/penguins/batches`

суперадмин, админ, преподаватель

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "group_id": 510,
  "subject_id": 108,
  "student_ids": [3001, 3002, 3003],
  "delta": 3,
  "reason": "Homework week 3",
  "rule_code": "HOMEWORK"
}
```

- **Бизнес-правила:**

  - Группа принадлежит этой организации
  - Предмет принадлежит этой организации
  - Преподаватель имеет активную роль `teacher` в этой организации и имеет назначение на эту группу/предмет `teaching_assignments`
  - Студент имеет активную роль `student` в этой организации и состоит в группе `group_members.status <> 'archived'`
  - Предмет привязан к группе `group_subjects`
  - `rule_code` правило существует и `is_active=1`
  - Для каждого студента создается запись в `penguin_ledger`, обновляется `penguin_balances`, создается `notifications` , тип `penguin_award|penguin_deduct` по знаку `delta`

- **Path / Query params:**

  - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `operator_id` берeм из JWT
  - `delta` — целое, не 0 (плюс - награда, минус - списание)

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `group_id` - /^\[1-9\]\d{0,9}\$/ - `int`, обязательное поле
    - `subject_id` - /^\[1-9\]\d{0,9}\$/ - `int`, обязательное поле
    - `student_ids` - `array[1..1000]` - `int`, обязательное поле
    - `delta` - `integer ≠ 0`, обязательное поле
    - `reason` - `string[1..255]`, `trim`
    - `rule_code` - ^\[A-Za-z0-9.\_-\]{2,50}\$

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `group_id` - /^\[1-9\]\d{0,9}\$/ - `int`, обязательное поле
    - `subject_id` - /^\[1-9\]\d{0,9}\$/ - `int`, обязательное поле
    - `student_ids` - `array[1..1000]` - `int`, обязательное поле
    - `delta` - `integer ≠ 0`, обязательное поле
    - `reason` - `string[1..255]`, `trim`
    - `rule_code` - ^\[A-Za-z0-9.\_-\]{2,50}\$

- **Responses**:

  - **201 Created** групповое начисление пингвинов успешно

```json
{
  "batch": {
    "id": 90001,
    "group_id": {
      "id": 510,
      "code": "281025-wdm",
      "name": "Web-Development-2025-10"
    },
    "subject_id": {
      "id": 108,
      "name": "React"
    },
    "operator_id": {
      "id": 1054,
      "full_name": "Ivan Petrov"
    },
    "delta": 3,
    "reason": "Homework week 3",
    "created_at": "2025-09-02T10:11:12Z"
  },
  "affected": 3,
  "students": [3001, 3002, 3003]
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid path parameter: orgId must be integer" }
```

```json
{ "message": "group_id is required" }
```

```json
{ "message": "subject_id is required" }
```

```json
{ "message": "student_ids is required" }
```

```json
{ "message": "delta is required" }
```

```json
{ "message": "delta must be a non-zero integer" }
```

```json
{ "message": "group_id must be integer" }
```

```json
{ "message": "subject_id must be integer" }
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
  "message": "Permission denied: You are not allowed to award penguins in this organization."
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
{ "message": "User not found" }
```

```json
{ "message": "Rule not found" }
```

- **409 Conflict** не выполняется условие

```json
{
  "message": "User does not have an active 'teacher' role in this organization."
}
```

```json
{ "message": "Teacher is not assigned to this subject in this group." }
```

```json
{ "message": "Subject is not assigned to the group." }
```

```json
{
  "message": "Some students do not have an active 'student' role in this organization."
}
```

```json
{ "message": "Some students are not active members of the group." }
```

```json
{ "message": "Rule is inactive." }
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

--Проверка роли преподавателя (берем из JWT)
SELECT 1
FROM user_roles
JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'teacher'
WHERE user_roles.org_id = :org_id AND user_roles.user_id = :operator_id AND user_roles.revoked_at IS NULL
LIMIT 1;

--Проверка преподавателя на назначение группе
SELECT 1 FROM teaching_assignments
WHERE org_id = :org_id AND teacher_id = :operator_id AND group_id = :group_id AND subject_id = :subject_id
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

--Если rule_code не передали
SET @rule_id := NULL;
SET @rule_active := NULL;

--Если rule_code передан
SELECT id, is_active INTO @rule_id, @rule_active
FROM penguin_rules
WHERE org_id = :org_id AND code = :rule_code
LIMIT 1;
--@rule_id IS NULL -> 404 "Rule not found"
--@rule_active = 0  -> 409 "Rule is inactive"

--Проверка студентов на роль и принадлежность группе

--роль student активна
SELECT COUNT(*) AS bad_student_role
FROM (
  SELECT DISTINCT sid FROM (
    --распакованный список :student_ids (временная таблица)
    SELECT :student_ids AS sid_list
  ) t
) ids
LEFT JOIN user_roles ON user_roles.org_id = :org_id AND user_roles.user_id = ids.sid AND user_roles.revoked_at IS NULL
LEFT JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'student'
WHERE roles.id IS NULL;
--если bad_student_role > 0 -> 409 "Some students do not have an active 'student' role in this organization."

--пользователь активен и член группы (не archived)
SELECT COUNT(*) AS bad_membership
FROM users
LEFT JOIN group_members
  ON group_members.group_id = :group_id
 AND group_members.student_id = users.id
 AND group_members.status <> 'archived'
WHERE users.id IN (:student_ids)
  AND (users.status = 'deleted' OR group_members.student_id IS NULL);
--если bad_membership > 0 -> 409 "Some students are not active members of the group."

--Создание группового начисления
INSERT INTO penguin_batches (org_id, group_id, subject_id, operator_id, delta, reason, created_at)
VALUES (:org_id, :group_id, :subject_id, :operator_id, :delta, :reason, NOW());

SET @batch_id = LAST_INSERT_ID();

--Для каждого студента логи и обновление баланса
--(в коде это батчевый INSERT SELECT с UNION ALL / VALUES)
--пример шаблона для каждого :student_id в :student_ids:
INSERT INTO penguin_ledger
(org_id, student_id, group_id, subject_id, operator_id, direction_id, rule_id, batch_id, delta, reason, created_at)
SELECT :org_id, :student_id, :group_id, :subject_id, :operator_id, g.direction_id, @rule_id, @batch_id, :delta, :reason, NOW()
FROM groups
WHERE groups.id = :group_id AND groups.org_id = :org_id;

INSERT INTO penguin_balances (org_id, student_id, group_id, subject_id, direction_id, total)
SELECT :org_id, :student_id, :group_id, :subject_id, g.direction_id, :delta
FROM groups
WHERE groups.id = :group_id AND groups.org_id = :org_id
ON DUPLICATE KEY UPDATE total = total + VALUES(total);

--Создание уведомления (по одному на студента)
INSERT INTO notifications (org_id, user_id, group_id, type, payload, is_read, created_at)
VALUES
(:org_id, :student_id, :group_id,
 CASE WHEN :delta >= 0 THEN 'penguin_award' ELSE 'penguin_deduct' END,
 JSON_OBJECT(
   'delta', :delta,
   'reason', :reason,
   'subject_id', :subject_id,
   'batch_id', @batch_id
 ),
 0, NOW());

--Для ответа
SELECT id, group_id, subject_id, operator_id, delta, reason, created_at
FROM penguin_batches
WHERE id = @batch_id;

```

### Получить список групповых начислений:

`GET /orgs/:orgId/penguins/batches?groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=`

суперадмин, админ, преподаватель, сотрудник организации

`groupId` - фильтр по группе (опционально)  
 `subjectId` - фильтр по предмету (опционально)  
 `operatorId` - фильтр по преподавателю (опционально)  
 `date_from` - фильтр по дате начало периода (опционально)  
 `date_to` - фильтр по дате конец периода (опционально)  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `groupId` - целое число
  - `subjectId` - целое число
  - `operatorId` - целое число
  - `date_from` - `YYYY-MM-DD`
  - `date_to` - `YYYY-MM-DD`
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
    - `operatorId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `date_from` - `YYYY-MM-DD`
    - `date_to` - `YYYY-MM-DD`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `operatorId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `date_from` - `YYYY-MM-DD`
    - `date_to` - `YYYY-MM-DD`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "total": 1,
  "page": 1,
  "limit": 50,
  "batches": [
    {
      "batch": {
        "id": 90001,
        "group_id": {
          "id": 510,
          "code": "281025-wdm",
          "name": "Web-Development-2025-10"
        },
        "subject_id": {
          "id": 108,
          "name": "React"
        },
        "operator_id": {
          "id": 1054,
          "full_name": "Ivan Petrov"
        },
        "delta": 3,
        "reason": "Homework week 3",
        "created_at": "2025-09-02T10:11:12Z"
      },
      "affected": 3
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
{ "message": "Invalid path parameter: operatorId must be integer" }
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
  "message": "Permission denied: You are not allowed to view penguins in this organization."
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
{ "message": "Teacher not found" }
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
FROM penguin_batches
JOIN users ON users.id = penguin_batches.operator_id
WHERE penguin_batches.org_id = :org_id
  AND users.status <> 'deleted'
  AND (:group_id IS NULL
OR penguin_batches.group_id = :group_id)
  AND (:subject_id IS NULL
OR penguin_batches.subject_id = :subject_id)
  AND (:operator_id IS NULL
OR penguin_batches.operator_id = :operator_id)
  AND (:date_from IS NULL
OR penguin_batches.created_at >= :date_from)
  AND (:date_to IS NULL
OR penguin_batches.created_at < :date_to);

--page
SELECT
  penguin_batches.id,
  penguin_batches.delta,
  penguin_batches.reason,
  penguin_batches.created_at,
  groups.id   AS group_id,
  groups.code AS group_code,
  groups.name AS group_name,
  subjects.id   AS subject_id,
  subjects.name AS subject_name,
  users.id        AS operator_id,
  users.full_name AS operator_name,
  COALESCE(bstats.affected, 0) AS affected
FROM penguin_batches
JOIN users ON users.id = penguin_batches.operator_id AND users.status <> 'deleted'
JOIN groups ON groups.id = penguin_batches.group_id
JOIN subjects ON subjects.id = penguin_batches.subject_id
LEFT JOIN (
  SELECT penguin_ledger.batch_id, COUNT(*) AS affected
  FROM penguin_ledger
  JOIN users students ON students.id = penguin_ledger.student_id AND students.status <> 'deleted'
  WHERE penguin_ledger.org_id = :org_id
  GROUP BY penguin_ledger.batch_id
) bstats ON bstats.batch_id = penguin_batches.id
WHERE penguin_batches.org_id = :org_id
  AND (:group_id IS NULL OR penguin_batches.group_id = :group_id)
  AND (:subject_id IS NULL OR penguin_batches.subject_id = :subject_id)
  AND (:operator_id IS NULL OR penguin_batches.operator_id = :operator_id)
  AND (:date_from IS NULL OR penguin_batches.created_at >= :date_from)
  AND (:date_to IS NULL OR penguin_batches.created_at < :date_to)
ORDER BY penguin_batches.created_at DESC, penguin_batches.id DESC
LIMIT @limit OFFSET @offset;

```

### Получить список студентов при групповом начислении:

`GET /orgs/:orgId/penguins/batches/:id/students?page=&limit=`

суперадмин, админ, преподаватель, сотрудник организации

`id` - ід группового начисления  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `id` - целое число
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
    - `id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

- **200 OK**

```json
{
  "total": 1,
  "page": 1,
  "limit": 50,
  "students": [
    {
      "id": 3001,
      "full_name": "Alice Student"
    },
    {
      "id": 3002,
      "full_name": "Bob Student"
    }
  ]
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
  "message": "Permission denied: You are not allowed to view penguins in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Batch not found" }
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

--Проверка батча
SELECT 1 FROM penguin_batches
WHERE id = :batch_id AND org_id = :org_id
LIMIT 1;


--total
SELECT COUNT(*) AS total
FROM penguin_ledger
JOIN users ON users.id = penguin_ledger.student_id
WHERE penguin_ledger.org_id = :org_id AND penguin_ledger.batch_id = :batch_id
  AND users.status <> 'deleted';

--page
SELECT users.id, users.full_name
FROM penguin_ledger
JOIN users ON users.id = penguin_ledger.student_id
WHERE penguin_ledger.org_id = :org_id AND penguin_ledger.batch_id = :batch_id
  AND users.status <> 'deleted'
ORDER BY users.full_name ASC, users.id ASC
LIMIT @limit OFFSET @offset;

```

### Получить групповое начисление по id (детальная карточка):

`GET /orgs/:orgId/penguins/batches/:id`

суперадмин, админ, преподаватель, сотрудник организации

`id` - ід группового начисления

- **Назначение:** Показывает один батч - базовые поля + человекочитаемые названия (группа/предмет/оператор), привязанное правило (если было), количество затронутых студентов (`affected`) и полный список студентов этого батча.

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
  - Батч принадлежит этой организации

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
  "id": 90001,
  "delta": 3,
  "reason": "Homework week 3",
  "created_at": "2025-09-02T10:11:12Z",

  "group": {
    "id": 510,
    "code": "281025-wdm",
    "name": "Web-Development-2025-10"
  },
  "subject": {
    "id": 108,
    "name": "React"
  },
  "operator": {
    "id": 1054,
    "full_name": "Ivan Petrov"
  },
  "rule": {
    "id": 14,
    "code": "HOMEWORK",
    "title": "Homework submission",
    "default_delta": 3
  },
  "affected": 3,
  "students": [
    {
      "id": 3001,
      "full_name": "Alice Student",
      "email": "alice@example.com"
    },
    {
      "id": 3002,
      "full_name": "Bob Student",
      "email": "bob@example.com"
    },
    {
      "id": 3003,
      "full_name": "Carol Student",
      "email": "carol@example.com"
    }
  ]
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
  "message": "Permission denied: You are not allowed to view penguins in this organization."
}
```

- **404 Not Found** объект не найден

```json
{ "message": "Organization not found" }
```

```json
{ "message": "Batch not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Проверка батча
SELECT 1 FROM penguin_batches
WHERE id = :batch_id AND org_id = :org_id
LIMIT 1;

--Карточка батча: базовые поля + человекочитаемые названия
SELECT
  penguin_batches.id,
  penguin_batches.delta,
  penguin_batches.reason,
  penguin_batches.created_at,
  groups.id   AS group_id,
  groups.code AS group_code,
  groups.name AS group_name,
  subjects.id   AS subject_id,
  subjects.name AS subject_name,
  users.id        AS operator_id,
  users.full_name AS operator_name
FROM penguin_batches
JOIN groups ON groups.id = penguin_batches.group_id
JOIN subjects ON subjects.id = penguin_batches.subject_id
LEFT JOIN users ON users.id = penguin_batches.operator_id
WHERE penguin_batches.org_id = :org_id AND penguin_batches.id = :id
LIMIT 1;

--Правило батча: берем из ledger (если rule использовали при создании)
--(ожидается один и тот же rule_id для всех строк батча; если NULL — правила нет)
SELECT
  penguin_rules.id,
  penguin_rules.code,
  penguin_rules.title,
  penguin_rules.default_delta
FROM penguin_ledger
JOIN penguin_rules ON penguin_rules.id = penguin_ledger.rule_id
WHERE penguin_ledger.org_id = :org_id
  AND penguin_ledger.batch_id = :id
  AND penguin_ledger.rule_id IS NOT NULL
LIMIT 1;

--Количество затронутых студентов (affected)
SELECT COUNT(*) AS affected
FROM penguin_ledger
JOIN users ON users.id = penguin_ledger.student_id
WHERE penguin_ledger.org_id = :org_id
  AND penguin_ledger.batch_id = :id
  AND users.status <> 'deleted';

--Полный список студентов батча (упорядочен по ФИО)
SELECT
  users.id,
  users.full_name,
  users.email
FROM penguin_ledger
JOIN users ON users.id = penguin_ledger.student_id
WHERE penguin_ledger.org_id = :org_id
  AND penguin_ledger.batch_id = :id
  AND users.status <> 'deleted'
ORDER BY users.full_name ASC, users.id ASC;

```
