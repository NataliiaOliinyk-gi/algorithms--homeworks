## Авторизация

`POST /auth/login` вход в систему

`POST /auth/mfa/verify` подтверждение MFA

`POST /auth/logout` выход

`POST /auth/password/forgot` забыли пароль (инициировать сброс)

`POST /auth/password/reset` сброс пароля (по токену из email)

### Вход в систему:

`POST /auth/login`

Публично (без авторизации)

- **Content-type:** `application/json`

- **Body:**

```json
{
  "email": "user@example.com",
  "password": "********"
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
{
  "user": {
    "id": 1054,
    "email": "user@example.com",
    "full_name": "Ivan Petrov"
  },
  "access_token": "<jwt>",
  "token_type": "Bearer"
}
```

- **200 OK** (MFA требуется):

```json
{
  "mfa_required": true,
  "mfa_token": "<opaque-or-jwt-mfa-token>",
  "available_types": ["totp", "sms", "email", "webauthn"]
}
```

- **400 Bad Request** некорректное тело запроса

```json
{ "message": "Invalid request body" }
```

- **401 Unauthorized** не различаем неверный email/пароль

```json
{ "message": "Invalid email or password" }
```

- **403 Forbidden** аккаунт заблокирован/удален

```json
{ "message": "Account is not allowed to sign in." }
```

- **429 Too Many Requests**

```json
{ "message": "Too many login attempts. Please try again later." }
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

### Подтверждение MFA:

`POST /auth/mfa/verify`

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
{
  "user": {
    "id": 1054,
    "email": "user@example.com",
    "full_name": "Ivan Petrov"
  },
  "access_token": "<jwt>",
  "token_type": "Bearer"
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

### Выход:

`POST /auth/logout`

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

### Забыли пароль (инициировать сброс):

`POST /auth/password/forgot`

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
{
  "message": "If an account with this email exists, you will receive a password reset link shortly."
}
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

### Сброс пароля по токену из email:

`POST /auth/password/reset`

Публично (без авторизации)

- **Content-type:** `application/json`

- **Body:**

```json
{
  "token": "<raw-token>",
  "password": "********"
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
