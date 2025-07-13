# ExpressKit

ExpressKit is a lightweight [express.js](https://expressjs.com/) wrapper that integrates with [NodeKit](https://github.com/gravity-ui/nodekit) and provides some useful features like request logging, tracing support, async controllers & middleware and verbose routes description.

Installation:

```bash
npm install --save @gravity-ui/nodekit @gravity-ui/expresskit
```

Basic usage:

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

## Security Schemes for OpenAPI

ExpressKit now supports OpenAPI security schemes for documenting authentication requirements. This allows you to easily add security definitions to your API documentation.

```typescript
import {ExpressKit, bearerAuth} from '@gravity-ui/expresskit';

// Create a bearer token auth handler with OpenAPI documentation
const jwtAuthHandler = bearerAuth('jwtAuth')(
  function authenticate(req, res, next) {
    // Your authentication logic here
    next();
  }
);

const app = new ExpressKit(nodekit, {
  'GET /protected': {
    handler: (req, res) => {
      res.json({message: 'Protected resource'});
    },
    authHandler: jwtAuthHandler
  }
});
```

See [Security Schemes Documentation](docs/SECURITY_SCHEMES.md) for more details.

## CSP

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
