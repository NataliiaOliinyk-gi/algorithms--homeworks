
## Контракты: эндпоинты по доменам

### Авторизация [Auth](./auth/README.md)

`POST /auth/login` вход в систему

`POST /auth/mfa/verify` подтверждение MFA

`POST /auth/logout` выход

`POST /auth/password/forgot` забыли пароль (инициировать сброс)

`POST /auth/password/reset` сброс пароля (по токену из email)


### Организации [Orgs](./orgs/README.md)

`POST /orgs` регистрация организации

`GET /orgs?q=&status=&country=&page=&limit=`  получить список организаций

`GET /orgs/:orgId` получить организацию по id

`PUT /orgs/:orgId` редактировать организацию

`DELETE /orgs/:orgId` удалить организацию

`PUT /orgs/:orgId/status` изменить статус организации


### Роли  [Roles](./roles/README.md)

`GET /roles` получить список ролей

`POST /orgs/:orgId/users/:userId/roles/:role_id` назначить роль

`DELETE /orgs/:orgId/users/:userId/roles/:role_id` отозвать роль


### Пользователи  [Users](./users/README.md)

`POST /orgs/:orgsId/users` регистрация пользователя в организации с  одновременным назначением роли и отправкой приглашения на email

`GET /orgs/:orgId/users/:userId` получить профиль юзера

`DELETE /orgs/:orgsId/users/:userId` удалить пользователя

`GET /orgs/:org_id/users?role=&q=&include_revoked=&page=&limit=`  получить список преподавателей/ студентов/сотрудников в учебной организации

`GET /orgs/:orgsId/users/me` получить профиль (свой)

`PUT /orgs/:orgsId/users/me` редактировать свой профиль

`POST /orgs/:orgId/users/me/password` сменить пароль



### Направления

`GET /orgs/:orgId/directions?q=&page=&limit= ` получить список направлений

`GET /orgs/:orgId/directions/:directionId` получить направление по id

`POST /orgs/:orgId/directions` создать направление

`PUT /orgs/:orgId/directions/:directionId` редактировать направление

`DELETE /orgs/:orgId/directions/:directionId` удалить направление

#### Получить список направлений: `GET /orgs/:orgId/directions?q=&page=&limit=`

суперадмин, админ, сотрудник учебной организации


  `q` - поиск по `code/name`  
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

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
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
  "directions": 
  [ 
    {
      "id": 101,
      "code": "web-dev",
      "name": "Web Development",
      "description": "Web Development, Full-Stack",
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
{ "message": "Permission denied: You are not allowed to view directions in this organization." }
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
FROM directions
WHERE org_id = :org_id
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR code LIKE CONCAT('%', :q, '%')
    OR name LIKE CONCAT('%', :q, '%')
  );

--page
SELECT id, code, name, description, created_at, updated_at
FROM directions
WHERE org_id = :org_id
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR code LIKE CONCAT('%', :q, '%')
    OR name LIKE CONCAT('%', :q, '%')
  )
ORDER BY name ASC, id ASC
LIMIT @limit OFFSET @offset;

```


#### Получить направление по id:  `GET /orgs/:orgId/directions/:directionId`

суперадмин, админ, сотрудник учебной организации, учитель, студент

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

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

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**
```json
{ 
  "id": 101,
  "code": "web-dev",
  "name": "Web Development",
  "description": "Web Development, Full-Stack",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
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
{ "message": "Permission denied: You are not allowed to view directions in this organization." }
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
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Выборка
SELECT id, code, name, description, created_at, updated_at
FROM directions
WHERE id = :direction_id AND org_id = :org_id
LIMIT 1;

```


#### Создать направление:  `POST /orgs/:orgId/directions`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "code": "web-dev",
  "name": "Web Development",
  "description": "Web Development, Full-Stack"
}
```

- **Назначение:** создать учебное направление в организации

- **Path / Query params:**

  - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `code` уникален в рамках организации `(org_id, code)`
  - Поля:
    - `code` обязательное поле
    - `name` обязательное поле
    - `description` опциональное поле

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$ - `toLowerCase()`, `trim` - обязательное поле
    - `name` - `string[1..150]`, `trim` - обязательное поле
    - `description` - `string[0..1000]`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$ - `toLowerCase()`, `trim` - обязательное поле
    - `name` - `string[1..150]`, `trim` - обязательное поле
    - `description` - `string[0..1000]`

  - DB:

    - `(org_id, code)` - `UNIQUE` проверка уникальности

- **Responses**:

  - **201 Created** направление создано
```json
{ 
  "id": 101,
  "code": "web-dev",
  "name": "Web Development",
  "description": "Web Development, Full-Stack",
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
{ "message": "Permission denied: You are not allowed to create a direction in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```

  - **409 Conflict** дубликат
```json
{ "message": "Direction code 'web-dev' is already in use in this organization" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Проверка уникальности кода направления
SELECT id FROM directions
WHERE org_id = :org_id AND code = :code 
LIMIT 1;

--Создание
INSERT INTO directions (org_id, code, name, description, created_at, updated_at)
VALUES (:org_id, :code, :name, :description, NOW(), NOW());

--Для ответа
SELECT id, code, name, description, created_at, updated_at
FROM directions
WHERE id = LAST_INSERT_ID();

```

#### Редактировать направление: `PUT /orgs/:orgId/directions/:directionId`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "code": "web-dev",
  "name": "Web Development",
  "description": "Web Development, Full-Stack"
}
```

- **Path / Query params:**

  - `orgId` - целое число
  - `directionId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `code` уникален в рамках организации `(org_id, code)`
  - Поля:
    - `code`
    - `name`
    - `description`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$ - `toLowerCase()`, `trim` 
    - `name` - `string[1..150]`, `trim` 
    - `description` - `string[0..1000]`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$ - `toLowerCase()`, `trim`
    - `name` - `string[1..150]`, `trim` 
    - `description` - `string[0..1000]`

  - DB:

    - `(org_id, code)` - `UNIQUE` проверка уникальности

- **Responses**:

  - **200 OK**
