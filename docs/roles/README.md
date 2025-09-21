## Роли

`GET /roles` получить список ролей

`POST /orgs/:orgId/users/:userId/roles/:role_id` назначить роль

`DELETE /orgs/:orgId/users/:userId/roles/:role_id` отозвать роль

### Получить все роли (список ролей): 

`GET /roles`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Responses**:

  - **200 OK**

```json
{ 
  [
  {
    "id": 102,
    "code": "org_admin",
    "name": "администратор учебной организации",
    "created_at": "2025-09-02T10:11:12Z",
    "updated_at": "2025-09-02T10:11:12Z"
  },
  {
    "id": 103,
    "code": "org_staff",
    "name": "сотрудник учебной организации",
    "created_at": "2025-09-02T10:11:12Z",
    "updated_at": "2025-09-02T10:11:12Z"
  },
  {
    "id": 104,
    "code": "teacher",
    "name": "преподаватель учебной организации",
    "created_at": "2025-09-02T10:11:12Z",
    "updated_at": "2025-09-02T10:11:12Z"
   },
]
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

- **SQL**

```sql
--Все роли:
SELECT id, code, name, created_at, updated_at
FROM roles
ORDER BY code ASC;

--Поиск по букве:
--q = содержит букву,если q пустой/NULL — возвращаем все
SELECT id, code, name, created_at, updated_at
FROM roles
WHERE COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
   OR code LIKE CONCAT('%', :q, '%')
   OR name LIKE CONCAT('%', :q, '%')
ORDER BY code ASC;

```


### Назначить роль: 

`POST /orgs/:orgId/users/:userId/roles/:role_id`

Связываем **пользователь - роль - учебное заведение**

Роли назначает суперадмин, админ

- **Инвариант** Для одного пользователя в рамках одной организации **нельзя назначить одну и ту же роль дважды**.  
Технически обеспечивается композитным уникальным индексом:

`UNIQUE (user_id, org_id, role_id)`

- **Идемпотентность.** Повторный вызов с той же ролью для того же пользователя в той же организации **не должен создавать дубликаты**.

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Backend-правила:**

  - роль существует (`roles.code` известен);
  - пользователь существует и должен принадлежать организации (бизнес-правила);
  - `operator_id` - берем из `jwt`

- **Validation**:

> Все валидации производим по `orgId`, `userId`, `role_id` из `URL` и правам с `JWT`.

  - Frontend:

    - `orgId` - ^\[1-9\]\d{0,9}\$ - обязательное поле
    - `userId` - ^\[1-9\]\d{0,9}\$ - обязательное поле
    - `role_id` - ^\[1-9\]\d{0,9}\$ - обязательное поле

  - Backend:

    - `orgId` - организация существует
    - `userId` - пользователь существует
    - `role_id` - роль существует

  - DB:

    - `(user_id, org_id, role_id)` - `UNIQUE` проверка уникальности

- **Responses**:

  - **201 Created** роль назначена впервые

```json
{ 
  "org_id": {
	  "id": 123,
	  "name": "ICH IT Career Hub", 
	  },
  "user_id": {
	  "id": 2054,
	  "full_name": "Petr Sidorov",
	  },
  "role_id": {
	  "id": 103,
    "code": "org_staff",
    "name": "сотрудник учебной организации",
	  },
  "operator_id": {
	  "id": 120,
	  "full_name": "Ivan Petrov",
	  },
  "assigned_at" : "2025-09-02T10:11:12Z",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
 }
```

  - **200 OK** роль уже была назначена (идемпотентный повтор)

```json
{ 
  "org_id": {
	  "id": 123,
	  "name": "ICH IT Career Hub", 
	  },
  "user_id": {
	  "id": 2054,
	  "full_name": "Petr Sidorov",
	  },
  "role_id": {
	  "id": 103,
    "code": "org_staff",
    "name": "сотрудник учебной организации",
	  },
  "operator_id": {
	  "id": 120,
	  "full_name": "Ivan Petrov",
	  },
  "assigned_at": "2025-09-02T10:11:12Z",
  "created_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
 }
```

  - **400 Bad Request** path-параметры невалидные по формату/типу
```json
{ "message": "Invalid path parameter" }
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
{ "message": "Permission denied: You are not allowed to assign this role." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "User not found" }
```
```json
{ "message": "Role not found" }
```

  - **409 Conflict** превышен лимит (согласно тарифного плана)
```json
{ "message": "Plan limits exceeded for role 'org_staff" }
```

- **SQL**

```sql
--Проверки:
--1) Роль существует
SELECT 1 FROM roles WHERE id = :role_id 
LIMIT 1;

