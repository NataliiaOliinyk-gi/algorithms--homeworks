## Пользователи

`POST /orgs/:orgsId/users` регистрация пользователя в организации с  одновременным назначением роли и отправкой приглашения на email

`GET /orgs/:orgId/users/:userId` получить профиль юзера

`DELETE /orgs/:orgsId/users/:userId` удалить пользователя

`GET /orgs/:org_id/users?role=&q=&include_revoked=&page=&limit=`  получить список преподавателей/ студентов/сотрудников в учебной организации

`GET /orgs/:orgsId/users/me` получить профиль (свой)

`PUT /orgs/:orgsId/users/me` редактировать свой профиль

`POST /orgs/:orgId/users/me/password` сменить пароль



### Регистрация пользователя:  `POST /orgs/:orgsId/users`

суперадмин, админ - регистрация преподавателя, сотрудника организации, студента;

при регистрации одновременно назначается роль и формируется приглашение для пользователя с одноразовым паролем для входа в систему.

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "email": "ivan.petrov@example.com",
  "full_name": "Ivan Petrov",
  "role_id": 103,
 }
```

- **Правила:**

  - `email` - обязательное поле, формат `email`
  - `full_name` - обязательное поле
  - `role_id` - обязательное поле

- **Backend-правила:**

  - `orgId` из пути:
    - для `org_admin` должен совпадать с `org` в его `JWT`
    - `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `email` глобально уникален, один `email` - ровно одна учетная запись во всей системе
  - Роль `role_id` существует (`roles`), запрещено через этот роут назначать глобальные роли (например `superadmin`) - только в рамках учебной организации (`org_admin`, `org_staff`, `teacher`, `student`)
  - Проверка лимита плана для роли
  - Пароль от клиента не принимаем, генерируем приглашение - пишем запись в `org_invitations` и отправляем письмо

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `email` - /^\[A-Za-z0-9.\_%+-\]+@\[A-Za-z0-9.-\]+\\\[A-Za-z\]{2,}\$/ - обязательное поле, `trim`
    - `full_name` - `string[0..150]` - обязательное поле, `trim`
    - `role_id` - /^\[1-9\]\d{0,9}\$/ - обязательное поле

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - обязательно, число
    - `email` - /^\[A-Za-z0-9.\_%+-\]+@\[A-Za-z0-9.-\]+\\\[A-Za-z\]{2,}\$/ - обязательное поле, trim
    - `full_name` - `string[0..150]` - обязательное поле, trim
    - `role_id` - /^\[1-9\]\d{0,9}\$/ - обязательное поле
    - `orgId` - организация существует
    - `roleId` - роль существует
    - лимит плана для роли

  - DB:

    - `email` - `UNIQUE` проверка уникальности
    - `user_roles` `(user_id, org_id, role_id)` - `UNIQUE` проверка уникальности - уникальность одной роли на одну организацию для одного юзера

- **Responses**:

  - **201 Created** создан новый пользователь, назначена роль, создано приглашение

```json
{ 
  "user": {
    "id": 2054,
    "email": "ivan.petrov@example.com",
    "full_name": "Ivan Petrov",
    "preferred_lang": "en",
    "status": "pending",
    "created_at": "2025-09-02T10:11:12Z",
    "updated_at": "2025-09-02T10:11:12Z"
    },
  "organization": { 
    "id": 123, 
    "name": "ICH IT Career Hub" 
    },
  "role": { 
    "id": 103, 
    "code": "org_staff", 
    "name": "сотрудник учебной организации" 
   },
  "assignment": {
    "operator_id": 120,
    "assigned_at": "2025-09-02T10:11:12Z",
    "created_at": "2025-09-02T10:11:12Z",
    "updated_at": "2025-09-02T10:11:12Z"
  },
  "invitation": {
    "expires_at": "2025-09-09T10:11:12Z",
    "status": "pending"
  }
 }
```

  - **400 Bad Request** некорректное тело запроса
```json
{ "message": "full_name is a required field" }
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
{ "message": "Permission denied: You are not allowed to create users in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "Role not found" }
```

  - **409 Conflict** дубликат