```json
{ 
  "id": 101,
  "code": "web-dev",
  "name": "Web Development",
  "description": "Web Development, Full-Stack",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-03T10:11:12Z"
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
{ "message": "Permission denied: You are not allowed to edit a direction in this organization." }
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
{ "message": "Direction code 'web-dev' is already in use in this organization" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Проверка уникальности нового кода направления
SELECT id FROM directions
WHERE org_id = :org_id AND code = :code AND id <> :direction_id
LIMIT 1;

--Обновление
UPDATE directions
SET code = COALESCE(:code, code),
    name = COALESCE(:name, name),
    description = COALESCE(:description, description),
    updated_at = NOW()
WHERE id = :direction_id AND org_id = :org_id;

```

#### Удалить направление:  `DELETE /orgs/:orgId/directions/:directionId`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `directionId` - целое число

- **Бизнес-правила:**

  - Нельзя удалить, если есть ссылки (`groups, direction_subjects, teaching_assignments`)

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `directionId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**
```json
{ 
  "id": 101,
  "code": "web-dev",
  "name": "Web Development",
  "description": "Web Development, Full-Stack",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-03T10:11:12Z"
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
{ "message": "Permission denied: You are not allowed to remove a direction in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "Direction not found" }
```

  - **409 Conflict** есть связи
```json
{ "message": "Direction is in use" }
```

- **SQL**


```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Проверка на связи
SELECT
  (SELECT COUNT(*) FROM groups  WHERE direction_id = :direction_id) +
  (SELECT COUNT(*) FROM direction_subjects  WHERE direction_id = :direction_id) AS refs;

--Удаление
DELETE FROM directions
WHERE id = :direction_id AND org_id = :org_id;

```


### Предметы

`GET /orgs/:orgId/subjects?q=&page=&limit=`  получить список предметов

`GET /orgs/:orgId/subjects/:subjectId` получить предмет по id

`POST /orgs/:orgId/subjects` создать предмет

`PUT /orgs/:orgId/subjects/:subjectId` редактировать предмет

`DELETE /orgs/:orgId/subjects/:subjectId` удалить предмет

#### Получить список предметов:  `GET /orgs/:orgId/subjects?q=&page=&limit=`

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


##### Получить предмет по id:  `GET /orgs/:orgId/subjects/:subjectId`

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

#### Создать предмет:  `POST /orgs/:orgId/subjects`

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

##### Редактировать предмет:  `PUT /orgs/:orgId/subjects/:subjectId`

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

#### Удалить предмет:  `DELETE /orgs/:orgId/subjects/:subjectId`

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

### Группы

`GET /orgs/:orgId/groups?q=&status=&direction_id=&page=&limit=`  получить список групп

`GET /orgs/:orgId/groups/:groupId` получить группу по id

`POST /orgs/:orgId/groups` создать группу

`PUT /orgs/:orgId/groups/:groupId` редактировать группу

`DELETE /orgs/:orgId/groups/:groupId` удалить группу

#### Получить список групп:  `GET /orgs/:orgId/groups?q=&status=&direction_id=&page=&limit=`

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
  "groups": 
  [ 
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
  		"updated_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to view groups in this organization." }
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

#### Получить группу по id:  `GET /orgs/:orgId/groups/:groupId`

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
  "updated_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to view groups in this organization." }
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

#### Создать группу:  `POST /orgs/:orgId/groups`

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
  "updated_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to create a group in this organization." }
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

#### Редактировать группу:  `PUT /orgs/:orgId/groups/:groupId`

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
  "end_date": "2026-08-15",
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
    *Архивация группы* — это перевод в `status='archived'`

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
  "updated_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to edit a group in this organization." }
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

#### Удалить группу:  `DELETE /orgs/:orgId/groups/:groupId`

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
  "archived_at": "2025-09-02T10:11:12Z",
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

--Архивация группы
UPDATE groups
SET status = 'archived',
    end_date = COALESCE(end_date, CURDATE()),
    updated_at = NOW()
WHERE id = :group_id AND org_id = :org_id;

SELECT id, code, 'archived' AS status, NOW() AS archived_at
FROM groups WHERE id = :group_id AND org_id = :org_id;

```

### Связка «Направление ⇔ Предметы» direction_subjects

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


#### Получить список предметов направления:  `GET /orgs/:orgId/directions/:directionId/subjects?q=&only_active=&page=&limit=`

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
  "direction_subjects": 
  [
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
    },
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
{ "message": "Permission denied: You are not allowed to view list of subjects of the direction in this organization." }
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

#### Получить одну запись (текущую или по дате начала):  `GET /orgs/:orgId/directions/:directionId/subjects/:subjectId?effective_from=YYYY-MM-DD`

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
{ "message": "Permission denied: You are not allowed to view a subject of the direction in this organization." }
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

#### Добавить предмет в направление:  `POST /orgs/:orgId/directions/:directionId/subjects`

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
{ "message": "Permission denied: You are not allowed to create a subject of the direction in this organization." }
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
{ "message": "Period overlap: this subject is already assigned to the direction for an active or overlapping period. Close or adjust the existing period before creating a new one" }
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


#### Обновить запись:  `PUT /orgs/:orgId/directions/:directionId/subjects/:subjectId?effective_from=`

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
{ "message": "Immutable field update is not allowed. You cannot change subject_id, direction_id or effective_from." }
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
{ "message": "Permission denied: You are not allowed to edit a subject of the direction in this organization." }
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

#### Закрыть запись:  `DELETE /orgs/:orgId/directions/:directionId/subjects/:subjectId?effective_from=`

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
{ "message": "Permission denied: You are not allowed to remove a subject of the direction in this organization." }
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

### Связка «Группа ⇔ Предметы» group_subjects

`GET /orgs/:orgId/groups/:groupId/subjects?q=&source=&page=&limit= `  получить список предметов группы

`POST /orgs/:orgId/groups/:groupId/subjects`  добавить предмет в группу

`DELETE /orgs/:orgId/groups/:groupId/subjects/:subjectId`  удалить предмет из группы

#### Получить список предметов группы:  `GET /orgs/:orgId/groups/:groupId/subjects?q=&source=&page=&limit=`

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
  "group_subjects": 
  [
    {
      "group": { 
        "id": 112,
  		  "direction_id": 108,
  		  "name": "Web-Development-2025-10",
        "code": "281025-wdm", 
        },
   	  "subject": { 
        "id": 108, 
        "name": "React", 
        "short_code": "react" 
        },
   	  "source": "direction",
   	  "added_at": "2025-09-02T10:11:12Z",
    },
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
{ "message": "Permission denied: You are not allowed to view list of subjects of the group in this organization." }
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

#### Добавить предмет в группу:  `POST /orgs/:orgId/groups/:groupId/subjects`

суперадмин, админ

Ручное наполнение ("source": "manual") Автоматическое наполнение будет происходить когда группу определяем в направление, в котором уже выбраны предметы для изучения

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "subject_id": 108,
  "source": "manual",
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
    "code": "281025-wdm", 
    },
  "subject": { 
    "id": 108, 
    "name": "React", 
    "short_code": "react" 
    },
  "source": "manual",
  "added_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to create a subject of the group in this organization." }
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
{ "message": "Duplicate subject in group: this subject is already attached to the group" }
```

  - **409 Conflict** нет активной связки с направлением
```json
{ "message": "Cannot add with source='direction': the subject is not active for this group's direction. Add it to the direction first or use source='manual'." }
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

#### Удалить предмет из группы: `DELETE /orgs/:orgId/groups/:groupId/subjects/:subjectId`

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
    "code": "281025-wdm", 
    },
  "subject": { 
    "id": 108, 
    "name": "React", 
    "short_code": "react" 
    },
  "removed": true,
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
{ "message": "Permission denied: You are not allowed to remove a subject of the group in this organization." }
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
{ "message": "Cannot remove subject from group: there are teaching assignments for this group and subject. Remove those assignments first." }
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


