# Rails JSON API REST client for react-admin.

A JSONAPI compatible adapter for react-admin that allows for rapidly building admin interfaces in React using the RA framework.

## Installation

ra-ror-jsonapi-client is available from npm. You can install it (and its required dependencies)
using:

```sh
npm install ra-ror-jsonapi-client
```

It can also be installed using yarn:

```sh
yarn add ra-ror-jsonapi-client
```

## Usage

```js
//in app.js
import React from "react";
import { Admin, Resource } from "react-admin";
import dataProvider from "ra-ror-jsonapi-client/build/restClient";

const restClient = jsonAPIRestClient("http://localhost:3000");

const App = () => (
  <Admin dataProvider={dataProvider}>
    ...
  </Admin>
);

export default App;
```
