# Работа над проектом

Краткий справочник для входа в задачу. Правила на каждый запуск — в [AGENTS.md](../AGENTS.md); описание игры — в [README.md](../README.md). Этот файл не нужно читать целиком перед каждой правкой.

## Где менять

| Задача | Основные файлы | Проверка во время работы |
|---|---|---|
| Потребности, действия, демография, загрузка | `sim.js`, `brain.js`; посильные партии сырья — `supplyAmount` | `quick` |
| Интеллект 2.0: личность, семья, контекстная память, поиск работы и планирование | `citizen-mind.js`, `labour.js`, `citizen-planner.js`; интеграция `brain.js`, `sim.js`, `learning.js` | `node --test tests/intelligence.test.cjs`, затем `full` |
| Причины решений жителей и обзор труда | `mind-view.js`, `mind.css`; подключения `app.js`, `dashboard.js` | `syntax` + браузер |
| Длительные намерения, связи, слухи и договорённости | `intentions.js`, `social-life.js`, `agreements.js`; интеграция `sim.js`, `brain.js`, `labour.js`, `commerce.js` | `node --test tests/society.test.cjs`, затем `full` |
| Социальные встречи, мотивы преступлений, компании, стража и наказания | `civic-life.js`, `civic-view.js`; интеграция `sim.js`, `brain.js`, `learning.js`, `government.js`, `society-view.js`; разовые штрафы исключены из прогноза казны | `node --test tests/civic-life.test.cjs`, затем `full` + браузер |
| Решения владельцев о найме, ценах и выпуске | `enterprise-policy.js`, вызовы в `guilds.js`; обзор в `society-view.js` | `node --test tests/society.test.cjs tests/guilds.test.cjs`, затем `full` + браузер |
| Семейный бюджет, риск, износ вещей, потребительский спрос и доставка покупок | `households.js`, `household-view.js`, `households.css`; интеграция `sim.js`, `brain.js`, `citizen-mind.js`, `finance.js`, `commerce.js`, `guilds.js`, `enterprise-policy.js`, `agreements.js` | `node --test tests/households.test.cjs tests/intelligence.test.cjs tests/society.test.cjs`, затем `full` + браузер |
| Учёт продаж, себестоимость, прогноз выпуска и найма | `enterprise-accounts.js`, `enterprise-policy.js`, `enterprise-view.js`; интеграция `finance.js`, `commerce.js`, `guilds.js`, `labour.js` | `node --test tests/enterprise-economy.test.cjs tests/society.test.cjs`, затем `full` + браузер |
| Ассортимент, галеты и порча продовольствия | `products.js`; рецепты и исполнение `sim.js`, `commerce.js`, `guilds.js`, питание `brain.js`, `households.js` | `node --test tests/enterprise-economy.test.cjs`, затем `full` |
| Местные стройматериалы, отдельный бюджет подрядов, доставка и строительные работы | `construction.js`, `expansion.js`, `development.js`, `enterprise-view.js`; интеграция `brain.js`, `sim.js`; фикстуры уровней `tests/helpers/construction.cjs` | `node --test tests/enterprise-economy.test.cjs tests/development.test.cjs`, затем `full` + браузер |
| Налоги, адресная льгота, содержание и местные закупки | `finance.js`; сбор с дворов в `property-tax.js` | `economy` + `node --test tests/property-budget.test.cjs` |
| Автономный бюджет: прогноз, фонд развития, лимиты служб и помощи | `city-budget.js`, `finance.js`, `finance-view.js`; расход фонда в `development.js`/`expansion.js`, регион в `city-systems.js` | `node --test tests/property-budget.test.cjs tests/city-policy.test.cjs`, затем `full` |
| Цены, квоты и насыщение внешнего рынка, натуральный сбор, предоплата | `commerce.js` | `economy` |
| Семейные гильдии, заявки в ратушу и конкуренция | `guilds.js`, `guild-view.js`, `guilds.css`; цены в `commerce.js`, цели в `brain.js` | `quick` + браузер |
| Уровни зданий, дополнительные улучшения, решения владельцев | `development.js`, `development-view.js`, `development.css`; планы в `brain.js`/`sim.js`, вместимость в `housing.js` | `node --test tests/development.test.cjs tests/economy-recovery.test.cjs` + браузер, затем `full` |
| Должности магистрата, полномочия и смена чиновников | `government.js`; делегированные налоги в `finance.js`, разрешения в `guilds.js` | `node --test tests/development.test.cjs` + браузер, затем `full` |
| Стройка и приглашение переселенцев | `expansion.js`, участки в `world.js` | `economy` |
| Сословия, земельная аренда, теснота и переезды семей | `housing.js`, ставки и кварталы `town-layout.js`, `district-view.js`; интеграция `sim.js`, `households.js`, `property-tax.js` | `node --test tests/city-policy.test.cjs`, затем `full` + браузер |
| Простые / городские дома и дворянские поместья, цены и доступ к жилью | `residences.js`, `housing.js`, `expansion.js`; сметы в `Expansion.options`, классы в `civic-view.js`, `map-plan.js`, множители в `development.js`/`property-tax.js` | `node --test tests/residences.test.cjs tests/housing.test.cjs`, затем `full` + браузер |
| Личные титулы, разовые взносы, сословное повышение и наследование | `titles.js`, `titles-view.js`; интеграция `sim.js`, `brain.js`, `learning.js`, `housing.js`, `households.js`; разовые доходы исключены из прогноза в `finance.js`/`city-budget.js` | `node --test tests/titles.test.cjs`, затем `full` + браузер |
| Планировка, дороги, движение и миграция геометрии | `town-layout.js`, `world.js`, `sim.js`, `map-art.js` | `node --test tests/map-extension.test.cjs tests/city-policy.test.cjs` + карта, затем `full` |
| События и реакция жителей | `events.js` | `events` |
| Регион, кризисы, обучение | `city-systems.js`, `learning.js` | `systems` |
| Панели и управление временем | `app.js`, `index.html`, `style.css`, `atlas.css` | `syntax` + браузер |
| Статистика, формы и их оформление | `dashboard.js`, `finance-view.js`, `dashboard.css` | `syntax` + браузер |
| История показателей, графики, периоды и распределения | `analytics.js`, `statistics-view.js`, `statistics.css`; сэмплирование и расход сырья в `sim.js` | `node --test tests/analytics.test.cjs`, затем `full` + браузер |
| Завершение, архив итогов, поколения и отчёт | `report.js`, `report-view.js`, `report.css`; остановка в `sim.js`/`app.js` | `quick` + браузер |
| Схематическая карта | `map-painted.js` (canvas и взаимодействия), `map-plan.js`/`map-plan.css`, `map-art.js`; иллюстрация больше не подключена | `syntax` + браузер; `systems` для геометрии |
| Команды разработки | `tools/check.cjs`, `tests/check.test.cjs` | `tooling` |

