

/**
 * Creates a Stork instance.
 *
 * ```javascript
 * new Stork(); // global key-values/records
 * new Stork({name: 'todos'}); // grouped key-values/records
 * new Stork({name: 'rooms', key: 'ID'}); // records have 'ID' property which is used as key for saving records
 * new Stork({name: 'you are', lazy: true}); // records aren't all loaded on start, they are loaded as needed
 * new Stork({name: 'users', database: 'myapp', size: 65536}); // some storage engines support a custom database name and a desired size for the database
 *
 * new Stork(options, function(stork) {
 *   // stork = initialized stork instance
 * });
 * ```
 *
 * @constructor
 * @class
 * @param {Object} [options]
 *        An object of options, see the following properties for more details:
 *        {@link Stork#key}, {@link Stork#name}, {@link Stork#lazy}.
 * @param {Stork~initSuccess} [success]
 *        The function to invoke when the instance successfully initializes.
 * @param {Stork~initFailure} [failure]
 *        The function to invoke if this instance failes to initialize.
 */
function Stork(options, success, failure)
{
  // If this wasn't called as a constructor, return an instance!
  if (!(this instanceof Stork)) return new Stork( options, success, failure );

  // JSON is required for StorkJS
  if (!JSON) throw 'JSON unavailable! Include http://www.json.org/json2.js to fix.';

  /**
   * The options passed to the constructor and subsequently to the
   * {@link Stork#init} function.
   *
   * @type {Object}
   * @default  {}
   */
  this.options = options = (options || {});

  /**
   * The name of the property to use as the key for the
   * {@link Stork#save} and {@link Stork#batch} functions. This should
   * be specified in the `options` object.
   *
   * @type {String}
   * @default 'id'
   */
  this.key = coalesce( options.key, 'id' );

  /**
   * The name used to group the key-value pairs. This is essentially
   * a table name. This should be specified in the `options` object.
   *
   * @type {String}
   * @default ''
   */
  this.name = coalesce( options.name, '' );

  /**
   * If true, key-value pairs will be lazily loaded instead of loaded
   * all at once on initialization. This should be specified in the
   * `options` object.
   *
   * @type {Boolean}
   * @default false
   */
  this.lazy = coalesce( options.lazy, false );

  /**
   * The cache of key-value pairs currently loaded. If
   * {@link Stork#loaded} is true then all key-value pairs exist in
   * the cache.
   *
   * @type {FastMap}
   */
  this.cache = new FastMap();

  /**
   * An array of functions called by the user before this instances
   * was finished initializing. Once this instance successfully finishes
   * initialization all pending functions are invoked in the order
   * in which they were originally made and this property is set to
   * `null`.
   *
   * @type {Object[]}
   */
  this.pending = [];

  /**
   * True if this instance has successfully initialized, otherwise
   * false if it failed to initialize or has not finished initializing.
   *
   * @type {Boolean}
   */
  this.initialized = false;

  /**
   * True if the entire instance has been loaded into the
   * {@link Stork#cache}, otherwise false. If lazy is specifed as true
   * loaded will be false until any of the following methods are
   * invoked: {@link Stork#each}, {@link Stork#all}, or
   * {@link Stork#reload}.
   *
   * @type {Boolean}
   */
  this.loaded = false;

  /**
   * The adapter `Object` with `String` name, `Number` priority, and
   * `Object` definition properties. The adapter can be chosen based
   * on the `options.adapter` and falls back to the next supported
   * adapter based on priority.
   *
   * @type {Object}
   */
  this.adapter = getAdapter( options.adapter );

  // Copy the chosen adapter methods into this instance.
  copy( this.adapter.definition, this );

  // Call each plugin on this instance before initialization starts.
  for (var i = 0; i < Stork.plugins.length; i++)
  {
    Stork.plugins[ i ]( this );
  }

  // Start initializaing this instance.
  this.initializing = this.init( this.options, success, failure );
}