### Участники групп group_members

`GET /orgs/:orgId/groups/:groupId/members?q=&status=&page=&limit=`  получить список студентов группы

`GET /orgs/:orgId/groups/:groupId/members/:studentId`  получить одного участника

`POST /orgs/:orgId/groups/:groupId/members`  добавить студента в группу

`PUT /orgs/:orgId/groups/:groupId/members/:studentId`  изменить статус/даты

`DELETE /orgs/:orgId/groups/:groupId/members/:studentId`  исключить студента из группы

#### Получить список студентов группы:  `GET /orgs/:orgId/groups/:groupId/members?q=&status=&page=&limit=`

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
  "group_members": 
  [
    {
      "group": { 
        "id": 112,
  	    "direction_id": 108,
  	    "name": "Web-Development-2025-10",
        "code": "281025-wdm", 
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
        },
    },
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
{ "message": "Permission denied: You are not allowed to view list of members of the group in this organization." }
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


#### Получить одного участника:  `GET /orgs/:orgId/groups/:groupId/members/:studentId`

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
    "code": "281025-wdm", 
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
    },
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
{ "message": "Permission denied: You are not allowed to view а member of the group in this organization" }
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

#### Добавить студента в группу:  `POST /orgs/:orgId/groups/:groupId/members`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "student_id": 3001,
  "joined_at": "2025-09-10T09:00:00Z",
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
    "code": "281025-wdm", 
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
    },
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
{ "message": "Permission denied: You are not allowed to add а member of the group in this organization." }
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
{ "message": "User does not have an active 'student' role in this organization." }
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

#### Обновить статус/даты:  `PUT /orgs/:orgId/groups/:groupId/members/:studentId`

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
    "code": "281025-wdm", 
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
    },
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
{ "message": "Permission denied: You are not allowed to edit а member of the group in this organization." }
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

#### Исключить студента из группы:  `DELETE /orgs/:orgId/groups/:groupId/members/:studentId`

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
    "code": "281025-wdm", 
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
    },
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
{ "message": "Permission denied: You are not allowed to remove а member of the group in this organization." }
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


### Назначения преподавателей teaching_assignments

`GET /orgs/:orgId/teaching-assignments?groupId=&teacherId=&subjectId=&page=&limit=`  получить список назначений

`GET /orgs/:orgId/teaching-assignments/:id`  получить назначение

`POST /orgs/:orgId/teaching-assignments`  создать назначение

`PUT /orgs/:orgId/teaching-assignments/:id`  изменить назначение

`DELETE /orgs/:orgId/teaching-assignments/:id`  удалить назначение

#### Получить список назначений:  `GET /orgs/:orgId/teaching-assignments?groupId=&teacherId=&subjectId=&page=&limit=`

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
  "teaching_assignments": 
  [
    {
 	    "id": 7001,
      "teacher":  { 
        "id": 1054, 
        "full_name": "Ivan Petrov" 
        },
      "subject":  { 
        "id": 108,  
        "name": "React" 
        },
      "group":  { 
        "id": 510,  
        "code": "281025-wdm", 
        "name": "Web-Development-2025-10" 
        },
      "assigned_at": "2025-09-02T10:11:12Z",
    },
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
{ "message": "Permission denied: You are not allowed to view teaching assignments in this organization." }
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

#### Получить назначение:  `GET /orgs/:orgId/teaching-assignments/:id`

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
  "teacher":  { 
    "id": 1054, 
    "full_name": "Ivan Petrov" 
    },
  "subject":  { 
    "id": 108,  
    "name": "React" 
    },
  "group":  { 
    "id": 510,  
    "code": "281025-wdm", 
    "name": "Web-Development-2025-10" 
    },
  "assigned_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to view this teaching assignment in this organization." }
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

#### Создать назначение:  `POST /orgs/:orgId/teaching-assignments`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "teacher_id": 1054, 
  "subject_id": 108, 
  "group_id": 510, 
  "assigned_at": "2025-09-02T10:11:12Z",
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

    - `(teacher_id, subject_id, group_id)` - `UNIQUE`  проверка уникальности
    - `(group_id,subject_id)` - `group_subjects`  проверка связи

- **Responses**:

  - **201 Created** преподаватель назначен на предмет группе
```json
{ 
  "id": 7001,
  "teacher":  { 
    "id": 1054, 
    "full_name": "Ivan Petrov" 
    },
  "subject":  { 
    "id": 108,  
    "name": "React" 
    },
  "group":  { 
    "id": 510,  
    "code": "281025-wdm", 
    "name": "Web-Development-2025-10" 
    },
  "assigned_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to create teaching assignments in this organization." }
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
{ "message": "User does not have an active 'teacher' role in this organization." }
```

  - **409 Conflict** у предмета нет активной связки с группой