В браузере модули подключаются тегами `script` в `index.html`, в тестах — через CommonJS. `sim.js` собирает модель и экспортирует её API. Зависимостей и сборщика нет. `map.js` не подключён; `backup-v1/` используется тестом переноса старых сохранений. `decision-bridge.js` — отключённый адаптер внешних решений.

## Команды

Нужен Node.js 22.16+ или 24+; здесь проверено на 24.19.0. Команды работают из любого каталога, если указать путь к скрипту. `npm` необязателен.

```sh
node server.js
node tools/check.cjs suggest finance.js dashboard.js
node tools/check.cjs economy
node tools/check.cjs quick
node tools/check.cjs full
```

- `syntax` — синтаксис JS/CJS и проверка наличия локальных скриптов страницы.
- `sim`, `economy`, `events`, `systems`, `tooling` — выбранный набор тестов и синтаксис.
- `quick` — все тесты кроме `[long]`.
- `long` — только длительные сценарии; `full` — все тесты, включая их.
- `suggest <files…>` — рекомендация по перечисленным файлам, без запуска. Это явный список, а не определение изменений через Git. Неизвестный путь рекомендует `full`.

При изменении симуляции, экономики, маршрутов или сохранений после локальных проверок нужен один `full`. Повторять его после правки текста или CSS не требуется. Новый длительный тест обозначается префиксом `[long]`; любой новый `*.test.cjs` автоматически входит в `quick`/`full`.

Консоль показывает профиль, результат и путь к логу. Ошибка даёт ненулевой код возврата и хвост диагностики. Полный вывод и JSON-итог лежат в `.reports/checks/<profile>.log` и `.json`. JSON содержит время, результаты и отпечаток исходников; это не кэш и не счётчик токенов. Каждый запуск выполняет проверки заново. Одновременные запуски одного профиля перезаписывают его последний отчёт.

## Проверка интерфейса и сохранений

Использовать браузерный инструмент и `/?demo=1`. Для формы проверить ввод, применение и видимый результат; для карты — нужный объект/маршрут; для адаптивной правки — затронутую ширину. Полные деревья страницы и скриншоты всех разделов обычно не нужны. Модельные тесты не заменяют проверку поведения интерфейса.

Основной город хранится в `localStorage` под `danzig-city-v2` (формат 2), чтение версии 1 сохранено. `Simulation.fromJSON` добавляет новые системы без сброса людей и истории. Не экспериментировать с основным сохранением. Старый `tests/browser-check.cjs` содержит машинные пути, обращение к внутреннему состоянию и удалённый интерфейс налога; это исторический сценарий, команды выше его не запускают.

## Как поддерживать небольшой контекст

Искать имя функции через `rg -n`, затем читать окружающий фрагмент. Для выбора тестов использовать таблицу или `suggest`. После успешной проверки сохраняется отчёт — не нужно пересказывать все тесты в чате. В новой задаче достаточно назвать цель и ограничения; постоянные правила уже в корневом `AGENTS.md`. Не создавать отдельный журнал, дублирующий README и историю разговора.

Основа подхода: [официальные инструкции AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) и [рекомендации OpenAI по кратким инструкциям и чтению по необходимости](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra). Их применение здесь — выбор проекта. Настройки модели и аккаунта этот набор файлов не меняет.
