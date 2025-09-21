## Организации 

`POST /orgs` регистрация организации

`GET /orgs?q=&status=&country=&page=&limit=`  получить список организаций

`GET /orgs/:orgId` получить организацию по id

`PUT /orgs/:orgId` редактировать организацию

`DELETE /orgs/:orgId` удалить организацию

`PUT /orgs/:orgId/status` изменить статус организации

### Регистрация организации: `POST /orgs`

Саморегистрация - через лендинг, либо платная, либо бесплатная подписка  
заполняется форма обратной связи

- **Content-type:** `application/json`

- **Authorization:** отсутствует

- **Body:**

```json
{ 
  "organizations": {
      "name": "ICH IT Career Hub", 
      "legal_name": "IT Career Hub GmbH", 
      "country_code": "DE",
    "signup_source": "self",
      },
  "org_addresses": {
      "address_type": "office",
      "line1": "Genthiner Str. 59",
      "city": "Berlin",
      "zip_code": "10686",
      "country_code": "DE",
      "timezone": "Europe/Berlin",
      "is_primary": true,
      },
  "admin": {
      "email": "admin@itcareerhub.de",
      "full_name": "Ivan Petrov",
      "password": "xxxxxxxxxxx",
      "preferred_lang": "de",
      },
  "user_profiles": {
      "date_of_birth": "1990-05-10",
      "phone": "+49301234567",
      "address_line1": "Adalbert Str. 40",
      "city": "Berlin",
      "zip_code": "10785",
      "country_code": "DE",
      },
 }
```


- **Backend-правила:**

  - `name` уникален;
  - создается `org_admin` пользователю-инициатору; `email` уникален
  - создается `org_subscriptions` на план `free/trial`.
  - отправляет письмо на почту для подтверждения

- **Бизнес-правила**

  - При саморегистрации: `status='pending'`  
    При создании супер-админом: `status='active'` + `approved_by/approved_at`
  - Пользователь-админ получает роль `org_admin` в созданной организации
  - Создаeтся подписка `org_subscriptions` на план `code = 'free'`, `is_current=true ` 
    `current_period_start = CURDATE()`, `current_period_end` - по `subscription_plans.interval` (месяц/год)  
    `status='trialing'` если план пробный, иначе `'active’`