```json
{ "message": "Subject is not assigned to the target group. Add the subject to the group before creating the teaching assignment" }
```

  - **409 Conflict** дубликат
```json
{ "message": "Duplicate assignment: this teacher is already assigned to this subject in this group." }
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

#### Изменить назначение:  `PUT /orgs/:orgId/teaching-assignments/:id`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "teacher_id": 1054, 
  "subject_id": 108, 
  "group_id": 510, 
  "assigned_at": "2025-09-02T10:11:12Z",
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

    - `(teacher_id, subject_id, group_id)` - `UNIQUE`  проверка уникальности
    - `(group_id,subject_id)` - `group_subjects`  проверка связи

- **Responses**:

  - **200 OK**
```json
{ 
  "id": 7001,
  "teacher":  { 
    "id": 1054, 
    "full_name": "Ivan Petrov" 
    },
  "subject":  { 
    "id": 108,  
    "name": "React" 
    },
  "group":  { 
    "id": 510,  
    "code": "281025-wdm", 
    "name": "Web-Development-2025-10" 
    },
  "assigned_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to edit teaching assignments in this organization." }
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
{ "message": "User does not have an active 'teacher' role in this organization." }
```

  - **409 Conflict** у предмета нет активной связки с группой
```json
{ "message": "Subject is not assigned to the target group. Add the subject to the group before creating the teaching assignment" }
```

  - **409 Conflict** дубликат
```json
{ "message": "Duplicate assignment: this teacher is already assigned to this subject in this group." }
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

#### Удалить назначение:  `DELETE /orgs/:orgId/teaching-assignments/:id`

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
  "teacher":  { 
    "id": 1054, 
    "full_name": "Ivan Petrov" 
    },
  "subject":  { 
    "id": 108,  
    "name": "React" 
    },
  "group":  { 
    "id": 510,  
    "code": "281025-wdm", 
    "name": "Web-Development-2025-10" 
    },
  "assigned_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to remove teaching assignments in this organization." }
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



### Penguins

### Справочник правил penguin_rules

`GET /orgs/:orgId/penguin-rules?q=&is_active=&page=&limit=`  получить список правил

`GET /orgs/:orgId/penguin-rules/:id` получить правило

`POST /orgs/:orgId/penguin-rules` создать правило

`PUT` /orgs/:orgId/penguin-rules/:id` изменить правило

`DELETE` /orgs/:orgId/penguin-rules/:id` удалить правило

#### Получить список правил:  `GET /orgs/:orgId/penguin-rules?q=&is_active=&page=&limit=`

суперадмин, админ, сотрудник учебной организации, преподаватель

  `q` - поиск по `code/title`  
  `is_active` — 0\|1 опционально, по умолчанию все  
  `page` - номер страницы, по умолчанию 1  
  `limit` - количество на странице (по умолчанию 50, ≤ 200)  

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `q` - строка (если передали)
  - `is_active` - 0\|1
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
    - `only_active` - 0\|1
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `q` - `string[0..100]` - `trim`
    - `only_active` - 0\|1
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**
```json
{ 
  "total": 1,
  "page": 1,
  "limit": 50,
  "penguin_rules": 
  [
    {
 	    "id": 115,
      "code": "HOMEWORK",
      "title": "Homework completed",
      "default_delta": 3,
      "is_active": true,
      "description": "Award for completed homework",
      "created_at": "2025-09-02T10:11:12Z",
      "updated_at": "2025-09-02T10:11:12Z",
    },
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
{ "message": "Permission denied: You are not allowed to view rules in this organization." }
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

--Проверки фильтров, если параметр передан

--Проверка группы
SELECT 1 FROM groups 
WHERE id = :group_id AND org_id = :org_id 
LIMIT 1;

--total
SELECT COUNT(*) AS total
FROM penguin_rules
WHERE org_id = :org_id
   AND (COALESCE(:is_active, -1) = -1 OR is_active = :is_active)
   AND (
     COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
     OR code  LIKE CONCAT('%', :q, '%')
     OR title LIKE CONCAT('%', :q, '%')
   );

--page
SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
FROM penguin_rules
WHERE org_id = :org_id
  AND (COALESCE(:is_active, -1) = -1 OR is_active = :is_active)
  AND (
    COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
    OR code  LIKE CONCAT('%', :q, '%')
    OR title LIKE CONCAT('%', :q, '%')
  )
ORDER BY is_active DESC, title ASC, id ASC
LIMIT @limit OFFSET @offset;

```


