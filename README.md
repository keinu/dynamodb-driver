# Simple AWS DynamoDB driver for nodejs

Simple Node.js DynamoDB driver to perform basic CRUD operations, it is meant to be as simple as possible.

## Installation

```
npm i dynamodb-driver
```

## Initialisation

```javascript

  var SimpleDynamo = require("node-simple-dynamo"),
      table = SimpleDynamo(awsConfigObject, DynamoDbConfigObject);

```

### Example

```javascript

  var table = SimpleDynamo({
      region: "eu-west-1"
      // --- your AWS config object if need be (AWS.config.update(awsconfig));
  }, {
    dynamodb: '2012-08-10'
  });

```

## Create row

Creates a row in the specified table, and id will be automatically generated using shorId if non exists in the document
Returns a promise resolving a document that has just been created

### Usage

```javascript

  somePromise = table.create(tableName, documentToCrate);

```

### Example

```javascript

  table.create("Users", {
    firstName: "Marilyn",
    lastName: "Manson"
  }).then(function(user) {

    // user is something like
    {
      id : "S1KtimR6"
      firstName: "Marilyn",
      lastName: "Manson"
    }

  });

```

## Update row

### Usage

```javascript

  somePromise = table.update(tableName, documentToUpdate [, conditions] [, keys]);

```

conditions: An object with a ConditionExpression and a ExpressionAttributeValues
(See: http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html)

keys: Should you table is not using id as primary key, you can specify your primary and sort key here such as ["organisationId", "documentId"]


### Example

```javascript

  database.update("Users", {
    id: "S1KtimR6",
    isPowerUser: true
  }, {
    ConditionExpression: "active = :active",
    ExpressionAttributeValues: {
        ":active": true
    }
  }).then(function(user) {

  });;

```

## Query rows


### Usage

```javascript

  Promise = database.query(tableName, query [, indexName] [, options])

```

query:
- could be an array for the query with the key, ComparisonOperator and AttributeValueList for legacy.
- could be an object with a KeyConditionExpression and ExpressionAttributeNames


### Example


```javascript

  database.query("Users", [{
    key: "email",
    operator: "EQ",
    value: email
  },{
    key: "password",
    operator: "EQ",
    value: password
  }], "EmailPasswordIndex").then(function(users) {

    // users is an Array of users
    [{
      id: "S1KtimR6",
      firstName: "Marilyn"
        lasName: "Manson"
     }, {
      id: "Z1et9rR5",
      firstName: "Xabi"
        lasName: "Alonso"
     }]

  });

```

## Get row by Key


### Usage

```javascript

  Promise = database.get(tableName, id).then(function(user) {

```

### Example

```javascript

  database.get("Users", "Z1et9rR5").then(function(user) {

    // user is something like that
    {
      id: "Z1et9rR5",
      firstName: "Xabi"
      lasName: "Alonso"
    }

  });

```

## Get multiple rows by Key


### Usage

```javascript

  Promise = database.getItems(tableName, arrayOfIds [, options])

```
options: is an optional object with consistentRead attribute. it will apply strongly consistent reads instead of the default setting (eventually consistent reads)

### Example

```javascript

  database.getItems("Users", ["Z1et9rR5", "S1KtimR6"], {consistentRead: true}).then(function(users) {

  // users is an Array of users
    [{
      id: "S1KtimR6",
      firstName: "Marilyn"
        lasName: "Manson"
     }, {
      id: "Z1et9rR5",
      firstName: "Xabi"
        lasName: "Alonso"
     }]

  });

```

## Delete row

### Usage

```javascript

  Promise = database.remove(tableName, id)

```

### Example

```javascript

  database.remove("Users", "Z1et9rR5").then(function(user) {
  // user is
    {
      id: "Z1et9rR5",
      firstName: "Xabi"
        lasName: "Alonso"
    }
  });

```

## List rows

### Usage

```javascript

  Promise = database.list(tableName, query);

```

Wil perform a scan operation on the selected table


### Example

```javascript

  database.list("Users", [{
    key: "email",
    operator: "EQ",
    value: "some@email.com"
  }]);

```