- **Validation**:

  - Frontend:

    - **organization**

      - `name` - `string[2..200]` - обязательное поле
      - `legal_name` - `string[0..255]` опционально
      - `country_code` - `string == /^[A-Z]{2}\$/ ` только `ISO-3166-1` (DE, UA, PL, FR, …)
      - `signup_source` - `string[0..50] ` (опционально, например `self|admin|import`)

    - **org_address**

      - `address_type` - в наборе: `registered|office|campus|billing|other`
      - `line1` - `string[1..200]` - обязательное поле
      - `city`  - `string[1..100]` - обязательное поле
      - `country_code` - `ISO-2` - обязательное поле
      - `timezone` -`string[1..50]` из списка IANA
      - `is_primary` - boolean (для первой адресной записи допустимо сразу `true`)

    - **admin**

      - `email` - /^\[a-zA-Z0-9.\_%+-\]+@\[a-zA-Z0-9.-\]+\\\[a-zA-Z\]{2,}\$/ - формат `email` - обязательное поле
      - `full_name` - `string[1..150]` - обязательное поле
      - `password` - /^(?=.\*\[A-Za-z\])(?=.\*\d)(?=.\*\[^A-Za-z\d\])\S{8,64}\$/ - минимальная длина 8, хотя бы 1 буква и 1 цифра - обязательное поле
      - `preferred_lang` - `ru|de|en` (optional, по умолчанию 'en')

    - **admin_profile** опционально

      - `date_of_birth` - ISO `YYYY-MM-DD`
      - `phone` - E.164 (рекомендуется)
      - Address-поля - обычные строки с лимитами длины


  - Backend:

    - **organization**

      - `name` - `string[2..200]` - обязательное поле
      - `legal_name` - `string[0..255]` опционально
      - `country_code` - `string == /^[A-Z]{2}\$/ ` только `ISO-3166-1` (DE, UA, PL, FR, …)
      - `signup_source` - `string[0..50] ` (опционально, например `self|admin|import`)

    - **org_address**

      - `address_type` - в наборе: `registered|office|campus|billing|other`
      - `line1` - `string[1..200]` - обязательное поле
      - `city`  - `string[1..100]` - обязательное поле
      - `country_code` - `ISO-2` - обязательное поле
      - `timezone` -`string[1..50]` из списка IANA
      - `is_primary` - boolean (для первой адресной записи допустимо сразу `true`)

    - **admin**

      - `email` - /^\[a-zA-Z0-9.\_%+-\]+@\[a-zA-Z0-9.-\]+\\\[a-zA-Z\]{2,}\$/ - формат `email` - обязательное поле
      - `full_name` - `string[1..150]` - обязательное поле
      - `password` - /^(?=.\*\[A-Za-z\])(?=.\*\d)(?=.\*\[^A-Za-z\d\])\S{8,64}\$/ - минимальная длина 8, хотя бы 1 буква и 1 цифра - обязательное поле
      - `preferred_lang` - `ru|de|en` (optional, по умолчанию 'en')

    - **admin_profile** опционально

      - `date_of_birth` - ISO `YYYY-MM-DD`
      - `phone` - E.164 (рекомендуется)
      - Address-поля - обычные строки с лимитами длины

  - DB: проверка уникальности полей:

    - `name` - для организации
    - `email` - для юзера (админа)


- **Responses**:

  - **201 Created** организация + админ созданы

```json
{ "message": "Welcome! You have successfully registered with the email admin@itcareerhub.de. \nPlease confirm your email by clicking the link sent to your inbox." }
```

  - **400 Bad Request** некорректное тело запроса
```json
{ "message": "fullName is a required field" }
```

  - **409 Conflict** дубликаты
```json
{ "message": "The name 'ICH IT Career Hub' is already in use." }
```
```json
{ "message": "The email 'admin@itcareerhub.de' is already in use." }
```
```json
{ "message": "The username 'admin.ich' is already in use." }
```


- **SQL**  

> организация =\> адрес =\> админ =\> профиль админа =\> роль =\> подписка организации  
>  (в одном запросе последовательно)

