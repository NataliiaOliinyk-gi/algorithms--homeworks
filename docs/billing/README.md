## Billing

`GET /billing/plans` получить список всех тарифных планов

`GET /orgs/:orgId/billing/subscription` получить текущую активную подписку организации

`GET /orgs/:orgId/billing/invoices?status=&page=&limit=` получить список счетов организации

`POST /orgs/:orgId/billing/invoices` создать инвойс для активной подписки (ручной триггер)

`GET /orgs/:orgId/billing/payments?status=&page=&limit=` получить историю платежей организации

### Планы subscription_plans

`GET /billing/plans` получить список всех тарифных планов

#### Получить список всех тарифных планов:

`GET /billing/plans`

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
  - Backend: нет параметров

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
      "price": 19.9,
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
      "price": 199.9,
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

### Подписки org_subscriptions

`GET /orgs/:orgId/billing/subscription` получить текущую активную подписку организации

#### Получить текущую активную подписку организации:

`GET /orgs/:orgId/billing/subscription`

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
{
  "message": "Permission denied: You are not allowed to view a subscription in this organization."
}
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

### Счета invoices

`GET /orgs/:orgId/billing/invoices?status=&page=&limit=` получить список счетов организации

`POST /orgs/:orgId/billing/invoices` создать инвойс для активной подписки (ручной триггер)

#### Получить список счетов организации:

`GET /orgs/:orgId/billing/invoices?status=&page=&limit=`

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
      "amount": 199.9,
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
{
  "message": "Permission denied: You are not allowed to view invoices in this organization."
}
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

#### Создать инвойс для активной подписки (ручной триггер):

`POST /orgs/:orgId/billing/invoices`

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
  "amount": 199.9,
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

### Оплаты payments

`GET /orgs/:orgId/billing/payments?status=&page=&limit=` получить историю платежей организации

#### Получить историю платежей организации:

`GET /orgs/:orgId/billing/payments?status=&page=&limit=`

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
      "amount": 199.9,
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
{
  "message": "Permission denied: You are not allowed to view payments in this organization."
}
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
