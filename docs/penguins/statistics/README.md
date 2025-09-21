## Статистика (день/неделя/месяц) penguin_ledger

`GET /orgs/:orgId/penguins/stats/daily?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`  
получить статистику за день

`GET /orgs/:orgId/penguins/stats/weekly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`  
получить статистику за неделю

`GET /orgs/:orgId/penguins/stats/monthly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`  
получить статистику за месяц

### Получить статистику за день:

`GET /orgs/:orgId/penguins/stats/daily?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`

суперадмин, админ, преподаватель, сотрудник организации, студент

`studentId` - фильтр по студенту (опционально)  
 `groupId` - фильтр по группе (опционально)  
 `subjectId` - фильтр по предмету (опционально)  
 `operatorId` - фильтр по преподавателю (опционально)  
 `directionId` - фильтр по направлению (опционально)  
 `date_from` - фильтр по дате начало периода (опционально)  
 `date_to` - фильтр по дате конец периода (опционально)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `studentId` - целое число
  - `groupId` - целое число
  - `subjectId` - целое число
  - `operatorId` - целое число
  - `directionId` - целое число
  - `date_from` - `YYYY-MM-DD`
  - `date_to` - `YYYY-MM-DD`
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit`- целое число, 1..200, по умолчанию 50

- **Бизнес-правила:**

  - Студент получает только свою статистику (`studentId = current`)

- **Backend-правила:**

  - `orgId` из пути:
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
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `date_from` - `YYYY-MM-DD`
    - `date_to` - `YYYY-MM-DD`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `studentId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `operatorId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `date_from` - `YYYY-MM-DD`
    - `date_to` - `YYYY-MM-DD`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "series": [
    {
      "date": "2025-09-01",
      "net_total": 12,
      "awards": 15,
      "deducts": -3,
      "count_ops": 7
    },
    {
      "date": "2025-09-02",
      "net_total": 5,
      "awards": 8,
      "deducts": -3,
      "count_ops": 4
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
{ "message": "Invalid path parameter: operatorId must be integer" }
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
  "message": "Permission denied: You are not allowed to view penguin statistics in this organization."
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
SELECT
  DATE(penguin_ledger.created_at) AS bucket_date,
  SUM(penguin_ledger.delta) AS net_total,
  SUM(CASE WHEN penguin_ledger.delta >= 0 THEN penguin_ledger.delta ELSE 0 END) AS awards,
  SUM(CASE WHEN penguin_ledger.delta < 0 THEN penguin_ledger.delta ELSE 0 END) AS deducts,
  COUNT(*) AS count_ops
FROM penguin_ledger
JOIN users student ON student.id = penguin_ledger.student_id AND student.status <> 'deleted'
JOIN users teacher ON teacher.id  = penguin_ledger.operator_id AND teacher.status  <> 'deleted'
WHERE penguin_ledger.org_id = :org_id
  AND (:student_id   IS NULL
OR penguin_ledger.student_id   = :student_id)
  AND (:group_id     IS NULL
OR penguin_ledger.group_id     = :group_id)
  AND (:subject_id   IS NULL
OR penguin_ledger.subject_id   = :subject_id)
  AND (:operator_id  IS NULL
OR penguin_ledger.operator_id  = :operator_id)
  AND (:direction_id IS NULL
OR penguin_ledger.direction_id = :direction_id)
  AND (:date_from    IS NULL
OR penguin_ledger.created_at  >= :date_from)
  AND (:date_to      IS NULL
OR penguin_ledger.created_at  <  :date_to)
GROUP BY bucket_date
ORDER BY bucket_date ASC;

```

### Получить статистику за неделю:

`GET /orgs/:orgId/penguins/stats/weekly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`

суперадмин, админ, преподаватель, сотрудник организации, студент