```sql
-- 1) Организация
INSERT INTO organizations
  (name, legal_name, country_code, status, approved_by, approved_at, signup_source, created_at, updated_at)
VALUES
  (:org_name, :org_legal_name, :org_country_code,
   CASE WHEN :is_superadmin THEN 'active' ELSE 'pending' END,
   CASE WHEN :is_superadmin THEN :approved_by ELSE NULL END,
   CASE WHEN :is_superadmin THEN NOW() ELSE NULL END,
   :signup_source, NOW(), NOW());

SET @org_id = LAST_INSERT_ID();

-- 2) Адрес (office / primary)
INSERT INTO org_addresses
  (org_id, address_type, label, line1, line2, city, state_region, zip_code, country_code, timezone, is_primary, latitude, longitude, created_at, updated_at)
VALUES
  (@org_id, :addr_type, :addr_label, :addr_line1, :addr_line2, :addr_city, :addr_region, :addr_zip, :addr_country, :addr_tz, :addr_is_primary, :addr_lat, :addr_lng, NOW(), NOW());

-- 3) Админ-пользователь
INSERT INTO users
  (email, full_name, password_hash, preferred_lang, status, avatar_url, created_at, updated_at)
VALUES
  (:admin_email, :admin_full_name, :password_hash, COALESCE(:preferred_lang,'en'),
   'active', NULL, NOW(), NOW());

SET @admin_user_id = LAST_INSERT_ID();

-- 4) Профиль админа (опционально)
INSERT INTO user_profiles
  (user_id, date_of_birth, phone, address_line1, address_line2, city, zip_code, country_code, created_at, updated_at)
VALUES
  (@admin_user_id, :dob, :phone, :upro_line1, :upro_line2, :upro_city, :upro_zip, :upro_country, NOW(), NOW());

-- 5) Назначение роли org_admin
SET @role_admin_id = (SELECT id FROM roles WHERE code = 'org_admin' LIMIT 1);
IF @role_admin_id IS NULL THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Role org_admin missing';
END IF;

INSERT INTO user_roles (user_id, org_id, role_id, assigned_at, created_at, updated_at)
VALUES (@admin_user_id, @org_id, @role_admin_id, NOW(), NOW(), NOW());

-- 6) Создание подписки (на free)
SET @plan_id = (SELECT id FROM subscription_plans WHERE code = :plan_code AND is_active = 1 LIMIT 1);
IF @plan_id IS NULL THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Subscription plan not found';
END IF;
-- вычисляем конец периода: месяц/год
SET @period_end =
  (SELECT CASE interval
           WHEN 'month' THEN DATE_ADD(CURDATE(), INTERVAL 1 MONTH)
           WHEN 'year'  THEN DATE_ADD(CURDATE(), INTERVAL 1 YEAR)
           ELSE DATE_ADD(CURDATE(), INTERVAL 1 MONTH)
         END
   FROM subscription_plans WHERE id = @plan_id);

INSERT INTO org_subscriptions
 (org_id, plan_id, status, is_current, auto_renew, cancel_at_period_end,
  current_period_start, current_period_end, trial_end_at,
  provider, external_subscription_id, created_at, updated_at)
VALUES
 (@org_id, @plan_id,
  CASE WHEN :plan_code = 'free' THEN 'trialing' ELSE 'active' END,
  TRUE, TRUE, FALSE,
  CURDATE(), @period_end,
  CASE WHEN :plan_code = 'free' THEN DATE_ADD(CURDATE(), INTERVAL :trial_days DAY) ELSE NULL END,
  'manual', NULL, NOW(), NOW());

SET @org_subscription_id = LAST_INSERT_ID();

```


### Получить список организаций: `GET /orgs?q=&status=&country=&page=&limit=`

суперадмин

 `q` - поиск по `name/legal_name` (опционально)  
 `status` - `active|pending|suspended|deleted` (опционально)  
 `country` - ISO-2 (опционально)  
 `page` - номер страницы, по умолчанию 1  
 `limit` - количество на странице (по умолчанию 50, ≤ 200)  

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `q` - строка
  - `status` - active\|pending\|suspended\|deleted
  - `country` - ISO-2
  - `page` - целое число \>= 1, по умолчанию 1
  - `limit`- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - Для `superadmin` - видит все организации
  - Организация учитывается, если `status='pending'/'active'/'suspended'`
  - `status=‘deleted’` по умолчанию не показываем

- **Validation**:

  - Frontend:

    - `q` - `string[0..200]` - `trim`
    - `status` - `enum: active|pending|suspended|deleted`
    - `country` - /^\[A-Z\]{2}\$/
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `q` - `string[0..200]` - `trim`
    - `page` - целое число, \>=1, по умолчанию - 1
    - `limit` - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

```json
{ 
  "total": 1,
  "page": 1,
  "limit": 50,
  "organizations": 
  [
    {
     "id": 101,
      "name": "ICH IT Career Hub",
      "legal_name": "IT Career Hub GmbH",
      "country_code": "DE",
      "status": "active",
      "created_at": "2025-01-10T09:00:00Z",
      "updated_at": "2025-01-20T10:00:00Z",
      "primary_address": {
        "address_type": "office",
        "line1": "Genthiner Str. 59",
        "city": "Berlin",
        "zip_code": "10686",
        "country_code": "DE",
        "timezone": "Europe/Berlin"
        },
    },
  ]
 }
```

  - **400 Bad Request** некорректное тело запроса