#### Получить правило:  `GET /orgs/:orgId/penguin-rules/:id`

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
  "id": 115,
  "code": "HOMEWORK",
  "title": "Homework completed",
  "default_delta": 3,
  "is_active": true,
  "description": "Award for completed homework",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z",

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
{ "message": "Permission denied: You are not allowed to view rules in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "Rule not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Выборка
SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
FROM penguin_rules
WHERE org_id = :org_id AND id = :id
LIMIT 1;

```

#### Создать правило:  `POST /orgs/:orgId/penguin-rules`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "code": "BONUS",
  "title": "Bonus points",
  "default_delta": 5,
  "is_active": true,
  "description": "Special bonus",
}
```

- **Path / Query params:**

  - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `code` уникален в рамках организации `(org_id, code)`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$, `toLowerCase()`, `trim`, обязательное поле
    - `title` - `string[1..150]`, `trim`, обязательное поле
    - `default_delta` - `smallint` целое, обязательное поле
    - `is_active` - `boolean`
    - `description` - `string[0..1000]`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$, `toLowerCase()`, `trim`, обязательное поле
    - `title` - `string[1..150]`, `trim`, обязательное поле
    - `default_delta` - `smallint` целое, обязательное поле
    - `is_active` - `boolean`
    - `description` - `string[0..1000]`

  - DB:

    - `(org_id, code)` - `UNIQUE` проверка уникальности

- **Responses**:

  - **201 Created** правило создано
```json
{ 
  "id": 108,
  "code": "BONUS",
  "title": "Bonus points",
  "default_delta": 5,
  "is_active": true,
  "description": "Special bonus",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z",
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
{ "message": "title is required" }
```
```json
{ "message": "default_delta is required" }
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
{ "message": "Permission denied: You are not allowed to create rules in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```

  - **409 Conflict** дубликат
```json
{ "message": "Rule code 'bonus' is already in use in this organization." }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Проверка на уникальность кода
SELECT id FROM penguin_rules 
WHERE org_id = :org_id AND code = :code 
LIMIT 1;

--Создание правила
INSERT INTO penguin_rules (org_id, code, title, default_delta, is_active, description, created_at, updated_at)
VALUES (:org_id, :code, :title, :default_delta, COALESCE(:is_active, 1), :description, NOW(), NOW());

--Для ответа
SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
FROM penguin_rules
WHERE id = LAST_INSERT_ID();

```

#### Изменить правило:   `PUT /orgs/:orgId/penguin-rules/:id`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "code": "BONUS",
  "title": "Bonus points",
  "default_delta": 5,
  "is_active": true,
  "description": "Special bonus",
}
```

- **Path / Query params:**

  - `orgId` - целое число
  - `id` - целое число

- **Бизнес-правила:**

  - При смене `code` проверить на уникальность `(org_id, code)`

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$, `toLowerCase()`, `trim`
    - `title` - `string[1..150]`, `trim`
    - `default_delta` - `smallint` целое
    - `is_active` - `boolean`
    - `description` - `string[0..1000]`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `code` - ^\[A-Za-z0-9.\_-\]{2,50}\$, `toLowerCase()`, `trim`
    - `title` - `string[1..150]`, `trim`
    - `default_delta` - `smallint` целое
    - `is_active` - `boolean`
    - `description` - `string[0..1000]`

  - DB:

    - `(org_id, code)` - UNIQUE проверка уникальности

- **Responses**:

  - **200 OK**
```json
{ 
  "id": 108,
  "code": "BONUS",
  "title": "Bonus points",
  "default_delta": 5,
  "is_active": true,
  "description": "Special bonus",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to edit a rule in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "Rule not found" }
```

  - **409 Conflict** дубликат
```json
{ "message": "Rule code 'bonus' is already in use in this organization." }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Проверка на уникальность кода, если меняем
SELECT id FROM penguin_rules
WHERE org_id = :org_id AND code = :code AND id <> :id
LIMIT 1;

--Обновление правила
UPDATE penguin_rules
SET code          = COALESCE(:code, code),
    title         = COALESCE(:title, title),
    default_delta = COALESCE(:default_delta, default_delta),
    is_active     = COALESCE(:is_active, is_active),
    description   = COALESCE(:description, description),
    updated_at    = NOW()
WHERE org_id = :org_id AND id = :id;

--Для ответа
SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
FROM penguin_rules
WHERE org_id = :org_id AND id = :id
LIMIT 1;

```


#### Удалить правило:  `DELETE /orgs/:orgId/penguin-rules/:id`

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
  - Правило не удаляем, а деактивируем `is_active=false`

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
  "id": 108,
  "code": "BONUS",
  "title": "Bonus points",
  "default_delta": 5,
  "is_active": true,
  "description": "Special bonus",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to remove a rule in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "Rule not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Деактивация правила
UPDATE penguin_rules
SET is_active = 0, updated_at = NOW()
WHERE org_id = :org_id AND id = :id;

--Для ответа
SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
FROM penguin_rules
WHERE org_id = :org_id AND id = :id
LIMIT 1;

```

### Групповое начисление пингвинов penguin_batches

`POST /orgs/:orgId/penguins/batches`    
создать групповое начисление/списание и разнести по студентам  

`GET /orgs/:orgId/penguins/batches?groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=`    
получить список групповых начислений  

`GET /orgs/:orgId/penguins/batches/:id/students?page=&limit=`    
получить список студентов при групповом начислении  

`GET /orgs/:orgId/penguins/batches/:id`    
получить групповое начисление по id  

#### Создать групповое начисление/списание и разнести по студентам:  `POST /orgs/:orgId/penguins/batches`

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
  "students": [3001, 3002, 3003],
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
{ "message": "Permission denied: You are not allowed to award penguins in this organization." }
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
{ "message": "User does not have an active 'teacher' role in this organization." }
```
```json
{ "message": "Teacher is not assigned to this subject in this group." }
```
```json
{ "message": "Subject is not assigned to the group." }
```
```json
{ "message": "Some students do not have an active 'student' role in this organization." }
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


#### Получить список групповых начислений:  `GET /orgs/:orgId/penguins/batches?groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=`

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
  "batches": 
  [ {
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
    },
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
{ "message": "Permission denied: You are not allowed to view penguins in this organization." }
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

#### Получить список студентов при групповом начислении:  `GET /orgs/:orgId/penguins/batches/:id/students?page=&limit=`

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
  "students": 
  [
    { 
      "id": 3001, 
      "full_name": "Alice Student" 
    },
    { 
      "id": 3002, 
      "full_name": "Bob Student" 
    },
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
{ "message": "Permission denied: You are not allowed to view penguins in this organization." }
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


#### Получить групповое начисление по id (детальная карточка):  `GET /orgs/:orgId/penguins/batches/:id`

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
    },
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
{ "message": "Permission denied: You are not allowed to view penguins in this organization." }
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


### Логирование (Индивидуальное начисление / списание) penguin_ledger

`POST /orgs/:orgId/penguins/ledger`  
создать индивидуальное начисление/списание пингвинов  

`GET /orgs/:orgId/penguins/ledger?q=&studentId=&groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=`    
получить список начислений/снятий  

`GET /orgs/:orgId/penguins/ledger/:id`    
получить операцию по id  

#### Создать индивидуальное начисление/списание пингвинов:  `POST /orgs/:orgId/penguins/ledger`

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
  "created_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to award penguins in this organization." }
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
{ "message": "User does not have an active 'teacher' role in this organization." }
```
```json
{ "message": "Teacher is not assigned to this subject in this group." }
```
```json
{ "message": "Subject is not assigned to the group." }
```
```json
{ "message": "Student do not have an active 'student' role in this organization." }
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


