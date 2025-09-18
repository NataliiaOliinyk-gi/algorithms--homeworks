# Документация API Pinguin Tracker 

**версия v_01**

## Назначение и аудитория

Платформа предназначена для школ и образовательных учреждений, позволяя:

- выдавать награды и достижения ученикам,
- формировать рейтинги и лидерборды,
- управлять пользователями и ролями,
- вести аналитику и отчетность,
- контролировать подписки и тарифы.

Главная концепция: организация (школа/учреждение) является ключевой сущностью, а все пользователи, классы, предметы, награды и рейтинги связаны с конкретной организацией.

## Введение

**Базовый URL**: `https://penguin-tracker-backend/api` ( `http://localhost:3001/api` )

**Формат дат**: `ISO-8601` в UTC, например `2025-09-01T14:35:00Z`

**Контент-тип**: `application/json`

**Локализация**: Language: `en /de / ru`

## Аутентификация и авторизация

**Логин по email/паролю**

**2FA** (`user_mfa`)**:** поддерживаем `totp/sms/email/webauthn`.

Потоки:

1.  `POST /auth/login` → если требуется MFA → `mfa_required: true`.

2.  `POST /auth/mfa/verify` → выдает финальный `access cookie`.

**Роли:** `superadmin`, `org_admin`, `org_staff`, `teacher`, `student`.  
Проверка доступа идёт по `user_roles` (org-scoped).

## Конвенции API

- **Пагинация:** `?page=1&limit=50`, ответы возвращают `total`, `page`, `limit`.

возвращает

```json
 {
  "total": 123,
  "page": 1,
  "limit": 50,
  "items": [  ],
 }
 ```

- **Сортировка:** `?sort=created_at&organizations=desc`

- **Фильтрация:** через `query`-параметры (например. `?org_id=1&status=active`).

- **Ошибки:** единый формат  
 ```json   
  { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {   } } }
```

- **Временные зоны и язык:** показываем по `user_settings.timezone`/`locale_override` если заданы.

## Коды ошибок

| HTTP Status Code   |    |   Summary                   |
|----|----|----|
| **200** | OK | Обработка запроса прошла успешно |
| **201** | Created | Объект успешно добавлен |
| **400** | Bad Request | Ошибка в теле запроса - отсутствие обязательного поля или неправильный формат поля |
| **401** | Unauthorized | Действительный ключ API не предоставлен. |
| **403** | Forbidden | API-ключ не имеет разрешений на выполнение запроса. |
| **404** | Not Found | Запрошенный ресурс не существует |
| **409** | Conflict | Дубликат уникального поля |
| **429** | Too Many Requests | Количество попыток превышено |
| **500** | Server Errors | Ошибка сервера |

## Контракты: эндпоинты по доменам

### Авторизация

`POST /auth/login` вход в систему

`POST /auth/mfa/verify` подтверждение MFA

`POST /auth/logout` выход

`POST /auth/password/forgot` забыли пароль (инициировать сброс)

`POST /auth/password/reset` сброс пароля (по токену из email)

#### Вход в систему: `POST /auth/login`

Публично (без авторизации)

- **Content-type:** `application/json`

- **Body:**

```json
{
  "email": "user@example.com",
  "password": "********",
 }
 ```

- **Бизнес-правила:**

  - Email сравнивать без учета регистра
  - Пароль проверяется через хэш (`bcrypt`) в коде
  - Лимит попыток: использовать `user_auth_counters` (блокировка)
  - Пользователь не должен быть в статусе `blocked/deleted`
  - Если у пользователя включена MFA возвращаем `mfa_required` + одноразовый `mfa_token` , типы MFA для выбора
  - Если MFA выключена создаем `user_sessions` и возвращаем `access_token`

- **Backend-правила:**

  - Для email проверка на формат `email`, длина `≤ 255`
  - Проверка пароля - минимум 8 символов, минимум 1 буква, 1 цифра, 1 символ
  - Единое сообщение об ошибке для неверной пары `email/password`

- **Validation**:

  - Frontend:

    - `email` - /^\[A-Za-z0-9.\_%+-\]+@\[A-Za-z0-9.-\]+\\\[A-Za-z\]{2,}\$/ - обязательное поле, `trim`
    - `password` - /^(?=.\*\[A-Za-z\])(?=.\*\d)(?=.\*\[^A-Za-z\d\])\S{8,64}\$/ - обязательное поле, `trim`

  - Backend:

    - `email` - /^\[A-Za-z0-9.\_%+-\]+@\[A-Za-z0-9.-\]+\\\[A-Za-z\]{2,}\$/ - обязательное поле, `trim`
    - `password` - /^(?=.\*\[A-Za-z\])(?=.\*\d)(?=.\*\[^A-Za-z\d\])\S{8,64}\$/ - обязательное поле, `trim`

- **Responses**:

  - **200 OK** (MFA не требуется):

```json
{ "user": 
  { 
    "id": 1054, 
    "email": "user@example.com", 
    "full_name": "Ivan Petrov" 
  },
  "access_token": "<jwt>",
  "token_type": "Bearer",
 }
```

  - **200 OK** (MFA требуется):

```json
{ "mfa_required": true,
  "mfa_token": "<opaque-or-jwt-mfa-token>",
  "available_types": ["totp","sms","email","webauthn"]
 }
```

  - **400 Bad Request** некорректное тело запроса
```json
 {"message": "Invalid request body"}
```
  - **401 Unauthorized** не различаем неверный email/пароль
```json
 {"message": "Invalid email or password"}
```
  - **403 Forbidden** аккаунт заблокирован/удален
```json
 {"message": "Account is not allowed to sign in."}
```
  - **429 Too Many Requests**
```json
 {"message": "Too many login attempts. Please try again later."}
```

- **SQL**

```sql
--Проверка email
SELECT id, email, full_name, password_hash, status
FROM users
WHERE LOWER(email) = :email
LIMIT 1;
--если status = 'deleted' -> 401
--если status = 'blocked' -> 403

--Счетчики/блокировки
SELECT failed_attempts, locked_until
FROM user_auth_counters
WHERE user_id = :user_id
FOR UPDATE;
--если строки нет, создаем
INSERT INTO user_auth_counters (user_id, failed_attempts, updated_at)
VALUES (:user_id, 0, NOW())
ON DUPLICATE KEY UPDATE user_id = user_id;
--если locked_until > NOW() -> 429

--Если неверный пароль
--счетчик
UPDATE user_auth_counters
SET failed_attempts = failed_attempts + 1,
    last_failed_at  = NOW(),
    locked_until    = CASE
           WHEN failed_attempts + 1 >= :max_attempts
           THEN DATE_ADD(NOW(), INTERVAL :lock_minutes MINUTE)
           ELSE locked_until
                      END
WHERE user_id = :user_id;
--и записываем в лог
INSERT INTO auth_logs (user_id, email, ip, ua, success, error_code, created_at)
VALUES (:user_id, :email, :ip, :ua, FALSE, 'INVALID_CREDENTIALS', NOW());

--Если OK и MFA включена -> mfa_token из кода
--и запись в лог
INSERT INTO auth_logs (user_id, email, ip, ua, success, error_code, created_at)
VALUES (:user_id, :email, :ip, :ua, FALSE, 'MFA_REQUIRED', NOW());

--Если OK и MFA выключена, создаем сессию
INSERT INTO user_sessions (user_id, token_hash, ip, ua, created_at, last_seen_at, expires_at, revoked_at)
VALUES (:user_id, :token_hash, :ip, :ua, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL :session_hours HOUR), NULL);

--сбрасываем счетчик
UPDATE user_auth_counters
SET failed_attempts = 0,
    locked_until    = NULL,
    updated_at      = NOW()
WHERE user_id = :user_id;

--запись в лог успешного захода
INSERT INTO auth_logs (user_id, email, ip, ua, success, error_code, created_at)
VALUES (:user_id, :email, :ip, :ua, TRUE, 'LOGIN_SUCCESS', NOW());

```


#### Подтверждение MFA: `POST /auth/mfa/verify`

Публично (по mfa_token)

- **Content-type:** `application/json`

- **Body:**

```json
{
  "type": "totp|sms|email|webauthn|backup_code", 
  "code": "123456", 
  "mfa_token": "<token>"
}
```

- **Бизнес-правила:**

  - `mfa_token` валиден, не просрочен, не использован, привязан к `user_id`
  - Проверка кода:
    - `totp`: вычислить по секрету из `user_mfa` (в коде)
    - `sms/email`: проверить с текущим активным кодом
    - `webauthn`: проверить через WebAuthn (в коде)
    - `backup_code`: найти хэш в `user_mfa_backup_codes`, не использован - отметить `used_at=NOW()`
  - В случае успеха: создать `user_sessions`, выдать `access_token`
  - Лимит неправильных MFA-попыток (аналогично `login`)

- **Validation**:

  - Frontend:

    - `type` - `totp|sms|email|webauthn|backup_code`- обязательное поле
    - `code` - `string` - формат зависи от типа, обязательное поле
    - `mfa_token` - `string` - обязательное поле

  - Backend:

    - `type` - `totp|sms|email|webauthn|backup_code`- обязательное поле
    - `code` - `string` - формат зависи от типа, обязательное поле
    - `mfa_token` - `string` - обязательное поле

- **Responses**:

  - **200 OK**

```json
{ "user": 
    { 
    "id": 1054, 
    "email": "user@example.com", 
    "full_name": "Ivan Petrov" 
    },
  "access_token": "<jwt>",
  "token_type": "Bearer",
 }
```

  - **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid MFA token" }
```

  - **401 Unauthorized**
```json
{ "message": "Invalid or incorrect MFA code" }
```
```json
{ "message": "MFA code has expired" }
```

  - **403 Forbidden**
```json
{ "message": "MFA is not enabled for this account" }
```

  - **429 Too Many Requests**
```json
{ "message": "Too many login attempts. Please try again later." }
```

- **SQL**

```sql
--Достаем настройки MFA
SELECT type, secret, enabled
FROM user_mfa
WHERE user_id = :user_id;

--Для backup-кода
SELECT id, code_hash, used_at
FROM user_mfa_backup_codes
WHERE user_id = :user_id
  AND code_hash = :code_hash
LIMIT 1;
--Если found && used_at IS NULL -> OK 

--Неудачная проверка кода -> инкремент + лог
UPDATE user_auth_counters
SET failed_attempts = failed_attempts + 1,
    last_failed_at  = NOW(),
    updated_at      = NOW(),
    locked_until    = CASE
      WHEN failed_attempts + 1 >= :max_attempts
        THEN DATE_ADD(NOW(), INTERVAL :lock_minutes MINUTE)
      ELSE locked_until
    END
WHERE user_id = :user_id;

INSERT INTO auth_logs (user_id, email, ip, ua, success, error_code, created_at)
VALUES (:user_id, :email, :ip, :ua, FALSE, 'MFA_INVALID', NOW());

--Успех -> создать сессию, сбросить счетчики, залогировать
INSERT INTO user_sessions (user_id, token_hash, ip, ua, created_at, last_seen_at, expires_at, revoked_at)
VALUES (:user_id, :token_hash, :ip, :ua, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL :session_hours HOUR), NULL);

UPDATE user_auth_counters
SET failed_attempts = 0,
    locked_until    = NULL,
    updated_at      = NOW()
WHERE user_id = :user_id;

INSERT INTO auth_logs (user_id, email, ip, ua, success, error_code, created_at)
VALUES (:user_id, :email, :ip, :ua, TRUE, 'MFA_SUCCESS', NOW());

--Для backup-кода помечаем использованный
UPDATE user_mfa_backup_codes
SET used_at = NOW(),
    used_ip = :ip,
    used_session_id = LAST_INSERT_ID()
WHERE id = :id;

```

#### Выход: `POST /auth/logout`

Авторизован (любой пользователь)

- **Content-type:** `application/json`

- **Authorization:** `Bearer <jwt>`

- **Body:** `{}`

- **Validation**:

  - Frontend: нет параметров
  - Backend: нет параметров

- **Responses**:

  - **200 OK**
```json
{ "message": "Logged out" }
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
--закрываем сессию
UPDATE user_sessions
SET revoked_at = COALESCE(revoked_at, NOW())
WHERE user_id = :user_id
  AND token_hash = :token_hash;

--записываем в лог
INSERT INTO auth_logs (user_id, email, ip, ua, success, error_code, created_at)
VALUES (:user_id, :email, :ip, :ua, TRUE, 'LOGOUT', NOW());