```json
{ "message": "Invalid query parameter: status must be one of [active,pending,suspended,deleted]" }
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
{ "message": "Permission denied: You are not allowed to view organizations." }
```

- **SQL**

```sql
SET @page  = GREATEST(COALESCE(:page, 1), 1);
SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
SET @offset = (@page - 1) * @limit;

--total
SELECT COUNT(*) AS total
FROM organizations
WHERE (COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
       OR organizations.name LIKE CONCAT('%', :q, '%')
       OR organizations.legal_name LIKE CONCAT('%', :q, '%'))
  AND (
(COALESCE(NULLIF(TRIM(:status), ''), NULL) IS NULL 
       AND organizations.status IN ('pending','active','suspended'))
      OR (COALESCE(NULLIF(TRIM(:status), ''), NULL) IS NOT NULL 
         AND organizations.status = :status)
      )
  AND (COALESCE(NULLIF(TRIM(:country), ''), NULL) IS NULL
       OR organizations.country_code = :country);

--page
SELECT 
  organizations.id, organizations.name, organizations.legal_name, organizations.country_code, organizations.status, organizations.created_at, organizations.updated_at,
  org_addresses.address_type, org_addresses.line1, org_addresses.city, org_addresses.zip_code, org_addresses.country_code AS addr_country_code, org_addresses.timezone
FROM organizations 
LEFT JOIN org_addresses
  ON org_addresses.org_id = organizations.id AND org_addresses.is_primary = 1
WHERE (COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
       OR organizations.name LIKE CONCAT('%', :q, '%')
       OR organizations.legal_name LIKE CONCAT('%', :q, '%'))
  AND (
(COALESCE(NULLIF(TRIM(:status), ''), NULL) IS NULL 
       AND organizations.status IN ('pending','active','suspended'))
      OR (COALESCE(NULLIF(TRIM(:status), ''), NULL) IS NOT NULL 
         AND organizations.status = :status)
      )
  AND (COALESCE(NULLIF(TRIM(:country), ''), NULL) IS NULL
       OR organizations.country_code = :country)
ORDER BY organizations.created_at DESC, organizations.id DESC
LIMIT @limit OFFSET @offset;

```


### Получить организацию по id: `GET /orgs/:orgId`

суперадмин, админ (только своя организация)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

    - `orgId` - целое число

- **Backend-правила:**

  - `orgId` из пути должен совпадать с `org` в JWT  
      (для `superadmin` - любой `org`)
  - oрганизация существует

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK**

```json
{ 
  "id": 101,
  "name": "ICH IT Career Hub",
  "legal_name": "IT Career Hub GmbH",
  "country_code": "DE",
  "status": "active",
  "created_at": "2025-01-10T09:00:00Z",
  "updated_at": "2025-01-20T10:00:00Z",
  "addresses": [
    {
      "address_type": "office",
      "label": null,
      "line1": "Genthiner Str. 59",
      "line2": null,
      "city": "Berlin",
      "state_region": null,
      "zip_code": "10686",
      "country_code": "DE",
      "timezone": "Europe/Berlin",
      "is_primary": true,
      "latitude": null,
      "longitude": null
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
{ "message": "Permission denied: You are not allowed to view this organization." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```

- **SQL**

```sql
--Проверка прав доступа
SELECT 1
FROM organizations 
WHERE id = :org_id
  AND ( :is_superadmin = 1 OR id = :jwt_org_id )
LIMIT 1;

--Карточка организации
SELECT id, name, legal_name, country_code, status, created_at, updated_at
FROM organizations
WHERE id = :org_id
LIMIT 1;

--Адреса
SELECT address_type, label, line1, line2, city, state_region, zip_code, country_code, timezone, is_primary, latitude, longitude
FROM org_addresses
WHERE org_id = :org_id
ORDER BY is_primary DESC, id ASC;

```

