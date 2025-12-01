# ExpressKit

`ExpressKit` — легковесная обертка для [express.js](https://expressjs.com/), которая интегрируется с [NodeKit](https://github.com/gravity-ui/nodekit), обеспечивая такие функции, как логирование запросов, поддержка трассировки, асинхронные контроллеры и middleware, а также детальное описание маршрутов.

Установка:

```bash
npm install --save @gravity-ui/nodekit @gravity-ui/expresskit
```

Основное использование:

```typescript
import {ExpressKit} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';

const nodekit = new NodeKit();

const app = new ExpressKit(nodekit, {
  'GET /': (req, res) => {
    res.send('Hello World!');
  },
});

app.run();
```

## CSP (политика безопасности контента)

`config.ts`

```typescript
import type {AppConfig} from '@gravity-ui/nodekit';
import {csp} from '@gravity-ui/expresskit';

const config: Partial<AppConfig> = {
    expressCspEnable: true,
    expressCspPresets: ({getDefaultPresets}) => {
        return getDefaultPresets({defaultNone: true}).concat([
            csp.inline(),
            {csp.directives.REPORT_TO: 'my-report-group'},
        ]);
    },
    expressCspReportTo: [
        {
            group: 'my-report-group',
            max_age: 30 * 60,
            endpoints: [{ url: 'https://cspreport.com/send'}],
            include_subdomains: true,
        }
    ]
}

export default config;
```

## Управление кешированием

По умолчанию ExpressKit устанавливает `no-cache` заголовки на все ответы. Вы можете управлять этим поведением глобально или на уровне маршрута.

### Глобальная конфигурация

```typescript
const config: Partial<AppConfig> = {
  expressEnableCaching: true, // Разрешить кеширование по умолчанию
};
```

### Конфигурация на уровне маршрута

```typescript
const app = new ExpressKit(nodekit, {
  'GET /api/cached': {
    enableCaching: true, // Разрешить кеширование для этого маршрута
    handler: (req, res) => res.json({data: 'кешируемые'}),
  },
  'GET /api/fresh': {
    enableCaching: false, // Принудительно no-cache
    handler: (req, res) => res.json({data: 'всегда свежие'}),
  },
});
```

Настройка `enableCaching` на уровне маршрута переопределяет глобальную. Состояние доступно в `req.routeInfo.enableCaching`.

## Валидация запросов и сериализация ответов

- [Валидация запросов и сериализация ответов](https://github.com/gravity-ui/expresskit/blob/main/docs/VALIDATOR-ru.md) - использование zod для автоматической валидации запросов и сериализации ответов.