```

#### Забыли пароль (инициировать сброс): `POST /auth/password/forgot`

публично (без авторизации)

- **Content-type:** `application/json`

- **Body:**

```json
{ "email": "user@example.com" }
```

- **Бизнес-правила:**

  - всегда возвращаем `200` с одинаковым текстом
  - Если пользователь существует и не `deleted`, создаем запись в `password_resets` и отправляем письмо

- **Backend-правила:**

  - Для email проверка на формат `email`, длина `≤ 255`
  - Проверка на частоту запросов

- **Validation**:

  - Frontend:

    - email - /^\[A-Za-z0-9.\_%+-\]+@\[A-Za-z0-9.-\]+\\\[A-Za-z\]{2,}\$/ - обязательное поле, `trim`

  - Backend:

    - email - /^\[A-Za-z0-9.\_%+-\]+@\[A-Za-z0-9.-\]+\\\[A-Za-z\]{2,}\$/ - обязательное поле, `trim`

- **Responses**:

  - **200 OK**
```json
{ "message": "If an account with this email exists, you will receive a password reset link shortly." }
```

  - **400 Bad Request** некорректное тело запроса
```json
{ "message": "Invalid request body" }
```

  - **429 Too Many Requests**
```json
{ "message": "Too many login attempts. Please try again later." }
```

- **SQL**

```sql
--Найти пользователя
SELECT id, email, status
FROM users
WHERE LOWER(email) = :email
LIMIT 1;

--Если найден и status <> 'deleted' - создать reset
INSERT INTO password_resets (user_id, token, expires_at, used_at, created_at)
VALUES (:user_id, :token_hash, DATE_ADD(NOW(), INTERVAL :ttl_minutes MINUTE), NULL, NOW());

--Запись в лог
INSERT INTO auth_logs (user_id, email, ip, ua, success, error_code, created_at)
VALUES (:user_id_or_null, :email, :ip, :ua, TRUE, 'PASSWORD_RESET_REQUESTED', NOW());

```

#### Сброс пароля по токену из email: `POST /auth/password/reset`

Публично (без авторизации)

- **Content-type:** `application/json`

- **Body:**

```json
{ 
  "token": "<raw-token>",
  "password": "********",
 }
```

- **Бизнес-правила:**

  - Токен валиден: соответствует `token_hash`, не просрочен, не использован
  - Обновить `users.password_hash`
  - Пометить `password_resets.used_at = NOW()`
  - Ревокировать все активные сессии пользователя (безопасность)
  - Сбросить счeтчики `user_auth_counters`

- **Backend-правила:**

  - Проверка пароля - минимум 8 символов, минимум 1 буква, 1 цифра, 1 символ

- **Validation**:

  - Frontend:
    - password - /^(?=.\*\[A-Za-z\])(?=.\*\d)(?=.\*\[^A-Za-z\d\])\S{8,64}\$/ - обязательное поле, `trim`

  - Backend:
    - password - /^(?=.\*\[A-Za-z\])(?=.\*\d)(?=.\*\[^A-Za-z\d\])\S{8,64}\$/ - обязательное поле, `trim`
    - проверка токена

- **Responses**:

  - **200 OK** :
```json
{ "message": "Password has been reset successfully. You can now sign in." }
```

  - **400 Bad Request**
```json
{ "message": "Invalid request body" }
```

  - **401 Unauthorized**
```json
{ "message": "Reset token has expired or has already been used" }
```

  - **404 Not Found**
```json
{ "message": "Invalid or unknown reset token" }
```

- **SQL**

```sql
--Найти валидный reset
SELECT id, user_id, expires_at, used_at
FROM password_resets
WHERE token = :token_hash
LIMIT 1;
--used_at IS NULL и expires_at > NOW()

--Обновляем пароль
UPDATE users
SET password_hash = :new_password_hash,
    updated_at = NOW()
WHERE id = :user_id;

--Помечаем reset использованным
UPDATE password_resets
SET used_at = NOW()
WHERE id = :reset_id;

--Ревокируем все активные сессии
UPDATE user_sessions
SET revoked_at = COALESCE(revoked_at, NOW())
WHERE user_id = :user_id AND revoked_at IS NULL;

--Сброс счетчиков
UPDATE user_auth_counters
SET failed_attempts = 0, locked_until = NULL
WHERE user_id = :user_id;

--Запись в лог
INSERT INTO auth_logs (user_id, email, ip, ua, success, error_code, created_at)
VALUES (:user_id, :email, :ip, :ua, TRUE, 'PASSWORD_RESET_SUCCESS', NOW());

