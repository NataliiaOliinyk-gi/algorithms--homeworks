## Оповещения notifications

`GET /orgs/:orgId/notifications?is_read=&page=&limit=`
получить уведомления текущего пользователя

`PUT /orgs/:orgId/notifications/:id/read`
пометить уведомление прочитанным

### Получить уведомления текущего пользователя:

`GET /orgs/:orgId/notifications?is_read=&page=&limit=`

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
{
  "message": "Permission denied: You are not allowed to view notifications in this organization."
}
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

### Пометить уведомление прочитанным:

`PUT /orgs/:orgId/notifications/:id/read`

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
