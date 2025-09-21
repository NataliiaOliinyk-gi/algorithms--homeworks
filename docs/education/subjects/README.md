## Предметы  

`GET /orgs/:orgId/subjects?q=&page=&limit=`  получить список предметов

`GET /orgs/:orgId/subjects/:subjectId` получить предмет по id

`POST /orgs/:orgId/subjects` создать предмет

`PUT /orgs/:orgId/subjects/:subjectId` редактировать предмет

`DELETE /orgs/:orgId/subjects/:subjectId` удалить предмет

### Получить список предметов:  

`GET /orgs/:orgId/subjects?q=&page=&limit=`

суперадмин, админ, сотрудник учебной организации, учитель, студент

  `q` - поиск по `name/short_code`  
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

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
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
  "subjects": 
  [ 
    {
  	  "id": 108,
  		"name": "React",
  		"short_code": "React",
  		"description": "Front-end: React",
  		"created_at": "2025-09-02T10:11:12Z",
  		"updated_at": "2025-09-02T10:11:12Z"
    },
  ],
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
{ "message": "Permission denied: You are not allowed to view subjects in this organization." }
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
FROM subjects
WHERE org_id = :org_id
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR name LIKE CONCAT('%', :q, '%')
    OR short_code LIKE CONCAT('%', :q, '%')
  );

--page
SELECT id, name, short_code, description, created_at, updated_at
FROM subjects
WHERE org_id = :org_id
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR name LIKE CONCAT('%', :q, '%')
    OR short_code LIKE CONCAT('%', :q, '%')
  )
ORDER BY name ASC, id ASC
LIMIT @limit OFFSET @offset;

```


#### Получить предмет по id:  

`GET /orgs/:orgId/subjects/:subjectId`

суперадмин, админ, сотрудник учебной организации, учитель, студент

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `subjectId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**
```json
{ 
  "id": 108,
  "name": "React",
  "short_code": "React",
  "description": "Front-end: React",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
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
{ "message": "Permission denied: You are not allowed to view subject in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
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
SELECT id, name, short_code, description, created_at, updated_at
FROM subjects
WHERE id = :subject_id AND org_id = :org_id
LIMIT 1;

```

### Создать предмет:  

`POST /orgs/:orgId/subjects`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "name": "React",
  "short_code": "React",
  "description": "Front-end: React"
}
```

- **Назначение:** создать предмет в организации

- **Path / Query params:**

  - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `name` уникален в рамках организации `(org_id, name)`
  - Поля:
    - `name` обязательное поле
    - `short_code` опциональное поле
    - `description` опциональное поле

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `name` - `string[1..150]`, `trim` - обязательное поле
    - `short_code` - ^\[A-Za-z0-9.\_-\]{2,20}\$, `toLowerCase()`, `trim`
    - `description` - `string[0..1000]`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `name` - `string[1..150]`, `trim` - обязательное поле
    - `short_code` - ^\[A-Za-z0-9.\_-\]{2,20}\$, `toLowerCase()`, `trim`
    - `description` - `string[0..1000]`

  - DB:

    - `(org_id, name)` - `UNIQUE` проверка уникальности

- **Responses**:

  - **201 Created** предмет создан
```json
{ 
  "id": 108,
  "name": "React",
  "short_code": "React",
  "description": "Front-end: React",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
}
```

  - **400 Bad Request** некорректное тело запроса
```json
{ "message": "Invalid path parameter: orgId must be integer" }
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
{ "message": "Permission denied: You are not allowed to create a subject in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```

  - **409 Conflict** дубликат
```json
{ "message": "Subject name 'React' is already in use in this organization" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Проверка уникальности названия предмета
SELECT id FROM subjects
WHERE org_id = :org_id AND name = :name LIMIT 1;

--Создание
INSERT INTO subjects (org_id, name, short_code, description, created_at, updated_at)
VALUES (:org_id, :name, :short_code, :description, NOW(), NOW());

--Для ответа
SELECT id, name, short_code, description, created_at, updated_at
FROM subjects WHERE id = LAST_INSERT_ID();

```

### Редактировать предмет:  

`PUT /orgs/:orgId/subjects/:subjectId`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "name": "React",
  "short_code": "React",
  "description": "Front-end: React"
}
```

- **Path / Query params:**

  - `orgId` - целое число
  - `subjectId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `name` уникален в рамках организации `(org_id, name)`
  - Поля:
    - `name` 
    - `short_code` 
    - `description` 

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `name` - `string[1..150]`, `trim` 
    - `short_code` - ^\[A-Za-z0-9.\_-\]{2,20}\$, `toLowerCase()`, `trim`
    - `description` - `string[0..1000]`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `name` - `string[1..150]`, `trim` 
    - `short_code` - ^\[A-Za-z0-9.\_-\]{2,20}\$, `toLowerCase()`, `trim`
    - `description` - `string[0..1000]`

  - DB:

    - `(org_id, name)` - `UNIQUE` проверка уникальности

- **Responses**:

  - **200 OK**

```json
{ 
  "id": 108,
  "name": "React",
  "short_code": "React",
  "description": "Front-end: React",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-04T10:11:12Z"
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
{ "message": "Permission denied: You are not allowed to edit a subject in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "Subject not found" }
```

  - **409 Conflict** дубликат
```json
{ "message": "Subject name 'React' is already in use in this organization" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Проверка уникальности названия предмета
SELECT id FROM subjects
WHERE org_id = :org_id AND name = :name AND id <> :subject_id
LIMIT 1;

--Обновление
UPDATE subjects
SET name        = COALESCE(:name, name),
    short_code  = COALESCE(:short_code, short_code),
    description = COALESCE(:description, description),
    updated_at  = NOW()
WHERE id = :subject_id AND org_id = :org_id;

```

### Удалить предмет:  

`DELETE /orgs/:orgId/subjects/:subjectId`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `subjectId` - целое число

- **Бизнес-правила:**

  - Нельзя удалить, если предмет привязан к группам/назначениям

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `subjectId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**
```json
{ 
  "id": 108,
  "name": "React",
  "short_code": "React",
  "description": "Front-end: React",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-04T10:11:12Z"
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
{ "message": "Permission denied: You are not allowed to remove a subject in this organization." }
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

--Проверка на связи
SELECT
  (SELECT COUNT(*) FROM group_subjects        WHERE subject_id = :subject_id) +
  (SELECT COUNT(*) FROM teaching_assignments  WHERE subject_id = :subject_id) AS refs;

--Если refs > 0 => 409

--Удаление
DELETE FROM subjects
WHERE id = :subject_id AND org_id = :org_id;

```