### Редактировать организацию: `PUT /orgs/:orgId`

суперадмин, админ (только свою организацию)

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:**

```json
{ 
  "name": "ICH IT Career Hub",
  "legal_name": "IT Career Hub GmbH",
  "country_code": "DE"
 }
```

- **Path / Query params:**

  - `orgId` - целое число

- **Бизнес-правила:**

  - `name` - уникален в системе
  - `country_code` - ISO-2

- **Backend-правила:**

  - `orgId` из пути должен совпадать с `org` в JWT  
    (для `superadmin` - любой `org`)
  - Организация `orgId` существует и не имеет `status='deleted'`
  - `name` - уникален в системе
  - `country_code` - ISO-2

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `name` - `string[2..200]`, `trim`
    - `legal_name` - `string[0..255]`, `trim`
    - `country_code` - /^\[A-Z\]{2}\$/

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `name` - `string[2..200]`, `trim`
    - `legal_name` - `string[0..255]`, `trim`
    - `country_code` - /^\[A-Z\]{2}\$/

  - DB:

    - `name` - `UNIQUE` проверка уникальности

- **Responses**:

  - **200 OK**

```json
{ 
  "id": 101,
  "name": "ICH IT Career Hub",
  "legal_name": "IT Career Hub GmbH",
  "country_code": "DE",
  "status": "active",
  "created_at": "2025-01-10T09:00:00Z",
  "updated_at": "2025-01-20T10:00:00Z",
  "addresses": [
    {
      "address_type": "office",
      "label": null,
      "line1": "Genthiner Str. 59",
      "line2": null,
      "city": "Berlin",
      "state_region": null,
      "zip_code": "10686",
      "country_code": "DE",
      "timezone": "Europe/Berlin",
      "is_primary": true,
      "latitude": null,
      "longitude": null
    }
  ]
 }
```


  - **400 Bad Request** некорректное тело запроса
```json
{ "message": "Invalid path parameter: orgId must be integer" }
```
```json
{ "message": "country_code must be a 2-letter ISO code" }
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
{ "message": "Permission denied: You are not allowed to edit this organization" }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```

  - **409 Conflict** дубликат
```json
{ "message": "The name 'ICH IT Career Hub' is already in use." }
```

- **SQL**

```sql
--Право на редактирование
SELECT 1 FROM organizations 
WHERE id = :org_id
  AND ( :is_superadmin = 1 OR id = :jwt_org_id )
  AND status <> 'deleted'
LIMIT 1;

--Проверка уникальности name, если name передан
SELECT 1 FROM organizations 
WHERE name = :name AND id <> :org_id
LIMIT 1;

--Обновление
UPDATE organizations
SET name         = COALESCE(:name, name),
    legal_name   = COALESCE(:legal_name, legal_name),
    country_code = COALESCE(:country_code, country_code),
    updated_at   = NOW()
WHERE id = :org_id;

--Возврат
SELECT id, name, legal_name, country_code, status, created_at, updated_at
FROM organizations
WHERE id = :org_id
LIMIT 1;

--Адреса
SELECT address_type, label, line1, line2, city, state_region, zip_code, country_code, timezone, is_primary, latitude, longitude
FROM org_addresses
WHERE org_id = :org_id
ORDER BY is_primary DESC, id ASC;

```

### Удалить организацию: `DELETE /orgs/:orgId`

суперадмин

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Path / Query params:**

  - `orgId` - целое число

- **Бизнес-правила:**

  - Не удаляем, если существует текущая подписка (`is_current=1`) из `current_period_end > NOW()`
  - Мягкое удаление: `status='deleted'`
  - Повторное удаление — `idempotent` (если уже `deleted` - возвращаем 200 с тем же статусом)

- **Backend-правила:**

  - `orgId` из пути должен совпадать с `org` в JWT  
      (для `superadmin` - любой org)
  - Организация `orgId` существует

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число