--2) Организация существует и активна/ожидает подтверждения
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--3) Пользователь существует и не удален
SELECT 1 FROM users 
WHERE id = :user_id AND status <> 'deleted' 
LIMIT 1;

--4) лимиты тарифа по роли (например org_staff)
SELECT subscription_plans.max_staff AS max_allowed,
       (
         SELECT COUNT(*)
         FROM user_roles
         WHERE user_roles.org_id = :org_id
           AND user_roles.role_id = :role_staff_id
           AND user_roles.revoked_at IS NULL
       ) AS currently_used
FROM org_subscriptions 
JOIN subscription_plans ON subscription_plans.id = org_subscriptions.plan_id
WHERE org_subscriptions.org_id = :org_id
  AND org_subscriptions.is_current = 1
LIMIT 1;

--Вставка (идемпотентность):
INSERT INTO user_roles (user_id, org_id, role_id, operator_id, assigned_at, created_at, updated_at, revoked_at)
VALUES (:user_id, :org_id, :role_id,:operator_id, NOW(), NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  -- если запись уже была, «реактивируем» ее
  revoked_at = NULL,
  -- фиксируем, кто назначил/изменил роль
  operator_id = :operator_id,
  updated_at = NOW(),
  -- сохраняем самую раннюю дату назначения (чтобы история не "скакала")
  assigned_at = COALESCE(user_roles.assigned_at, NOW());

--Вернуть назначение для ответа:
SELECT user_roles.user_id, user_roles.org_id, user_roles.role_id, user_roles.assigned_at, user_roles.created_at, user_roles.updated_at,
       roles.code AS role_code, roles.name AS role_name,
       users.username, users.full_name,
       organizations.name AS org_name
FROM user_roles
JOIN roles ON roles.id = user_roles.role_id
JOIN users ON users.id = user_roles.user_id
JOIN organizations ON organizations.id = user_roles.org_id
WHERE user_roles.user_id = :user_id AND user_roles.org_id = :org_id AND user_roles.role_id = :role_id;

```

### Отозвать роль: 

`DELETE /orgs/:orgId/users/:userId/roles/:role_id`

Роли отзывает суперадмин, админ

Вместо физического удаления мягкий отзыв

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Validation**:

  - Frontend:

    - `orgId` - ^\[1-9\]\d{0,9}\$ - обязательное поле
    - `userId` - ^\[1-9\]\d{0,9}\$ - обязательное поле
    - `role_id` - ^\[1-9\]\d{0,9}\$ - обязательное поле

  - Backend:

    - `orgId` - организация существует
    - `userId` - пользователь существует
    - `role_id` - роль существует

- **Responses**:

  - **200 OK** роль отозвана
```json
{ 
  "org_id": {
	  "id": 123,
	  "name": "ICH IT Career Hub", 
	  },
  "user_id": {
	  "id": 2054,
	  "username": "sidorov_p",
	  "full_name": "Petr Sidorov",
	  },
  "role_id": {
	  "id": 103,
    "code": "org_staff",
    "name": "сотрудник учебной организации",
	  },
  "operator_id": {
	  "id": 120,
	  "username": "admin.ich",
	  "full_name": "Ivan Petrov",
	  },
  "assigned_at": "2025-08-02T10:11:12Z",
  "revoked_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
 }
```

  - **400 Bad Request** path-параметры невалидные по формату/типу
```json
{ "message": "Invalid path parameter" }
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
{ "message": "Permission denied: You are not allowed to assign this role." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "User not found" }
```
```json
{ "message": "Role not found" }
```

- **SQL**

```sql
--Проверки:
--1) Роль существует
SELECT 1 FROM roles WHERE id = :role_id 
LIMIT 1;

--2) Организация существует и активна/ожидает подтверждения
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--3) Пользователь существует и не удален
SELECT 1 FROM users 
WHERE id = :user_id AND status <> 'deleted' LIMIT 1;
Отзыв роли:
UPDATE user_roles
SET revoked_at = NOW(), updated_at = NOW()
WHERE user_id = :user_id AND org_id = :org_id AND role_id = :role_id
  AND revoked_at IS NULL;

--Вернуть назначение для ответа:
SELECT user_roles.user_id, user_roles.org_id, user_roles.role_id, user_roles.revoked_at, user_roles.updated_at,
       roles.code AS role_code, roles.name AS role_name,
       users.username, users.full_name,
       organizations.name AS org_name
FROM user_roles
JOIN roles ON roles.id = user_roles.role_id
JOIN users ON users.id = user_roles.user_id
JOIN organizations ON organizations.id = user_roles.org_id
WHERE user_roles.user_id = :user_id AND user_roles.org_id = :org_id AND user_roles.role_id = :role_id;

```