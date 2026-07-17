# 888 Basketball как Telegram Mini App

Документ описывает production-путь от текущей статической игры до запуска внутри Telegram. Основной источник — [официальная документация Telegram Mini Apps](https://core.telegram.org/bots/webapps).

## 1. Что уже подходит

Игра является статическим HTML5-приложением без сборщика и backend-зависимостей. Canvas, touch-ввод, адаптивная вёрстка и локальные ассеты совместимы с WebView Telegram. Для базового запуска достаточно HTTPS-хостинга и регистрации URL через BotFather.

## 2. Создание бота

1. Открыть официального `@BotFather`.
2. Выполнить `/newbot`.
3. Указать отображаемое имя и username, заканчивающийся на `bot`.
4. Сохранить полученный токен только в менеджере секретов или переменной окружения backend. Никогда не добавлять токен в JavaScript, Git или HTML.
5. Добавить изображение, описание и команды бота.

Telegram рекомендует создавать ботов именно через BotFather: [введение для разработчиков](https://core.telegram.org/bots).

## 3. HTTPS-хостинг

Production Mini App должна открываться по публичному HTTPS URL. Подойдёт любой статический хостинг с корректным MIME для `.js`, `.png` и `.mp3`:

- GitHub Pages;
- Cloudflare Pages;
- Netlify;
- Vercel;
- собственный Nginx/CDN.

Проверить:

```text
https://game.example.com/index.html
https://game.example.com/src/main.js
https://game.example.com/assets/ball-premium.png
```

Все URL должны отвечать без редиректа на авторизацию. HTTPS-сертификат должен быть действительным. HTTP допустим только в отдельном тестовом окружении Telegram.

## 4. Регистрация Main Mini App

В BotFather открыть:

```text
/mybots
→ выбрать бота
→ Bot Settings
→ Configure Mini App
→ Enable Mini App
```

Указать HTTPS URL игры. После настройки на профиле бота появится кнопка запуска. Main Mini App также открывается ссылкой:

```text
https://t.me/<bot_username>?startapp
```

Для передачи режима можно использовать параметр:

```text
https://t.me/<bot_username>?startapp=level_campaign
```

Telegram передаст его как `start_param` и `tgWebAppStartParam`. Официальное описание способов запуска находится в [Telegram Mini Apps](https://core.telegram.org/bots/webapps#implementing-mini-apps).

Дополнительно настроить `Menu Button` через `/setmenubutton` или Bot Settings → Menu Button.

## 5. Подключение Telegram WebApp API

Добавить в `<head>` перед игровыми скриптами:

```html
<script src="https://telegram.org/js/telegram-web-app.js?63"></script>
```

Создать небольшой адаптер, который безопасно работает и в обычном браузере:

```js
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
  tg.lockOrientation?.();
}
```

`ready()` сообщает Telegram, что приложение загрузилось и системный placeholder можно скрыть. `expand()` запрашивает максимальную высоту WebView. Новые методы обязательно вызывать через feature detection, поскольку версия Telegram у пользователей отличается.

## 6. Viewport и safe area

Не полагаться только на `100vh`. Использовать Telegram CSS variables с fallback:

```css
html,
body,
#device-stage {
  min-height: var(--tg-viewport-stable-height, 100dvh);
}

#device-stage {
  padding-top: max(env(safe-area-inset-top), var(--tg-safe-area-inset-top, 0px));
  padding-right: max(env(safe-area-inset-right), var(--tg-safe-area-inset-right, 0px));
  padding-bottom: max(env(safe-area-inset-bottom), var(--tg-safe-area-inset-bottom, 0px));
  padding-left: max(env(safe-area-inset-left), var(--tg-safe-area-inset-left, 0px));
}
```

При событиях изменения viewport вызвать существующий `resize()` Canvas. Проверить портретный режим на iOS и Android, появление клавиатуры и сворачивание WebView.

## 7. Тема Telegram

Доступны `Telegram.WebApp.colorScheme`, `themeParams` и CSS-переменные `--tg-theme-*`. Игра может сохранить собственный неоновый дизайн, но системные области желательно согласовать:

```js
tg?.setHeaderColor?.('#07131d');
tg?.setBackgroundColor?.('#07131d');
tg?.setBottomBarColor?.('#07131d');
```

## 8. Пользователь и язык

Для визуального приветствия допустимо читать:

```js
const user = tg?.initDataUnsafe?.user;
const language = user?.language_code;
```

`initDataUnsafe` нельзя использовать как подтверждение личности или основание для записи рекорда. Для безопасности отправить строку `Telegram.WebApp.initData` на backend и валидировать подпись согласно [официальному алгоритму](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).

Язык игры можно первоначально выбрать по `language_code`, сохранив пользовательский переключатель RU/EN приоритетным.

## 9. Рекорд и backend

### Текущая авторизация 888 Basketball

Для игры уже подготовлен и опубликован сервер авторизации:

```text
POST https://basketball888-api.ulrichsturm.workers.dev/auth/telegram
```

Он работает на Cloudflare Workers, а профиль игрока хранится в Cloudflare D1
`basketball888-db`, в таблице `players`. Браузер передаёт только
`Telegram.WebApp.initData`; Worker проверяет HMAC-подпись и срок `auth_date`,
после чего создаёт или обновляет профиль. Запросы разрешены только с
`https://ulrichsturm.github.io`.

Чтобы включить production-авторизацию, в настройках Worker нужно добавить
**зашифрованный secret** с именем `BOT_TOKEN` и самостоятельно вставить туда
токен из BotFather. Токен не должен попадать в репозиторий, код игры, чат или
обычную переменную окружения. После сохранения секрета повторно открыть игру
через Telegram: запись пользователя появится в D1 автоматически.

Исходный код Worker и схема базы находятся в проекте:

```text
worker/src/index.js
worker/schema.sql
worker/wrangler.toml
```

Это авторизация, а не античит. До появления глобального рейтинга рекорд игры
по-прежнему хранится локально; отправку и серверную валидацию очков следует
добавлять отдельным этапом.

Текущий `localStorage` подходит для локального рекорда на одном устройстве. Для глобальной таблицы лидеров нужен backend:

1. Mini App отправляет `initData`, итоговый счёт и технические метрики забега.
2. Backend проверяет подпись `initData` и свежесть `auth_date`.
3. Backend определяет Telegram user ID только из проверенных данных.
4. Backend проверяет допустимость результата: длительность, число бросков, уровень, максимальный теоретический счёт.
5. Backend сохраняет лучший результат идемпотентно.

Минимальные endpoint:

```text
POST /api/session/start
POST /api/score
GET  /api/leaderboard
```

Нельзя доверять счёту, вычисленному только в браузере. Для соревновательной таблицы сервер должен выдавать session nonce и проверять последовательность событий или подписанный итоговый payload.

## 10. Отправка результата в чат

`Telegram.WebApp.sendData()` доступен для Mini Apps, открытых keyboard-кнопкой, передаёт до 4096 байт и закрывает приложение. Для Main Mini App обычно удобнее backend + Bot API или inline flow. Различия описаны в [официальных способах запуска](https://core.telegram.org/bots/webapps#implementing-mini-apps).

Пример компактного payload:

```js
tg?.sendData?.(JSON.stringify({ type: 'score', score, level: 10 }));
```

## 11. Тактильная обратная связь

Заменить или дополнить `navigator.vibrate`:

```js
tg?.HapticFeedback?.impactOccurred('light');
tg?.HapticFeedback?.notificationOccurred(hit ? 'success' : 'error');
```

Оставить `navigator.vibrate` как fallback для обычного браузера.

## 12. Хранилище

Для несекретных настроек достаточно `localStorage`. В актуальных клиентах Telegram также доступны `DeviceStorage` и `CloudStorage`; чувствительные небольшие значения могут храниться через `SecureStorage`. Каждый новый API проверять на наличие перед вызовом. Токен бота никогда не хранить на клиенте.

## 13. Загрузка и производительность

Десять level-фонов занимают значительный объём. Для Mini App рекомендуется:

- конвертировать PNG-фоны в WebP/AVIF;
- оставить PNG только там, где нужна прозрачность;
- загрузить сначала меню и фон первого уровня;
- остальные уровни подгружать последовательно в фоне;
- показывать progress/loading screen до `tg.ready()`;
- отключать glow/частицы на низком `performance_class`;
- при `visibilitychange` ставить таймер и аудио на паузу.

## 14. Жизненный цикл

Обработать:

```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
  else resumeToLevelIntro();
});
```

Не продолжать 24-секундный таймер, когда Mini App скрыта. При закрытии приложения незавершённый забег лучше считать прерванным.

## 15. Тестирование

Проверить минимум:

- Telegram iOS;
- Telegram Android;
- Telegram Desktop/macOS;
- обычный Safari/Chrome fallback;
- старый клиент без новых методов;
- медленную сеть и холодный кэш;
- потерю фокуса во время уровня;
- звук включён/выключен;
- safe area на устройствах с вырезом;
- валидацию поддельного и просроченного `initData`.

Telegram описывает отдельное test environment и способы входа для iOS/Desktop/macOS в разделе [Testing Mini Apps](https://core.telegram.org/bots/webapps#testing-mini-apps). Test environment отделено от production и требует отдельного аккаунта и бота.

## 16. Чеклист релиза

- [ ] HTTPS URL доступен без авторизации.
- [ ] Подключён официальный `telegram-web-app.js`.
- [ ] Вызываются `ready()` и `expand()`.
- [ ] Canvas реагирует на viewport и safe area.
- [ ] Игра ставится на паузу при скрытии.
- [ ] Все новые методы имеют feature detection.
- [ ] Бот настроен как Main Mini App и Menu Button.
- [ ] Токен отсутствует в frontend и Git.
- [ ] `initData` проверяется на backend перед записью результата.
- [ ] Оптимизированы изображения и холодная загрузка.
- [ ] Протестированы iOS, Android и Desktop.
- [ ] Добавлены BotFather preview media, локализованные описание и скриншоты.

## Рекомендуемая последовательность реализации

1. Оптимизировать level-фоны в WebP.
2. Добавить Telegram adapter и viewport integration.
3. Развернуть статическую игру по HTTPS.
4. Создать бота и Main Mini App в BotFather.
5. Провести тест без backend с локальным рекордом.
6. Добавить backend-валидацию `initData`.
7. Добавить серверный рекорд и leaderboard.
8. Провести QA на трёх платформах.
9. Настроить preview media и production URL.