#### Получить список начислений/списаний (Журнал):  `GET /orgs/:orgId/penguins/ledger?q=&studentId=&groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=`  

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
  "ledger": 
  [
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
      "created_at": "2025-09-02T10:11:12Z",
    },
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
{ "message": "Permission denied: You are not allowed to view penguins in this organization." }
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


#### Получить одно начисление/списание пингвина по id:  `GET /orgs/:orgId/penguins/ledger/:id`

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
  "created_at": "2025-09-02T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to view penguins in this organization." }
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


### Статистика (день/неделя/месяц) penguin_ledger

`GET /orgs/:orgId/penguins/stats/daily?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`    
получить статистику за день  

`GET /orgs/:orgId/penguins/stats/weekly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`   
получить статистику за неделю  

`GET /orgs/:orgId/penguins/stats/monthly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`    
получить статистику за месяц  

#### Получить статистику за день: `GET /orgs/:orgId/penguins/stats/daily?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`

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
      "net_total":  5, 
      "awards":  8, 
      "deducts": -3, 
      "count_ops": 4 
    },
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
{ "message": "Permission denied: You are not allowed to view penguin statistics in this organization." }
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

#### Получить статистику за неделю:  `GET /orgs/:orgId/penguins/stats/weekly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`

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
{ "message": "Permission denied: You are not allowed to view penguin statistics in this organization." }
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

#### Получить статистику за месяц:  `GET /orgs/:orgId/penguins/stats/monthly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`

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
{ "message": "Permission denied: You are not allowed to view penguin statistics in this organization." }
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


### Балансы penguin_balances

`GET /orgs/:orgId/students/:studentId/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=`    
получить баланс студента  

`GET /orgs/:orgId/my/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=`    
получить свой баланс пингвинов (студент для себя)  

`GET /orgs/:orgId/penguins/leaderboard?groupId=&subjectId=&directionId=&page=&limit=`    
получить лидборд (топ студентов)  


#### Получить баланс студента по id:  `GET /orgs/:orgId/students/:studentId/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=`

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
  "balances": 
  [
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
    "total": 15,
    },
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
{ "message": "Permission denied: You are not allowed to view this student's penguin balances in this organization." }
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

##### Получить свой баланс пингвинов:  `GET /orgs/:orgId/my/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=`

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
  "balances": 
  [
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
    "total": 15,
    },
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

#### Получить лидборд (топ студентов):  `GET /orgs/:orgId/penguins/leaderboard?groupId=&subjectId=&directionId=&page=&limit=`

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
  "leaderboard": 
  [
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
    "total": 15,
    },
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
{ "message": "At least one leaderboard scope is required groupId+subjectId or directionId+subjectId" }
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
{ "message": "Permission denied: You are not allowed to view this resource in this organization." }
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


### Оповещения notifications

`GET /orgs/:orgId/notifications?is_read=&page=&limit=`  получить уведомления текущего пользователя

`PUT /orgs/:orgId/notifications/:id/read`  пометить уведомление прочитанным

#### Получить уведомления текущего пользователя:  `GET /orgs/:orgId/notifications?is_read=&page=&limit=`