```json
{ "message": "The email 'ivan.petrov@example.com' is already in use." }
```

  - **409 Conflict** превышен лимит (согласно тарифного плана)
```json
{ "message": "Plan limits exceeded for role 'org_staff." }
```

- **SQL**

```sql
--Проверки:
--1) Организация существует и активна/ожидает подтверждения
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--2) Роль существует
SELECT 1 FROM roles WHERE id = :role_id 
LIMIT 1;

--3) лимиты тарифа по роли 
-- узнаем код роли
SELECT code INTO @role_code FROM roles WHERE id = :role_id;
--берем лимит из плана под эту роль
SELECT
  CASE @role_code
    WHEN 'org_staff' THEN subscription_plans.max_staff
    WHEN 'teacher'   THEN subscription_plans.max_teachers
    WHEN 'student'   THEN subscription_plans.max_groups * subscription_plans.max_students_per_group
    ELSE NULL
  END AS max_allowed,
CASE roles.code
    WHEN 'student' THEN (
      SELECT COUNT(DISTINCT user_roles.user_id)
      FROM user_roles
      WHERE user_roles.org_id = :org_id
        AND user_roles.role_id = roles.id        
        AND user_roles.revoked_at IS NULL
    )
    ELSE (
     SELECT COUNT(*)
         FROM user_roles
         WHERE user_roles.org_id = :org_id
           AND user_roles.role_id = :role_id
           AND user_roles.revoked_at IS NULL

    )
  END AS currently_used
FROM org_subscriptions 
JOIN subscription_plans ON subscription_plans.id = org_subscriptions.plan_id
JOIN roles ON roles.id = :role_id
WHERE org_subscriptions.org_id = :org_id
  AND org_subscriptions.is_current = 1
LIMIT 1;

--4)существует ли юзер
SELECT id INTO @user_id
FROM users
WHERE email = :email AND status <> 'deleted'
LIMIT 1;

--Создать пользователя
INSERT INTO users (email, full_name, password_hash, preferred_lang, status, created_at, updated_at)
SELECT :email, :full_name, NULL, COALESCE(:preferred_lang, 'en'), 'pending', NOW(), NOW()
WHERE @user_id IS NULL;

--Получаем id 
SET @user_id = COALESCE(@user_id, LAST_INSERT_ID());

--Назначить роль (идемпотентно) + кто назначил
INSERT INTO user_roles (user_id, org_id, role_id, operator_id, assigned_at, created_at, updated_at, revoked_at)
VALUES (@user_id, :org_id, :role_id, :operator_id, NOW(), NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  revoked_at  = NULL,             --реактивация, если была отозвана
  operator_id = :operator_id,     --фиксируем, кто назначил/изменил
  updated_at  = NOW(),
  assigned_at = COALESCE(user_roles.assigned_at, NOW());

--Создать приглашение:
INSERT INTO org_invitations (org_id, email, role_id, token, status, expires_at, created_by, created_at)
VALUES (:org_id, :email, :role_id, :token, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY), :operator_id, NOW());

--Вернуть для ответа:
SELECT 
  users.id AS user_id, users.email, users.full_name, users.preferred_lang, users.status, users.created_at, users.updated_at,
  organizations.id AS org_id, organizations.name AS org_name,
  roles.id AS role_id, roles.code AS role_code, roles.name AS role_name,
  user_roles.assigned_at, user_roles.created_at AS role_created_at, user_roles.updated_at AS role_updated_at
FROM user_roles
JOIN users ON users.id = user_roles.user_id
JOIN organizations ON organizations.id = user_roles.org_id
JOIN roles ON roles.id = user_roles.role_id
WHERE user_roles.user_id = @user_id AND user_roles.org_id = :org_id AND user_roles.role_id = :role_id
LIMIT 1;

```

### Получить профиль юзера:  `GET /orgs/:orgId/users/:userId`

суперадмин, админ, сотрудник организации, преподаватель

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `userId` - целое число

