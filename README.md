# Simple AWS DynamoDB driver for nodejs

Simple nodejs DynamoDB layer to perform basic operations. All methods return a promise using Q.

## Usage

```javascript

  var SimpleDynamo = require("node-simple-dynamo");
  var database = SimpleDynamo({
    // --- your AWS config object if need be (AWS.config.update(awsconfig));
  }, {
    region: "eu-west-1",
    dynamodb: '2012-08-10'
  });

```

## Create row

An id will be automatically generated using shorId

```javascript
  database.create("Users", {
    firstName: "Marilyn",
    lastName: "Manson"
  }).then(function(user) {
  
  });

```

### Update row

```javascript

  database.update("Users", {
    id: 1234,
    firstName: "Robert",
    lastName: "Trebor"
  }).then(function(user) {
  
  });;

```

### Query rows

*pass null to the index name parameter if you are not using an index*

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
  
  });

```

### Get row by Hash Key

```javascript

  database.get("Users", id).then(function(user) {
  
  });
  
```

### Get multiple rows by hash Key, pass an array of id

```javascript

  database.getItems("Users", [1234, 2345, 3456]).then(function(users) {
  
  });

```

### Delete row

```javascript

  database.remove("Users", id).then(function(user) {
  
  });
  
```

### List rows

Example, lists rows containing value 'some@email.com' as email Key

**!! This uses a Scan** therefore not recomended

```javascript
  database.list("Users", [{
    key: "email",
    operator: "EQ",
    value: "some@email.com"
  }]);
  
```
