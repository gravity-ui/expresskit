# ExpressKit Validator

Обеспечивает валидацию запросов (body, params, query, headers) и сериализацию ответов с использованием схем Zod.

## Содержание

- [Быстрый старт: Автоматическая валидация](#быстрый-старт-автоматическая-валидация)
- [Основные концепции](#основные-концепции)
  - [`withContract(config, settings?)(handler)`](#withcontractconfig-settingshandler)
  - [Расширенный Request (`ContractRequest`)](#расширенный-request-contractrequest)
  - [Расширенный Response (`ContractResponse`)](#расширенный-response-contractresponse)
  - [Настройка обработки ошибок](#настройка-обработки-ошибок)

---

## Быстрый старт: Автоматическая валидация

Вот типичный пример использования `withContract` для автоматической валидации запросов и сериализации ответов:

```typescript
import {ExpressKit, withContract, AppRoutes, RouteContract} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';
import {z} from 'zod/v4';

// Определите ваши схемы Zod
const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
});

const ErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
});

// Настройте API endpoint
const CreateTaskConfig = {
  name: 'CreateTask',
  operationId: 'createTaskOperation',
  summary: 'Creates a new task',
  request: {
    body: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }),
  },
  response: {
    content: {
      // Использование упрощенного синтаксиса для ответа 201
      201: TaskSchema,
      // Использование объектного синтаксиса, когда нужно описание
      400: {
        schema: ErrorSchema,
        description: 'Invalid input data.',
      },
    },
  },
} satisfies RouteContract;

// Создайте обработчик роута, обернутый в withContract
const createTaskHandler = withContract(CreateTaskConfig)(async (req, res) => {
  // req.body автоматически валидируется и типизируется
  const {name, description} = req.body;

  const newTask = {
    id: 'task_' + Date.now(),
    name,
    description,
    createdAt: new Date().toISOString(),
  };

  // Валидирует ответ по TaskSchema и отправляет его
  res.sendValidated(201, newTask);
});

// Пример с ручной валидацией
const manualValidationHandler = withContract(CreateTaskConfig, {
  manualValidation: true,
})(async (req, res) => {
  // Необходимо вручную валидировать, так как manualValidation установлен в true
  const {body} = await req.validate();
  const {name, description} = body;

  const newTask = {
    id: 'task_' + Date.now(),
    name,
    description,
    createdAt: new Date().toISOString(),
  };

  res.sendValidated(201, newTask);
});

// Интегрируйте с вашими роутами Express/ExpressKit
const routes: AppRoutes = {
  'POST /tasks': createTaskHandler,
};

const nodekit = new NodeKit();
const app = new ExpressKit(nodekit, routes);
```

**Ключевые моменты:**

- Тело запроса автоматически валидируется по вашей схеме
- Внутри обработчика `req.body` типизирован согласно вашей схеме
- `res.sendValidated()` валидирует данные ответа по вашей схеме
- Если валидация не проходит, выбрасываются соответствующие ошибки и обрабатываются

---

## Основные концепции

Основной инструмент — HOF-функция `withContract`, которая оборачивает обработчики роутов Express для добавления валидации, сериализации и типобезопасности на основе схем Zod.

### `withContract(config, settings?)(handler)`

- **`config` (`RouteContract`)**: Объект для настройки поведения валидации.

  ```typescript
  interface RouteContract {
    request?: {
      contentType?: string | string[]; // Разрешенные типы контента запроса. По умолчанию: 'application/json'
      body?: z.ZodType<any>; // Схема для req.body
      params?: z.ZodType<any>; // Схема для req.params
      query?: z.ZodType<any>; // Схема для req.query
      headers?: z.ZodType<any>; // Схема для req.headers
    };
    // Определите схемы ответов для различных HTTP статус-кодов. Это поле ОБЯЗАТЕЛЬНО.
    response: {
      contentType?: string; // Тип контента ответа. По умолчанию: 'application/json'
      content: Record<
        number,
        | z.ZodType<any>
        | {
            schema?: z.ZodType<any>; // Опциональная схема Zod для тела ответа этого статус-кода
            description?: string; // Описание для этого ответа
          }
      >;
    };
  }
  ```

- **`settings`**: Опциональные настройки для контракта.

  ```typescript
  interface WithContractSettings {
    manualValidation?: boolean; // По умолчанию: false. Если true, вызывайте req.validate() вручную.
  }
  ```

  Ключевые свойства:

  - `manualValidation`: Установите в `true`, чтобы отключить автоматическую валидацию запроса.

- **`handler(req, res)`**: Ваш обработчик роута Express, получающий расширенные объекты `req` и `res`.

### Расширенный Request (`ContractRequest`)

Объект `req` в вашем обработчике расширен:

- **Типизированные свойства**: `req.body`, `req.params`, `req.query`, `req.headers` типизированы на основе схем `RouteContract.request` (если автоматическая валидация включена и прошла успешно).
- **`req.validate(): Promise<ValidatedData>`**:
  - Вызовите этот асинхронный метод, если `manualValidation` установлен в `true`.
  - Возвращает промис, разрешающийся объектом с валидированными `body`, `params`, `query` и `headers`.
  - Выбрасывает `ValidationError` при неудаче.

### Расширенный Response (`ContractResponse`)

Объект `res` в вашем обработчике расширен следующими методами:

- **`res.sendTyped(statusCode, data?)`**:

  - Отправляет JSON-ответ с указанным `statusCode`.
  - Аргумент `data` **проверяется на типы** во время компиляции по схеме, связанной с `statusCode`.
  - **Не выполняет валидацию во время выполнения** и не преобразует данные.
  - Полезно, если вы уверены в структуре данных и хотите пропустить накладные расходы на валидацию.

- **`res.sendValidated(statusCode, data)`**:
  - Отправляет JSON-ответ с указанным `statusCode`.
  - **Выполняет валидацию во время выполнения** данных `data` по схеме, связанной с `statusCode`.
  - **Преобразует данные** согласно этой схеме Zod (удаляет лишние поля, применяет значения по умолчанию и т.д.).
  - Выбрасывает `ResponseValidationError`, если валидация не проходит.
  - Используйте этот метод для обеспечения строгого соблюдения контракта API.

### Настройка обработки ошибок

ExpressKit предоставляет мощный способ настройки обработки ошибок валидации через комбинацию `withErrorContract` и `AppConfig.appValidationErrorHandler`:

#### Пользовательская обработка ошибок с `withErrorContract` и `appValidationErrorHandler`

```typescript
import {
  withErrorContract,
  ErrorContract,
  ValidationError,
  ResponseValidationError,
} from '@gravity-ui/expresskit';
import {z} from 'zod/v4';
import {NodeKit} from '@gravity-ui/nodekit';

// Определите ваш контракт ошибок с типизированными ответами об ошибках
const CustomErrorContract = {
  errors: {
    content: {
      // Упрощенная форма: просто схема Zod
      422: z.object({
        error: z.string(),
        code: z.literal('UNPROCESSABLE_ENTITY'),
        details: z.array(z.string()).optional(),
      }),
      // Объектная форма, когда нужны метаданные
      400: {
        name: 'ValidationError',
        schema: z.object({
          error: z.string(),
          code: z.string(),
          details: z.array(z.string()).optional(),
          requestId: z.string(),
        }),
        description: 'Custom validation error format',
      },
      500: {
        name: 'ServerError',
        schema: z.object({
          error: z.string(),
          code: z.string(),
          requestId: z.string(),
        }),
        description: 'Server error',
      },
    },
  },
} satisfies ErrorContract;

const config: Partial<AppConfig> = {
  appValidationErrorHandler: (ctx) => {
    return withErrorContract(CustomErrorContract)((err, req, res, next) => {
      if (err instanceof ValidationError) {
        // Используйте типобезопасный res.sendError() из withErrorContract
        res.sendError(400, {
          error: 'Invalid input',
          code: 'CUSTOM_VALIDATION_ERROR',
          details: err.details?.issues?.map((issue) => issue.message) || [],
          requestId: req.id,
        });
      } else if (err instanceof ResponseValidationError) {
        res.sendError(500, {
          error: 'Internal Server Error',
          code: 'RESPONSE_VALIDATION_FAILED',
          requestId: req.id,
        });
      } else {
        next(err);
      }
    });
  },
};
```