- **Responses**:

  - **200 OK** организация деактивирована

```json
{ 
  "id": 101,
  "name": "ICH IT Career Hub",
  "status": "deleted",
  "deleted_at": "2025-09-02T10:11:12Z"
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
{ "message": "Permission denied: Only superadmins can delete organizations." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```

  - **409 Conflict** есть активная подписка
```json
{ "message": "Deletion blocked: the organization has an active subscription. Deletion is not allowed while a subscription is active" }
```

- **SQL**

```sql
--Проверка организации
SELECT 1 FROM organizations 
WHERE id = :org_id 
LIMIT 1;

--Проверка на подписку
SELECT id, status, current_period_end, cancel_at_period_end
FROM org_subscriptions
WHERE org_id = :org_id
  AND is_current = 1
  AND status IN ('trialing','active','past_due','paused')
  AND current_period_end > NOW()
LIMIT 1;
--если вернулась строка -> 409 Conflict

--Обновление статуса
UPDATE organizations
SET status = 'deleted',
    approved_by = NULL,
    approved_at = NULL,
    updated_at = NOW()
WHERE id = :org_id;

--Ответ
SELECT id, name, status, NOW() AS deleted_at
FROM organizations
WHERE id = :org_id
LIMIT 1;

```

### Изменить статус организации  `PUT /orgs/:orgId/status`

суперадмин

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:**

```json
{ 
  "status": "active"
 }
```

- **Path / Query params:**

  - `orgId` - целое число

- **Бизнес-правила:**

  - Поддерживаемые значения: `active, pending, suspended`
  - Разрешенные переходы:
    - `pending` → `active`
    - `active` → `suspended`
    - `suspended` → `active`
  - При переводе в `active` из `pending` — проставляем `approved_by` = текущий супер-админ, `approved_at = NOW()`
  - В `pending` из `active/suspended` возвращать нельзя

- **Backend-правила:**

  - Только `superadmin`
  - Организация `orgId` существует
  - Для `deleted` — `409`

- **Validation**:

  - Frontend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно
    - `status` - `active|pending|suspended`

  - Backend:

    - `orgId` - /^\[1-9\]\d{0,9}\$/ - в `path`, обязательно, число
    - `status` - `active|pending|suspended`

- **Responses**:

  - **200 OK**

```json
{ 
  "id": 101,
  "name": "ICH IT Career Hub",
  "status": "active",
  "approved_by": 1,
  "approved_at": "2025-09-02T10:11:12Z",
  "updated_at": "2025-09-02T10:11:12Z"
}
```

  - **400 Bad Request** некорректное тело запроса
```json
{ "message": "Invalid path parameter: orgId must be integer" }
```
```json
{ "message": "Invalid status value. Must be one of [active,pending,suspended]." }
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
{ "message": "Permission denied: Only superadmins can update organization status." }
```

  - **404 Not Found** объект не найден
```json
{ "message": "Organization not found" }
```

  - **409 Conflict** есть активная подписка
```json
{ "message": "Invalid status transition." }
```
```json
{ "message": "Organization is deleted and cannot change status." }
```

- **SQL**

```sql
--Проверка организации
SELECT status FROM organizations 
WHERE id = :org_id 
LIMIT 1;
--если status = 'deleted' -> 409

--Обновление статуса
UPDATE organizations
SET status = :new_status,
    approved_by = CASE 
        WHEN :new_status = 'active' AND @old_status = 'pending' THEN :current_user_id
        ELSE approved_by
    END,
    approved_at = CASE 
        WHEN :new_status = 'active' AND @old_status = 'pending' THEN NOW()
        ELSE approved_at
    END,
    updated_at = NOW()
WHERE id = :org_id;

--Ответ
SELECT id, name, status, approved_by, approved_at, updated_at
FROM organizations
WHERE id = :org_id
LIMIT 1;

```