# ExpressKit (work in progress)

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

More complex examples and documentation are coming.
