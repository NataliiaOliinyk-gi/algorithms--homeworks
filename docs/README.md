## Контракты: эндпоинты по доменам

### Авторизация [auth](./auth/README.md)

`POST /auth/login` вход в систему

`POST /auth/mfa/verify` подтверждение MFA

`POST /auth/logout` выход

`POST /auth/password/forgot` забыли пароль (инициировать сброс)

`POST /auth/password/reset` сброс пароля (по токену из email)

### Организации [orgs](./orgs/README.md)

`POST /orgs` регистрация организации

`GET /orgs?q=&status=&country=&page=&limit=` получить список организаций

`GET /orgs/:orgId` получить организацию по id

`PUT /orgs/:orgId` редактировать организацию

`DELETE /orgs/:orgId` удалить организацию

`PUT /orgs/:orgId/status` изменить статус организации

### Роли [roles](./users/roles/README.md)

`GET /roles` получить список ролей

`POST /orgs/:orgId/users/:userId/roles/:role_id` назначить роль

`DELETE /orgs/:orgId/users/:userId/roles/:role_id` отозвать роль

### Пользователи [users](./users/README.md)

`POST /orgs/:orgsId/users`
регистрация пользователя в организации с одновременным назначением роли и отправкой приглашения на email

`GET /orgs/:orgId/users/:userId` получить профиль юзера

`DELETE /orgs/:orgsId/users/:userId` удалить пользователя

`GET /orgs/:org_id/users?role=&q=&include_revoked=&page=&limit=`
получить список преподавателей/ студентов/сотрудников в учебной организации

`GET /orgs/:orgsId/users/me` получить профиль (свой)

`PUT /orgs/:orgsId/users/me` редактировать свой профиль

`POST /orgs/:orgId/users/me/password` сменить пароль

### Education

#### Направления [directions](./education/directions/README.md)

`GET /orgs/:orgId/directions?q=&page=&limit= ` получить список направлений

`GET /orgs/:orgId/directions/:directionId` получить направление по id

`POST /orgs/:orgId/directions` создать направление

`PUT /orgs/:orgId/directions/:directionId` редактировать направление

`DELETE /orgs/:orgId/directions/:directionId` удалить направление

#### Предметы [subjects](./education/subjects/README.md)

`GET /orgs/:orgId/subjects?q=&page=&limit=` получить список предметов

`GET /orgs/:orgId/subjects/:subjectId` получить предмет по id

`POST /orgs/:orgId/subjects` создать предмет

`PUT /orgs/:orgId/subjects/:subjectId` редактировать предмет

`DELETE /orgs/:orgId/subjects/:subjectId` удалить предмет

#### Группы [groups](./education/groups/README.md)

`GET /orgs/:orgId/groups?q=&status=&direction_id=&page=&limit=` получить список групп

`GET /orgs/:orgId/groups/:groupId` получить группу по id

`POST /orgs/:orgId/groups` создать группу

`PUT /orgs/:orgId/groups/:groupId` редактировать группу

`DELETE /orgs/:orgId/groups/:groupId` удалить группу

#### Связка «Направление ⇔ Предметы» [direction_subjects](./education/direction_subjects/README.md)

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

#### Связка «Группа ⇔ Предметы» [group_subjects](./education/group_subjects/README.md)

`GET /orgs/:orgId/groups/:groupId/subjects?q=&source=&page=&limit= `
получить список предметов группы

`POST /orgs/:orgId/groups/:groupId/subjects`
добавить предмет в группу

`DELETE /orgs/:orgId/groups/:groupId/subjects/:subjectId`
удалить предмет из группы

#### Участники групп [group_members](./education/group_members/README.md)

`GET /orgs/:orgId/groups/:groupId/members?q=&status=&page=&limit=` получить список студентов группы

`GET /orgs/:orgId/groups/:groupId/members/:studentId` получить одного участника

`POST /orgs/:orgId/groups/:groupId/members` добавить студента в группу