Stork.prototype =
{

  /**
   * Decodes a key from a string.
   *
   * @method decode
   * @param {String} rawKey
   *        The string to decode into a key.
   * @return {Any}
   */
  decode: fromJson,

  /**
   * Encodes a key into a string.
   *
   * @method encode
   * @param {Any} key
   *        The key to encode to a string.
   * @return {String}
   */
  encode: toJson,

  /**
   * Returns true if this Stork is not ready for storage calls and queues
   * the method and arguments to be called after this Stork is initialized.
   *
   * @private
   * @param  {function} method
   *         The reference to the calling function
   * @param  {Arguments} args
   *         The arguments of the calling function
   * @param  {Stork.Promise} promise
   *         The promise to notify when the function is finally called.
   * @return {Boolean} -
   *         Returns true if the calling function should return this
   *         immediately because the implementation isn't initialized yet.
   */
  handlePending: function(method, args, promise)
  {
    var handled = !this.initialized;

    if (handled)
    {
      this.pending.push(
      {
        method: method,
        arguments: Array.prototype.slice.call( args ),
        promise: promise

      });

      if ( promise )
      {
        promise.$reset();
      }
    }

    return handled;
  },

  /**
   * Marks the Stork as initialized and executes any pending functions.
   *
   * @private
   * @param  {Stork.Promise} promise
   *         The promise for {@link Stork#init} or {@link Stork#reload}.
   * @return {Stork} -
   *         A reference to this.
   */
  finishInitialization: function(promise, args)
  {
    if (!this.initialized)
    {
      this.initialized = true;

      promise.$success( args );

      for (var i = 0; i < this.pending.length; i++)
      {
        var pending = this.pending[ i ];
        var newPromise = pending.method.apply( this, pending.arguments );

        if ( pending.promise )
        {
          pending.promise.$bindTo( newPromise );
        }
      }

      this.pending = null;
    }

    return this;
  },

  /**
   * Finishes the reload function passing the now cached values and keys
   * to the success callbacks.
   *
   * @private
   * @param  {Stock.Promise} promise
   *         The promise for the {@link Stork#reload} invocation.
   */
  finishReload: function(promise)
  {
    if ( promise.$pending() )
    {
      var cache = this.cache;

      if ( this.initialized )
      {
        promise.$success( [cache.values, cache.okeys] );
      }
      else
      {
        this.finishInitialization( promise, [cache.values, cache.okeys] );
      }
    }
  },

  /**
   * Determines whether this Stork implementation is available.
   *
   * @return {Boolean} True if this Stork is usable, otherwise false.
   */
  valid: function()
  {
    throw 'Stork.valid is not implemented';
  },

  /**
   * The format of success callback for {@link Stork#init}.
   *
   * @callback Stork~initSuccess
   * @param {Stork} stork
   *        The reference to this Stork instance.
   */

  /**
   * The format of failure callback for {@link Stork#init}.
   *
   * @callback Stork~initFailure
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Initializes this Stork instance. If `options.lazy` is passed in as true,
   * key-value pairs will not be loaded here, otherwise all key-value
   * pairs will be loaded. This function is automatically called at the end
   * of the Stork constructor with the options passed to the constructor.
   *
   * @param  {Object} options
   *         The initialization options.
   * @param  {Stork~initSuccess} [success]
   *         The function to invoke when the Stork instance successfully
   *         initializes and is usable.
   * @param  {Stork~initFailure} [failure]
   *         The function to invoke if there's a problem initializing.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  init: function(options, success, failure)
  {
    throw 'Stork.init is not implemented';
  },

  /**
   * The format of success callback for {@link Stork#reload}.
   *
   * @callback Stork~reloadSuccess
   * @param {Array} values
   *        An array of all values loaded. This should not be modified.
   * @param {Array} keys
   *        An array of all keys loaded. This should not be modified.
   */

  /**
   * The format of failure callback for {@link Stork#reload}.
   *
   * @callback Stork~reloadFailure
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Loads all key-value pairs into the cache which will increase performance
   * for fetching operations ({@link Stork#get}, {@link Stork#getMany},
   * {@link Stork#each}, {@link Stork#all}).
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function(values, keys) {
   *   // handle success
   * };
   * var onFailureFunc = function(error) {
   *   // uh oh!
   * };
   * db.reload(); // I don't care about whether it succeeds or fails
   * db.reload( onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.reload().then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @param  {Stork~reloadSuccess} [success]
   *         The function to invoke when all key-value pairs are loaded.
   * @param  {Stork~reloadFailure} [failure]
   *         The function to invoke if there was a problem loading all key-value
   *         pairs.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  reload: function(success, failure)
  {
    throw 'Stork.reload is not implemented';
  },

  /**
   * A helper method for creating a consistent look when chaining promised
   * functions.
   *
   * *Usage*
   * ```javascript
   * db.then(function() { // <--
   *     // this === db, how big is it?
   *     return this.size();
   *   })
   *   .then(function(size) {
   *     // size has been determined, destroy!
   *     return this.destroy();
   *   })
   *   .then(function(){
   *     // You sunk my battleship! (destroyed db)
   *   })
   * ;
   * ```
   *
   * @param  {function} callback
   *         The callback to invoke with this Stork instance as `this`.
   * @return {Stork.Promise} -
   *         The callback should return a Promise to chain additional functions.
   */
  then: function(callback)
  {
    return callback.apply( this );
  },

  /**
   * The format of success callback for {@link Stork#getMany}.
   *
   * @callback Stork~getManySuccess
   * @param {Array} values
   *        The array of values associated to the given keys. If a key wasn't
   *        found then the value in the array will be `undefined`.
   */

  /**
   * The format of failure callback for {@link Stork#getMany}.
   *
   * @callback Stork~getManyFailure
   * @param {Array} keys
   *        The keys given that resulted in an error.
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Gets an array of values given an array of keys and returns it to the
   * callback. If the key doesn't exist then the corresponding value in the
   * returned array will be `undefined`.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function(values, keys) {
   *   // handle success
   * };
   * var onFailureFunc = function(keys, error) {
   *   // uh oh!
   * };
   * db.getMany( arrayOfKeys, onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.getMany( arrayOfKeys ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @param  {Array} keys
   *         The keys of the key-value pairs to get.
   * @param  {Stork~getManySuccess} [success]
   *         THe function to invoke with the values found.
   * @param  {Stork~getManyFailure} [failure]
   *         The function to invoke if there was a problem getting values.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  getMany: function(keys, success, failure)
  {
    var promise = Promise.Group( keys.length, this, success, failure );

    if ( this.handlePending( this.getMany, arguments, promise ) )
    {
      return promise;
    }

    var values = [];

    var addValue = function(i)
    {
      return function(value)
      {
        values[ i ] = value;

        promise.$success( [values, keys] );
      };
    };
    var onFailure = function(e)
    {
      promise.$failure( [keys, e] );
    };

    for (var i = 0; i < keys.length; i++)
    {
      this.get( keys[ i ], addValue( i ), onFailure );
    }

    return promise;
  },

  /**
   * The format of success callback for {@link Stork#get}.
   *
   * @callback Stork~getSuccess
   * @param {Any} value
   *        The value associated to the given key or `undefined` if one was not
   *        found.
   * @param {Any} key
   *        The key of the key-value pair that was successfully found.
   */

  /**
   * The format of failure callback for {@link Stork#get}.
   *
   * @callback Stork~getFailure
   * @param {Any} key
   *        The key of the key-value pair that was unsuccessfully gotten.
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Gets the value for the given key and returns it to the callback. If the
   * key doesn't exist then `undefined` is given to the callback.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function(value, key) {
   *   // handle success
   * };
   * var onFailureFunc = function(key, error) {
   *   // uh oh!
   * };
   * db.get( key, onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.get( key ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @param  {Any} key
   *         The key of the key-value pair to get.
   * @param  {Stork~getSuccess} [success]
   *         The function to invoke if a value is successfully found or not found.
   * @param  {Stork~getFailure} [failure]
   *         The function to invoke if there was a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  get: function (key, success, failure)
  {
    var promise = new Promise( this, success, failure );

    if ( this.handlePending( this.get, arguments, promise ) )
    {
      return promise;
    }

    var rawKey;

    try
    {
      rawKey = this.encode( key );
    }
    catch (e)
    {
      promise.$failure( [key, e] );
    }

    if ( promise.$pending() )
    {
      if ( this.cache.has( rawKey ) )
      {
        promise.$success( [this.cache.get( rawKey ), key] );
      }
      else if ( this.loaded )
      {
        promise.$success( [undefined, key] );
      }
      else
      {
        this._get( key, rawKey, promise );
      }
    }

    return promise;
  },

  _get: function(key, rawKey, promise)
  {
    throw 'Stork._get is not implemented';
  },

  /**
   * The format of success callback for {@link Stork#destroy}.
   *
   * @callback Stork~destroySuccess
   */

  /**
   * The format of failure callback for {@link Stork#destroy}.
   *
   * @callback Stork~destroyFailure
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Removes all key-value pairs and invokes the callback.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function() {
   *   // DESTROYED!
   * };
   * var onFailureFunc = function(error) {
   *   // uh oh!
   * };
   * db.destroy(); // I don't care about whether it succeeds or fails
   * db.destroy( onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.destroy().then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @param  {Stork~destroySuccess} [success]
   *         The function invoked when all key-value pairs are removed.
   * @param  {Stork~destroyFailure} [failure]
   *         The function invoked if there was a problem removing all key-value
   *         pairs.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  destroy: function(success, failure)
  {
    var promise = new Promise( this, success, failure );

    if ( this.handlePending( this.destroy, arguments, promise ) )
    {
      return promise;
    }

    this._destroy( promise );

    return promise;
  },

  _destroy: function(promise)
  {
    throw 'Stork._destroy is not implemented';
  },



  /**
   * The format of success callback for {@link Stork#reset}.
   *
   * @callback Stork~resetSuccess
   * @param {Any[]} keys
   *        The array of keys to reset.
   * @param {Any[]} values
   *        The array of values to reset.
   */

  /**
   * The format of failure callback for {@link Stork#reset}.
   *
   * @callback Stork~resetFailure
   * @param {Any[]} keys
   *        The array of keys to reset.
   * @param {Any[]} values
   *        The array of values to reset.
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Resets the key-value pairs. This is equivalent to destroying and running
   * a batch save on all the key-value pairs. Once reset the callback is
   * invoked.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function() {
   *   // DESTROYED!
   * };
   * var onFailureFunc = function(error) {
   *   // uh oh!
   * };
   * db.reset([3], ['value']); // I don't care about whether it succeeds or fails
   * db.reset([3], ['value'], onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.reset([3], ['value']).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @param {Any[]} keys
   *         The array of keys to reset.
   * @param {Any[]} values
   *         The array of values to reset.
   * @param  {Stork~resetSuccess} [success]
   *         The function invoked when all key-value pairs are Reset.
   * @param  {Stork~resetFailure} [failure]
   *         The function invoked if there was a problem reseting all key-value
   *         pairs.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  reset: function(keys, values, success, failure)
  {
    var promise = this._resetPromise( keys, values, success, failure );

    if ( this.handlePending( this.reset, arguments, promise ) )
    {
      return promise;
    }

    var rawKeys = [], rawValues = [];

    try
    {
      for (var i = 0; i < values.length; i++)
      {
        rawKeys[ i ] = this.encode( keys[ i ] );
        rawValues[ i ] = toJson( values[ i ] );
      }
    }
    catch (e)
    {
      promise.$failure( [keys, values, e] );
    }

    if ( promise.$pending() )
    {
      this._reset( keys, values, rawKeys, rawValues, promise );
    }

    return promise;
  },

  _resetPromise: function(keys, values, success, failure)
  {
    return Promise.Group( values.length, this, success, failure );
  },

  _reset: function(keys, values, rawKeys, rawValues, promise)
  {
    var onSaved = function()
    {
      promise.$success( [keys, values] );
    };
    var setFailure = function(e)
    {
      promise.$failure( [keys, values, e] );
    };
    var onDestroyed = function()
    {
      for (var i = 0; i < values.length && !promise.state; i++)
      {
        var valuePromise = new Promise( this, onSaved, setFailure );

        this._put( keys[ i ], values[ i ], rawKeys[ i ], rawValues[ i ], valuePromise );
      }
    };

    this.destroy( onDestroyed, setFailure );
  },

  /**
   * The format of success callback for {@link Stork#save}.
   *
   * @callback Stork~saveSuccess
   * @param {Object} record
   *        The record that successfully saved.
   */

  /**
   * The format of failure callback for {@link Stork#save}.
   *
   * @callback Stork~saveFailure
   * @param {Object} record
   *        The record that failed to save.
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Saves an `Object` record and returns the saved record to the callback. The
   * record is the value in the key-value pair and the key is pulled from the
   * record based on the options passed into the {@link Stork#init} function.
   * The property used as the key is `this.key` and by default is `id`. If a key
   * isn't specified in a record then a UUID is used and placed in the object.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function(record) {
   *   // handle success
   * };
   * var onFailureFunc = function(record, error) {
   *   // uh oh!
   * };
   * db.save( record ); // I don't care about whether it succeeds or fails
   * db.save( record, onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.save( record ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @param  {Object} record
   *         The record to save.
   * @param  {Stork~saveSuccess} [success]
   *         The function to invoke when the record is successfully saved.
   * @param  {Stork~saveFailure} [failure]
   *         The function to invoke if the record fails to save.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  save: function(record, success, failure)
  {
    var promise = new Promise( this, success, failure );

    if ( this.handlePending( this.save, arguments, promise ) )
    {
      return promise;
    }

    var keyName = this.key;
    var key = record[ keyName ];

    if ( undef( key ) )
    {
      key = record[ keyName ] = uuid();
    }

    var onSuccess = function(key, value)
    {
      promise.$success( [value] );
    };
    var onFailure = function(key, value, error)
    {
      promise.$failure( [value, error] );
    };

    this.put( key, record, onSuccess, onFailure );

    return promise;
  },

  /**
   * The format of success callback for {@link Stork#batch}.
   *
   * @callback Stork~batchSuccess
   * @param {Array} records
   *        The records successfully saved.
   */

  /**
   * The format of failure callback for {@link Stork#batch}.
   *
   * @callback Stork~batchFailure
   * @param {Array} records
   *        The records unsuccessfully saved.
   * @param {Number} recordsSaved
   *        The number of records that successfully saved.
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Saves an array of `Object` records and returns the records saved to the
   * callback. The record is the value in the key-value pair and the key is
   * pulled from the record based on the options passed into the
   * {@link Stork#init} function. The property used as the key is `this.key` and
   * by default is `id`. If a key isn't specified in a record then a UUID is
   * used and placed in the object.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function(records) {
   *   // handle success
   * };
   * var onFailureFunc = function(records, recordsSaved, error) {
   *   // uh oh!
   * };
   * db.batch( records ); // I don't care about whether it succeeds or fails
   * db.batch( records, onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.batch( records ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @param  {Array} records
   *         The array of objects to save.
   * @param  {Stork~batchSuccess} [success]
   *         The function to invoke when all records are successfully saved.
   * @param  {Stork~batchFailure} [failure]
   *         The function to invoke if any of the records failed to save.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  batch: function(records, success, failure)
  {
    var promise = Promise.Group( records.length, this, success, failure );

    if ( this.handlePending( this.batch, arguments, promise ) )
    {
      return promise;
    }

    var onSaved = function()
    {
      promise.$success( [records] );
    };
    var setFailure = function(e)
    {
      promise.$failure( [records, saves, e] );
    };

    for (var i = 0; i < records.length && !promise.state; i++)
    {
      this.save( records[ i ], onSaved, setFailure );
    }

    return promise;
  },

  /**
   * The format of success callback for {@link Stork#put}.
   *
   * @callback Stork~putSuccess
   * @param {Any} key
   *        The key to add or update.
   * @param {Any} value
   *        The value to add or update.
   * @param {Any} previousValue
   *        The previous value for the key if it exists in the cache.
   */

  /**
   * The format of failure callback for {@link Stork#put}.
   *
   * @callback Stork~putFailure
   * @param {Any} key
   *        The key that failed to be added or updated.
   * @param {Any} value
   *        The value that failed to be added or updated.
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Adds or updates the value mapped by the given key and returns the key
   * and value placed to the callback.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function(key, value, previousValue) {
   *   // handle success
   * };
   * var onFailureFunc = function(key, value, error) {
   *   // uh oh!
   * };
   * db.put( key, value ); // I don't care about whether it succeeds or fails
   * db.put( key, value, onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.put( key, value ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @param  {Any} key
   *         The key to add or update.
   * @param  {Any} value
   *         The value to add or update.
   * @param  {Stork~putSuccess} [success]
   *         The function to invoke when the key-value pair is successfully
   *         added or updated.
   * @param  {Stork~putFailure} [failure]
   *         The function to invoke if there was a problem putting the key-value
   *         pair.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  put: function(key, value, success, failure)
  {
    var promise = new Promise( this, success, failure );

    if ( this.handlePending( this.put, arguments, promise ) )
    {
      return promise;
    }

    var rawKey, rawValue;

    try
    {
      rawKey = this.encode( key );
      rawValue = toJson( value );
    }
    catch (e)
    {
      promise.$failure( [key, value, e] );
    }

    if ( promise.$pending() )
    {
      this._put( key, value, rawKey, rawValue, promise );
    }

    return promise;
  },

  _put: function(key, value, rawKey, rawValue, promise)
  {
    throw 'Stork._put is not implemented';
  },

  /**
   * The format of success callback for {@link Stork#remove}.
   *
   * @callback Stork~removeSuccess
   * @param {Any} value
   *        The value removed or `undefined` if the key didn't exist.
   * @param {Any} key
   *        The key of the key-value pair that was removed.
   */

  /**
   * The format of failure callback for {@link Stork#remove}.
   *
   * @callback Stork~removeFailure
   * @param {Any} key
   *        The key of the key-value pair that failed to be removed.
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Removes the key-value pair for the given key and returns the removed value
   * to the callback if on existed.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function(value, key) {
   *   // handle success
   * };
   * var onFailureFunc = function(key, error) {
   *   // uh oh!
   * };
   * db.remove( key ); // I don't care about whether it succeeds or fails
   * db.remove( key, onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.remove( key ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @param  {Any} key
   *         The key of the key-value pair to remove.
   * @param  {Stork~removeSuccess} [success]
   *         The function to invoke then the key is removed or doesn't exist.
   * @param  {Stork~removeFailure} [failure]
   *         The function to invoke if there was a problem removing the key.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  remove: function(key, success, failure)
  {
    var promise = new Promise( this, success, failure );

    if ( this.handlePending( this.remove, arguments, promise ) )
    {
      return promise;
    }

    var rawKey;

    try
    {
      rawKey = this.encode( key );
    }
    catch (e)
    {
      promise.$failure( [key, e] );
    }

    if ( promise.$pending() )
    {
      if ( this.loaded && !this.cache.has( rawKey ) )
      {
        promise.$success( [undefined, key] );
      }
      else
      {
        var value = this.cache.get( rawKey );

        this._remove( key, rawKey, value, promise );
      }
    }

    return promise;
  },

  _remove: function(key, rawKey, value, promise)
  {
    throw 'Stork._remove is not implemented';
  },

  /**
   * The format of success callback for {@link Stork#removeMany}.
   *
   * @callback Stork~removeManySuccess
   * @param {Array} values
   *        The values removed in the same order of the keys. If a key didn't
   *        exist then the corresponding value in the array will be `undefined`.
   * @param {Array} keys
   *        The corresponding removed keys.
   */

  /**
   * The format of failure callback for {@link Stork#removeMany}.
   *
   * @callback Stork~removeManyFailure
   * @param {Array} values
   *        The values removed in the same order of the given keys.
   * @param {Number} removed
   *        The number of records removed before the error occurred.
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Removes multiple key-value pairs and returns the values removed to the
   * given callback.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function(values, keys) {
   *   // handle success
   * };
   * var onFailureFunc = function(values, removed, error) {
   *   // uh oh!
   * };
   * db.removeMany( keys ); // I don't care about whether it succeeds or fails
   * db.removeMany( keys, onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.removeMany( keys ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @param  {Array} keys
   *         The array of keys to remove.
   * @param  {Stork~removeManySuccess} [success]
   *         The function to invoke once all matching key-value pairs are
   *         removed, with the values removed.
   * @param  {Stork~removeManyFailure} [failure]
   *         The function to invoke if there was a problem removing any of the
   *         key-value pairs.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  removeMany: function(keys, success, failure)
  {
    var promise = Promise.Group( keys.length, this, success, failure );

    if ( this.handlePending( this.removeMany, arguments, promise ) )
    {
      return promise;
    }

    var values = [];
    var removed = 0;

    var addValue = function(i)
    {
      return function(value)
      {
        values[ i ] = value;
        removed++;

        promise.$success( [values, keys] );
      };
    };
    var setFailure = function(e)
    {
      promise.$failure( [values, removed, e] );
    };

    for (var i = 0; i < keys.length; i++)
    {
      this.remove( keys[ i ], addValue( i ), setFailure )
    }

    return promise;
  },

  /**
   * The format of success callback for {@link Stork#each}.
   *
   * @callback Stork~eachSuccess
   * @param {Any} value
   *        The value of the current key-value pair.
   * @param {Any} key
   *        The key of the current key-value pair.
   */

  /**
   * The format of failure callback for {@link Stork#each}.
   *
   * @callback Stork~eachFailure
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Returns every key-value pair individually to the given callback.
   *
   * *Usage*
   * ```javascript
   * var onPairFunc = function(value, key) {
   *   // handle success
   * };
   * var onFailureFunc = function(error) {
   *   // uh oh!
   * };
   * db.each( onPairFunc ); // I don't care about whether it fails
   * db.each( onPairFunc, onFailureFunc ); // listen for success & failure
   * ```
   *
   * @param  {Stork~eachSuccess} callback
   *         The function to invoke for each key-value pair.
   * @param  {Stork~eachFailure} [failure]
   *         The function to invoke if there was a problem iterating the
   *         key-value pairs.
   * @return {Stork} -
   *         The reference to this Stork instance.
   */
  each: function(callback, failure)
  {
    if ( !isFunc( callback ) || this.handlePending( this.each, arguments ) )
    {
      return this;
    }

    var stork = this;
    var iterate = function(values, keys)
    {
      for (var i = 0; i < values.length; i++)
      {
        callback.call( stork, values[ i ], keys[ i ] );
      }
    };

    if ( this.loaded )
    {
      var keys = this.cache.okeys;
      var values = this.cache.values;

      iterate( values, keys );
    }
    else
    {
      this.reload( iterate, failure );
    }

    return this;
  },

  /**
   * The format of success callback for {@link Stork#size}.
   *
   * @callback Stork~sizeSuccess
   * @param {Number} count
   *        The total number of key-value pairs.
   */

  /**
   * The format of failure callback for {@link Stork#size}.
   *
   * @callback Stork~sizeFailure
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Returns the number of key-value pairs to the success callback.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function(count) {
   *   // handle success
   * };
   * var onFailureFunc = function(error) {
   *   // uh oh!
   * };
   * db.size( onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.size().then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @param  {Stork~sizeSuccess} [success]
   *         The function to invoke with the number of key-value pairs.
   * @param  {Stork~sizeFailure} [failure]
   *         The function to invoke if there was a problem determining the
   *         number of key-value pairs.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  size: function(success, failure)
  {
    var promise = new Promise( this, success, failure );

    if ( this.handlePending( this.size, arguments, promise ) )
    {
      return promise;
    }

    if ( this.loaded )
    {
      promise.$success( [this.cache.size()] );
    }
    else
    {
      this._size( promise );
    }

    return promise;
  },

  _size: function(promise)
  {
    throw 'Stork._size is not implemented';
  },

  /**
   * The format of success callback for {@link Stork#all}.
   *
   * @callback Stork~allSuccess
   * @param {Array} values
   *        An array of all values stored. This should not be modified.
   * @param {Array} keys
   *        An array of all keys stored. This should not be modified.
   */

  /**
   * The format of failure callback for {@link Stork#all}.
   *
   * @callback Stork~allFailure
   * @param {Any} error
   *        The error that was thrown.
   */

  /**
   * Returns all key-value pairs to the success callback.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function(values, keys) {
   *   // handle success
   * };
   * var onFailureFunc = function(error) {
   *   // uh oh!
   * };
   * db.all( onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.all().then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @param  {Stork~allSuccess} [success]
   *         The function to invoke with all the key-value pairs.
   * @param  {Stork~allFailure} [failure]
   *         The function to invoke if this Stork was unable to return all of the key-value pairs.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  all: function(success, failure)
  {
    var promise = new Promise( this, success, failure );

    if ( this.handlePending( this.all, arguments, promise ) )
    {
      return promise;
    }

    var returnAll = function(values, keys)
    {
      promise.$success( [values, keys] );
    };
    var onFailure = function(error)
    {
      promise.$failure( [error] );
    };

    if ( this.loaded )
    {
      var keys = this.cache.okeys;
      var values = this.cache.values;

      returnAll( values, keys );
    }
    else
    {
      this.reload( returnAll, onFailure );
    }

    return promise;
  }

};