```

### Организации

`POST /orgs` регистрация организации

`GET /orgs?q=&status=&country=&page=&limit=`  получить список организаций

`GET /orgs/:orgId` получить организацию по id

`PUT /orgs/:orgId` редактировать организацию

`DELETE /orgs/:orgId` удалить организацию

`PUT /orgs/:orgId/status` изменить статус организации

#### Регистрация организации: `POST /orgs`

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


#### Получить список организаций: `GET /orgs?q=&status=&country=&page=&limit=`

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


#### Получить организацию по id: `GET /orgs/:orgId`

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

#### Редактировать организацию: `PUT /orgs/:orgId`

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

#### Удалить организацию: `DELETE /orgs/:orgId`

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

#### Изменить статус организации  `PUT /orgs/:orgId/status`

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


### Роли

`GET /roles` получить список ролей

`POST /orgs/:orgId/users/:userId/roles/:role_id` назначить роль

`DELETE /orgs/:orgId/users/:userId/roles/:role_id` отозвать роль

#### Получить все роли (список ролей): `GET /roles`

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


#### Назначить роль: `POST /orgs/:orgId/users/:userId/roles/:role_id`

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

#### Отозвать роль: `DELETE /orgs/:orgId/users/:userId/roles/:role_id`

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

### Пользователи

`POST /orgs/:orgsId/users` регистрация пользователя в организации с  одновременным назначением роли и отправкой приглашения на email

`GET /orgs/:orgId/users/:userId` получить профиль юзера

`DELETE /orgs/:orgsId/users/:userId` удалить пользователя

`GET /orgs/:org_id/users?role=&q=&include_revoked=&page=&limit=`  получить список преподавателей/ студентов/сотрудников в учебной организации

`GET /orgs/:orgsId/users/me` получить профиль (свой)

`PUT /orgs/:orgsId/users/me` редактировать свой профиль

`POST /orgs/:orgId/users/me/password` сменить пароль

#### Регистрация пользователя:  `POST /orgs/:orgsId/users`

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

#### Получить профиль юзера:  `GET /orgs/:orgId/users/:userId`

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

#### Удалить пользователя в организации:  `DELETE /orgs/:orgsId/users/:userId`

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

#### Получить список пользователей согласно роли: `GET /orgs/:org_id/users?role=&q=&include_revoked=&page=&limit=`

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


#### Получить свой профиль:  `GET /orgs/:orgsId/users/me`

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

##### Редактировать свой профиль:  `PUT /orgs/:orgsId/users/me`

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


#### Сменить пароль (свой):  `POST /orgs/:orgId/users/me/password`

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

GET /orgs/:orgId/penguin-rules?q=&is_active=&page=&limit=  
получить список правил

GET /orgs/:orgId/penguin-rules/:id получить правило

POST /orgs/:orgId/penguin-rules создать правило

PUT /orgs/:orgId/penguin-rules/:id изменить правило

DELETE /orgs/:orgId/penguin-rules/:id удалить правило

#### Получить список правил:

суперадмин, админ, сотрудник учебной организации, преподаватель

- GET /orgs/:orgId/penguin-rules?q=&is_active=&page=&limit=

> q - поиск по code/title
>
> is_active — 0\|1 опционально, по умолчанию все
>
> page - номер страницы, по умолчанию 1
>
> limit - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:** {}

- **Path / Query params:**

  - orgId - целое число

  - q - строка (если передали)

  - is_active - 0\|1

  - page - целое число \>= 1, по умолчанию 1

  - limit- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

- **Validation**:

  - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - q - string\[0..100\] - trim

  - only_active - 0\|1

  - page - целое число, \>=1, по умолчанию - 1

  - limit - целое число, 1..200, по умолчанию - 50

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - q - string\[0..100\] - trim

    - only_active - 0\|1

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

  <!-- -->

  - **Responses**:

    - **200 OK**

> {
>
> "total": 1,
>
> "page": 1,
>
> "limit": 50,
>
> "penguin_rules":
>
> \[
>
> {
>
> "id": 11,
>
> "code": "HOMEWORK",
>
> "title": "Homework completed",
>
> "default_delta": 3,
>
> "is_active": true,
>
> "description": "Award for completed homework",
>
> "created_at": "2025-09-02T10:11:12Z",
>
> "updated_at": "2025-09-02T10:11:12Z",
>
> },
>
> \]
>
> }

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view rules in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}

- **SQL**

> SET @page = GREATEST(COALESCE(:page, 1), 1);
>
> SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
>
> SET @offset = (@page - 1) \* @limit;
>
> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> Проверки фильтров, если параметр передан
>
> Проверка группы
>
> SELECT 1 FROM groups
>
> WHERE id = :group_id AND org_id = :org_id
>
> LIMIT 1;
>
> total
>
> SELECT COUNT(\*) AS total
>
> FROM penguin_rules
>
> WHERE org_id = :org_id
>
> AND (COALESCE(:is_active, -1) = -1 OR is_active = :is_active)
>
> AND (
>
> COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
>
> OR code LIKE CONCAT('%', :q, '%')
>
> OR title LIKE CONCAT('%', :q, '%')
>
> );
>
> page
>
> SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
>
> FROM penguin_rules
>
> WHERE org_id = :org_id
>
> AND (COALESCE(:is_active, -1) = -1 OR is_active = :is_active)
>
> AND (
>
> COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
>
> OR code LIKE CONCAT('%', :q, '%')
>
> OR title LIKE CONCAT('%', :q, '%')
>
> )
>
> ORDER BY is_active DESC, title ASC, id ASC
>
> LIMIT @limit OFFSET @offset;

##### Получить правило:

суперадмин, админ, сотрудник учебной организации, учитель

- GET /orgs/:orgId/penguin-rules/:id

  - **Content-type:** application/json

  - **Authorization:** Bearer \<jwt\>

  - **Body:** {}

  - **Path / Query params:**

    - orgId - целое число

    - id - целое число

  - **Backend-правила:**

    - orgId из пути должен совпадать с org в JWT  
      (для superadmin - любой org)

    - Организация orgId существует и status IN ('active','pending')

  - **Validation**:

    - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - id - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - id - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

  <!-- -->

  - **Responses**:

    - **200 OK**

> {
>
> "id": 11,
>
> "code": "HOMEWORK",
>
> "title": "Homework completed",
>
> "default_delta": 3,
>
> "is_active": true,
>
> "description": "Award for completed homework",
>
> "created_at": "2025-09-02T10:11:12Z",
>
> "updated_at": "2025-09-02T10:11:12Z",
>
> },

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: id must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view rules in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {"message": "Rule not found"}

- **SQL**

> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending') LIMIT 1;
>
> Выборка
>
> SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
>
> FROM penguin_rules
>
> WHERE org_id = :org_id AND id = :id
>
> LIMIT 1;

##### Создать правило:

суперадмин, админ

- POST /orgs/:orgId/penguin-rules

  - **Content-type:** application/json

  - **Authorization:** Bearer \<jwt\>

  - **Body:**

> {
>
> "code": "BONUS",
>
> "title": "Bonus points",
>
> "default_delta": 5,
>
> "is_active": true,
>
> "description": "Special bonus",
>
> }

- **Path / Query params:**

  - orgId - целое число

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

  - code уникален в рамках организации (org_id, code)

- **Validation**:

  - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - code - ^\[A-Za-z0-9.\_-\]{2,50}\$, toLowerCase(), trim, обязательное поле

  - title - string\[1..150\], trim, обязательное поле

  - default_delta - smallint целое, обязательное поле

  - is_active - boolean

  - description - string\[0..1000\]

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - code - ^\[A-Za-z0-9.\_-\]{2,50}\$, toLowerCase(), trim, обязательное поле

    - title - string\[1..150\], trim, обязательное поле

    - default_delta - smallint целое, обязательное поле

    - is_active - boolean

    - description - string\[0..1000\]

  - DB:

    - (org_id, code) - UNIQUE проверка уникальности

  <!-- -->

  - **Responses**:

    - **201 Created** правило создано

> {
>
> "id": 18,
>
> "code": "BONUS",
>
> "title": "Bonus points",
>
> "default_delta": 5,
>
> "is_active": true,
>
> "description": "Special bonus",
>
> "created_at": "2025-09-02T10:11:12Z",
>
> "updated_at": "2025-09-02T10:11:12Z",
>
> },

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”code is required”}
>
> {“message”: ”title is required”}
>
> {“message”: ”default_delta is required”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to create rules in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}

- **409 Conflict** дубликат

> {“message”: ”Rule code 'bonus' is already in use in this organization.”}

- **SQL**

> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> Проверка на уникальность кода
>
> SELECT id FROM penguin_rules
>
> WHERE org_id = :org_id AND code = :code
>
> LIMIT 1;
>
> Создание правила
>
> INSERT INTO penguin_rules (org_id, code, title, default_delta, is_active, description, created_at, updated_at)
>
> VALUES (:org_id, :code, :title, :default_delta, COALESCE(:is_active, 1), :description, NOW(), NOW());
>
> Для ответа
>
> SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
>
> FROM penguin_rules
>
> WHERE id = LAST_INSERT_ID();

##### Изменить правило:

суперадмин, админ

- PUT /orgs/:orgId/penguin-rules/:id

  - **Content-type:** application/json

  - **Authorization:** Bearer \<jwt\>

  - **Body:**

> {
>
> "code": "BONUS",
>
> "title": "Bonus points",
>
> "default_delta": 5,
>
> "is_active": true,
>
> "description": "Special bonus",
>
> }

- **Path / Query params:**

  - orgId - целое число

- **Бизнес-правила:**

  - При смене code проверить на уникальность (org_id, code)

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

- **Validation**:

  - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - code - ^\[A-Za-z0-9.\_-\]{2,50}\$, toLowerCase(), trim

  - title - string\[1..150\], trim

  - default_delta - smallint целое

  - is_active - boolean

  - description - string\[0..1000\]

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - code - ^\[A-Za-z0-9.\_-\]{2,50}\$, toLowerCase(), trim

    - title - string\[1..150\], trim

    - default_delta - smallint целое

    - is_active - boolean

    - description - string\[0..1000\]

  - DB:

    - (org_id, code) - UNIQUE проверка уникальности

  <!-- -->

  - **Responses**:

    - **200 OK**

> {
>
> "id": 18,
>
> "code": "BONUS",
>
> "title": "Bonus points",
>
> "default_delta": 5,
>
> "is_active": true,
>
> "description": "Special bonus",
>
> "created_at": "2025-09-02T10:11:12Z",
>
> "updated_at": "2025-09-02T10:11:12Z",
>
> },

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to edit a rule in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {"message": "Rule not found"}

- **409 Conflict** дубликат

> {“message”: ”Rule code 'bonus' is already in use in this organization.”}

- **SQL**

> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> Проверка на уникальность кода, если меняем
>
> SELECT id FROM penguin_rules
>
> WHERE org_id = :org_id AND code = :code AND id \<\> :id
>
> LIMIT 1;
>
> Обновление правила
>
> UPDATE penguin_rules
>
> SET code = COALESCE(:code, code),
>
> title = COALESCE(:title, title),
>
> default_delta = COALESCE(:default_delta, default_delta),
>
> is_active = COALESCE(:is_active, is_active),
>
> description = COALESCE(:description, description),
>
> updated_at = NOW()
>
> WHERE org_id = :org_id AND id = :id;
>
> Для ответа
>
> SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
>
> FROM penguin_rules
>
> WHERE org_id = :org_id AND id = :id
>
> LIMIT 1;

##### Удалить правило:

суперадмин, админ

- DELETE /orgs/:orgId/penguin-rules/:id

  - **Content-type:** application/json

  - **Authorization:** Bearer \<jwt\>

  - **Body:** {}

  - **Path / Query params:**

    - orgId - целое число

    - id - целое число

  - **Backend-правила:**

    - orgId из пути должен совпадать с org в JWT  
      (для superadmin - любой org)

    - Организация orgId существует и status IN ('active','pending')

    - Правило не удаляем, а деактивируем is_active=false

  - **Validation**:

    - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - id - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - id - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

  <!-- -->

  - **Responses**:

> {
>
> "id": 18,
>
> "code": "BONUS",
>
> "title": "Bonus points",
>
> "default_delta": 5,
>
> "is_active": false,
>
> "description": "Special bonus",
>
> "created_at": "2025-09-02T10:11:12Z",
>
> "updated_at": "2025-09-02T10:11:12Z",
>
> },

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: id must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to remove a rule in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {"message": "Rule not found"}

- **SQL**

> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending') LIMIT 1;
>
> Деактивация правила
>
> UPDATE penguin_rules
>
> SET is_active = 0, updated_at = NOW()
>
> WHERE org_id = :org_id AND id = :id;
>
> Для ответа
>
> SELECT id, code, title, default_delta, is_active, description, created_at, updated_at
>
> FROM penguin_rules
>
> WHERE org_id = :org_id AND id = :id
>
> LIMIT 1;

#### Групповое начисление пингвинов penguin_batches

POST /orgs/:orgId/penguins/batches  
создать групповое начисление/списание  
и разнести по студентам

GET /orgs/:orgId/penguins/batches?groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=  
получить список групповых начислений

GET /orgs/:orgId/penguins/batches/:id/students?page=&limit=  
получить список студентов при групповом начислении

GET /orgs/:orgId/penguins/batches/:id  
получить групповое начисление по id

##### Создать групповое начисление/списание и разнести по студентам:

суперадмин, админ, преподаватель

- POST /orgs/:orgId/penguins/batches

  - **Content-type:** application/json

  - **Authorization:** Bearer \<jwt\>

  - **Body:**

> {
>
> "group_id": 510,
>
> "subject_id": 108,
>
> "student_ids": \[3001, 3002, 3003\],
>
> "delta": 3,
>
> "reason": "Homework week 3",
>
> "rule_code": "HOMEWORK"
>
> }

- **Бизнес-правила:**

  - Группа принадлежит этой организации

  - Предмет принадлежит этой организации

  - Преподаватель имеет активную роль teacher в этой организации и имеет назначение на эту группу/предмет teaching_assignments

  - Студент имеет активную роль student в этой организации и состоит в группе group_members.status \<\> 'archived'

  - Предмет привязан к группе group_subjects

  - rule_code правило существует и is_active=1

  - Для каждого студента создается запись в penguin_ledger, обновляется penguin_balances, создается notifications , тип penguin_award\|penguin_deduct по знаку delta

- **Path / Query params:**

  - orgId - целое число

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

  - operator_id берём из JWT

  - delta — целое, не 0 (плюс - награда, минус - списание)

- **Validation**:

  - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - group_id - /^\[1-9\]\d{0,9}\$/ - int, обязательное поле

  - subject_id - /^\[1-9\]\d{0,9}\$/ - int, обязательное поле

  - student_ids - array\[1..1000\] - int, обязательное поле

  - delta - integer ≠ 0, обязательное поле

  - reason - string\[1..255\], trim

  - rule_code - ^\[A-Za-z0-9.\_-\]{2,50}\$

  - 

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - group_id - /^\[1-9\]\d{0,9}\$/ - int, обязательное поле

    - subject_id - /^\[1-9\]\d{0,9}\$/ - int, обязательное поле

    - student_ids - array\[1..1000\] - int, обязательное поле

    - delta - integer ≠ 0, обязательное поле

    - reason - string\[1..255\], trim

    - rule_code - ^\[A-Za-z0-9.\_-\]{2,50}\$

  <!-- -->

  - **Responses**:

    - **201 Created** групповое начисление пингвинов успешно

> {
>
> "batch": {
>
> "id": 90001,
>
> "group_id": {
>
> "id": 510,
>
> "code": "281025-wdm",
>
> "name": "Web-Development-2025-10"
>
> },
>
> "subject_id": {
>
> "id": 108,
>
> "name": "React"
>
> },
>
> "operator_id": {
>
> "id": 1054,
>
> "full_name": "Ivan Petrov"
>
> },
>
> "delta": 3,
>
> "reason": "Homework week 3",
>
> "created_at": "2025-09-02T10:11:12Z"
>
> },
>
> "affected": 3,
>
> "students": \[3001, 3002, 3003\],
>
> },

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”group_id is required”}
>
> {“message”: ”subject_id is required”}
>
> {“message”: ”student_ids is required”}
>
> {“message”: ”delta is required”}
>
> {“message”: ”delta must be a non-zero integer”}
>
> {“message”: ”group_id must be integer”}
>
> {“message”: ”subject_id must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to award penguins in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”Group not found”}
>
> {“message”: ”Subject not found”}
>
> {“message”: ”User not found”}
>
> {“message”: ”Rule not found”}

- **409 Conflict** не выполняется условие

> {“message”: ”User does not have an active 'teacher' role in this organization.”}
>
> {“message”: ”Teacher is not assigned to this subject in this group.”}
>
> {“message”: ”Subject is not assigned to the group.”}
>
> {“message”: ”Some students do not have an active 'student' role in this organization.”}
>
> {“message”: ”Some students are not active members of the group.”}
>
> {“message”: ”Rule is inactive.”}

- **SQL**

> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> Проверка группы
>
> SELECT 1 FROM groups
>
> WHERE id = :group_id AND org_id = :org_id
>
> LIMIT 1;
>
> Проверка роли преподавателя (берем из JWT)
>
> SELECT 1
>
> FROM user_roles
>
> JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'teacher'
>
> WHERE user_roles.org_id = :org_id AND user_roles.user_id = :operator_id AND user_roles.revoked_at IS NULL
>
> LIMIT 1;
>
> Проверка преподавателя на назначение группе
>
> SELECT 1 FROM teaching_assignments
>
> WHERE org_id = :org_id AND teacher_id = :operator_id AND group_id = :group_id AND subject_id = :subject_id
>
> LIMIT 1;
>
> Проверка предмета
>
> SELECT 1 FROM subjects
>
> WHERE id = :subject_id AND org_id = :org_id
>
> LIMIT 1;
>
> Проверка предмета на назначение группе
>
> SELECT 1 FROM group_subjects
>
> WHERE org_id = :org_id
>
> AND group_id = :group_id
>
> AND subject_id = :subject_id
>
> LIMIT 1;
>
> Если rule_code не передали
>
> SET @rule_id := NULL;
>
> SET @rule_active := NULL;
>
> Если rule_code передан
>
> SELECT id, is_active INTO @rule_id, @rule_active
>
> FROM penguin_rules
>
> WHERE org_id = :org_id AND code = :rule_code
>
> LIMIT 1;
>
> @rule_id IS NULL -\> 404 "Rule not found"
>
> @rule_active = 0 -\> 409 "Rule is inactive"
>
> Проверка студентов на роль и принадлежность группе
>
> роль student активна
>
> SELECT COUNT(\*) AS bad_student_role
>
> FROM (
>
> SELECT DISTINCT sid FROM (
>
> распакованный список :student_ids (временная таблица)
>
> SELECT :student_ids AS sid_list
>
> ) t
>
> ) ids
>
> LEFT JOIN user_roles ON user_roles.org_id = :org_id AND user_roles.user_id = ids.sid AND user_roles.revoked_at IS NULL
>
> LEFT JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'student'
>
> WHERE roles.id IS NULL;
>
> если bad_student_role \> 0 -\> 409 "Some students do not have an active 'student' role in this organization."
>
> пользователь активен и член группы (не archived)
>
> SELECT COUNT(\*) AS bad_membership
>
> FROM users
>
> LEFT JOIN group_members
>
> ON group_members.group_id = :group_id
>
> AND group_members.student_id = users.id
>
> AND group_members.status \<\> 'archived'
>
> WHERE users.id IN (:student_ids)
>
> AND (users.status = 'deleted' OR group_members.student_id IS NULL);
>
> если bad_membership \> 0 -\> 409 "Some students are not active members of the group."
>
> Создание группового начисления
>
> INSERT INTO penguin_batches (org_id, group_id, subject_id, operator_id, delta, reason, created_at)
>
> VALUES (:org_id, :group_id, :subject_id, :operator_id, :delta, :reason, NOW());
>
> SET @batch_id = LAST_INSERT_ID();
>
> Для каждого студента логи и обновление баланса
>
> *(в коде это батчевый INSERT SELECT с UNION ALL / VALUES)*
>
> пример шаблона для каждого :student_id в :student_ids:
>
> INSERT INTO penguin_ledger
>
> (org_id, student_id, group_id, subject_id, operator_id, direction_id, rule_id, batch_id, delta, reason, created_at)
>
> SELECT :org_id, :student_id, :group_id, :subject_id, :operator_id, g.direction_id, @rule_id, @batch_id, :delta, :reason, NOW()
>
> FROM groups
>
> WHERE groups.id = :group_id AND groups.org_id = :org_id;
>
> INSERT INTO penguin_balances (org_id, student_id, group_id, subject_id, direction_id, total)
>
> SELECT :org_id, :student_id, :group_id, :subject_id, g.direction_id, :delta
>
> FROM groups
>
> WHERE groups.id = :group_id AND groups.org_id = :org_id
>
> ON DUPLICATE KEY UPDATE total = total + VALUES(total);
>
> Создание уведомления (по одному на студента)
>
> INSERT INTO notifications (org_id, user_id, group_id, type, payload, is_read, created_at)
>
> VALUES
>
> (:org_id, :student_id, :group_id,
>
> CASE WHEN :delta \>= 0 THEN 'penguin_award' ELSE 'penguin_deduct' END,
>
> JSON_OBJECT(
>
> 'delta', :delta,
>
> 'reason', :reason,
>
> 'subject_id', :subject_id,
>
> 'batch_id', @batch_id
>
> ),
>
> 0, NOW());
>
> Для ответа
>
> SELECT id, group_id, subject_id, operator_id, delta, reason, created_at
>
> FROM penguin_batches
>
> WHERE id = @batch_id;

##### Получить список групповых начислений:

суперадмин, админ, преподаватель, сотрудник организации

- GET /orgs/:orgId/penguins/batches?groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=

> groupId - фильтр по группе (опционально)
>
> subjectId - фильтр по предмету (опционально)
>
> operatorId - фильтр по преподавателю (опционально)
>
> date_from - фильтр по дате начало периода (опционально)
>
> date_to - фильтр по дате конец периода (опционально)
>
> page - номер страницы, по умолчанию 1
>
> limit - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:** {}

- **Path / Query params:**

  - orgId - целое число

  - groupId - целое число

  - subjectId - целое число

  - operatorId - целое число

  - date_from - YYYY-MM-DD

  - date_to - YYYY-MM-DD

  - page - целое число \>= 1, по умолчанию 1

  - limit- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

- **Validation**:

  - Frontend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - operatorId - /^\[1-9\]\d{0,9}\$/ - в path

    - date_from - YYYY-MM-DD

    - date_to - YYYY-MM-DD

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - operatorId - /^\[1-9\]\d{0,9}\$/ - в path

    - date_from - YYYY-MM-DD

    - date_to - YYYY-MM-DD

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

> {
>
> "total": 1,
>
> "page": 1,
>
> "limit": 50,
>
> "batches":
>
> \[
>
> "batch": {
>
> "id": 90001,
>
> "group_id": {
>
> "id": 510,
>
> "code": "281025-wdm",
>
> "name": "Web-Development-2025-10"
>
> },
>
> "subject_id": {
>
> "id": 108,
>
> "name": "React"
>
> },
>
> "operator_id": {
>
> "id": 1054,
>
> "full_name": "Ivan Petrov"
>
> },
>
> "delta": 3,
>
> "reason": "Homework week 3",
>
> "created_at": "2025-09-02T10:11:12Z"
>
> },
>
> "affected": 3,
>
> \]
>
> }

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: groupId must be integer”}
>
> {“message”: ”Invalid path parameter: subjectId must be integer”}
>
> {“message”: ”Invalid path parameter: operatorId must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view penguins in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”Group not found”}
>
> {“message”: ”Teacher not found”}
>
> {“message”: ”Subject not found”}

- **SQL**

> SET @page = GREATEST(COALESCE(:page, 1), 1);
>
> SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
>
> SET @offset = (@page - 1) \* @limit;
>
> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> total
>
> SELECT COUNT(\*) AS total
>
> FROM penguin_batches
>
> JOIN users ON users.id = penguin_batches.operator_id
>
> WHERE penguin_batches.org_id = :org_id
>
> AND users.status \<\> 'deleted'
>
> AND (:group_id IS NULL
>
> OR penguin_batches.group_id = :group_id)
>
> AND (:subject_id IS NULL
>
> OR penguin_batches.subject_id = :subject_id)
>
> AND (:operator_id IS NULL
>
> OR penguin_batches.operator_id = :operator_id)
>
> AND (:date_from IS NULL
>
> OR penguin_batches.created_at \>= :date_from)
>
> AND (:date_to IS NULL
>
> OR penguin_batches.created_at \< :date_to);
>
> page
>
> SELECT
>
> penguin_batches.id,
>
> penguin_batches.delta,
>
> penguin_batches.reason,
>
> penguin_batches.created_at,
>
> groups.id AS group_id,
>
> groups.code AS group_code,
>
> groups.name AS group_name,
>
> subjects.id AS subject_id,
>
> subjects.name AS subject_name,
>
> users.id AS operator_id,
>
> users.full_name AS operator_name,
>
> COALESCE(bstats.affected, 0) AS affected
>
> FROM penguin_batches
>
> JOIN users ON users.id = penguin_batches.operator_id AND users.status \<\> 'deleted'
>
> JOIN groups ON groups.id = penguin_batches.group_id
>
> JOIN subjects ON subjects.id = penguin_batches.subject_id
>
> LEFT JOIN (
>
> SELECT penguin_ledger.batch_id, COUNT(\*) AS affected
>
> FROM penguin_ledger
>
> JOIN users students ON students.id = penguin_ledger.student_id AND students.status \<\> 'deleted'
>
> WHERE penguin_ledger.org_id = :org_id
>
> GROUP BY penguin_ledger.batch_id
>
> ) bstats ON bstats.batch_id = penguin_batches.id
>
> WHERE penguin_batches.org_id = :org_id
>
> AND (:group_id IS NULL OR penguin_batches.group_id = :group_id)
>
> AND (:subject_id IS NULL OR penguin_batches.subject_id = :subject_id)
>
> AND (:operator_id IS NULL OR penguin_batches.operator_id = :operator_id)
>
> AND (:date_from IS NULL OR penguin_batches.created_at \>= :date_from)
>
> AND (:date_to IS NULL OR penguin_batches.created_at \< :date_to)
>
> ORDER BY penguin_batches.created_at DESC, penguin_batches.id DESC
>
> LIMIT @limit OFFSET @offset;

##### Получить список студентов при групповом начислении:

суперадмин, админ, преподаватель, сотрудник организации

- GET /orgs/:orgId/penguins/batches/:id/students?page=&limit=

> id - ід группового начисления
>
> page - номер страницы, по умолчанию 1
>
> limit - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:** {}

- **Path / Query params:**

  - orgId - целое число

  - id - целое число

  - page - целое число \>= 1, по умолчанию 1

  - limit- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

- **Validation**:

  - Frontend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - id - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - id - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

> {
>
> "total": 1,
>
> "page": 1,
>
> "limit": 50,
>
> "students":
>
> \[
>
> { "id": 3001,
>
> "full_name": "Alice Student"
>
> },
>
> { "id": 3002,
>
> "full_name": "Bob Student"
>
> }
>
> \]
>
> }

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: id must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view penguins in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”Batch not found”}

- **SQL**

> SET @page = GREATEST(COALESCE(:page, 1), 1);
>
> SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
>
> SET @offset = (@page - 1) \* @limit;
>
> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> Проверка батча
>
> SELECT 1 FROM penguin_batches
>
> WHERE id = :batch_id AND org_id = :org_id
>
> LIMIT 1;
>
> total
>
> SELECT COUNT(\*) AS total
>
> FROM penguin_ledger
>
> JOIN users ON users.id = penguin_ledger.student_id
>
> WHERE penguin_ledger.org_id = :org_id AND penguin_ledger.batch_id = :batch_id
>
> AND users.status \<\> 'deleted';
>
> page
>
> SELECT users.id, users.full_name
>
> FROM penguin_ledger
>
> JOIN users ON users.id = penguin_ledger.student_id
>
> WHERE penguin_ledger.org_id = :org_id AND penguin_ledger.batch_id = :batch_id
>
> AND users.status \<\> 'deleted'
>
> ORDER BY users.full_name ASC, users.id ASC
>
> LIMIT @limit OFFSET @offset;

##### Получить групповое начисление по id (детальная карточка):

суперадмин, админ, преподаватель, сотрудник организации

- GET /orgs/:orgId/penguins/batches/:id

> id - ід группового начисления

- **Назначение:** Показывает один батч - базовые поля + человекочитаемые названия (группа/предмет/оператор), привязанное правило (если было), количество затронутых студентов (affected) и полный список студентов этого батча.

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:** {}

- **Path / Query params:**

  - orgId - целое число

  - id - целое число

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

  - Батч принадлежит этой организации

- **Validation**:

  - Frontend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - id - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - id - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

- **Responses**:

  - **200 OK**

> {
>
> "id": 90001,
>
> "delta": 3,
>
> "reason": "Homework week 3",
>
> "created_at": "2025-09-02T10:11:12Z",
>
> "group": {
>
> "id": 510,
>
> "code": "281025-wdm",
>
> "name": "Web-Development-2025-10"
>
> },
>
> "subject": {
>
> "id": 108,
>
> "name": "React"
>
> },
>
> "operator": {
>
> "id": 1054,
>
> "full_name": "Ivan Petrov"
>
> },
>
> "rule": {
>
> "id": 14,
>
> "code": "HOMEWORK",
>
> "title": "Homework submission",
>
> "default_delta": 3
>
> },
>
> "affected": 3,
>
> "students": \[
>
> {
>
> "id": 3001,
>
> "full_name": "Alice Student",
>
> "email": "alice@example.com"
>
> },
>
> {
>
> "id": 3002,
>
> "full_name": "Bob Student",
>
> "email": "bob@example.com"
>
> },
>
> {
>
> "id": 3003,
>
> "full_name": "Carol Student",
>
> "email": "carol@example.com"
>
> },
>
> \]
>
> }

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: id must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view penguins in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”Batch not found”}

- **SQL**

> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> Проверка батча
>
> SELECT 1 FROM penguin_batches
>
> WHERE id = :batch_id AND org_id = :org_id
>
> LIMIT 1;
>
> Карточка батча: базовые поля + человекочитаемые названия
>
> SELECT
>
> penguin_batches.id,
>
> penguin_batches.delta,
>
> penguin_batches.reason,
>
> penguin_batches.created_at,
>
> groups.id AS group_id,
>
> groups.code AS group_code,
>
> groups.name AS group_name,
>
> subjects.id AS subject_id,
>
> subjects.name AS subject_name,
>
> users.id AS operator_id,
>
> users.full_name AS operator_name
>
> FROM penguin_batches
>
> JOIN groups ON groups.id = penguin_batches.group_id
>
> JOIN subjects ON subjects.id = penguin_batches.subject_id
>
> LEFT JOIN users ON users.id = penguin_batches.operator_id
>
> WHERE penguin_batches.org_id = :org_id AND penguin_batches.id = :id
>
> LIMIT 1;
>
> Правило батча: берем из ledger (если rule использовали при создании)
>
> (ожидается один и тот же rule_id для всех строк батча; если NULL — правила нет)
>
> SELECT
>
> penguin_rules.id,
>
> penguin_rules.code,
>
> penguin_rules.title,
>
> penguin_rules.default_delta
>
> FROM penguin_ledger
>
> JOIN penguin_rules ON penguin_rules.id = penguin_ledger.rule_id
>
> WHERE penguin_ledger.org_id = :org_id
>
> AND penguin_ledger.batch_id = :id
>
> AND penguin_ledger.rule_id IS NOT NULL
>
> LIMIT 1;
>
> Количество затронутых студентов (affected)
>
> SELECT COUNT(\*) AS affected
>
> FROM penguin_ledger
>
> JOIN users ON users.id = penguin_ledger.student_id
>
> WHERE penguin_ledger.org_id = :org_id
>
> AND penguin_ledger.batch_id = :id
>
> AND users.status \<\> 'deleted';
>
> Полный список студентов батча (упорядочен по ФИО)
>
> SELECT
>
> users.id,
>
> users.full_name,
>
> users.email
>
> FROM penguin_ledger
>
> JOIN users ON users.id = penguin_ledger.student_id
>
> WHERE penguin_ledger.org_id = :org_id
>
> AND penguin_ledger.batch_id = :id
>
> AND users.status \<\> 'deleted'
>
> ORDER BY users.full_name ASC, users.id ASC;

#### Логирование (Индивидуальное начисление / списание) penguin_ledger

POST /orgs/:orgId/penguins/ledger  
создать индивидуальное начисление/списание пингвинов

GET /orgs/:orgId/penguins/ledger?q=&studentId=&groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=  
получить список начислений/снятий

GET /orgs/:orgId/penguins/ledger/:id  
получить операцию по id

##### Создать индивидуальное начисление/списание пингвинов:

суперадмин, админ, преподаватель

- POST /orgs/:orgId/penguins/ledger

  - **Content-type:** application/json

  - **Authorization:** Bearer \<jwt\>

  - **Body:**

> {
>
> "student_id": 3001,
>
> "group_id": 510,
>
> "subject_id": 108,
>
> "delta": -2,
>
> "reason": "Late submission",
>
> "rule_code": "DEDUCT_LATE"
>
> }

- **Бизнес-правила:**

  - Группа принадлежит этой организации

  - Предмет принадлежит этой организации

  - Преподаватель имеет активную роль teacher в этой организации и имеет назначение на эту группу/предмет teaching_assignments

  - Студент имеет активную роль student в этой организации и состоит в группе group_members.status \<\> 'archived'

  - Предмет привязан к группе group_subjects

  - rule_code правило существует и is_active=1

  - Для студента обновляется penguin_balances, создается notifications , тип penguin_award\|penguin_deduct по знаку delta

- **Path / Query params:**

  - orgId - целое число

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

  - operator_id берём из JWT

  - delta — целое, не 0 (плюс - награда, минус - списание)

- **Validation**:

  - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - group_id - /^\[1-9\]\d{0,9}\$/ - int, обязательное поле

  - subject_id - /^\[1-9\]\d{0,9}\$/ - int, обязательное поле

  - student_id - /^\[1-9\]\d{0,9}\$/ - int, обязательное поле

  - delta - integer ≠ 0, обязательное поле

  - reason - string\[1..255\], trim

  - rule_code - ^\[A-Za-z0-9.\_-\]{2,50}\$

  - 

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - group_id - /^\[1-9\]\d{0,9}\$/ - int, обязательное поле

    - subject_id - /^\[1-9\]\d{0,9}\$/ - int, обязательное поле

    - student_id - /^\[1-9\]\d{0,9}\$/ - int, обязательное поле

    - delta - integer ≠ 0, обязательное поле

    - reason - string\[1..255\], trim

    - rule_code - ^\[A-Za-z0-9.\_-\]{2,50}\$

  <!-- -->

  - **Responses**:

    - **201 Created** начисление/ снятие пингвинов успешно

> {
>
> "id": 120045,
>
> "student": {
>
> "id": 3001,
>
> "full_name": "Alice Student"
>
> },
>
> "group": {
>
> "id": 510,
>
> "code": "281025-wdm",
>
> "name": "Web-Development-2025-10"
>
> },
>
> "subject": {
>
> "id": 108,
>
> "name": "React"
>
> },
>
> "operator": {
>
> "id": 1054,
>
> "full_name": "Ivan Petrov"
>
> },
>
> "rule": {
>
> "id": 12,
>
> "code": "DEDUCT_LATE"
>
> },
>
> "delta": -2,
>
> "reason": "Late submission",
>
> "created_at": "2025-09-02T10:11:12Z",
>
> },

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”group_id is required”}
>
> {“message”: ”subject_id is required”}
>
> {“message”: ”student_id is required”}
>
> {“message”: ”delta is required”}
>
> {“message”: ”delta must be a non-zero integer”}
>
> {“message”: ”group_id must be integer”}
>
> {“message”: ”subject_id must be integer”}
>
> {“message”: ”student_id must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to award penguins in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”Group not found”}
>
> {“message”: ”Subject not found”}
>
> {“message”: ”User not found”}
>
> {“message”: ”Rule not found”}

- **409 Conflict** не выполняется условие

> {“message”: ”User does not have an active 'teacher' role in this organization.”}
>
> {“message”: ”Teacher is not assigned to this subject in this group.”}
>
> {“message”: ”Subject is not assigned to the group.”}
>
> {“message”: ”Student do not have an active 'student' role in this organization.”}
>
> {“message”: ”Student is not an active member of the group.”}
>
> {“message”: ”Rule is inactive.”}

- **SQL**

> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> Проверка группы
>
> SELECT 1 FROM groups
>
> WHERE id = :group_id AND org_id = :org_id
>
> LIMIT 1;
>
> Проверка роли преподавателя (берем из JWT)
>
> SELECT 1
>
> FROM user_roles
>
> JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'teacher'
>
> WHERE user_roles.org_id = :org_id AND user_roles.user_id = :teacher_id AND user_roles.revoked_at IS NULL
>
> LIMIT 1;
>
> Проверка преподавателя на назначение группе
>
> SELECT 1 FROM teaching_assignments
>
> WHERE org_id = :org_id AND teacher_id = :operator_id AND group_id = :group_id AND subject_id = :subject_id
>
> LIMIT 1;
>
> Проверка предмета
>
> SELECT 1 FROM subjects
>
> WHERE id = :subject_id AND org_id = :org_id
>
> LIMIT 1;
>
> Проверка предмета на назначение группе
>
> SELECT 1 FROM group_subjects
>
> WHERE org_id = :org_id
>
> AND group_id = :group_id
>
> AND subject_id = :subject_id
>
> LIMIT 1;
>
> Проверка правила (если оно передано)
>
> если не передали rule_code:
>
> SET @rule_id := NULL;
>
> SET @rule_active := NULL;
>
> если передали rule_code:
>
> SELECT id, is_active INTO @rule_id, @rule_active
>
> FROM penguin_rules
>
> WHERE org_id = :org_id AND code = :rule_code
>
> LIMIT 1;
>
> если :rule_code передано і @rule_id IS NULL -\> 404 Rule not found
>
> если :rule_code передано і @rule_active = 0 -\> 409 Rule is inactive
>
> Проверка роли студента
>
> SELECT 1
>
> FROM user_roles
>
> JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'student'
>
> WHERE user_roles.org_id = :org_id AND user_roles.user_id = :student_id AND user_roles.revoked_at IS NULL
>
> LIMIT 1;
>
> Проверка студента на принадлежность группе (не archived)
>
> SELECT COUNT(\*) AS bad_membership
>
> FROM users
>
> LEFT JOIN group_members
>
> ON group_members.group_id = :group_id
>
> AND group_members.student_id = users.id
>
> AND group_members.status \<\> 'archived'
>
> WHERE users.id IN (:student_id)
>
> AND (users.status = 'deleted' OR group_members.student_id IS NULL);
>
> если bad_membership \> 0 -\> 409 "Student is not an active member of the group."
>
> Создание начисления/списания пингвина
>
> INSERT INTO penguin_ledger
>
> (org_id, student_id, group_id, subject_id, operator_id, direction_id, rule_id, batch_id, delta, reason, created_at)
>
> SELECT :org_id, :student_id, :group_id, :subject_id, :operator_id, g.direction_id, @rule_id, @batch_id, :delta, :reason, NOW()
>
> FROM groups
>
> WHERE groups.id = :group_id AND groups.org_id = :org_id;
>
> Обновление баланса
>
> INSERT INTO penguin_balances (org_id, student_id, group_id, subject_id, direction_id, total)
>
> SELECT :org_id, :student_id, :group_id, :subject_id, g.direction_id, :delta
>
> FROM groups
>
> WHERE groups.id = :group_id AND groups.org_id = :org_id
>
> ON DUPLICATE KEY UPDATE total = total + VALUES(total);
>
> Создание уведомления
>
> INSERT INTO notifications (org_id, user_id, group_id, type, payload, is_read, created_at)
>
> VALUES
>
> (:org_id, :student_id, :group_id,
>
> CASE WHEN :delta \>= 0 THEN 'penguin_award' ELSE 'penguin_deduct' END,
>
> JSON_OBJECT(
>
> 'delta', :delta,
>
> 'reason', :reason,
>
> 'subject_id', :subject_id,
>
> 'batch_id', @batch_id
>
> ),
>
> 0, NOW());
>
> Для ответа
>
> SELECT
>
> penguin_ledger.id, penguin_ledger.delta, penguin_ledger.reason, penguin_ledger.created_at,
>
> users.id AS student_id, users.full_name AS student_name,
>
> teacher.id AS operator_id, teacher.full_name AS operator_name,
>
> subjects.id AS subject_id, subjects.name AS subject_name,
>
> groups.id AS group_id, groups.code, groups.name AS group_name,
>
> penguin_rules.id AS rule_id, penguin_rules.code AS rule_code
>
> FROM penguin_ledger
>
> JOIN users ON users.id = penguin_ledger.student_id
>
> JOIN users teacher ON teacher.id = penguin_ledger.operator_id
>
> JOIN subjects ON subjects.id = penguin_ledger.subject_id
>
> JOIN groups ON groups.id = penguin_ledger.group_id
>
> LEFT JOIN penguin_rules ON penguin_rules.id = penguin_ledger.rule_id
>
> WHERE penguin_ledger.id = LAST_INSERT_ID();

##### Получить список начислений/списаний (Журнал):

суперадмин, админ, преподаватель, сотрудник организации, студент

- GET /orgs/:orgId/penguins/ledger?q=&studentId=&groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=

> q - поиск по reason (опционально)
>
> studentId - фильтр по студенту (опционально)
>
> groupId - фильтр по группе (опционально)
>
> subjectId - фильтр по предмету (опционально)
>
> operatorId - фильтр по преподавателю (опционально)
>
> date_from - фильтр по дате начало периода (опционально)
>
> date_to - фильтр по дате конец периода (опционально)
>
> page - номер страницы, по умолчанию 1
>
> limit - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:** {}

- **Path / Query params:**

  - orgId - целое число

  - groupId - целое число

  - subjectId - целое число

  - operatorId - целое число

  - date_from - YYYY-MM-DD

  - date_to - YYYY-MM-DD

  - page - целое число \>= 1, по умолчанию 1

  - limit- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

- **Validation**:

  - Frontend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - studentId - /^\[1-9\]\d{0,9}\$/ - в path

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - operatorId - /^\[1-9\]\d{0,9}\$/ - в path

    - date_from - YYYY-MM-DD

    - date_to - YYYY-MM-DD

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - studentId - /^\[1-9\]\d{0,9}\$/ - в path

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - operatorId - /^\[1-9\]\d{0,9}\$/ - в path

    - date_from - YYYY-MM-DD

    - date_to - YYYY-MM-DD

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

> {
>
> "total": 1,
>
> "page": 1,
>
> "limit": 50,
>
> "ledger":
>
> \[
>
> {
>
> "id": 120045,
>
> "student": {
>
> "id": 3001,
>
> "full_name": "Alice Student"
>
> },
>
> "group": {
>
> "id": 510,
>
> "code": "281025-wdm",
>
> "name": "Web-Development-2025-10"
>
> },
>
> "subject": {
>
> "id": 108,
>
> "name": "React"
>
> },
>
> "operator": {
>
> "id": 1054,
>
> "full_name": "Ivan Petrov"
>
> },
>
> "rule": {
>
> "id": 12,
>
> "code": "DEDUCT_LATE"
>
> },
>
> "delta": -2,
>
> "reason": "Late submission",
>
> "created_at": "2025-09-02T10:11:12Z",
>
> },
>
> \]
>
> }

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: studentId must be integer”}
>
> {“message”: ”Invalid path parameter: groupId must be integer”}
>
> {“message”: ”Invalid path parameter: subjectId must be integer”}
>
> {“message”: ”Invalid path parameter: operatorId must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view penguins in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”Student not found”}
>
> {“message”: ”Group not found”}
>
> {“message”: ”Teacher not found”}
>
> {“message”: ”Subject not found”}

- **SQL**

> SET @page = GREATEST(COALESCE(:page, 1), 1);
>
> SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
>
> SET @offset = (@page - 1) \* @limit;
>
> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> total
>
> SELECT COUNT(\*) AS total
>
> FROM penguin_ledger
>
> JOIN users ON users.id = penguin_ledger.student_id
>
> JOIN users teacher ON teacher.id = penguin_ledger.operator_id
>
> JOIN subjects ON subjects.id = penguin_ledger.subject_id
>
> JOIN groups ON groups.id = penguin_ledger.group_id
>
> LEFT JOIN penguin_rules ON penguin_rules.id = penguin_ledger.rule_id
>
> WHERE penguin_ledger.org_id = :org_id
>
> AND users.status \<\> 'deleted' AND teacher.status \<\> 'deleted'
>
> AND (:student_id IS NULL OR penguin_ledger.student_id = :student_id)
>
> AND (:group_id IS NULL OR penguin_ledger.group_id = :group_id)
>
> AND (:subject_id IS NULL OR penguin_ledger.subject_id = :subject_id)
>
> AND (:operator_id IS NULL OR penguin_ledger.operator_id = :operator_id)
>
> AND (:date_from IS NULL OR penguin_ledger.created_at \>= :date_from)
>
> AND (:date_to IS NULL OR penguin_ledger.created_at \< :date_to)
>
> AND (
>
> COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
>
> OR penguin_ledger.reason LIKE CONCAT('%', :q, '%')
>
> );
>
> page
>
> SELECT
>
> penguin_ledger.id, penguin_ledger.delta, penguin_ledger.reason, penguin_ledger.created_at,
>
> users.id AS student_id, users.full_name AS student_name,
>
> teacher.id AS operator_id, teacher.full_name AS operator_name,
>
> subjects.id AS subject_id, subjects.name AS subject_name,
>
> groups.id AS group_id, groups.code, groups.name AS group_name,
>
> penguin_rules.id AS rule_id, penguin_rules.code AS rule_code
>
> FROM penguin_ledger
>
> JOIN users ON users.id = penguin_ledger.student_id
>
> JOIN users teacher ON teacher.id = penguin_ledger.operator_id
>
> JOIN subjects ON subjects.id = penguin_ledger.subject_id
>
> JOIN groups ON groups.id = penguin_ledger.group_id
>
> LEFT JOIN penguin_rules ON penguin_rules.id = penguin_ledger.rule_id
>
> WHERE penguin_ledger.org_id = :org_id
>
> AND users.status \<\> 'deleted' AND teacher.status \<\> 'deleted'
>
> AND (:student_id IS NULL OR penguin_ledger.student_id = :student_id)
>
> AND (:group_id IS NULL OR penguin_ledger.group_id = :group_id)
>
> AND (:subject_id IS NULL OR penguin_ledger.subject_id = :subject_id)
>
> AND (:operator_id IS NULL OR penguin_ledger.operator_id = :operator_id)
>
> AND (:date_from IS NULL OR penguin_ledger.created_at \>= :date_from)
>
> AND (:date_to IS NULL OR penguin_ledger.created_at \< :date_to)
>
> AND (
>
> COALESCE(NULLIF(TRIM(:q), ''), NULL) IS NULL
>
> OR penguin_ledger.reason LIKE CONCAT('%', :q, '%')
>
> )
>
> ORDER BY penguin_ledger.created_at DESC, penguin_ledger.id DESC
>
> LIMIT @limit OFFSET @offset;

##### Получить одно начисление/списание пингвина по id:

суперадмин, админ, преподаватель, сотрудник организации, студент

- GET /orgs/:orgId/penguins/ledger/:id

  - **Content-type:** application/json

  - **Authorization:** Bearer \<jwt\>

  - **Body:** {}

  - **Path / Query params:**

    - orgId - целое число

    - id - целое число

  - **Backend-правила:**

    - orgId из пути должен совпадать с org в JWT  
      (для superadmin - любой org)

    - Организация orgId существует и status IN ('active','pending')

  - **Validation**:

    - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - id - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - id - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

  <!-- -->

  - **Responses**:

    - **200 OK**

> {
>
> "id": 120045,
>
> "student": {
>
> "id": 3001,
>
> "full_name": "Alice Student"
>
> },
>
> "group": {
>
> "id": 510,
>
> "code": "281025-wdm",
>
> "name": "Web-Development-2025-10"
>
> },
>
> "subject": {
>
> "id": 108,
>
> "name": "React"
>
> },
>
> "operator": {
>
> "id": 1054,
>
> "full_name": "Ivan Petrov"
>
> },
>
> "rule": {
>
> "id": 12,
>
> "code": "DEDUCT_LATE"
>
> },
>
> "delta": -2,
>
> "reason": "Late submission",
>
> "created_at": "2025-09-02T10:11:12Z",
>
> },

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: id must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view penguins in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {"message": "Penguin accrual/debit not found"}

- **SQL**

> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending') LIMIT 1;
>
> Выборка
>
> SELECT
>
> penguin_ledger.id, penguin_ledger.delta, penguin_ledger.reason, penguin_ledger.created_at,
>
> users.id AS student_id, users.full_name AS student_name,
>
> teacher.id AS operator_id, teacher.full_name AS operator_name,
>
> subjects.id AS subject_id, subjects.name AS subject_name,
>
> groups.id AS group_id, groups.code, groups.name AS group_name,
>
> penguin_rules.id AS rule_id, penguin_rules.code AS rule_code
>
> FROM penguin_ledger
>
> JOIN users ON users.id = penguin_ledger.student_id
>
> JOIN users teacher ON teacher.id = penguin_ledger.operator_id
>
> JOIN subjects ON subjects.id = penguin_ledger.subject_id
>
> JOIN groups ON groups.id = penguin_ledger.group_id
>
> LEFT JOIN penguin_rules ON penguin_rules.id = penguin_ledger.rule_id
>
> WHERE penguin_ledger.org_id=:org_id AND penguin_ledger.id=:id
>
> LIMIT 1;

#### Статистика (день/неделя/месяц) penguin_ledger

GET /orgs/:orgId/penguins/stats/daily?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=  
получить статистику за день

GET /orgs/:orgId/penguins/stats/weekly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=  
получить статистику за неделю

GET /orgs/:orgId/penguins/stats/monthly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=  
получить статистику за месяц

##### Получить статистику за день:

суперадмин, админ, преподаватель, сотрудник организации, студент

- GET /orgs/:orgId/penguins/stats/daily?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=

> studentId - фильтр по студенту (опционально)
>
> groupId - фильтр по группе (опционально)
>
> subjectId - фильтр по предмету (опционально)
>
> operatorId - фильтр по преподавателю (опционально)
>
> directionId - фильтр по направлению (опционально)
>
> date_from - фильтр по дате начало периода (опционально)
>
> date_to - фильтр по дате конец периода (опционально)

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:** {}

- **Path / Query params:**

  - orgId - целое число

  - studentId - целое число

  - groupId - целое число

  - subjectId - целое число

  - operatorId - целое число

  - directionId - целое число

  - date_from - YYYY-MM-DD

  - date_to - YYYY-MM-DD

- **Бизнес-правила:**

  - Студент получает только свою статистику (studentId = current)

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

- **Validation**:

  - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - studentId - /^\[1-9\]\d{0,9}\$/ - в path

  - groupId - /^\[1-9\]\d{0,9}\$/ - в path

  - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

  - operatorId - /^\[1-9\]\d{0,9}\$/ - в path

  - directionId - /^\[1-9\]\d{0,9}\$/ - в path

  - date_from - YYYY-MM-DD

  - date_to - YYYY-MM-DD

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - studentId - /^\[1-9\]\d{0,9}\$/ - в path

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - operatorId - /^\[1-9\]\d{0,9}\$/ - в path

    - directionId - /^\[1-9\]\d{0,9}\$/ - в path

    - date_from - YYYY-MM-DD

    - date_to - YYYY-MM-DD

  <!-- -->

  - **Responses**:

    - **200 OK**

> {
>
> "series": \[
>
> {
>
> "date": "2025-09-01",
>
> "net_total": 12,
>
> "awards": 15,
>
> "deducts": -3,
>
> "count_ops": 7
>
> },
>
> {
>
> "date": "2025-09-02",
>
> "net_total": 5,
>
> "awards": 8,
>
> "deducts": -3,
>
> "count_ops": 4
>
> }
>
> \]
>
> },

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: studentId must be integer”}
>
> {“message”: ”Invalid path parameter: groupId must be integer”}
>
> {“message”: ”Invalid path parameter: subjectId must be integer”}
>
> {“message”: ”Invalid path parameter: operatorId must be integer”}
>
> {“message”: ”Invalid path parameter: directionId must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view penguin statistics in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”Student not found”}
>
> {“message”: ”Group not found”}
>
> {“message”: ”Subject not found”}
>
> {“message”: ”Teacher not found”}
>
> {“message”: ”Direction not found”}

- **SQL**

> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending') LIMIT 1;
>
> Выборка
>
> SELECT
>
> DATE(penguin_ledger.created_at) AS bucket_date,
>
> SUM(penguin_ledger.delta) AS net_total,
>
> SUM(CASE WHEN penguin_ledger.delta \>= 0 THEN penguin_ledger.delta ELSE 0 END) AS awards,
>
> SUM(CASE WHEN penguin_ledger.delta \< 0 THEN penguin_ledger.delta ELSE 0 END) AS deducts,
>
> COUNT(\*) AS count_ops
>
> FROM penguin_ledger
>
> JOIN users student ON student.id = penguin_ledger.student_id AND student.status \<\> 'deleted'
>
> JOIN users teacher ON teacher.id = penguin_ledger.operator_id AND teacher.status \<\> 'deleted'
>
> WHERE penguin_ledger.org_id = :org_id
>
> AND (:student_id IS NULL
>
> OR penguin_ledger.student_id = :student_id)
>
> AND (:group_id IS NULL
>
> OR penguin_ledger.group_id = :group_id)
>
> AND (:subject_id IS NULL
>
> OR penguin_ledger.subject_id = :subject_id)
>
> AND (:operator_id IS NULL
>
> OR penguin_ledger.operator_id = :operator_id)
>
> AND (:direction_id IS NULL
>
> OR penguin_ledger.direction_id = :direction_id)
>
> AND (:date_from IS NULL
>
> OR penguin_ledger.created_at \>= :date_from)
>
> AND (:date_to IS NULL
>
> OR penguin_ledger.created_at \< :date_to)
>
> GROUP BY bucket_date
>
> ORDER BY bucket_date ASC;

##### Получить статистику за неделю:

суперадмин, админ, преподаватель, сотрудник организации, студент

- GET /orgs/:orgId/penguins/stats/weekly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=

> studentId - фильтр по студенту (опционально)
>
> groupId - фильтр по группе (опционально)
>
> subjectId - фильтр по предмету (опционально)
>
> operatorId - фильтр по преподавателю (опционально)
>
> directionId - фильтр по направлению (опционально)
>
> date_from - фильтр по дате начало периода (опционально)
>
> date_to - фильтр по дате конец периода (опционально)

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:** {}

- **Path / Query params:**

  - orgId - целое число

  - studentId - целое число

  - groupId - целое число

  - subjectId - целое число

  - operatorId - целое число

  - directionId - целое число

  - date_from - YYYY-MM-DD

  - date_to - YYYY-MM-DD

- **Бизнес-правила:**

  - Студент получает только свою статистику (studentId = current)

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

- **Validation**:

  - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - studentId - /^\[1-9\]\d{0,9}\$/ - в path

  - groupId - /^\[1-9\]\d{0,9}\$/ - в path

  - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

  - operatorId - /^\[1-9\]\d{0,9}\$/ - в path

  - directionId - /^\[1-9\]\d{0,9}\$/ - в path

  - date_from - YYYY-MM-DD

  - date_to - YYYY-MM-DD

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - studentId - /^\[1-9\]\d{0,9}\$/ - в path

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - operatorId - /^\[1-9\]\d{0,9}\$/ - в path

    - directionId - /^\[1-9\]\d{0,9}\$/ - в path

    - date_from - YYYY-MM-DD

    - date_to - YYYY-MM-DD

  <!-- -->

  - **Responses**:

    - **200 OK**

> {
>
> "series": \[
>
> {
>
> "week": "2025-W35",
>
> "net_total": 22,
>
> "awards": 26,
>
> "deducts": -4,
>
> "count_ops": 11
>
> }
>
> \]
>
> },

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: studentId must be integer”}
>
> {“message”: ”Invalid path parameter: groupId must be integer”}
>
> {“message”: ”Invalid path parameter: subjectId must be integer”}
>
> {“message”: ”Invalid path parameter: operatorId must be integer”}
>
> {“message”: ”Invalid path parameter: directionId must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view penguin statistics in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”Student not found”}
>
> {“message”: ”Group not found”}
>
> {“message”: ”Subject not found”}
>
> {“message”: ”Teacher not found”}
>
> {“message”: ”Direction not found”}

- **SQL**

> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending') LIMIT 1;
>
> Выборка
>
> SELECT
>
> DATE_FORMAT(penguin_ledger.created_at - INTERVAL (WEEKDAY(penguin_ledger.created_at)) DAY, '%Y-%m-%d') AS week_start,
>
> CONCAT(YEARWEEK(penguin_ledger.created_at, 3) DIV 100, '-W', LPAD(YEARWEEK(penguin_ledger.created_at, 3) % 100, 2, '0')) AS week_label,
>
> SUM(penguin_ledger.delta) AS net_total,
>
> SUM(CASE WHEN penguin_ledger.delta \>= 0 THEN penguin_ledger.delta ELSE 0 END) AS awards,
>
> SUM(CASE WHEN penguin_ledger.delta \< 0 THEN penguin_ledger.delta ELSE 0 END) AS deducts,
>
> COUNT(\*) AS count_ops
>
> FROM penguin_ledger
>
> JOIN users student ON student.id = penguin_ledger.student_id AND student.status \<\> 'deleted'
>
> JOIN users teacher ON teacher.id = penguin_ledger.operator_id AND teacher.status \<\> 'deleted'
>
> WHERE penguin_ledger.org_id = :org_id
>
> AND (:student_id IS NULL
>
> OR penguin_ledger.student_id = :student_id)
>
> AND (:group_id IS NULL
>
> OR penguin_ledger.group_id = :group_id)
>
> AND (:subject_id IS NULL
>
> OR penguin_ledger.subject_id = :subject_id)
>
> AND (:operator_id IS NULL
>
> OR penguin_ledger.operator_id = :operator_id)
>
> AND (:direction_id IS NULL
>
> OR penguin_ledger.direction_id = :direction_id)
>
> AND (:date_from IS NULL
>
> OR penguin_ledger.created_at \>= :date_from)
>
> AND (:date_to IS NULL
>
> OR penguin_ledger.created_at \< :date_to)
>
> GROUP BY week_start, week_label
>
> ORDER BY week_start ASC;

##### Получить статистику за месяц:

суперадмин, админ, преподаватель, сотрудник организации, студент

- GET /orgs/:orgId/penguins/stats/monthly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=

> studentId - фильтр по студенту (опционально)
>
> groupId - фильтр по группе (опционально)
>
> subjectId - фильтр по предмету (опционально)
>
> operatorId - фильтр по преподавателю (опционально)
>
> directionId - фильтр по направлению (опционально)
>
> date_from - фильтр по дате начало периода (опционально)
>
> date_to - фильтр по дате конец периода (опционально)

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:** {}

- **Path / Query params:**

  - orgId - целое число

  - studentId - целое число

  - groupId - целое число

  - subjectId - целое число

  - operatorId - целое число

  - directionId - целое число

  - date_from - YYYY-MM-DD

  - date_to - YYYY-MM-DD

- **Бизнес-правила:**

  - Студент получает только свою статистику (studentId = current)

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

- **Validation**:

  - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - studentId - /^\[1-9\]\d{0,9}\$/ - в path

  - groupId - /^\[1-9\]\d{0,9}\$/ - в path

  - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

  - operatorId - /^\[1-9\]\d{0,9}\$/ - в path

  - directionId - /^\[1-9\]\d{0,9}\$/ - в path

  - date_from - YYYY-MM-DD

  - date_to - YYYY-MM-DD

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - studentId - /^\[1-9\]\d{0,9}\$/ - в path

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - operatorId - /^\[1-9\]\d{0,9}\$/ - в path

    - directionId - /^\[1-9\]\d{0,9}\$/ - в path

    - date_from - YYYY-MM-DD

    - date_to - YYYY-MM-DD

  <!-- -->

  - **Responses**:

    - **200 OK**

> {
>
> "series": \[
>
> {
>
> "month": "2025-09",
>
> "net_total": 120,
>
> "awards": 150,
>
> "deducts": -30,
>
> "count_ops": 64
>
> }
>
> \]
>
> },

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: studentId must be integer”}
>
> {“message”: ”Invalid path parameter: groupId must be integer”}
>
> {“message”: ”Invalid path parameter: subjectId must be integer”}
>
> {“message”: ”Invalid path parameter: operatorId must be integer”}
>
> {“message”: ”Invalid path parameter: directionId must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view penguin statistics in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”Student not found”}
>
> {“message”: ”Group not found”}
>
> {“message”: ”Subject not found”}
>
> {“message”: ”Teacher not found”}
>
> {“message”: ”Direction not found”}

- **SQL**

> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending') LIMIT 1;
>
> Выборка
>
> SELECT
>
> DATE_FORMAT(penguin_ledger.created_at, '%Y-%m') AS month_label,
>
> SUM(penguin_ledger.delta) AS net_total,
>
> SUM(CASE WHEN penguin_ledger.delta \>= 0 THEN penguin_ledger.delta ELSE 0 END) AS awards,
>
> SUM(CASE WHEN penguin_ledger.delta \< 0 THEN penguin_ledger.delta ELSE 0 END) AS deducts,
>
> COUNT(\*) AS count_ops
>
> FROM penguin_ledger
>
> JOIN users student ON student.id = penguin_ledger.student_id AND student.status \<\> 'deleted'
>
> JOIN users teacher ON teacher.id = penguin_ledger.operator_id AND teacher.status \<\> 'deleted'
>
> WHERE penguin_ledger.org_id = :org_id
>
> AND (:student_id IS NULL
>
> OR penguin_ledger.student_id = :student_id)
>
> AND (:group_id IS NULL
>
> OR penguin_ledger.group_id = :group_id)
>
> AND (:subject_id IS NULL
>
> OR penguin_ledger.subject_id = :subject_id)
>
> AND (:operator_id IS NULL
>
> OR penguin_ledger.operator_id = :operator_id)
>
> AND (:direction_id IS NULL
>
> OR penguin_ledger.direction_id = :direction_id)
>
> AND (:date_from IS NULL
>
> OR penguin_ledger.created_at \>= :date_from)
>
> AND (:date_to IS NULL
>
> OR penguin_ledger.created_at \< :date_to)
>
> GROUP BY month_label
>
> ORDER BY month_label ASC;

#### Балансы penguin_balances

GET /orgs/:orgId/students/:studentId/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=  
получить баланс студента

GET /orgs/:orgId/my/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=  
получить свой баланс пингвинов (студент для себя)

GET /orgs/:orgId/penguins/leaderboard?groupId=&subjectId=&directionId=&page=&limit=  
получить лидборд (топ студентов)

##### Получить баланс студента по id:

суперадмин, админ, преподаватель, сотрудник организации

- GET /orgs/:orgId/students/:studentId/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=

> studentId - id студента
>
> groupId - фильтр по группе (опционально)
>
> subjectId - фильтр по предмету (опционально)
>
> directionId - фильтр по направлению (опционально)
>
> page - номер страницы, по умолчанию 1
>
> limit - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:** {}

- **Path / Query params:**

  - orgId - целое число

  - studentId - целое число

  - groupId - целое число

  - subjectId - целое число

  - directionId - целое число

  - page - целое число \>= 1, по умолчанию 1

  - limit- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

  - Студент принадлежит этой организации

- **Validation**:

  - Frontend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - studentId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - directionId - /^\[1-9\]\d{0,9}\$/ - в path

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - studentId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - directionId - /^\[1-9\]\d{0,9}\$/ - в path

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

> {
>
> "total": 1,
>
> "page": 1,
>
> "limit": 50,
>
> "balances":
>
> \[
>
> {
>
> "group": {
>
> "id": 510,
>
> "code": "281025-wdm",
>
> "name": "Web-Development-2025-10"
>
> },
>
> "subject": {
>
> "id": 108,
>
> "name": "React"
>
> },
>
> "direction": {
>
> "id": 8,
>
> "name": "Web Development"
>
> },
>
> "total": 15,
>
> },
>
> \]
>
> }

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: studentId must be integer”}
>
> {“message”: ”Invalid path parameter: directionId must be integer”}
>
> {“message”: ”Invalid path parameter: groupId must be integer”}
>
> {“message”: ”Invalid path parameter: subjectId must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view this student's penguin balances in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”Student not found”}
>
> {“message”: ”Direction not found”}
>
> {“message”: ”Group not found”}
>
> {“message”: ”Subject not found”}

- **SQL**

> SET @page = GREATEST(COALESCE(:page, 1), 1);
>
> SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
>
> SET @offset = (@page - 1) \* @limit;
>
> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> Проверка студента
>
> SELECT 1 FROM users
>
> JOIN user_roles ON user_roles.org_id = :org_id AND user_roles.user_id = users.id AND user_roles.revoked_at IS NULL
>
> JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'student'
>
> WHERE users.id = :student_id AND users.status \<\> 'deleted'
>
> LIMIT 1;
>
> total
>
> SELECT COUNT(\*) AS total
>
> FROM penguin_balances
>
> JOIN groups ON groups.id = penguin_balances.group_id
>
> JOIN subjects ON subjects.id = penguin_balances.subject_id
>
> JOIN directions ON directions.id = penguin_balances.direction_id
>
> WHERE penguin_balances.org_id = :org_id
>
> AND penguin_balances.student_id = :student_id
>
> AND (:group_id IS NULL OR penguin_balances.group_id = :group_id)
>
> AND (:subject_id IS NULL OR penguin_balances.subject_id = :subject_id)
>
> AND (:direction_id IS NULL OR penguin_balances.direction_id = :direction_id);
>
> page
>
> SELECT
>
> penguin_balances.total,
>
> groups.id AS group_id, groups.code AS group_code, groups.name AS group_name,
>
> subjects.id AS subject_id, subjects.name AS subject_name,
>
> directions.id AS direction_id, directions.name AS direction_name
>
> FROM penguin_balances
>
> JOIN groups ON groups.id = penguin_balances.group_id
>
> JOIN subjects ON subjects.id = penguin_balances.subject_id
>
> JOIN directions ON directions.id = penguin_balances.direction_id
>
> WHERE penguin_balances.org_id = :org_id
>
> AND penguin_balances.student_id = :student_id
>
> AND (:group_id IS NULL OR penguin_balances.group_id = :group_id)
>
> AND (:subject_id IS NULL OR penguin_balances.subject_id = :subject_id)
>
> AND (:direction_id IS NULL OR penguin_balances.direction_id = :direction_id)
>
> ORDER BY penguin_balances.total DESC, subjects.name ASC, groups.name ASC
>
> LIMIT @limit OFFSET @offset;

##### Получить свой баланс пингвинов:

студент (для себя)

- GET /orgs/:orgId/my/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=

> groupId - фильтр по группе (опционально)
>
> subjectId - фильтр по предмету (опционально)
>
> directionId - фильтр по направлению (опционально)
>
> page - номер страницы, по умолчанию 1
>
> limit - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:** {}

- **Path / Query params:**

  - orgId - целое число

  - groupId - целое число

  - subjectId - целое число

  - directionId - целое число

  - page - целое число \>= 1, по умолчанию 1

  - limit- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

  - Студент принадлежит этой организации

- **Validation**:

  - Frontend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - directionId - /^\[1-9\]\d{0,9}\$/ - в path

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - directionId - /^\[1-9\]\d{0,9}\$/ - в path

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

> {
>
> "total": 1,
>
> "page": 1,
>
> "limit": 50,
>
> "balances":
>
> \[
>
> {
>
> "group": {
>
> "id": 510,
>
> "code": "281025-wdm",
>
> "name": "Web-Development-2025-10"
>
> },
>
> "subject": {
>
> "id": 108,
>
> "name": "React"
>
> },
>
> "direction": {
>
> "id": 8,
>
> "name": "Web Development"
>
> },
>
> "total": 15,
>
> },
>
> \]
>
> }

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: directionId must be integer”}
>
> {“message”: ”Invalid path parameter: groupId must be integer”}
>
> {“message”: ”Invalid path parameter: subjectId must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You can only view your own penguin balances.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”Student not found”}
>
> {“message”: ”Direction not found”}
>
> {“message”: ”Group not found”}
>
> {“message”: ”Subject not found”}

- **SQL**

> SET @page = GREATEST(COALESCE(:page, 1), 1);
>
> SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
>
> SET @offset = (@page - 1) \* @limit;
>
> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> Проверка студента (берем из JWT)
>
> SELECT 1 FROM users
>
> JOIN user_roles ON user_roles.org_id = :org_id AND user_roles.user_id = users.id AND user_roles.revoked_at IS NULL
>
> JOIN roles ON roles.id = user_roles.role_id AND roles.code = 'student'
>
> WHERE users.id = :current_user_id AND users.status \<\> 'deleted'
>
> LIMIT 1;
>
> total
>
> SELECT COUNT(\*) AS total
>
> FROM penguin_balances
>
> JOIN groups ON groups.id = penguin_balances.group_id
>
> JOIN subjects ON subjects.id = penguin_balances.subject_id
>
> JOIN directions ON directions.id = penguin_balances.direction_id
>
> WHERE penguin_balances.org_id = :org_id
>
> AND penguin_balances.student_id = :current_user_id
>
> AND (:group_id IS NULL OR penguin_balances.group_id = :group_id)
>
> AND (:subject_id IS NULL OR penguin_balances.subject_id = :subject_id)
>
> AND (:direction_id IS NULL OR penguin_balances.direction_id = :direction_id);
>
> page
>
> SELECT
>
> penguin_balances.total,
>
> groups.id AS group_id, groups.code AS group_code, groups.name AS group_name,
>
> subjects.id AS subject_id, subjects.name AS subject_name,
>
> directions.id AS direction_id, directions.name AS direction_name
>
> FROM penguin_balances
>
> JOIN groups ON groups.id = penguin_balances.group_id
>
> JOIN subjects ON subjects.id = penguin_balances.subject_id
>
> JOIN directions ON directions.id = penguin_balances.direction_id
>
> WHERE penguin_balances.org_id = :org_id
>
> AND penguin_balances.student_id = :current_user_id
>
> AND (:group_id IS NULL OR penguin_balances.group_id = :group_id)
>
> AND (:subject_id IS NULL OR penguin_balances.subject_id = :subject_id)
>
> AND (:direction_id IS NULL OR penguin_balances.direction_id = :direction_id)
>
> ORDER BY penguin_balances.total DESC, subjects.name ASC, groups.name ASC
>
> LIMIT @limit OFFSET @offset;

##### Получить лидборд (топ студентов):

суперадмин, админ, преподаватель, сотрудник организации, студент

- GET /orgs/:orgId/penguins/leaderboard?groupId=&subjectId=&directionId=&page=&limit=

> Один из фильтров обязателен:
>
> groupId+subjectId - фильтр по группе и по предмету
>
> directionId+subjectId - фильтр по направлению и предмету
>
> directionId - фильтр по направлению и всем предметам суммарно
>
> page - номер страницы, по умолчанию 1
>
> limit - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:** {}

- **Path / Query params:**

  - orgId - целое число

  - groupId - целое число

  - subjectId - целое число

  - directionId - целое число

  - page - целое число \>= 1, по умолчанию 1

  - limit- целое число, 1..200, по умолчанию 50

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

- **Validation**:

  - Frontend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - directionId - /^\[1-9\]\d{0,9}\$/ - в path

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

    - groupId - /^\[1-9\]\d{0,9}\$/ - в path

    - subjectId - /^\[1-9\]\d{0,9}\$/ - в path

    - directionId - /^\[1-9\]\d{0,9}\$/ - в path

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

- **Responses**:

  - **200 OK**

> {
>
> "total": 1,
>
> "page": 1,
>
> "limit": 50,
>
> "leaderboard":
>
> \[
>
> {
>
> "student": {
>
> "id": 3001,
>
> "full_name": "Alice Student"
>
> },
>
> "group": {
>
> "id": 510,
>
> "code": "281025-wdm",
>
> "name": "Web-Development-2025-10"
>
> },
>
> "subject": {
>
> "id": 108,
>
> "name": "React"
>
> },
>
> "total": 15,
>
> },
>
> \]
>
> }

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: directionId must be integer”}
>
> {“message”: ”Invalid path parameter: groupId must be integer”}
>
> {“message”: ”Invalid path parameter: subjectId must be integer”}
>
> {“message”: ”At least one leaderboard scope is required (groupId+subjectId or directionId+subjectId”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view this resource in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”Direction not found”}
>
> {“message”: ”Group not found”}
>
> {“message”: ”Subject not found”}

- **SQL**

> SET @page = GREATEST(COALESCE(:page, 1), 1);
>
> SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
>
> SET @offset = (@page - 1) \* @limit;
>
> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> Проверка группы
>
> SELECT 1 FROM groups
>
> WHERE id = :group_id AND org_id = :org_id
>
> LIMIT 1;
>
> Проверка предмета
>
> SELECT 1 FROM subjects
>
> WHERE id = :subject_id AND org_id = :org_id
>
> LIMIT 1;
>
> Проверка направления
>
> SELECT 1 FROM directions
>
> WHERE id = :direction_id AND org_id = :org_id
>
> LIMIT 1;
>
> **Вариант по groupId+subjectId**
>
> total
>
> SELECT COUNT(\*) AS total
>
> FROM penguin_balances
>
> JOIN users ON users.id = penguin_balances.student_id
>
> WHERE penguin_balances.org_id = :org_id
>
> AND penguin_balances.group_id = :group_id
>
> AND penguin_balances.subject_id = :subject_id
>
> AND users.status \<\> 'deleted';
>
> page
>
> penguin_balances.student_id,
>
> users.full_name AS student_name,
>
> penguin_balances.group_id, groups.code, groups.name AS group_name,
>
> penguin_balances.subject_id, subjects.name AS subject_name,
>
> penguin_balances.total
>
> FROM penguin_balances
>
> JOIN users ON users.id = penguin_balances.student_id
>
> JOIN groups ON groups.id = penguin_balances.group_id
>
> JOIN subjects ON subjects.id = penguin_balances.subject_id
>
> WHERE penguin_balances.org_id = :org_id
>
> AND penguin_balances.group_id = :group_id
>
> AND penguin_balances.subject_id = :subject_id
>
> AND users.status \<\> 'deleted'
>
> ORDER BY penguin_balances.total DESC, users.full_name ASC, penguin_balances.student_id ASC
>
> LIMIT @limit OFFSET @offset;
>
> **Вариант по directionId+subjectId**
>
> total
>
> SELECT COUNT(\*) AS total
>
> FROM penguin_balances
>
> JOIN users ON users.id = penguin_balances.student_id
>
> WHERE penguin_balances.org_id = :org_id
>
> AND penguin_balances.direction_id = :direction_id
>
> AND penguin_balances.subject_id = :subject_id
>
> AND users.status \<\> 'deleted';
>
> page
>
> penguin_balances.student_id,
>
> users.full_name AS student_name,
>
> penguin_balances.direction_id, directions.code, directions.name AS direction_name,
>
> penguin_balances.subject_id, subjects.name AS subject_name,
>
> penguin_balances.total
>
> FROM penguin_balances
>
> JOIN users ON users.id = penguin_balances.student_id
>
> JOIN directions ON directions.id = penguin_balances.direction_id
>
> JOIN subjects ON subjects.id = penguin_balances.subject_id
>
> WHERE penguin_balances.org_id = :org_id
>
> AND penguin_balances.direction_id = :direction_id
>
> AND penguin_balances.subject_id = :subject_id
>
> AND users.status \<\> 'deleted'
>
> ORDER BY penguin_balances.total DESC, users.full_name ASC, penguin_balances.student_id ASC
>
> LIMIT @limit OFFSET @offset;
>
> **Вариант по directionId**
>
> total
>
> SELECT COUNT(\*) AS total
>
> FROM (
>
> SELECT penguin_balances.student_id
>
> FROM penguin_balances
>
> JOIN users
>
> ON users.id = penguin_balances.student_id
>
> AND users.status \<\> 'deleted'
>
> WHERE penguin_balances.org_id = :org_id
>
> AND penguin_balances.direction_id = :direction_id
>
> GROUP BY penguin_balances.student_id
>
> ) t;
>
> page
>
> SELECT
>
> penguin_balances.student_id,
>
> users.full_name AS student_name,
>
> penguin_balances.direction_id,
>
> directions.code AS direction_code,
>
> directions.name AS direction_name,
>
> SUM(penguin_balances.total) AS total
>
> FROM penguin_balances
>
> JOIN users
>
> ON users.id = penguin_balances.student_id
>
> AND users.status \<\> 'deleted'
>
> JOIN directions
>
> ON directions.id = penguin_balances.direction_id
>
> AND directions.org_id = :org_id
>
> WHERE penguin_balances.org_id = :org_id
>
> AND penguin_balances.direction_id = :direction_id
>
> GROUP BY
>
> penguin_balances.student_id, users.full_name,
>
> penguin_balances.direction_id, directions.code, directions.name
>
> ORDER BY total DESC, users.full_name ASC, penguin_balances.student_id ASC
>
> LIMIT @limit OFFSET @offset;

#### Оповещения notifications

GET /orgs/:orgId/notifications?is_read=&page=&limit=  
получить уведомления текущего пользователя

PUT /orgs/:orgId/notifications/:id/read  
пометить уведомление прочитанным

##### Получить уведомления текущего пользователя:

суперадмин, админ, преподаватель, сотрудник организации, студент

- GET /orgs/:orgId/notifications?is_read=&page=&limit=

> is_read - о
>
> page - номер страницы, по умолчанию 1
>
> limit - количество на странице (по умолчанию 50, ≤ 200)

- **Content-type:** application/json

- **Authorization:** Bearer \<jwt\>

- **Body:** {}

- **Path / Query params:**

  - orgId - целое число

  - is_read - boolean

  - page - целое число \>= 1, по умолчанию 1

  - limit- целое число, 1..200, по умолчанию 50

- **Бизнес-правила:**

  - Возвращаем только персональные (user_id = текущий) в этой организации

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

- **Validation**:

  - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - is_read - boolean

  - page - целое число, \>=1, по умолчанию - 1

  - limit - целое число, 1..200, по умолчанию - 50

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - is_read - boolean

    - page - целое число, \>=1, по умолчанию - 1

    - limit - целое число, 1..200, по умолчанию - 50

  <!-- -->

  - **Responses**:

    - **200 OK**

> {
>
> "total": 2,
>
> "page": 1,
>
> "limit": 50,
>
> "notifications": \[
>
> {
>
> "id": 50001,
>
> "type": "penguin_award",
>
> "payload": {
>
> "delta": 3,
>
> "reason": "Homework week 3",
>
> "subject_id": 108,
>
> "batch_id": 90001 },
>
> "is_read": false,
>
> "created_at": "2025-09-02T10:11:12Z"
>
> },
>
> \]
>
> },

- **400 Bad Request** некорректное тело запроса

> {“message”: ”Invalid path parameter: orgId must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: You are not allowed to view notifications in this organization.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {“message”: ”User not found”}

- **SQL**

> SET @page = GREATEST(COALESCE(:page, 1), 1);
>
> SET @limit = LEAST(GREATEST(COALESCE(:limit, 50), 1), 200);
>
> SET @offset = (@page - 1) \* @limit;
>
> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> total
>
> SELECT COUNT(\*) AS total
>
> FROM notifications
>
> WHERE org_id = :org_id
>
> AND user_id = :current_user_id
>
> AND (COALESCE(:is_read, -1) = -1 OR is_read = :is_read);
>
> page
>
> SELECT id, type, payload, is_read, created_at
>
> FROM notifications
>
> WHERE org_id = :org_id
>
> AND user_id = :current_user_id
>
> AND (COALESCE(:is_read, -1) = -1 OR is_read = :is_read)
>
> ORDER BY created_at DESC, id DESC
>
> LIMIT @limit OFFSET @offset;

##### Пометить уведомление прочитанным:

владелец уведомления

- PUT /orgs/:orgId/notifications/:id/read

  - **Content-type:** application/json

  - **Authorization:** Bearer \<jwt\>

  - **Body:**

> {
>
> "id": 50001,
>
> "is_read": true
>
> }

- **Path / Query params:**

  - orgId - целое число

  - id - целое число

- **Backend-правила:**

  - orgId из пути должен совпадать с org в JWT  
    (для superadmin - любой org)

  - Организация orgId существует и status IN ('active','pending')

- **Validation**:

  - Frontend:

<!-- -->

- orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  - id - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  <!-- -->

  - Backend:

    - orgId - /^\[1-9\]\d{0,9}\$/ - в path, обязательно, число

    - id - /^\[1-9\]\d{0,9}\$/ - в path, обязательно

  <!-- -->

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

> {“message”: ”Invalid path parameter: orgId must be integer”}
>
> {“message”: ”Invalid path parameter: id must be integer”}

- **401 Unauthorized** отсутствует Authorization

> {“message”: ”Authorization header missing”}

- **401 Unauthorized** токен просрочен

> {“message”: ”jwt expired”}

- **403 Forbidden** отказано в доступе

> {“message”: ”Permission denied: ou can only modify your own notifications.”}

- **404 Not Found** объект не найден

> {“message”: ”Organization not found”}
>
> {"message": "Notification not found"}

- **SQL**

> Проверка организации
>
> SELECT 1 FROM organizations
>
> WHERE id = :org_id AND status IN ('active','pending')
>
> LIMIT 1;
>
> Проверка что уведомление принадлежит текущему юзеру
>
> SELECT id FROM penguin_rules
>
> WHERE org_id = :org_id AND code = :code AND id \<\> :id
>
> LIMIT 1;
>
> Обновление
>
> UPDATE notifications
>
> SET is_read = 1
>
> WHERE id = :id AND org_id = :org_id AND user_id = :current_user_id;
>
> Для ответа
>
> SELECT id, type, payload, is_read, created_at FROM notifications
>
> WHERE id = :id AND org_id = :org_id AND user_id = :current_user_id
>
> LIMIT 1;

#### Billing

- **Планы:**

  - 

- **Подписки:  **

  - 

- **Инвойсы:  **

  - 

- **Оплаты:  **

  - 

#### Настройки пользователя, сессии, MFA

- 

### Валидации

const validationRules = {

> email: {
>
> pattern: /^\[A-Za-z0-9.\_%+-\]+@\[A-Za-z0-9.-\]+\\\[A-Za-z\]{2,}\$/,
>
> message: "email mast contain @, dot and no contain spaces"
>
> },
>
> password: {
>
> pattern: /^(?=.\*\[A-Za-z\])(?=.\*\d)(?=.\*\[^A-Za-z\d\])\S{8,64}\$/,
>
> message: "Password must be 8-64 characters and include 1 letter, 1 number and 1 special symbol"
>
> },
>
> orgId: {
>
> pattern: /^\[1-9\]\d{0,9}\$/,
>
> message: "Invalid organization ID"
>
> },
>
> id: {
>
> pattern: /^\[1-9\]\d{0,9}\$/,
>
> message: "Invalid ID parameter"
>
> },
>
> page: {
>
> min: 1,
>
> default: 1,
>
> message: "Page must be integer \>= 1"
>
> },
>
> limit: {
>
> min: 1,
>
> max: 200,
>
> default: 50,
>
> message: "Limit must be integer between 1 and 200"
>
> }

};
