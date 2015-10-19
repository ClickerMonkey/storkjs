# StorkJS
### Simple key-value storage in your browser.

StorkJS allows you to store key-value pairs & records in the browser, so when your user returns that data is still there.
Inspired by [lawnchair](http://brian.io/lawnchair/), StorkJS is a more robust option with error handling, key customization, and much more!

StorkJS uses the most preferred & supported storage available based on your browser.

#### Features
- Clean and simple API
- Pure Javascript, no dependencies
- Graceful degradation of storage backends, uses the best one available!
- Keys & Values can be any data type
- All stored key-value pairs/records can be loaded on initialization or lazy loaded upon request
- Promises & [chaining](#chainingExample) allow for cleaner code, since saving and retrieving data
   isn't always synchronous
- Plugins can be added to alter behavior
- Everything is cached to avoid unnessary retrievals

#### API
- {@link Stork#then|then(callback)}: Start a chain of asynchronous calls
- {@link Stork#get|get(key, [success], [failure])}: Return a single value if it exists
- {@link Stork#getMany|getMany(keys, [success], [failure])}: Return several values at once
- {@link Stork#save|save(record, [success], [failure])}: Save a record, generating a key if one doesn't exist
- {@link Stork#batch|batch(records, [success], [failure])}: Save multuple records at once
- {@link Stork#put|put(key, value, [success], [failure])}: Save a key-value pair
- {@link Stork#remove|remove(key, [success], [failure])}: Removes a value/record based on their key
- {@link Stork#removeMany|removeMany(keys, [success], [failure])}: Removes several values/records at once
- {@link Stork#destroy|destroy([success], [failure])}: Remove all key-values/records
- {@link Stork#reload|reload([success], [failure])}: Load all records into cache
- {@link Stork#each|each(callback, [failure])}: Invokes the callback for all key-value pairs
- {@link Stork#all|all([success], [failure])}: Returns all keys and values to the callback
- {@link Stork#size|size([success], [failure])}: Returns the number of key-value pairs to the callback

#### Examples
*Using StorkJS as a record store*

```javascript
var db = new Stork( {name: 'todos'} );
// Save one record
db.save( {id: 1, title: 'Download Stork JS'} );
// Save multiple at once
db.batch([
  {id: 2, title: 'Use Stork JS'},
  {id: 3, title: '???'},
  {id: 4, title: 'Profit!'}
]);
// Save one without an ID, an ID is placed in the record automatically
db.save( {title: 'Hit the Gym'} );
// Remove one
db.remove( 4 );
// Retrieve a record
db.get( 3, function(todo) 
{
  alert( todo.title );
});
// Retrieve all records
db.all(function(todos) 
{
  // todos = array of all todo records
});
```

*Using StorkJS as a key-value store*
```javascript
var db = new Stork( {name: 'settings'} );
db.put( 'meow', 'string key' );
db.put( 23, 'number key' );
db.put( true, 'boolean key' );
db.put( {y:5}, 'object key' );
db.put( [1,3], 'array key' );
// Remove one
db.remove( [1,3] );
// Retrieve one key-value pair
db.get( {y:5}, function(value, key)
{
  // value == 'object key'
});
// Retrieve all key-value pairs
db.all(function(values, keys)
{
  // values = array of all values, keys = array of corresponding keys
});
```

<span id="chainingExample"></span>
*Listening for success or failure*
```javascript
// All saving, removal, & retrieval operations can be passed success & failure callbacks
db.get( 23543,
  function(value, key) {

  },
  function(key, error) {

  })
;

// All saving, removal, & retrieval operations return promises
db.get( 23543 )
  .then(function(value, key) {

  })
  .error(function(error) {

  })
;

// If a result of a callback is a promise, YOU CAN CHAIN THEM!
db.get( 23543 )
  .then(function(value, key) {
    // The value associated to the key
    return this.size();
  })
  .then(function(size) {
    // The current number of key-value pairs.
    return this.all();
  })
  .then(function(values, keys) {
    // All key-value pairs currently stored.
    return this.destroy();
  })
  .then(function() {
    // Everything is destroyed!
  })
  .error(function(error) {
    // Oops!
  })
;
```

#### Building

```
npm install
gulp
```

#### Building Documentation
```
gulp docs
```

#### Testing
Once built, view `test/index.html` in the browser.