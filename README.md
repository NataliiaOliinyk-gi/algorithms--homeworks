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

**Базовый URL**: `https://penguin-tracker-backend/api` ( `http://localhost:3000/api` )

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

[Эндпоинты по доменам](./docs/README.md)


## Валидации (Общие правила)

### Формат валидации для всех endpoints

```
const validationRules = {
  email: {
    pattern: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
    message: "email mast contain @, dot and no contain spaces"
  },
password: {
    pattern: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d])\S{8,64}$/,
    message: "Password must be 8-64 characters and include 1 letter, 1 number and 1 special symbol"
  },

  orgId: {
    pattern: /^[1-9]\d{0,9}$/,
    message: "Invalid parameter: orgId must be integer"
  },
  id: {
    pattern: /^[1-9]\d{0,9}$/,
    message: "Invalid path parameter: id must be integer"
  },
  page: {
    min: 1,
    default: 1,
    message: "Page must be integer >= 1"
  },
  limit: {
    min: 1,
    max: 200,
    default: 50,
    message: "Limit must be integer between 1 and 200"
  }
};

```

### ENUM валидации (ПОЛНЫЙ СПИСОК из моделей)

```
const enumValidations = {
  // organizations
  organization_status: ['pending', 'active', 'suspended', 'deleted'],
  
  // org_addresses
  address_type: ['registered', 'office', 'campus', 'billing', 'other'],
  
  // org_billing_profiles
  billing_provider: ['stripe', 'paypal', 'manual'],
  
  // org_subscriptions
  subscription_status: ['trialing', 'active', 'past_due', 'canceled', 'expired', 'paused'],
  subscription_provider: ['stripe', 'paypal', 'manual'],
  
  // invoices
  invoice_status: ['draft', 'open', 'paid', 'void', 'uncollectible', 'refunded'],
  
  // payments
  payment_status: ['succeeded', 'failed', 'pending', 'refunded'],
  payment_provider: ['stripe', 'paypal', 'manual'],
  
  // users
  user_status: ['active', 'on_break', 'blocked', 'deleted'],
  user_language: ['ru', 'de', 'en'],
  
  // user_mfa
  mfa_type: ['totp', 'sms', 'email', 'webauthn'],
  
  // org_invitations
  invitation_status: ['pending', 'accepted', 'revoked', 'expired'],
  
  // groups
  group_status: ['planned', 'active', 'archived'],
  
  // group_members
  member_status: ['active', 'inactive', 'archived'],
  
  // group_subjects
  subject_source: ['direction', 'manual'],
  
  // penguin_rules
  rule_active: [true, false], // boolean, но для consistency
  
  // notifications
  notification_type: ['penguin_award', 'penguin_deduct', 'announcement', 'system'],
  
  // auth_logs
  auth_success: [true, false] // boolean
};

// Функция валидации ENUM
function validateEnum(value, enumName) {
  if (!value) return true; // опциональные поля
  return enumValidations[enumName].includes(value);
}

// Пример использования
if (!validateEnum(req.query.status, 'invoice_status')) {
  return res.status(400).json({ message: "Invalid status value" });
}

```