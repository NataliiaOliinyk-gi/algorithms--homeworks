## Логирование (Индивидуальное начисление / списание) penguin_ledger

`POST /orgs/:orgId/penguins/ledger`  
создать индивидуальное начисление/списание пингвинов

`GET /orgs/:orgId/penguins/ledger?q=&studentId=&groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=`  
получить список начислений/снятий

`GET /orgs/:orgId/penguins/ledger/:id`  
получить операцию по id

### Создать индивидуальное начисление/списание пингвинов:

`POST /orgs/:orgId/penguins/ledger`

суперадмин, админ, преподаватель

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{
  "student_id": 3001,
  "group_id": 510,
  "subject_id": 108,
  "delta": -2,
  "reason": "Late submission",
  "rule_code": "DEDUCT_LATE"
}
```

- **Бизнес-правила:**

  - Группа принадлежит этой организации
  - Предмет принадлежит этой организации
  - Преподаватель имеет активную роль `teacher` в этой организации и имеет назначение на эту группу/предмет `teaching_assignments`
  - Студент имеет активную роль `student` в этой организации и состоит в группе `group_members.status <> 'archived'`
  - Предмет привязан к группе `group_subjects`
  - `rule_code` правило существует и `is_active=1`
  - Для студента обновляется `penguin_balances`, создается `notifications` , тип `penguin_award|penguin_deduct` по знаку `delta`

- **Path / Query params:**

  - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `operator_id` берем из JWT
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

  - **201 Created** начисление/ снятие пингвинов успешно

```json
{
  "id": 120045,
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
  "operator": {
    "id": 1054,
    "full_name": "Ivan Petrov"
  },
  "rule": {
    "id": 12,
    "code": "DEDUCT_LATE"
  },
  "delta": -2,
  "reason": "Late submission",
  "created_at": "2025-09-02T10:11:12Z"
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

```json
{ "message": "student_id must be integer" }
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
  "message": "Student do not have an active 'student' role in this organization."
}
```

```json
{ "message": "Student is not an active member of the group." }
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
WHERE user_roles.org_id = :org_id AND user_roles.user_id = :teacher_id AND user_roles.revoked_at IS NULL
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

--Проверка правила (если оно передано)
--если не передали rule_code:
SET @rule_id := NULL;
SET @rule_active := NULL;
--если передали rule_code:
SELECT id, is_active INTO @rule_id, @rule_active
FROM penguin_rules
WHERE org_id = :org_id AND code = :rule_code
LIMIT 1;
--если :rule_code передано і @rule_id IS NULL -> 404 Rule not found
--если :rule_code передано і @rule_active = 0 -> 409 Rule is inactive

--Проверка роли студента
SELECT 1
FROM user_roles
JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'student'
WHERE user_roles.org_id = :org_id AND user_roles.user_id = :student_id AND user_roles.revoked_at IS NULL
LIMIT 1;

--Проверка студента на принадлежность группе (не archived)
SELECT COUNT(*) AS bad_membership
FROM users
LEFT JOIN group_members
  ON group_members.group_id = :group_id
 AND group_members.student_id = users.id
 AND group_members.status <> 'archived'
WHERE users.id IN (:student_id)
  AND (users.status = 'deleted' OR group_members.student_id IS NULL);
--если bad_membership > 0 -> 409 "Student is not an active member of the group."

--Создание начисления/списания пингвина
INSERT INTO penguin_ledger
(org_id, student_id, group_id, subject_id, operator_id, direction_id, rule_id, batch_id, delta, reason, created_at)
SELECT :org_id, :student_id, :group_id, :subject_id, :operator_id, g.direction_id, @rule_id, @batch_id, :delta, :reason, NOW()
FROM groups
WHERE groups.id = :group_id AND groups.org_id = :org_id;

--Обновление баланса
INSERT INTO penguin_balances (org_id, student_id, group_id, subject_id, direction_id, total)
SELECT :org_id, :student_id, :group_id, :subject_id, g.direction_id, :delta
FROM groups
WHERE groups.id = :group_id AND groups.org_id = :org_id
ON DUPLICATE KEY UPDATE total = total + VALUES(total);

--Создание уведомления
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
SELECT
  penguin_ledger.id, penguin_ledger.delta, penguin_ledger.reason, penguin_ledger.created_at,
  users.id AS student_id, users.full_name AS student_name,
  teacher.id AS operator_id, teacher.full_name AS operator_name,
  subjects.id AS subject_id, subjects.name AS subject_name,
  groups.id AS group_id, groups.code, groups.name AS group_name,
  penguin_rules.id AS rule_id, penguin_rules.code AS rule_code
FROM penguin_ledger
JOIN users ON users.id = penguin_ledger.student_id
JOIN users teacher ON teacher.id = penguin_ledger.operator_id
JOIN subjects ON subjects.id = penguin_ledger.subject_id
JOIN groups ON groups.id = penguin_ledger.group_id
LEFT JOIN penguin_rules ON penguin_rules.id = penguin_ledger.rule_id
WHERE penguin_ledger.id = LAST_INSERT_ID();

```

### Получить список начислений/списаний (Журнал):

`GET /orgs/:orgId/penguins/ledger?q=&studentId=&groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=`

суперадмин, админ, преподаватель, сотрудник организации, студент

`q` - поиск по `reason` (опционально)  
 `studentId` - фильтр по студенту (опционально)  
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
  - `studentId` - целое число
  - `groupId` - целое число
  - `subjectId` - целое число
  - `operatorId` - целое число
  - `date_from` - `YYYY-MM-DD`
  - `date_to` - `YYYY-MM-DD`
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit`- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  `orgId` из пути:

  - должен совпадать с `org` в JWT
  - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `studentId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `operatorId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `date_from` - `YYYY-MM-DD`
    - `date_to` - `YYYY-MM-DD`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `studentId` - /^\[1-9\]\d{0,9}\$/ - в `path`
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
  "ledger": [
    {
      "id": 120045,
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
      "operator": {
        "id": 1054,
        "full_name": "Ivan Petrov"
      },
      "rule": {
        "id": 12,
        "code": "DEDUCT_LATE"
      },
      "delta": -2,
      "reason": "Late submission",
      "created_at": "2025-09-02T10:11:12Z"
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
{ "message": "Invalid path parameter: studentId must be integer" }
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
{ "message": "Student not found" }
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
FROM penguin_ledger
JOIN users ON users.id = penguin_ledger.student_id
JOIN users teacher ON teacher.id = penguin_ledger.operator_id
JOIN subjects ON subjects.id = penguin_ledger.subject_id
JOIN groups ON groups.id = penguin_ledger.group_id
LEFT JOIN penguin_rules ON penguin_rules.id = penguin_ledger.rule_id
WHERE penguin_ledger.org_id = :org_id
  AND users.status <> 'deleted' AND teacher.status <> 'deleted'
  AND (:student_id IS NULL OR penguin_ledger.student_id = :student_id)
  AND (:group_id IS NULL OR penguin_ledger.group_id = :group_id)
  AND (:subject_id IS NULL OR penguin_ledger.subject_id = :subject_id)
  AND (:operator_id IS NULL OR penguin_ledger.operator_id = :operator_id)
  AND (:date_from IS NULL OR penguin_ledger.created_at >= :date_from)
  AND (:date_to IS NULL OR penguin_ledger.created_at < :date_to)
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR penguin_ledger.reason LIKE CONCAT('%', :q, '%')
  );

--page
SELECT
  penguin_ledger.id, penguin_ledger.delta, penguin_ledger.reason, penguin_ledger.created_at,
  users.id AS student_id, users.full_name AS student_name,
  teacher.id AS operator_id, teacher.full_name AS operator_name,
  subjects.id AS subject_id, subjects.name AS subject_name,
  groups.id AS group_id, groups.code, groups.name AS group_name,
  penguin_rules.id AS rule_id, penguin_rules.code AS rule_code
FROM penguin_ledger
JOIN users ON users.id = penguin_ledger.student_id
JOIN users teacher ON teacher.id = penguin_ledger.operator_id
JOIN subjects ON subjects.id = penguin_ledger.subject_id
JOIN groups ON groups.id = penguin_ledger.group_id
LEFT JOIN penguin_rules ON penguin_rules.id = penguin_ledger.rule_id
WHERE penguin_ledger.org_id = :org_id
  AND users.status <> 'deleted' AND teacher.status <> 'deleted'
  AND (:student_id IS NULL OR penguin_ledger.student_id = :student_id)
  AND (:group_id IS NULL OR penguin_ledger.group_id = :group_id)
  AND (:subject_id IS NULL OR penguin_ledger.subject_id = :subject_id)
  AND (:operator_id IS NULL OR penguin_ledger.operator_id = :operator_id)
  AND (:date_from IS NULL OR penguin_ledger.created_at >= :date_from)
  AND (:date_to IS NULL OR penguin_ledger.created_at < :date_to)
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR penguin_ledger.reason LIKE CONCAT('%', :q, '%')
  )
ORDER BY penguin_ledger.created_at DESC, penguin_ledger.id DESC
LIMIT @limit OFFSET @offset;

```

### Получить одно начисление/списание пингвина по id:

`GET /orgs/:orgId/penguins/ledger/:id`

суперадмин, админ, преподаватель, сотрудник организации, студент

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
  "id": 120045,
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
  "operator": {
    "id": 1054,
    "full_name": "Ivan Petrov"
  },
  "rule": {
    "id": 12,
    "code": "DEDUCT_LATE"
  },
  "delta": -2,
  "reason": "Late submission",
  "created_at": "2025-09-02T10:11:12Z"
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
{ "message": "Penguin accrual/debit not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations
WHERE id = :org_id AND status IN ('active','pending')
LIMIT 1;

--Выборка
SELECT
  penguin_ledger.id, penguin_ledger.delta, penguin_ledger.reason, penguin_ledger.created_at,
  users.id AS student_id, users.full_name AS student_name,
  teacher.id AS operator_id, teacher.full_name AS operator_name,
  subjects.id AS subject_id, subjects.name AS subject_name,
  groups.id AS group_id, groups.code, groups.name AS group_name,
  penguin_rules.id AS rule_id, penguin_rules.code AS rule_code
FROM penguin_ledger
JOIN users ON users.id = penguin_ledger.student_id
JOIN users teacher ON teacher.id = penguin_ledger.operator_id
JOIN subjects ON subjects.id = penguin_ledger.subject_id
JOIN groups ON groups.id = penguin_ledger.group_id
LEFT JOIN penguin_rules ON penguin_rules.id = penguin_ledger.rule_id
WHERE penguin_ledger.org_id=:org_id AND penguin_ledger.id=:id
LIMIT 1;

```