суперадмин, админ, преподаватель, сотрудник организации, студент

  `is_read`     
  `page` - номер страницы, по умолчанию 1  
  `limit` - количество на странице (по умолчанию 50, ≤ 200)  

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `is_read` - boolean
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit` - целое число, 1..200, по умолчанию 50

- **Бизнес-правила:**

  - Возвращаем только персональные (`user_id` = текущий) в этой организации

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `is_read` - `boolean`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `is_read` - `boolean`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**
```json
{ 
  "total": 2,
  "page": 1,
  "limit": 50,
  "notifications": [
    {
      "id": 50001,
      "type": "penguin_award",
      "payload": { 
        "delta": 3, 
        "reason": "Homework week 3", 
        "subject_id": 108, 
        "batch_id": 90001 
        },
      "is_read": false,
      "created_at": "2025-09-02T10:11:12Z"
    },
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
{ "message": "Permission denied: You are not allowed to view notifications in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "User not found" }
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
FROM notifications
WHERE org_id = :org_id
  AND user_id = :current_user_id
  AND (COALESCE(:is_read, -1) = -1 OR is_read = :is_read);

--page
SELECT id, type, payload, is_read, created_at
FROM notifications
WHERE org_id = :org_id
  AND user_id = :current_user_id
  AND (COALESCE(:is_read, -1) = -1 OR is_read = :is_read)
ORDER BY created_at DESC, id DESC
LIMIT @limit OFFSET @offset;

```

#### Пометить уведомление прочитанным:  `PUT /orgs/:orgId/notifications/:id/read`

владелец уведомления

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "id": 50001, 
  "is_read": true
}
```

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
    - `id` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

- **Responses**:

  - **200 OK**

```json
 {
 "id": 50001,
 "type": "penguin_award",
 "payload": {
    "delta": 3,
    "reason": "Homework week 3",
    "subject_id": 108,
    "batch_id": 90001 
    },
 "is_read": true,
 "created_at": "2025-09-02T10:11:12Z"
 },
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
{ "message": "Permission denied: ou can only modify your own notifications." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "Notification not found" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Проверка что уведомление принадлежит текущему юзеру
SELECT id FROM penguin_rules
WHERE org_id = :org_id AND code = :code AND id <> :id
LIMIT 1;

--Обновление 
UPDATE notifications
SET is_read = 1
WHERE id = :id AND org_id = :org_id AND user_id = :current_user_id;

--Для ответа
SELECT id, type, payload, is_read, created_at FROM notifications 
WHERE id = :id AND org_id = :org_id AND user_id = :current_user_id
LIMIT 1;

```

### Billing

### Планы 		subscription_plans

`GET /billing/plans`  получить список всех тарифных планов


#### Получить список всех тарифных планов:  `GET /billing/plans`

Публично (без авторизации)

- **Content-type:** `application/json`

- **Body:** `{}`

- **Бизнес-правила:**

  - Доступно всем пользователям без аутентификации
  - Возвращаются только активные планы (`is_active = true`)

- **Backend-правила:**

  - Нет проверки аутентификации
  - Возвращаются только планы с `is_active = true`

- **Validation**:

  - Frontend: нет параметров
  - Backend:  нет параметров

- **Responses**:

  - **200 OK**
```json
{ 
  "plans": [
    {
      "id": 1,
      "code": "basic_monthly",
      "name": "Basic Plan",
      "description": "Basic plan for small teams",
      "interval": "month",
      "price": 19.90,
      "currency": "EUR",
      "max_staff": 2,
      "max_teachers": 5,
      "max_groups": 3,
      "max_students_per_group": 25,
      "is_active": true,
      "features_json": {
        "dashboard": true,
        "reports": false,
        "support": "basic"
        },
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": 2,
      "code": "premium_yearly",
      "name": "Premium Plan",
      "description": "Premium plan with all features",
      "interval": "year",
      "price": 199.90,
      "currency": "EUR",
      "max_staff": 10,
      "max_teachers": 50,
      "max_groups": 20,
      "max_students_per_group": 30,
      "is_active": true,
      "features_json": {
        "dashboard": true,
        "reports": true,
        "analytics": true,
        "support": "priority"
        },
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

  - **400 Bad Request** некорректное тело запроса
```json
{ "message": "Invalid request" }
```

  - **500 Internal Server Error** 
```json
{ "message": "Failed to load subscription plans" }
```

- **SQL**

```sql
SELECT
  id,
  code,
  name,
  description,
  `interval`,
  price,
  currency,
  max_staff,
  max_teachers,
  max_groups,
  max_students_per_group,
  is_active,
  features_json,
  created_at
FROM subscription_plans
WHERE is_active = TRUE
ORDER BY price ASC, created_at DESC;

```

### Подписки		org_subscriptions

`GET /orgs/:orgId/billing/subscription`  получить текущую активную подписку организации


#### Получить текущую активную подписку организации:  `GET /orgs/:orgId/billing/subscription`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - Возвращается подписка с `is_current = true`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**
```json
{ 
  "id": 123,
  "org_id": 456,
  "plan_id": 1,
  "status": "active",
  "is_current": true,
  "auto_renew": true,
  "cancel_at_period_end": false,
  "current_period_start": "2024-01-01T00:00:00Z",
  "current_period_end": "2024-01-31T23:59:59Z",
  "trial_end_at": null,
  "canceled_at": null,
  "provider": "stripe",
  "external_subscription_id": "sub_123456789",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
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
{ "message": "Permission denied: You are not allowed to view a subscription in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "Active subscription not found" }
```

- **SQL**

```sql
-- Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

-- Текущая подписка 
SELECT
  id,
  org_id,
  plan_id,
  status,
  is_current,
  auto_renew,
  cancel_at_period_end,
  current_period_start,
  current_period_end,
  trial_end_at,
  canceled_at,
  provider,
  external_subscription_id,
  created_at,
  updated_at
FROM org_subscriptions
WHERE org_id = :org_id
  AND is_current = TRUE
LIMIT 1;

```

### Счета 		invoices

`GET /orgs/:orgId/billing/invoices?status=&page=&limit=`  получить список счетов организации

`POST /orgs/:orgId/billing/invoices`  создать инвойс для активной подписки (ручной триггер)

#### Получить список счетов организации:  `GET /orgs/:orgId/billing/invoices?status=&page=&limit=`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `status` - строка, опционально (`draft, open, paid, void, uncollectible, refunded`)
  - `page` - целое число >= 1, по умолчанию 1
  - `limit` - целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `status` - `draft|open|paid|void|uncollectible|refunded`, опционально
    - `page` - целое число \>= 1, по умолчанию 1
    - `limit`- целое число, 1..200, по умолчанию 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `status` - `draft|open|paid|void|uncollectible|refunded`, опционально
    - `page` - целое число \>= 1, по умолчанию 1
    - `limit`- целое число, 1..200, по умолчанию 50

- **Responses**:

  - **200 OK**
```json
{ 
 "total": 15,
  "page": 1,
  "limit": 50,
  "invoices": [
    {
      "id": 1001,
      "org_id": 456,
      "subscription_id": 123,
      "number": "INV-2024-001",
      "amount": 199.90,
      "currency": "EUR",
      "period_start": "2024-01-01T00:00:00Z",
      "period_end": "2024-01-31T23:59:59Z",
      "due_at": "2024-02-15T23:59:59Z",
      "status": "paid",
      "external_invoice_id": "in_123456789",
      "hosted_invoice_url": "https://pay.stripe.com/invoice/xxx",
      "created_at": "2024-01-01T00:00:00Z",
      "paid_at": "2024-01-15T10:30:00Z"
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
{ "message": "Permission denied: You are not allowed to view invoices in this organization." }
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
FROM invoices
WHERE org_id = :org_id
  AND (:status IS NULL OR status = :status);

--page
SELECT
  id,
  org_id,
  subscription_id,
  number,
  amount,
  currency,
  period_start,
  period_end,
  due_at,
  status,
  external_invoice_id,
  hosted_invoice_url,
  created_at,
  paid_at
FROM invoices
WHERE org_id = :org_id
  AND (:status IS NULL OR status = :status)
ORDER BY created_at DESC, id DESC
LIMIT @limit OFFSET @offset;

```

#### Создать инвойс для активной подписки (ручной триггер):  `POST /orgs/:orgId/billing/invoices`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** 

```json
{ 
  "subscription_id": 123,        
  "due_in_days": 14,            
  "as_of": "2025-09-19T00:00:00Z"
}
```

- **Path / Query params:**

  - `orgId` - целое число

- **Бизнес-правила:**

  - `subscription_id` должен принадлежать организации
  - Подписка должна быть `status='active'` и `is_current = true`
  - Инвойс создается за текущий биллинговый период подписки, если `current_period_end <= as_of` (по умолчанию `NOW()`), т.е. период завершен (`post-paid` сценарий)
  - Нельзя создать повторно инвойс за тот же период (`subscription_id, period_start, period_end` уникальны)
  - Номер инвойса формируется как `INV-YYYYMM-###`, где `YYYYMM` — месяц `period_end`, счeтчик `###` - порядковый номер для данной организации и месяца
  - Сумма и валюта берутся из тарифа (`subscription_plans`)
  - `due_at = period_end + due_in_days` (по умолчанию 14 дней)

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` - любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - Вся операция - в транзакции
  - Должны быть заведены уникальные индексы:
    - `UNIQUE(subscription_id, period_start, period_end)` — защита от дублей за один период
    - `UNIQUE(org_id, number)` — защита от конфликтов нумерации

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `subscription_id` - /^[1-9]\d{0,9}$/ - обязательное поле
    - `due_in_days` - целое 1..60
    - `as_of`- валидный ISO-8601 datetime, (по умолчанию `NOW()`)

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `subscription_id` - /^[1-9]\d{0,9}$/ - обязательное поле
    - `due_in_days` - целое 1..60
    - `as_of`- валидный ISO-8601 datetime, (по умолчанию `NOW()`)

- **Responses**:

  - **201 Created**
```json
{ 
 "id": 1001,
  "org_id": 456,
  "subscription_id": 123,
  "number": "INV-202501-001",
  "amount": 199.90,
  "currency": "EUR",
  "period_start": "2025-01-01T00:00:00Z",
  "period_end": "2025-01-31T23:59:59Z",
  "due_at": "2025-02-14T23:59:59Z",
  "status": "open",
  "external_invoice_id": null,
  "hosted_invoice_url": null,
  "created_at": "2025-02-01T00:00:00Z",
  "paid_at": null
}
```

  - **400 Bad Request** некорректное тело запроса
```json
{ "message": "Invalid path parameter: orgId must be integer" }
```
```json
{ "message": "subscription_id is required" }
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
{ "message": "Permission denied: Only administrators can create invoices." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "Subscription not found" }
```

  - **409 Conflict** 
```json
{ "message": "Invoice for this subscription period already exists" }
```
```json
{ "message": "Subscription period is not finished yet" }
```

  - **500 Internal Server Error** отказано в доступе
```json
{ "message": "Failed to create invoice" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

START TRANSACTION;

-- 1) Фиксируем строку подписки, чтобы стабилизировать период
SELECT id, org_id, plan_id, status, is_current, current_period_start, current_period_end
FROM org_subscriptions
WHERE id = :subscription_id
  AND org_id = :org_id
  AND status = 'active'
  AND is_current = TRUE
FOR UPDATE;

-- 2) Вставка инвойса «за завершeнный период», если такого ещe нет
INSERT INTO invoices (
  org_id,
  subscription_id,
  number,
  amount,
  currency,
  period_start,
  period_end,
  due_at,
  status,
  created_at
)
SELECT
  org_subscriptions.org_id,
  org_subscriptions.id AS subscription_id,
  CONCAT(
    'INV-',
    DATE_FORMAT(org_subscriptions.current_period_end, '%Y%m'),
    '-',
    LPAD(
      1 + COALESCE((
        SELECT COUNT(*)
        FROM invoices
        WHERE invoices.org_id = org_subscriptions.org_id
          AND DATE_FORMAT(invoices.period_end, '%Y%m') = DATE_FORMAT(org_subscriptions.current_period_end, '%Y%m')
      ), 0),
      3, '0'
    )
  ) AS number,
  subscription_plans.price      AS amount,
  subscription_plans.currency   AS currency,
  org_subscriptions.current_period_start AS period_start,
  org_subscriptions.current_period_end   AS period_end,
  DATE_ADD(org_subscriptions.current_period_end, INTERVAL :due_in_days DAY) AS due_at,
  'open'        AS status,
  NOW()         AS created_at
FROM org_subscriptions
JOIN subscription_plans  ON subscription_plans.id = org_subscriptions.plan_id
WHERE org_subscriptions.id = :subscription_id
  AND org_subscriptions.org_id = :org_id
  AND org_subscriptions.status = 'active'
  AND org_subscriptions.is_current = TRUE
  AND org_subscriptions.current_period_end <= :as_of
  AND NOT EXISTS (
    SELECT 1
    FROM invoices invoices2
    WHERE invoices2.subscription_id = org_subscriptions.id
      AND invoices2.period_start     = org_subscriptions.current_period_start
      AND invoices2.period_end       = org_subscriptions.current_period_end
  );

-- 3) Проверяем, вставилось ли (ROW_COUNT() в коде):
--    0 строк → либо период не завершeн, либо дубль. 

COMMIT;

-- Получить созданный инвойс:
SELECT * FROM invoices 
WHERE id = LAST_INSERT_ID();


```


### Оплаты 		payments

`GET /orgs/:orgId/billing/payments?status=&page=&limit=`  получить историю платежей организации


#### Получить историю платежей организации:  `GET /orgs/:orgId/billing/payments?status=&page=&limit=`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `status` - строка, опционально (`succeeded, failed, pending, refunded`)
  - `page` - целое число >= 1, по умолчанию 1
  - `limit` - целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `status` - `succeeded|failed|pending|refunded`, опционально
    - `page` - целое число \>= 1, по умолчанию 1
    - `limit`- целое число, 1..200, по умолчанию 50

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `status` - `succeeded|failed|pending|refunded`, опционально
    - `page` - целое число \>= 1, по умолчанию 1
    - `limit`- целое число, 1..200, по умолчанию 50

- **Responses**:

  - **200 OK**
```json
{ 
  "total": 8,
  "page": 1,
  "limit": 50,
  "payments": [
    {
      "id": 5001,
      "org_id": 456,
      "invoice_id": 1001,
      "amount": 199.90,
      "currency": "EUR",
      "provider": "stripe",
      "external_payment_id": "ch_123456789",
      "status": "succeeded",
      "error_code": null,
      "error_message": null,
      "created_at": "2024-01-15T10:30:00Z",
      "settled_at": "2024-01-15T10:30:00Z"
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
{ "message": "Permission denied: You are not allowed to view payments in this organization." }
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
FROM payments
WHERE org_id = :org_id
  AND (:status IS NULL OR status = :status);

--page
SELECT
  id,
  org_id,
  invoice_id,
  amount,
  currency,
  provider,
  external_payment_id,
  status,
  error_code,
  error_message,
  created_at,
  settled_at
FROM payments
WHERE org_id = :org_id
  AND (:status IS NULL OR status = :status)
ORDER BY created_at DESC, id DESC
LIMIT @limit OFFSET @offset;

```