`PUT /orgs/:orgId/groups/:groupId/members/:studentId` изменить статус/даты

`DELETE /orgs/:orgId/groups/:groupId/members/:studentId` исключить студента из группы

#### Назначения преподавателей [teaching_assignments](./education/teaching_assignments/README.md)

`GET /orgs/:orgId/teaching-assignments?groupId=&teacherId=&subjectId=&page=&limit=`
получить список назначений

`GET /orgs/:orgId/teaching-assignments/:id` получить назначение

`POST /orgs/:orgId/teaching-assignments` создать назначение

`PUT /orgs/:orgId/teaching-assignments/:id` изменить назначение

`DELETE /orgs/:orgId/teaching-assignments/:id` удалить назначение

### Penguins

#### Справочник правил [penguin_rules](./penguins/penguin_rules/README.md)

`GET /orgs/:orgId/penguin-rules?q=&is_active=&page=&limit=` получить список правил

`GET /orgs/:orgId/penguin-rules/:id` получить правило

`POST /orgs/:orgId/penguin-rules` создать правило

`PUT` /orgs/:orgId/penguin-rules/:id` изменить правило

`DELETE` /orgs/:orgId/penguin-rules/:id` удалить правило

#### Групповое начисление пингвинов [penguin_batches](./penguins/penguin_batches/README.md)

`POST /orgs/:orgId/penguins/batches`  
создать групповое начисление/списание и разнести по студентам

`GET /orgs/:orgId/penguins/batches?groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=`  
получить список групповых начислений

`GET /orgs/:orgId/penguins/batches/:id/students?page=&limit=`  
получить список студентов при групповом начислении

`GET /orgs/:orgId/penguins/batches/:id`  
получить групповое начисление по id

#### Логирование (Индивидуальное начисление / списание) [penguin_ledger](./penguins/penguin_ledger/README.md)

`POST /orgs/:orgId/penguins/ledger`  
создать индивидуальное начисление/списание пингвинов

`GET /orgs/:orgId/penguins/ledger?q=&studentId=&groupId=&subjectId=&operatorId=&date_from=&date_to=&page=&limit=`  
получить список начислений/снятий

`GET /orgs/:orgId/penguins/ledger/:id`  
получить операцию по id

#### Статистика (день/неделя/месяц) [statistics](./penguins/statistics/README.md)

`GET /orgs/:orgId/penguins/stats/daily?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`  
получить статистику за день

`GET /orgs/:orgId/penguins/stats/weekly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`  
получить статистику за неделю

`GET /orgs/:orgId/penguins/stats/monthly?studentId=&groupId=&subjectId=&operatorId=&directionId=&date_from=&date_to=`  
получить статистику за месяц

#### Балансы [penguin_balances](./penguins/penguin_balances/README.md)

`GET /orgs/:orgId/students/:studentId/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=`  
получить баланс студента

`GET /orgs/:orgId/my/penguins/balances?groupId=&subjectId=&directionId=&page=&limit=`  
получить свой баланс пингвинов (студент для себя)

`GET /orgs/:orgId/penguins/leaderboard?groupId=&subjectId=&directionId=&page=&limit=`  
получить лидборд (топ студентов)

#### Оповещения [notifications](./penguins/notifications/README.md)

`GET /orgs/:orgId/notifications?is_read=&page=&limit=` получить уведомления текущего пользователя

`PUT /orgs/:orgId/notifications/:id/read` пометить уведомление прочитанным

### Billing [billing](./billing/README.md)

`GET /billing/plans` получить список всех тарифных планов

`GET /orgs/:orgId/billing/subscription` получить текущую активную подписку организации

`GET /orgs/:orgId/billing/invoices?status=&page=&limit=` получить список счетов организации

`POST /orgs/:orgId/billing/invoices` создать инвойс для активной подписки (ручной триггер)

`GET /orgs/:orgId/billing/payments?status=&page=&limit=` получить историю платежей организации