`studentId` - фильтр по студенту (опционально)  
 `groupId` - фильтр по группе (опционально)  
 `subjectId` - фильтр по предмету (опционально)  
 `operatorId` - фильтр по преподавателю (опционально)  
 `directionId` - фильтр по направлению (опционально)  
 `date_from` - фильтр по дате начало периода (опционально)  
 `date_to` - фильтр по дате конец периода (опционально)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `studentId` - целое число
  - `groupId` - целое число
  - `subjectId` - целое число
  - `operatorId` - целое число
  - `directionId` - целое число
  - `date_from` - `YYYY-MM-DD`
  - `date_to` - `YYYY-MM-DD`
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit`- целое число, 1..200, по умолчанию 50

- **Бизнес-правила:**

  - Студент получает только свою статистику (`studentId = current`)

- **Backend-правила:**

  - `orgId` из пути:
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
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `date_from` - `YYYY-MM-DD`
    - `date_to` - `YYYY-MM-DD`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `studentId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `operatorId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `date_from` - `YYYY-MM-DD`
    - `date_to` - `YYYY-MM-DD`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "series": [
    {
      "week": "2025-W35",
      "net_total": 22,
      "awards": 26,
      "deducts": -4,
      "count_ops": 11
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
{ "message": "Invalid path parameter: operatorId must be integer" }
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
  "message": "Permission denied: You are not allowed to view penguin statistics in this organization."
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
SELECT
  DATE_FORMAT(penguin_ledger.created_at - INTERVAL (WEEKDAY(penguin_ledger.created_at)) DAY, '%Y-%m-%d') AS week_start,
  CONCAT(YEARWEEK(penguin_ledger.created_at, 3) DIV 100, '-W', LPAD(YEARWEEK(penguin_ledger.created_at, 3) % 100, 2, '0')) AS week_label,
  SUM(penguin_ledger.delta) AS net_total,
  SUM(CASE WHEN penguin_ledger.delta >= 0 THEN penguin_ledger.delta ELSE 0 END) AS awards,
  SUM(CASE WHEN penguin_ledger.delta <  0 THEN penguin_ledger.delta ELSE 0 END) AS deducts,
  COUNT(*) AS count_ops
FROM penguin_ledger
JOIN users student ON student.id = penguin_ledger.student_id AND student.status <> 'deleted'
JOIN users teacher ON teacher.id  = penguin_ledger.operator_id AND teacher.status  <> 'deleted'
WHERE penguin_ledger.org_id = :org_id
  AND (:student_id   IS NULL
OR penguin_ledger.student_id   = :student_id)
  AND (:group_id     IS NULL
OR penguin_ledger.group_id     = :group_id)
  AND (:subject_id   IS NULL
OR penguin_ledger.subject_id   = :subject_id)
  AND (:operator_id  IS NULL
OR penguin_ledger.operator_id  = :operator_id)
  AND (:direction_id IS NULL
OR penguin_ledger.direction_id = :direction_id)
  AND (:date_from    IS NULL
OR penguin_ledger.created_at  >= :date_from)
  AND (:date_to      IS NULL
OR penguin_ledger.created_at  <  :date_to)
GROUP BY week_start, week_label
ORDER BY week_start ASC;

```

### Получить статистику за месяц:

`GET /orgs/:orgId/penguins/stats/monthly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`

суперадмин, админ, преподаватель, сотрудник организации, студент

`studentId` - фильтр по студенту (опционально)  
 `groupId` - фильтр по группе (опционально)  
 `subjectId` - фильтр по предмету (опционально)  
 `operatorId` - фильтр по преподавателю (опционально)  
 `directionId` - фильтр по направлению (опционально)  
 `date_from` - фильтр по дате начало периода (опционально)  
 `date_to` - фильтр по дате конец периода (опционально)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `studentId` - целое число
  - `groupId` - целое число
  - `subjectId` - целое число
  - `operatorId` - целое число
  - `directionId` - целое число
  - `date_from` - `YYYY-MM-DD`
  - `date_to` - `YYYY-MM-DD`
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit`- целое число, 1..200, по умолчанию 50

- **Бизнес-правила:**

  - Студент получает только свою статистику (`studentId = current`)

- **Backend-правила:**

  - `orgId` из пути:
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
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `date_from` - `YYYY-MM-DD`
    - `date_to` - `YYYY-MM-DD`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `studentId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `groupId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `operatorId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`
    - `date_from` - `YYYY-MM-DD`
    - `date_to` - `YYYY-MM-DD`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{
  "series": [
    {
      "month": "2025-09",
      "net_total": 120,
      "awards": 150,
      "deducts": -30,
      "count_ops": 64
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
{ "message": "Invalid path parameter: operatorId must be integer" }
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
  "message": "Permission denied: You are not allowed to view penguin statistics in this organization."
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
SELECT
  DATE_FORMAT(penguin_ledger.created_at, '%Y-%m') AS month_label,
  SUM(penguin_ledger.delta) AS net_total,
  SUM(CASE WHEN penguin_ledger.delta >= 0 THEN penguin_ledger.delta ELSE 0 END) AS awards,
  SUM(CASE WHEN penguin_ledger.delta <  0 THEN penguin_ledger.delta ELSE 0 END) AS deducts,
  COUNT(*) AS count_ops
FROM penguin_ledger
JOIN users student ON student.id = penguin_ledger.student_id AND student.status <> 'deleted'
JOIN users teacher ON teacher.id  = penguin_ledger.operator_id AND teacher.status  <> 'deleted'
WHERE penguin_ledger.org_id = :org_id
  AND (:student_id   IS NULL
OR penguin_ledger.student_id   = :student_id)
  AND (:group_id     IS NULL
OR penguin_ledger.group_id     = :group_id)
  AND (:subject_id   IS NULL
OR penguin_ledger.subject_id   = :subject_id)
  AND (:operator_id  IS NULL
OR penguin_ledger.operator_id  = :operator_id)
  AND (:direction_id IS NULL
OR penguin_ledger.direction_id = :direction_id)
  AND (:date_from    IS NULL
OR penguin_ledger.created_at  >= :date_from)
  AND (:date_to      IS NULL
OR penguin_ledger.created_at  <  :date_to)
GROUP BY month_label
ORDER BY month_label ASC;

```