- **Назначение:** вернуть базовые данные пользователя, его персональный профиль (`user_profiles`) и активные роли в текущей организации (`user_roles` с `revoked_at IS NULL`)

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - Пользователь существует и имеет хотя бы одну активную роль в этой организации

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `userId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId`- /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `userId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - Проверка наличия активного назначения в пределах организации

- **Responses**:

  - **200 OK**
```json
{ 
  "user": {
    "id": 2054,
    "email": "ivan.petrov@example.com",
    "full_name": "Ivan Petrov",
    "preferred_lang": "en",
    "avatar_url": "https://cdn.app/u/2054.png",
    "status": "active",
    "created_at": "2025-09-02T10:11:12Z",
    "updated_at": "2025-09-05T09:01:02Z"
    },
  "profile": {
    "date_of_birth": "1990-02-20",
    "phone": "+4915123456789",
    "address_line1": "Adalbert Str. 40",
    "address_line2": null,
    "city": "Berlin",
    "zip_code": "10785",
    "country_code": "DE"
    },
  "roles_in_org": 
  [
    { 
      "id": 4, 
      "code": "teacher", 
      "name": "преподаватель", 
      "assigned_at": "2025-08-15T10:00:00Z" 
    }
  ]
 }
```

  - **400 Bad Request** некорректное тело запроса
```json
{ "message": "Invalid path parameter: orgId must be integer" }
```
```json
{ "message": "Invalid path parameter: userId must be integer" }
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
{ "message": "Permission denied: You are not allowed to view this profile in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "User not found" }
```
```json
{ "message": "User has no active roles in this organization" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Проверка,что пользователь имеет активную роль в этой организации
SELECT 1
FROM user_roles
WHERE org_id = :org_id
  AND user_id = :user_id
  AND revoked_at IS NULL
LIMIT 1;

--Базовые данные пользователя
SELECT id, email, full_name, preferred_lang, avatar_url, status, created_at, updated_at
FROM users
WHERE id = :user_id
LIMIT 1;

--Персональный профиль (1:1, может отсутствовать)
SELECT date_of_birth, phone, address_line1, address_line2, city, zip_code, country_code
FROM user_profiles
WHERE user_id = :user_id
LIMIT 1;

--Активные роли в рамках этой организации
SELECT roles.id, roles.code, roles.name, user_roles.assigned_at
FROM user_roles 
JOIN roles ON roles.id = user_roles.role_id
WHERE user_roles.user_id = :user_id
  AND user_roles.org_id = :org_id
  AND user_roles.revoked_at IS NULL
ORDER BY roles.code ASC;

```

### Удалить пользователя в организации:  `DELETE /orgs/:orgsId/users/:userId`

суперадмин, админ

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Назначение:** отозвать все роли пользователя в рамках указанной организации. Глобально аккаунт не удаляем. Если после отзыва ролей у пользователя нет активных ролей нигде, можно пометить `users.status = 'deleted'`

- **Path / Query params:**

  - `orgId` - целое число
  - `userId` - целое число

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - Пользователь `userId` существует и `status <> 'deleted'`
  - Нельзя удалить **последнего активного** `org_admin` организации
  - Обновляем `user_roles.revoked_at` для этой организации

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `userId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `userId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**
```json
{ 
  "organization": { 
    "id": 23, 
    "name": "ICH IT Career Hub" 
    },
  "user": { 
    "id": 2054, 
    "email": "ivan.petrov@example.com", 
    "full_name": "Ivan Petrov" 
    },
  "revoked_roles": 
  [
    { 
      "id": 103, 
      "code": "org_staff", 
      "name": "сотрудник учебной организации" }
  ],
  "revoked_at": "2025-09-05T10:11:12Z",
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
{ "message": "Permission denied: You are not allowed to remove users in this organization." }
```

- **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "User not found" }
```

- **409 Conflict** последний админ
```json
{ "message": "Cannot revoke the last active org_admin of the organization." }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Проверить, не последний ли это активный админ в организации
SELECT
  SUM(CASE WHEN ur.user_id = :user_id THEN 1 ELSE 0 END) AS is_target_admin,
  SUM(1) AS total_admins
FROM user_roles
JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'org_admin'
WHERE user_roles.org_id = :org_id AND user_roles.revoked_at IS NULL;

--Если is_target_admin = 1 и total_admins = 1 -> 409 Conflict

--Отозвать все активные роли пользователя в этой организации
UPDATE user_roles
SET revoked_at = NOW(), updated_at = NOW()
WHERE org_id = :org_id
  AND user_id = :user_id
  AND revoked_at IS NULL;

--Если после отзыва ролей у пользователя нет активных ролей нигде, пометить как deleted
SELECT COUNT(*) INTO @active_roles_any
FROM user_roles
WHERE user_id = :user_id AND revoked_at IS NULL;

UPDATE users
SET status = CASE WHEN @active_roles_any = 0 THEN 'deleted' ELSE status END,
    updated_at = NOW()
WHERE id = :user_id;

--Вернуть отозванные роли для ответа
SELECT roles.id, roles.code, roles.name
FROM user_roles
JOIN roles ON roles.id = user_roles.role_id
WHERE user_roles.org_id = :org_id AND user_roles.user_id = :user_id
  AND user_roles.revoked_at IS NOT NULL;

```

### Получить список пользователей согласно роли: `GET /orgs/:org_id/users?role=&q=&include_revoked=&page=&limit=`

суперадмин, админ, сотрудник организации, преподаватель

  `role` - фильтр по роли `teacher|student|org_staff|org_admin`  
  `q` - поиск по `full_name/email`  
  `include_revoked` - по умолчанию 0 (показывать только активные назначения)  
  `page` - номер страницы, по умолчанию 1  
  `limit` - количество на странице (по умолчанию 50, ≤ 200)  

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число
  - `role` - одно из `teacher | student | org_staff | org_admin`
  - `q` - строка (если передали)
  - `include_revoked` - 0 или 1 (по умолчанию 0, показывать только активные назначения)
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit` - целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - `orgId` из пути:
    - должен совпадать с `org` в JWT
    - для `superadmin` — любой `org`
  - Организация `orgId` существует и `status IN ('active','pending')`
  - Показывать активные назначения по умолчанию

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `role` - `teacher | student | org_staff | org_admin` - в `path`
    - `q` - `string[0..100]` - `trim`
    - `include_revoked` - `0 | 1`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

 

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `role` - `teacher | student | org_staff | org_admin` - в `path`
    - `q` - `string[0..100]` - `trim`
    - `include_revoked` - `0 | 1`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**
```json
{ 
  "total": 2,
  "page": 1,
  "limit": 50,
  "users": 
  [ 
    {
      "user": {
        "id": 1054,
        "email": "ivan.petrov@example.com",
        "full_name": "Ivan Petrov",
        "preferred_lang": "en",
        "status": "active",
        "created_at": "2025-09-02T10:11:12Z",
        "updated_at": "2025-09-02T10:11:12Z"
        },
     "role": { 
        "id": 104, 
        "code": "teacher", 
        "name": "преподаватель учебной организации" 
        },
      "assignment": {
        "operator_id": 120,
        "assigned_at": "2025-09-02T10:11:12Z",
        "updated_at": "2025-09-02T10:11:12Z"
        },
  	},
    {
      "user": {
        "id": 1080,
        "email": "oleksandr.kovalenko@example.com",
        "full_name": "Oleksandr Kovalenko",
        "preferred_lang": "en",
        "status": "active",
        "created_at": "2025-09-02T10:11:12Z",
        "updated_at": "2025-09-02T10:11:12Z"
        },
     "role": { 
        "id": 104, 
        "code": "teacher", 
        "name": "преподаватель учебной организации" 
        },
      "assignment": {
        "operator_id": 120,
        "assigned_at": "2025-09-02T10:11:12Z",
        "updated_at": "2025-09-02T10:11:12Z"
        },
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
{ "message": "Permission denied: You are not allowed to view users in this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```
```json
{ "message": "Role not found" }
```

- **SQL**

```sql
SET @page  = GREATEST(COALESCE(:page, 1), 1);
SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
SET @offset = (@page - 1) * @limit;

SELECT
  users.id, users.email, users.full_name, users.preferred_lang, users.status,
  roles.id AS role_id, roles.code, roles.name,
  user_roles.assigned_at, user_roles.revoked_at, user_roles.updated_at
FROM user_roles
JOIN users ON users.id = user_roles.user_id
JOIN roles ON roles.id = user_roles.role_id
WHERE user_roles.org_id = :org_id
  AND roles.code = :role_code
  AND users.status <> 'deleted'
  AND (
COALESCE(:include_revoked, 0) = 1 OR user_roles.revoked_at IS NULL
)
  AND (
        COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
        OR users.full_name LIKE CONCAT('%', :q, '%')
        OR users.email     LIKE CONCAT('%', :q, '%')
      )
ORDER BY users.full_name ASC, users.id ASC
LIMIT @limit OFFSET @offset;

-- total
SELECT COUNT(*) AS total
FROM user_roles
JOIN users  ON users.id = user_roles.user_id
JOIN roles  ON roles.id = user_roles.role_id
WHERE user_roles.org_id = :org_id
  AND roles.code = :role_code
  AND users.status <> 'deleted'
  AND (COALESCE(:include_revoked, 0) = 1 OR user_roles.revoked_at IS NULL)
  AND (
        COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
        OR users.full_name LIKE CONCAT('%', :q, '%')
        OR users.email     LIKE CONCAT('%', :q, '%')
      );

```


### Получить свой профиль:  `GET /orgs/:orgsId/users/me`

зарегистрированный пользователь

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число

- **Назначение:** вернуть базовые данные пользователя, его персональный профиль (`user_profiles`), индивидуальные настройки (`user_settings`) и активные роли в текущей организации (`user_roles с revoked_at IS NULL`)

- **Backend-правила:**

  - `orgId` из пути должен совпадать с `org` в JWT
  - Организация `orgId` существует и `status IN ('active','pending')`
  - Возвращаются только активные назначения ролей в этой организации

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**
```json
{ 
  "user": {
    "id": 2054,
    "email": "ivan.petrov@example.com",
    "full_name": "Ivan Petrov",
    "preferred_lang": "en",
    "avatar_url": "https://cdn.app/u/2054.png",
    "status": "active",
    "created_at": "2025-09-02T10:11:12Z",
    "updated_at": "2025-09-05T09:01:02Z"
    },
  "profile": {
    "date_of_birth": "1990-02-20",
    "phone": "+4915123456789",
    "address_line1": "Adalbert Str. 40",
    "address_line2": null,
    "city": "Berlin",
    "zip_code": "10785",
    "country_code": "DE"
    },
  "settings": {
    "timezone": "Europe/Berlin",
    "notify_in_app": true,
    "notify_email": false,
    "locale_override": "de"
    },
  "roles_in_org": 
  [
    { 
      "id": 104, 
      "code": "teacher", 
      "name": "преподаватель", 
      "assigned_at": "2025-08-15T10:00:00Z" 
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
{ "message": "Permission denied: You are not allowed to view this profile in this organization." }
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
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Базовые данные пользователя (из JWT: :me_user_id)
SELECT id, email, full_name, preferred_lang, avatar_url, status, created_at, updated_at
FROM users
WHERE id = :me_user_id
LIMIT 1;

--Персональный профиль (1:1, может отсутствовать)
SELECT date_of_birth, phone, address_line1, address_line2, city, zip_code, country_code
FROM user_profiles
WHERE user_id = :me_user_id
LIMIT 1;

--Индивидуальные настройки (1:1, может отсутствовать)
SELECT timezone, notify_in_app, notify_email, locale_override
FROM user_settings
WHERE user_id = :me_user_id
LIMIT 1;

--Активные роли в рамках этой организации
SELECT roles.id, roles.code, roles.name, user_roles.assigned_at
FROM user_roles 
JOIN roles ON roles.id = user_roles.role_id
WHERE user_roles.user_id = :me_user_id
  AND user_roles.org_id = :org_id
  AND user_roles.revoked_at IS NULL
ORDER BY roles.code ASC;

```

### Редактировать свой профиль:  `PUT /orgs/:orgsId/users/me`

зарегистрированный пользователь

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "full_name": "Ivan Petrov",
  "preferred_lang": "de",
  "avatar_url": "https://cdn.app/u/2054.png",
  "profile": {
    "date_of_birth": "1990-02-20",
    "phone": "+4915123456789",
    "address_line1": "Adalbert Str. 40",
    "address_line2": null,
    "city": "Berlin",
    "zip_code": "10785",
    "country_code": "DE"
    },
  "settings": {
    "timezone": "Europe/Berlin",
    "notify_in_app": true,
    "notify_email": false,
    "locale_override": "de"
    }
}
```

- **Правила/ограничения:**

  - Нельзя менять `email` этим роутом
  - Поля, которые можно менять в `users`:
    - `full_name`
    - `preferred_lang` (`ru|de|en`)
    - `avatar_url`

  - Профиль `user_profiles`:
    - все адресные
    - телефон
    - дата рождения

  - Настройки `user_settings`:
    - `timezone` (`IANA`),
    - `notify_in_app`,
    - `notify_email`,
    - `locale_override` (`ru|de|en`)

- **Path / Query params:**

  - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути должен совпадать с `org` в JWT
  - Организация `orgId` существует и `status IN ('active','pending')`
  - `email` не меняем

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `full_name` - `string[1..150]`, `trim`
    - `preferred_lang` - `oneOf('ru','de','en')`
    - `avatar_url` - `string[0..255]` (валидный URL)
    - `profile.date_of_birth` - формат `YYYY-MM-DD`
    - `profile.phone` - `E.164`: /^\\?\[1-9\]\d{7,14}\$/
    - `profile.country_code` - ^\[A-Z\]{2}\$
    - `settings.timezone` - `IANA` (например, Europe/Berlin)
    - `settings.notify_in_app` - `boolean`
    - `notify_email` - `boolean`
    - `settings.locale_override` - `oneOf('ru','de','en')`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `full_name` - `string[1..150]`, `trim`
    - `preferred_lang` - `oneOf('ru','de','en')`
    - `avatar_url` - `string[0..255]` (валидный URL)
    - `profile.date_of_birth` - формат `YYYY-MM-DD`
    - `profile.phone` - `E.164`: /^\\?\[1-9\]\d{7,14}\$/
    - `profile.country_code` - ^\[A-Z\]{2}\$
    - `settings.timezone` - `IANA` (например, Europe/Berlin)
    - `settings.notify_in_app` - `boolean`
    - `notify_email` - `boolean`
    - `settings.locale_override` - `oneOf('ru','de','en')`
    - Отсечь поля, которые менять нельзя (например, `email` =\> 400)

  - DB:

    - Вставка/обновление `user_profiles`, `user_settings` - через `UPSERT`
    - Обновление `users.updated_at`

- **Responses**:

  - **200 OK**
```json
{ 
  "user": {
    "id": 2054,
    "email": "ivan.petrov@example.com",
    "full_name": "Ivan Petrov",
    "preferred_lang": "de",
    "avatar_url": "https://cdn.app/u/2054.png",
    "status": "active",
    "created_at": "2025-09-02T10:11:12Z",
    "updated_at": "2025-09-05T09:30:00Z"
    },
  "profile": {
    "date_of_birth": "1990-02-20",
    "phone": "+4915123456789",
    "address_line1": "Adalbert Str. 40",
    "address_line2": null,
    "city": "Berlin",
    "zip_code": "10785",
    "country_code": "DE"
    },
  "settings": {
    "timezone": "Europe/Berlin",
    "notify_in_app": true,
    "notify_email": false,
    "locale_override": "de"
    }
}
```

  - **400 Bad Request** некорректное тело запроса
```json
{ "message": "Email is immutable on this endpoint" }
```
```json
{ "message": "Invalid profile.date_of_birth (expected YYYY-MM-DD)" }
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
{ "message": "Permission denied: You are not allowed to edit this profile in this organization." }
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
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Базовые данные пользователя (из JWT: :me_user_id)
SELECT id, email, full_name, preferred_lang, avatar_url, status, created_at, updated_at
FROM users
WHERE id = :me_user_id
LIMIT 1;

--Обновление users (только разрешенные поля)
UPDATE users
SET full_name = COALESCE(:full_name, full_name),
    preferred_lang = COALESCE(:preferred_lang, preferred_lang),
    avatar_url = COALESCE(:avatar_url, avatar_url),
    updated_at = NOW()
WHERE id = :me_user_id;

--UPSERT в user_profiles
INSERT INTO user_profiles
  (user_id, date_of_birth, phone, address_line1, address_line2, city, zip_code, country_code, created_at, updated_at)
VALUES
  (:me_user_id, :dob, :phone, :addr1, :addr2, :city, :zip, UPPER(:country_code), NOW(), NOW())
ON DUPLICATE KEY UPDATE
  date_of_birth = VALUES(date_of_birth),
  phone         = VALUES(phone),
  address_line1 = VALUES(address_line1),
  address_line2 = VALUES(address_line2),
  city          = VALUES(city),
  zip_code      = VALUES(zip_code),
  country_code  = VALUES(country_code),
  updated_at    = NOW();

--UPSERT в user_settings
INSERT INTO user_settings
  (user_id, timezone, notify_in_app, notify_email, locale_override)
VALUES
  (:me_user_id, :tz, :notify_in_app, :notify_email, :locale_override)
ON DUPLICATE KEY UPDATE
  timezone       = VALUES(timezone),
  notify_in_app  = VALUES(notify_in_app),
  notify_email   = VALUES(notify_email),
  locale_override= VALUES(locale_override);

```


### Сменить пароль (свой):  `POST /orgs/:orgId/users/me/password`

зарегистрированный пользователь

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "current_password": "OldP@ssw0rd!", 
  "new_password":     "NewP@ssw0rd!",  
  "confirm_password": "NewP@ssw0rd!" 
 }
```

- **Назначение:** безопасно изменить пароль текущего пользователя, проверив старый пароль. После успешного изменения деактивировать другие сессии пользователя.

- **Path / Query params:**

  - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути должен совпадать с `org` в JWT
  - Организация `orgId` существует и `status IN ('active','pending')`
  - Для обычного изменения пароля требуется `current_password`
  - Проверка силы пароля (минимум 8 символов, минимум 1 буква, 1 цифра, 1 символ)
  - После смены пароля:
    - обновить `users.password_hash`
    - деактивировать все остальные активные сессии пользователя, кроме текущей
    - сбросить счетчики неудачных входов `user_auth_counters`
    - записать событие в `auth_logs`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `current_password` - `string[1..200]` обязательное поле
    - `new_password` - /^(?=.\*\[A-Za-z\])(?=.\*\d)(?=.\*\[^A-Za-z\d\])\S{8,64}\$/ - обязательное поле
    - `confirm_password == new_password`
    - `new_password <> current_password`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `current_password` - `string[1..200]` обязательное поле
    - `new_password` - /^(?=.\*\[A-Za-z\])(?=.\*\d)(?=.\*\[^A-Za-z\d\])\S{8,64}\$/ - обязательное поле
    - `confirm_password == new_password`
    - `new_password <> current_password`

  - DB:

    - только обновление хеша/сессий/счетчиков

- **Responses**:

  - **200 OK**
```json
{ "message": "Password changed successfully" }
```

  - **400 Bad Request** некорректное тело запроса
```json
{ "message": "Invalid path parameter: orgId must be integer" }
```
```json
{ "message": "current_password is required" }
```
```json
{ "message": "new_password must be 8-64 characters and include 1 letter, 1 number and 1 special symbol" }
```
```json
{ "message": "new_password must be different from current_password" }
```
```json
{ "message": "confirm_password does not match new_password" }
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
{ "message": "Invalid current password" }
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
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id AND status IN ('active','pending') 
LIMIT 1;

--Обновление пароля
UPDATE users
SET password_hash = :new_password_hash,
    updated_at     = NOW()
WHERE id = :me_user_id;

--Деактивировать все остальные активные сессии
UPDATE user_sessions
SET revoked_at = NOW()
WHERE user_id = :me_user_id
  AND revoked_at IS NULL
  AND id <> :current_session_id;

--Сбросить счетчики неудачных входов
UPDATE user_auth_counters
SET failed_attempts = 0,
    last_failed_at  = NULL,
    locked_until    = NULL,
    updated_at      = NOW()
WHERE user_id = :me_user_id;

--Лог события (успех/ошибка)
INSERT INTO auth_logs (user_id, ip, ua, success, error_code, created_at)
VALUES (:me_user_id, :ip, :ua, 1, NULL, NOW());

```