'use strict';

// UMD (Universal Module Definition)
(function (root, factory)
{
  if (typeof define === 'function' && define.amd) // jshint ignore:line
  {
    // AMD. Register as an anonymous module.
    define('storkjs', [], function() { // jshint ignore:line
      return factory(root);
    });
  }
  else if (typeof module === 'object' && module.exports)  // jshint ignore:line
  {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(global);  // jshint ignore:line
  }
  else
  {
    // Browser globals (root is window)
    root.Stork = factory(root);
  }
}(this, function(global, undefined)
{

var toJson = JSON.stringify;

var fromJson = JSON.parse;

function isFunc(x)
{
  return !!(x && x.constructor && x.call && x.apply);
}

function isObject(x)
{
  return typeof x === 'object' && x !== null;
}

function isNumber(x)
{
  return typeof x === 'number' && !isNaN(x);
}

function isArray(x)
{
  return x instanceof Array;
}

function isString(x)
{
  return typeof x === 'string';
}

function undef(x)
{
  return typeof x === 'undefined';
}

function def(x)
{
  return typeof x !== 'undefined';
}

function replaceArray(dest, src)
{
  dest.length = 0;
  dest.push.apply( dest, src );
}

function coalesce(a, b, c, d)
{
  if (def(a)) return a;
  if (def(b)) return b;
  if (def(c)) return c;
  return d;
}

function swap(arr, i, j)
{
  var temp = arr[i]; 
  arr[i] = arr[j]; 
  arr[j] = temp;
}

function noop()
{
}

function fn(func)
{
  return isFunc( func ) ? func : noop;
}

function fncoalesce(a, b)
{
  return isFunc( a ) ? a : (isFunc(b) ? b : noop);
}

function copy(from, to)
{
  for (var prop in from)
  {
    to[ prop ] = from[ prop ];
  }

  return to;
}

function S4() 
{
  return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}

function uuid() 
{
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

function compareAdapters(a, b)
{
  var d = b.priority - a.priority;

  return d === 0 ? 0 : (d < 0 ? -1 : 1);
}

function $promise(methodName, func)
{
  return function()
  {
    var promise = new Promise( this, success, failure );

    if ( this.handlePending( this[ methodName ], arguments, promise ) ) 
    {
      return promise;
    }

    var args = Array.prototype.slice.call( arguments );
    args.pop(); // remove failure
    args.pop(); // remove success
    args.push( promise ); // add promise

    // Call the wrapped function
    func.apply( this, args );

    return promise;
  };
}

function getAdapter(adapterName)
{
  if ( adapterName )
  {
    for (var i = 0; i < Stork.adapters.length; i++) 
    {
      var adapt = Stork.adapters[i];

      if ( adapt.name === adapterName && adapt.definition.valid() )
      {
        return adapt;
      }
    }
  }

  if ( !getAdapter.chosen ) 
  {
    Stork.adapters.sort( compareAdapters );

    for (var i = 0; i < Stork.adapters.length; i++) 
    {
      var adapt = Stork.adapters[i];

      if ( adapt.definition.valid() )
      {
        return getAdapter.chosen = adapt;
      }
    }
  }

  return getAdapter.chosen;
}


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


/**
 * Instantiates a new Promise. 
 *
 * @constructor
 * @memberOf Stork
 * @param {Object} context
 *        The `this` to apply to the success, failure, and error callbacks.
 * @param {function} [success]
 *        A success callback to add to be invoked.
 * @param {function} [failure]
 *        A failure callback to add to be invoked.
 * @param {Stork.Promise} [root]
 *        The root promise, if one exists.
 */
function Promise(context, success, failure, root)
{
  /**
   * The `this` to apply to the callbacks.
   * 
   * @type {Object}
   */
  this.context = context;

  /**
   * The root promise in the chain of promises.
   * 
   * @type {Promise}
   */
  this.root = root || this;

  /**
   * The next promise in the chain of promises.
   * 
   * @type {Promise}
   */
  this.next = null;

  /**
   * The first valid promise returned from a success callback.
   * @private
   * 
   * @type {Promise}
   */
  this.nextPromise = null;

  /**
   * The current state of this promise.
   * 
   * @type {Number}
   * @default Promise.PENDING
   */
  this.state = Promise.PENDING;

  /**
   * An array of success callbacks to invoke when the promise is marked as
   * successful.
   * 
   * @type {function[]}
   */
  this.successes = [];

  /**
   * An array of failure callbacks to invoke when the promise is marked as
   * failed.
   * 
   * @type {function[]}
   */
  this.failures = [];

  /**
   * An array of error callbacks stored at the root promise.
   * 
   * @type {function[]}
   */
  this.errors = [];

  /**
   * An array of arguments that are to be passed to the success or failure 
   * callbacks.
   * 
   * @type {Array}
   */
  this.args = null;

  /**
   * Whether this promise should look at the result of the failure callbacks 
   * for a promise to bind to and continue the chain.
   * 
   * @type {boolean}
   */
  this.chainFailureResult = false;

  // Queue the passed in success & failure callbacks.
  this.$queue( success, failure );
}

/**
 * Promise is awaiting for a success or failure notification.
 * @type {Number}
 */
Promise.PENDING = 0;

/**
 * Promise has been marked as a failure.
 * @type {Number}
 */
Promise.FAILURE = 1;

/**
 * Promise has been marked as a success.
 * @type {Number}
 */
Promise.SUCCESS = 2;

/**
 * Promise has been marked as a success and the next promise has been notified.
 * @type {Number}
 */
Promise.CHAINED = 3;


Promise.prototype = 
{
  /**
   * Adds success and optionally a failure callback to be invoked when the 
   * promised operation completes. The success callback can return a promise 
   * to chain promises.
   * 
   * @param  {function} success
   *         The function to invoke with the success arguments.
   * @param  {function} [failure]
   *         The function to invoke with the failure arguments.
   * @return {Stork.Promise} -
   *         The next promise to invoke when the returned promise from the 
   *         success callback finishes.
   */
  then: function(success, failure)
  {
    this.$queue( success, failure );  

    if ( !this.next )
    {
      this.next = new Promise( this.context, undefined, undefined, this );
    }
   
    if ( this.state & Promise.SUCCESS ) 
    {
      this.$handleSuccesses();
    } 
    else if ( this.state === Promise.FAILURE ) 
    {
      this.$handleFailures();
    }

    return this.next;
  },

  /**
   * Adds a callback to be invoked when either a success or failure occurs on
   * this promise. If a promise is returned by the callback - once that promise
   * completes the next promise will be processed on either success or failure.
   * 
   * @param  {function} complete
   *         The function to invoke when either a success or a failure occurs.
   * @return {Stork.Promise} - 
   *         The next promise to invoke when the returned promise from the
   *         success callback finishes.
   */
  either: function(complete)
  {
    this.chainFailureResult = true;

    return this.then( complete, complete );
  },

  /**
   * Adds a generic error to be called if any of the promises in the chain have
   * failed.
   * 
   * @param  {function} error
   *         A function to invoke if any of the promises fail.
   * @return {Stork.Promise} -
   *         A reference to this promise.
   */
  error: function(error)
  {
    if ( isFunc( error ) )
    {
      this.root.errors.push( error );

      if ( this.state === Promise.FAILURE )
      {
        this.$handleFailures();
      }  
    }

    return this;
  },

  // When the given promise finishes it will finish this promise as well.
  $bindTo: function(to, replacementArguments)
  {
    var from = this;

    to.then(
      function() {
        from.context = to.context;
        from.$success( coalesce( replacementArguments, to.args ) );
      },
      function() {
        from.context = to.context;
        from.$failure( coalesce( replacementArguments, to.args ) );
      })
    ;
  },

  // Returns true if the promise has yet to finish.
  $pending: function()
  {
    return this.state === Promise.PENDING;
  },

  // Adds a success and/or failure callback to this promise.
  $queue: function(success, failure)
  {
    if ( isFunc( success ) ) this.successes.push( success );
    if ( isFunc( failure ) ) this.failures.push( failure );
  },

  // Executes all successes currently on the promise.
  $handleSuccesses: function()
  {
    var succs = this.successes;
    for (var i = 0; i < succs.length; i++) 
    {
      var s = succs[ i ];
      var result = s.apply( this.context, this.args );

      if ( result instanceof Promise && !this.nextPromise ) 
      {
        this.nextPromise = result;
      }
    }

    succs.length = 0;

    this.$handleNext();
  },

  // If a next promise is given and one of the success callbacks return a 
  // promise, this promise is bound to the returned promise to complete the 
  // link in the chain.
  $handleNext: function()
  {
    var next = this.next;
    var returned = this.nextPromise;

    if (next && returned && (this.state === Promise.SUCCESS || (this.state === Promise.FAILURE && this.chainFailureResult)))
    {
      next.$bindTo( returned );

      this.state = Promise.CHAINED;
    }
  },

  // Marks this promise as a success if the promise hasn't finished yet.
  $success: function(args)
  {
    if ( this.state === Promise.PENDING ) 
    {
      this.args = args || [];
      this.state = Promise.SUCCESS;
      this.$handleSuccesses();
    }

    return this;
  },

  // Executes all failures currently on the promise.
  $handleFailures: function()
  {
    var fails = this.failures;
    for (var i = 0; i < fails.length; i++) 
    {
      var f = fails[ i ];
      var result = f.apply( this.context, this.args );

      if ( this.chainFailureResult && result instanceof Promise && !this.nextPromise )
      {
        this.nextPromise = result;
      }
    }

    fails.length = 0;

    var errors = this.root.errors;
    var errorArgument = [ this.args[ this.args.length - 1 ] ];

    for (var i = 0; i < errors.length; i++)
    {
      errors[ i ].apply( this.context, errorArgument );
    }

    errors.length = 0;

    this.$handleNext();
  },

  // Marks this promise as a failure if the promise hasn't finished yet.
  $failure: function(args)
  {
    if ( this.state === Promise.PENDING ) 
    {
      this.args = args || [];
      this.state = Promise.FAILURE;
      this.$handleFailures();
    }

    return this;
  },

  // Resets this promise removing all listeners
  $reset: function() 
  {
    this.state = Promise.PENDING;
    this.chainFailureResult = false;
    this.$clear();
    this.$stop();

    return this;
  },

  // Removes all listeners
  $clear: function()
  {
    this.successes.length = 0;
    this.failures.length = 0;
    this.errors.length = 0;

    return this;
  },

  // Stops any chained promises from getting called if they haven't been
  // called already.
  $stop: function()
  {
    this.next = null;
    this.nextPromise = null;

    return this;
  }

};



/**
 * Creates a Promise that has already successfully ran.
 * 
 * @param {Object} context
 *        The `this` to apply to the success, failure, and error callbacks.
 * @return {Stork.Promise}
 *         The promise created.
 */
Promise.Done = function(context)
{
  return new Promise( context ).$success();
};

/**
 * Creates a Promise that waits for a given number of success to be considered
 * a success, any failure will cause subsequent successes to be ignored.
 * 
 * @param {Number} groupSize
 *        The number of $success calls that need to be made for the promise to
 *        actually be considered a success.
 * @param {Object} context
 *        The `this` to apply to the success, failure, and error callbacks.
 * @param {function} [success]
 *        A success callback to add to be invoked.
 * @param {function} [failure]
 *        A failure callback to add to be invoked.
 */
Promise.Group = function(groupSize, context, success, failure)
{
  var group = new Promise( context, success, failure );
  var count = 0;
  var $success = group.$success;

  // Override it! Inefficient, but easiest for now.
  group.$success = function( args )
  {
    if ( this.state === Promise.PENDING )
    {
      if ( ++count === groupSize )
      {
        $success.call( group, args );
      }
    }
  };

  return group;
};

/**
 * A FastMap has the key-to-value benefits of a map and iteration benefits of an
 * array. This is especially beneficial when most of the time the contents of 
 * the structure need to be iterated and order doesn't matter (since removal 
 * performs a swap which breaks insertion order).
 *
 * @constructor
 * @memberOf Stork
 * @param {Stork.FastMap|object} [map]
 */
function FastMap(map)
{
  /**
   * An array of the values in this map.
   * @member {Array}
   */
  this.values = [];

  /**
   * An array of the keys in this map.
   * @type {Array}
   */
  this.keys = [];

  /**
   * An array of the original keys in this map.
   * @type {Array}
   */
  this.okeys = [];

  /**
   * An object of key to index mappings.
   * @type {Object}
   */
  this.indices = {};

  // If another map is given to populate this map, do it!
  this.putMap( map );
}

FastMap.prototype =
{

  /**
   * Resets the map by initializing the values, keys, and indexes.
   * 
   * @return {Stork.FastMap}
   */
  reset: function()
  {
    this.values.length = 0;
    this.keys.length = 0;
    this.okeys.length = 0;
    this.indices = {};

    return this;
  },

  /**
   * Puts the value in the map by the given key.
   *
   * @param {String} key
   * @param {V} value
   * @param {K} originalKey
   * @return {Stork.FastMap}
   */
  put: function(key, value, originalKey)
  {
    if ( key in this.indices )
    {
      this.values[ this.indices[ key ] ] = value;
    }
    else
    {
      this.indices[ key ] = this.values.length;
      this.values.push( value );
      this.keys.push( key );
      this.okeys.push( originalKey );
    }

    return this;
  },

  /**
   * Puts all keys & values on the given map into this map overwriting any existing values mapped by similar keys.
   *
   * @param {FastMap|Object} map
   * @return {Stork.FastMap}
   */
  putMap: function(map)
  {
    if (map instanceof FastMap)
    {
      var keys = map.keys;
      var values = map.values;
      var okeys = map.okeys;

      for (var i = 0; i < keys.length; i++)
      {
        this.put( keys[ i ], values[ i ], okeys[ i ] );
      }
    }
    else if ( isObject( map ) )
    {
      for (var key in map)
      {
        this.put( key, map[ key ], key );
      }
    }

    return this;
  },

  /**
   * Returns the value mapped by the given key.
   *
   * @param {String} key
   * @return {V}
   */
  get: function(key)
  {
    return this.values[ this.indices[ key ] ];
  },

  /**
   * Removes the value by a given key
   *
   * @param {String} key
   * @return {Stork.FastMap}
   */
  remove: function(key)
  {
    var index = this.indices[ key ];

    if ( isNumber( index ) )
    {
      this.removeAt( index );
    }

    return this;
  },

  /**
   * Overwrites this map with another map.
   * 
   * @param  {Stork.FastMap} map
   * @return {Stork.FastMap}
   */
  overwrite: function(map)
  {
    replaceArray( this.values, map.values );
    replaceArray( this.keys, map.keys );
    replaceArray( this.okeys, map.okeys );

    this.rebuildIndex();

    return this;
  },

  /**
   * Removes the value & key at the given index.
   *
   * @param {Number} index
   * @return {Stork.FastMap}
   */
  removeAt: function(index)
  {
    var key = this.keys[ index ];
    var lastValue = this.values.pop();
    var lastKey = this.keys.pop();
    var lastOkey = this.okeys.pop();

    if ( index < this.values.length )
    {
      this.values[ index ] = lastValue;
      this.keys[ index ] = lastKey;
      this.okeys[ index ] = lastOkey; 
      this.indices[ lastKey ] = index;
    }

    delete this.indices[ key ];

    return this;
  },

  /**
   * Returns the index of the value in the array given a key.
   *
   * @param {String} key
   * @return {Number}
   */
  indexOf: function(key)
  {
    return coalesce( this.indices[ key ], -1 );
  },

  /**
   * Returns whether this map has a value for the given key.
   *
   * @param {String} key
   * @return {Boolean}
   */
  has: function(key)
  {
    return key in this.indices;
  },

  /**
   * Returns whether the given input has overlap with keys in this map.
   *
   * @param {FastMap|Object} map
   * @return {Boolean}
   */
  hasOverlap: function(map)
  {
    var keys = this.keys;
    var indices = map.indices;

    for (var i = 0; i < keys.length; i++)
    {
      if ( keys[i] in indices )
      {
        return true;
      }
    }
   
    return false;
  },

  /**
   * Returns the number of elements in the map.
   *
   * @return {Number}
   */
  size: function()
  {
    return this.values.length;
  },

  /**
   * Reverses the order of the underlying values & keys.
   * 
   * @return {Stork.FastMap} -
   *         The referense to this map.
   */
  reverse: function()
  {
    var max = this.size() - 1;
    var half = Math.ceil( max / 2 );

    for (var i = 0; i < half; i++)
    {
      swap( this.values, i, max - i );
      swap( this.keys, i, max - i );
      swap( this.okeys, i, max - i );
    }

    this.rebuildIndex();

    return this;
  },

  /**
   * Sorts the underlying values & keys given a value compare function.
   * 
   * @param  {function} comparator
   *         A function which accepts two values and returns a number used for
   *         sorting. If the first argument is less than the second argument, a
   *         negative number should be returned. If the arguments are equivalent
   *         then 0 should be returned, otherwise a positive number should be
   *         returned.
   * @return {Stork.FastMap} -
   *         The reference to this map.
   */
  sort: function(comparator)
  {
    var map = this;

    // Sort this partition!
    function partition(left, right)
    {
      var pivot = map.values[ Math.floor((right + left) / 2) ];
      var i = left;
      var j = right;

      while (i <= j) 
      {
        while (comparator( map.values[i], pivot ) < 0) i++
        while (comparator( map.values[j], pivot ) > 0) j--;

        if (i <= j) {
          swap( map.values, i, j );
          swap( map.keys, i, j );
          swap( map.okeys, i, j );
          i++;
          j--;
        }
      }

      return i;
    }

    // Quicksort
    function qsort(left, right)
    {
      var index = partition( left, right );

      if (left < index - 1) 
      {
        qsort( left, index - 1 );
      }

      if (index < right) 
      {
        qsort( index, right );
      }
    }

    var right = this.size() - 1;

    // Are there elements to sort?
    if ( right > 0 )
    {
      qsort( 0, right );

      this.rebuildIndex();
    }

    return this;
  },

  /**
   * Rebuilds the index based on the keys.
   * 
   * @return {Stork.FastMap} -
   *         The reference to this map.
   */
  rebuildIndex: function()
  {
    this.indices = {};

    for (var i = 0, l = this.keys.length; i < l; i++)
    {
      this.indices[ this.keys[ i ] ] = i;
    }

    return this;
  }

};

/**
 * An array of all plugin `function`s invoked on a Stork instance when it's created.
 * 
 * @type {Array}
 * @see {@link Stork.plugin}
 */
Stork.plugins = [];

/**
 * Adds a plugin function to be invoked on every Stork instance that's created.
 * Each plugin function is invoked after an adapter is chosen and integrated,
 * but before the {@link Stork#init} function is called.
 *
 * *Example*
 * ```javascript
 * Stork.plugin(function(stork) {
 *   var oldPut = stork.put;
 *   stork.put = function(key, value, success, failure) {
 *     // before put
 *     var promise = oldPut.apply( this, arguments );
 *     // after put, listen to promise?
 *     return promise;
 *   };
 * });
 * ```
 * 
 * @param  {Stork~plugin} definition 
 *         The function invoked on every Stork instance.
 * @return {Stork} -
 *         The Stork namespace.
 */
Stork.plugin = function(definition)
{
  if ( isFunc( definition ) ) 
  {
    Stork.plugins.push( definition ); 
  }

  return Stork;
};

/**
 * @callback Stork~plugin
 * @param {Stork} stork The Stork instance to run the plugin on.
 */

/**
 * An array of adapters available for implementing a Stork instance. Each item
 * in the array is an object with three properties: `String` name, `Number` 
 * priority, and `Object` definition.
 * 
 * @type {Array}
 * @see {@link Stork.adapter}
 */
Stork.adapters = [];

/**
 * Adds an adapter available for Stork to use if it's supported.
 *
 * *Example*
 * ```javascript
 * Stork.adapter('myadapter', 7, {
 *   valid: function() { ... },
 *   init: function(options, success, failure) { ... },
 *   reload: function(success, failure) { ... },
 *   _get: function(key, rawKey, promise) { ... },
 *   _destroy: function(promise) { ... },
 *   _put: function(key, value, rawKey, rawValue, promise) { ... },
 *   _remove: function(key, rawKey, value, promise) { ... },
 *   _size: function(promise) { ... }
 * });
 * ```
 * 
 * @param  {String} name       
 *         The name of the adapter. Must be unique.
 * @param  {Number} priority
 *         The priority of this adapter. The higher the value the earlier
 *         it's checked for support and is used by Stork instances.
 * @param  {function|Object} definition 
 *         The definition of the adapter which is either an object of methods 
 *         to overwrite for the Stork instance, or a function which returns a 
 *         similar object.
 * @return {Stork} - 
 *         The Stork namespace.
 */
Stork.adapter = function(name, priority, definition)
{
  Stork.adapters.push(
  {
    name: name,
    priority: priority,
    definition: isFunc( definition ) ? definition() : definition
  });

  return Stork;
};
Stork.plugin((function()
{

  /**
   * The format of success callback for aggregation functions.
   * 
   * @callback Stork~aggregateSuccess
   * @param {Number} aggregatedValue
   *        The result of the aggregation function.
   */

  /**
   * The format of failure callback for aggregation functions.
   * 
   * @callback Stork~aggregateFailure
   * @param {Any} error 
   *        The error that was thrown.
   */
  
  /**
   * The format of an accumulation callback for aggregation functions.
   *
   * @callback Stork~aggregateAccumulate
   * @param {Any} value
   *        The value to process for accumulation.
   */
  
  /**
   * The format of an accumulation callback for aggregation functions.
   *
   * @callback Stork~aggregateResult
   * @return {Any}
   *         The result of the accumulated values.
   */

  /**
   * Performs an aggregation on key-value pairs where the value is an `Object` 
   * which may have a specific property to aggregate. The result of the 
   * aggregation is returned to the callback.
   *
   * This is part of the aggregation plugin.
   * 
   * @memberOf Stork#
   * @param  {String} property
   *         The property on the object to pass to the accumulation function.
   * @param  {Stork~aggregateAccumulate} accumulate
   *         The function to invoke with the value of the property.
   * @param  {Stork~aggregateResult} getResult
   *         The function to call at the end to returned the aggregated value.
   * @param  {Stork~aggregateSuccess} [success]
   *         The function to invoke when a value is successfully aggregated.
   * @param  {Stork~aggregateSuccess} [failure]
   *         The function to invoke if there's a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function aggregate(property, accumulate, getResult, promise)
  {
    var onSuccess = function(values, keys)
    {
      var returnedValue = undefined;

      for (var i = 0; i < values.length; i++)
      {
        var v = values[ i ];

        if (isObject( v ) && property in v)
        {
          accumulate( v[ property ] );
        }
      }

      promise.$success( [ getResult() ] )
    };
    var onFailure = function(e)
    {
      promise.$failure( [e] );
    };

    this.all( onSuccess, onFailure );
  }

  /**
   * Returns the number of values that are objects and have the specified 
   * property to the callback.
   *
   * This is part of the aggregation plugin.
   *
   * *Usage*
   * ```javascript
   * db.count('name', function(count) {
   *   // count = the number of objects with the property 'name'
   * });
   * ```
   * 
   * @memberOf Stork#
   * @param  {String} property
   *         The property on the object to look for.
   * @param  {Stork~aggregateSuccess} [success]
   *         The function to invoke with the number of values with the property.
   * @param  {Stork~aggregateSuccess} [failure]
   *         The function to invoke if there's a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function count(property, promise)
  {
    var total = 0;

    var accumulate = function(v)
    {
      total++;
    };
    var getResult = function()
    {
      return total;
    };

    aggregate( property, accumulate, getResult, promise );
  }

  /**
   * Returns the sum of a set of values taken from a property on all `Object` 
   * values to the callback.
   *
   * This is part of the aggregation plugin.
   * 
   * *Usage*
   * ```javascript
   * db.sum('kills', function(sum) {
   *   // sum = total of all kills
   * });
   * ```
   * 
   * @memberOf Stork#
   * @param  {String} property
   *         The property on the object to sum.
   * @param  {Stork~aggregateSuccess} [success]
   *         The function to invoke with the sum.
   * @param  {Stork~aggregateSuccess} [failure]
   *         The function to invoke if there's a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function sum(property, promise)
  {
    var summing = 0;

    var accumulate = function(v)
    {
      if (isNumber(v))
      {
        summing += v;
      }
    };
    var getResult = function()
    {
      return summing;
    };

    aggregate( property, accumulate, getResult, promise );
  }


  /**
   * Returns the average of a set of values taken from a property on all `Object` 
   * values to the callback.
   *
   * This is part of the aggregation plugin.
   * 
   * *Usage*
   * ```javascript
   * db.avg('age', function(avg) {
   *   // avg = the average age
   * });
   * ```
   * 
   * @memberOf Stork#
   * @param  {String} property
   *         The property on the object to average.
   * @param  {Stork~aggregateSuccess} [success]
   *         The function to invoke with the average.
   * @param  {Stork~aggregateSuccess} [failure]
   *         The function to invoke if there's a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function avg(property, promise)
  {
    var summing = 0;
    var total = 0;

    var accumulate = function(v)
    {
      if (isNumber(v))
      {
        summing += v;
        total++;
      }
    };
    var getResult = function()
    {
      return summing / total;
    };

    aggregate( property, accumulate, getResult, promise );
  }

  /**
   * Returns the minimum value of a set of values taken from a property on all 
   * `Object` values to the callback.
   *
   * This is part of the aggregation plugin.
   * 
   * *Usage*
   * ```javascript
   * db.min('age', function(min) {
   *   // min = the minimum age
   * });
   * ```
   * 
   * @memberOf Stork#
   * @param  {String} property
   *         The property on the object to find the minimum value of.
   * @param  {Stork~aggregateSuccess} [success]
   *         The function to invoke with the minimum value.
   * @param  {Stork~aggregateSuccess} [failure]
   *         The function to invoke if there's a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function min(property, promise)
  {
    var minValue = Number.MAX_VALUE;

    var accumulate = function(v)
    {
      if (isNumber(v))
      {
        minValue = Math.min( minValue, v );
      }
    };
    var getResult = function()
    {
      return minValue;
    };

    aggregate( property, accumulate, getResult, promise );
  }

  /**
   * Returns the maximum value of a set of values taken from a property on all 
   * `Object` values to the callback.
   *
   * This is part of the aggregation plugin.
   * 
   * *Usage*
   * ```javascript
   * db.max('age', function(max) {
   *   // max = the maximum age
   * });
   * ```
   * 
   * @memberOf Stork#
   * @param  {String} property
   *         The property on the object to find the maximum value of.
   * @param  {Stork~aggregateSuccess} [success]
   *         The function to invoke with the maximum value.
   * @param  {Stork~aggregateSuccess} [failure]
   *         The function to invoke if there's a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function max(property, promise)
  {
    var maxValue = Number.MAX_VALUE;

    var accumulate = function(v)
    {
      if (isNumber(v))
      {
        maxValue = Math.min( maxValue, v );
      }
    };
    var getResult = function()
    {
      return maxValue;
    };

    aggregate( property, accumulate, getResult, promise );
  }

  var METHODS = 
  {
    aggregate:  $promise( 'aggregate', aggregate ),
    count:      $promise( 'count', count ),
    sum:        $promise( 'sum', sum ),
    avg:        $promise( 'avg', avg ),
    min:        $promise( 'min', min ),
    max:        $promise( 'max', max )
  }; 

  return function(stork)
  {
    copy( METHODS, stork );
  };

})());


  
Stork.plugin((function()
{

  /**
   * The format of the condition callback for {@link Stork#where}.
   * 
   * @callback Stork~where
   * @param {Any} value
   *        The value to inspect and return true if you want it returned.
   * @param {Any} key
   *        The key to inspect and return true if you want it returned.
   */
  
  /**
   * The format of success callback for {@link Stork#where}.
   * 
   * @callback Stork~whereSuccess
   * @param {Array} values
   *        The values matching the given condition.
   * @param {Array} keys
   *        The keys matching the given condition.
   */

  /**
   * The format of failure callback for {@link Stork#where}.
   * 
   * @callback Stork~whereFailure
   * @param {Any} error 
   *        The error that was thrown.
   */

  /**
   * Returns a subset of key-value pairs that match a condition function to the 
   * callback.
   *
   * This is part of the query plugin.
   *
   * *Usage*
   * ```javascript
   * var condition = function(value, key) {
   *   // return true if key-value matches some condition
   * };
   * var onSuccessFunc = function(value, key) {
   *   // handle success
   * };
   * var onFailureFunc = function(key, error) {
   *   // uh oh!
   * };
   * db.where( condition, onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.where( condition ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @memberOf Stork#
   * @param  {Stork~where} condition
   *         The function to invoke on each key-value pair to determine whether
   *         that pair is included in the results.
   * @param  {Stork~whereSuccess} [success]
   *         The function to invoke with the matched key-value pairs.
   * @param  {Stork~whereFailure} [failure]
   *         The function to invoke if there was a problem retrieving the
   *         key-value pairs.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function where(condition, promise)
  {
    var onSuccess = function(values, keys)
    {
      var matchedKeys = [];
      var matchedValues = [];

      for (var i = 0; i < values.length; i++)
      {
        var v = values[ i ];
        var k = keys[ i ];

        if ( condition( v, k ) )
        {
          matchedValues.push( v );
          matchedKeys.push( k );
        }
      }

      promise.$success( [matchedValues, matchedKeys] );
    };
    var onFailure = function(e)
    {
      promise.$failure( [e] );
    };

    this.all( onSuccess, onFailure );
  }

  /**
   * The format of success callback for {@link Stork#select}.
   * 
   * @callback Stork~selectSuccess
   * @param {Array} values
   *        If columns is a string this is an array of values pulled from the
   *        same property on all values that are objects. If columns is an array
   *        this is an array of objects containing the properties that exist
   *        in the columns array.
   * @param {Array} keys
   *        An array of the keys for pointing to the original values.
   */

  /**
   * The format of failure callback for {@link Stork#select}.
   * 
   * @callback Stork~selectFailure
   * @param {String|Array} columns
   *        The property you wanted to return or an array of properties to return.
   * @param {Any} error 
   *        The error that was thrown.
   */
  
  /**
   * Returns column values (if columns is a string) or an array of objects of 
   * column values (if columns is an array) to the callback.
   *
   * This is part of the query plugin.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function(values, keys) {
   *   // handle success
   * };
   * var onFailureFunc = function(columns, error) {
   *   // uh oh!
   * };
   * db.select( 'name', onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.select( ['name', 'id'] ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @memberOf Stork#
   * @param  {String|Array} columns
   *         The property you want to return or an array of properties to return.
   * @param  {Stork~selectSuccess} [success]
   *         The function to invoke with the selected properties.
   * @param  {Stork~selectFailure} [failure]
   *         The function to invoke if there was a problem selecting the columns.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function select(columns, promise)
  {
    var onSuccess = function(values, keys)
    {
      var results = [];
      var resultKeys = [];

      for (var i = 0; i < values.length; i++)
      {
        var v = values[ i ];

        if ( isObject( v ) )
        {
          if ( isString( columns ) )
          {
            if ( columns in v )
            {
              results.push( v[ columns ] );
              resultKeys.push( keys[ i ] );
            }
          }
          else if ( isArray( columns ) )
          {
            var resultObject = {};
            var resultColumns = 0;

            for (var k = 0; k < columns.length; k++)
            {
              var c = columns[ k ];

              if ( c in v )
              {
                resultObject[ c ] = v[ c ];
                resultColumns++;
              }
            }

            if ( resultColumns > 0 )
            {
              results.push( resultObject );
              resultKeys.push( keys[ i ] );
            }
          }
        }
      }

      promise.$success( [results, resultKeys] );
    };
    var onFailure = function(e)
    {
      promise.$failure( [columns, e] );
    };

    this.all( onSuccess, onFailure );
  }

  /**
   * The format of the comparater for {@link Stork#sort}.
   *
   * @callback Stork~sortComparator
   * @param {Any} a
   *        The first value to compare.
   * @param {Any} b
   *        The second value to compare.
   * @return {Number} -
   *         A negative number if `a < b`, a positive number of `a > b` and 0
   *         if `a == b`.
   */

  /**
   * The format of success callback for {@link Stork#sort}.
   * 
   * @callback Stork~sortSuccess
   * @param {Array} values
   *        The array of sorted values.
   * @param {Array} keys
   *        The array of sorted keys.
   */

  /**
   * The format of failure callback for {@link Stork#sort}.
   * 
   * @callback Stork~sortFailure
   * @param {Any} error 
   *        The error that was thrown.
   */
  
  /**
   * Sorts all key-value pairs and returns them to the callback. Next time the
   * key-value pairs are iterated over they will be returned in the same order.
   * The underlying structure should be considered unsorted anytime key-value
   * pairs are updated, added, or removed.
   *
   * This is part of the query plugin.
   *
   * *Usage*
   * ```javascript
   * var compareFunc = function(a, b) {
   *   // compare a & b and return a number
   * };
   * var onSuccessFunc = function(values, keys) {
   *   // handle success
   * };
   * var onFailureFunc = function(error) {
   *   // uh oh!
   * };
   * db.sort( compareFunc, false, onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.sort( compareFunc ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @memberOf Stork#
   * @param  {Stork~sortComparator} comparator
   *         The function used to compare two values.
   * @param  {Boolean} desc
   *         If the key-value pairs should be in descending (reversed) order.
   * @param  {Stork~sortSuccess} [success]
   *         The function to invoke with the sorted values & keys.
   * @param  {Stork~sortFailure} [failure]
   *         The function to invoke if there was a problem sorting the pairs.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function sort(comparator, desc, promise)
  {
    var onSuccess = function()
    {
      var cache = this.cache;

      cache.sort( comparator );

      if ( desc )
      {
        cache.reverse();
      }

      promise.$success( [cache.values, cache.okeys] );
    };
    var onFailure = function(e)
    {
      promise.$failure( [e] );
    };

    this.all( onSuccess, onFailure );
  }

  var METHODS = 
  {
    where:  $promise( 'where', where ),
    select: $promise( 'select', select ),
    sort:   $promise( 'sort', sort )
  }; 

  return function(stork)
  {
    copy( METHODS, stork );
  };

})());


  

Stork.adapter('chrome-storage-local', 4, function()
{
  var store = window.chrome && chrome.storage ? chrome.storage.local : false;

  function isError()
  {
    return chrome && chrome.runtime && chrome.runtime.lastError;
  };

  return {

    encode: function(key)
    {
      return this.prefix + toJson( key );
    },

    decode: function(rawKey)
    {
      return fromJson( rawKey.substring( this.prefix.length ) );
    },

    valid: function()
    {
      if (!store)
      {
        return false;
      }

      try
      {
        var temp = Math.random();
        var map = {};

        map[ temp ] = temp;
        store.set( map );
        store.remove( temp );

        return true;
      }
      catch (e)
      {
        return false;
      }
    },

    init: function(options, success, failure)
    {
      var promise = new Promise( this, success, failure );

      this.prefix = coalesce( options.prefix, this.name + '-' );

      if ( this.lazy )
      {
        this._finishInitialization( promise, [this] );
      }
      else
      {
        promise.$bindTo( this.reload(), [this] );
      }

      return promise;
    },

    reload: function(success, failure)
    {
      var promise = new Promise( this, success, failure );
      var stork = this;
      var prefix = this.prefix;
      var cache = new FastMap();

      store.get( null, function(items)
      {
        if ( isError() )
        {
          promise.$failure( [isError()] );
        }
        else
        {
          for (var rawKey in items)
          {
            if ( rawKey.substring( 0, prefix.length ) === prefix )
            {
              cache.put( rawKey, items[ rawKey ], stork.decode( rawKey ) );
            }
          }

          stork.cache.overwrite( cache );
          stork.loaded = true;

          stork.finishReload( promise );
        }

      });

      return promise;
    },

    _get: function(key, rawKey, promise)
    {
      var stork = this;

      store.get( rawKey, function(items)
      {
        if ( isError() )
        {
          promise.$failure( [key, isError()] );
        }
        else
        {
          if ( items.length )
          {
            var value = fromJson( items[0] );

            stork.cache.put( rawKey, value, key );

            promise.$success( [value, key] );
          }
          else
          {
            promise.$success( [undefined, key] );
          }
        }
      });
    },

    _destroy: function(promise)
    {
      var stork = this;
      var removeByKeys = function()
      {
        store.remove( this.cache.keys, function()
        {
          if ( isError() )
          {
            promise.$failure( [isError()] );
          }
          else
          {
            stork.cache.reset();

            promise.$success();
          }
        });
      };
      var onFailure = function(e)
      {
        promise.$failure( [e] );
      };

      if ( this.loaded )
      {
        removeByKeys();
      }
      else
      {
        this.reload( removeByKeys, onFailure );
      }
    },

    _resetPromise: function(keys, values, success, failure)
    {
      return new Promise( this, success, failure );
    },

    _reset: function(keys, values, rawKeys, rawValues, promise)
    {
      var stork = this;

      var setFailure = function(e)
      {
        promise.$failure( [keys, values, e] );
      };
      var onDestroyed = function()
      {
        var obj = {};

        for (var i = 0; i < values.length; i++)
        {
          obj[ rawKeys[ i ] ] = values[ i ];
        }

        store.set( obj, function()
        {
          if ( isError() )
          {
            setFailure( isError() );
          }
          else
          {
            for (var i = 0; i < values.length; i++)
            {
              stork.cache.put( rawKeys[ i ], values[ i ], keys[ i ] );
            }

            promise.$success( [keys, values] );
          }
        });
      };

      this._destroy( new Promise( this, onDestroyed, setFailure ) );
    },

    _put: function(key, value, rawKey, rawValue, promise)
    {
      var stork = this;
      var obj = {};

      obj[ rawKey ] = value;

      store.set( obj, function()
      {
        if ( isError() )
        {
          promise.$failure( [key, value, isError()] );
        }
        else
        {
          var previousValue = stork.cache.get( rawKey );

          stork.cache.put( rawKey, value, key );

          promise.$success( [key, value, previousValue] );
        }
      });
    },

    _remove: function(key, rawKey, value, promise)
    {
      var stork = this;

      store.remove( rawKey, function()
      {
        if ( isError() )
        {
          promise.$failure( [key, isError()] );
        }
        else
        {
          stork.cache.remove( rawKey );

          promise.$success( [value, key] );
        }
      });
    },

    _size: function(promise)
    {
      var onSuccess = function(keys, values)
      {
        promise.$success( [keys.length] );
      };
      var onFailure = function(e)
      {
        promise.$failure( [e] );
      };

      this.reload( onSuccess, onFailure );
    }

  }
});


Stork.adapter('ie-userdata', 1.5, 
{
  valid: function() 
  {
    return def( document.body.addBehavior );
  },

  init: function(options, success, failure) 
  {
    var promise = new Promise( this, success, failure );

    var s = document.createElement('span');
    s.style.behavior = "url('#default#userData')";
    s.style.position = 'absolute';
    s.style.left = 10000;
    document.body.appendChild(s);

    this.store = s;
    this.store.load( this.name );

    if ( this.lazy )
    {
      this.finishInitialization( promise, [this] );
    }
    else
    {
      promise.$bindTo( this.reload(), [this] );
    }
    
    return promise;
  },

  reload: function(success, failure)
  {
    var promise = new Promise( this, success, failure );

    var attributes = this.store.XMLDocument.firstChild.attributes;
    var cache = new FastMap();

    for (var i = 0; i < attributes.length; i++) 
    {
      try
      {
        var v = attributes[ i ];
        var rawKey = v.nodeName;
        var rawValue = v.nodeValue;
        var key = this.decode( rawKey );
        var value = fromJson( rawValue );

        cache.put( rawKey, value, key ); 
      }
      catch (e) 
      {
        // ignore
      }
    }

    this.cache.overwrite( cache );
    this.loaded = true;
    this.finishReload( promise );

    return promise;
  },

  _get: function(key, rawKey, promise)
  {
    var rawValue = this.store.getAttribute( rawKey );

    if ( rawValue === null )
    {
      promise.$success( [undefined, key] );
    }
    else
    {
      var value = null;

      try
      {
        value = fromJson( rawValue );
      }
      catch (e)
      {
        promise.$failure( [e] );
      }

      if ( promise.$pending() )
      {
        this.cache.put( rawKey, value, key );

        promise.$success( [value, key] );
      }
    }
  },

  _destroy: function(promise)
  {
    var attributes = this.store.XMLDocument.firstChild.attributes;

    for (var i = 0; i < attributes.length; i++) 
    {
      this.store.removeAttribute( attributes[ i ].nodeName );
    }

    this.cache.reset();

    promise.$success();
  },

  _put: function(key, value, rawKey, rawValue, promise)
  {
    var previousValue = this.cache.get( rawKey );

    try
    {
      this.store.setAttribute( rawKey, rawValue );
    }
    catch (e)
    {
      promise.$failure( [key, value, e] );
    }

    if ( promise.$pending() )
    {
      this.cache.put( rawKey, value, key );

      promise.$success( [key, value, previousValue] );
    }
  },

  _remove: function(key, rawKey, value, promise)
  {
    this.store.removeAttribute( rawKey );
    this.cache.remove( rawKey );

    promise.$success( [value, key] );
  }

});
Stork.adapter('indexed-db', 5, function()
{

  var getIDB = function() 
  {
    return window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.oIndexedDB || window.msIndexedDB;
  };

  var getIDBTransaction = function() 
  {
    return window.IDBTransaction || window.webkitIDBTransaction || window.mozIDBTransaction || window.oIDBTransaction || window.msIDBTransaction;
  };

  var getIDBKeyRange = function() 
  {
    return window.IDBKeyRange || window.webkitIDBKeyRange || window.mozIDBKeyRange || window.oIDBKeyRange || window.msIDBKeyRange;
  };

  var DATABASE_NAME = 'stork';
  var DATABASE_VERSION = 3;
  var READ_WRITE = (getIDBTransaction() && 'READ_WRITE' in getIDBTransaction()) ? getIDBTransaction().READ_WRITE : 'readwrite';

  return {

    valid: function() 
    {
      return !!getIDB();
    },

    init: function(options, success, failure)
    {
      var promise = new Promise( this, success, failure );

      var stork = this;
      var factory = getIDB();
      var request = factory.open( this.name, DATABASE_VERSION );

      request.onerror = function(e)
      {
        promise.$failure( [e] );
      };

      // First started or it needs a version upgrade
      request.onupgradeneeded = function()
      {
        stork.db = request.result;
        stork.db.createObjectStore( stork.name, { keyPath: this.key } );
      };

      // Database is ready for use
      request.onsuccess = function(event)
      {
        stork.db = request.result;

        if ( stork.lazy )
        {
          stork.finishInitialization( promise, [stork] );
        }
        else
        {
          promise.$bindTo( stork.reload(), [stork] );
        }
      };

      return promise;
    },

    reload: function(success, failure)
    {
      var promise = new Promise( this, success, failure );

      var stork = this;
      var objectStore = this.db.transaction( this.name ).objectStore( this.name );
      var cursor = objectStore.openCursor();
      var cache = new FastMap();

      cursor.onsuccess = function(e)
      {
        var result = cursor.result;

        if (result)
        {
          var rawKey = result.key;
          var value = result.value;
          var key = stork.decode( rawKey );

          cache.put( rawKey, value, key );

          result['continue']();
        }
        else
        {
          stork.cache.overwrite( cache );
          stork.loaded = true;
          stork.finishReload( promise, [stork.cache.values, stork.cache.okeys] );
        }
      };

      cursor.onerror = function(e)
      {
        promise.$failure( [keys, e] );
      };

      return promise;
    },

    _destroy: function(promise)
    {
      var stork = this;
      var objectStore = this.db.transaction( this.name, READ_WRITE ).objectStore( this.name );

      objectStore.transaction.oncomplete = function()
      {
        stork.cache.reset();

        promise.$success();
      };

      objectStore.transaction.onabort = function(e)
      {
        promise.$failure( [e] );
      };

      objectStore.clear();
    },

    _get: function(key, rawKey, promise)
    {
      var stork = this;
      var objectStore = this.db.transaction( this.name ).objectStore( this.name );
      var request = objectStore.get( rawKey );

      request.onsuccess = function(e)
      {
        if ( request.result === undefined )
        {
          promise.$success( [undefined, key] );
        }
        else
        {
          var value = request.result;

          stork.cache.put( rawKey, value, key );

          promise.$success( [value, key] );          
        }
      };

      request.onerror = function()
      {
        promise.$failure( [key, request.error] );
      };
    },

    _put: function(key, value, rawKey, rawValue, promise)
    {
      var stork = this;
      var objectStore = this.db.transaction( this.name, READ_WRITE ).objectStore( this.name );

      objectStore.transaction.oncomplete = function()
      {
        var previousValue = stork.cache.get( rawKey );

        stork.cache.put( rawKey, value, key );

        promise.$success( [key, value, previousValue] );
      }; 

      objectStore.transaction.onabort = function(e)
      {
        promise.$failure( [key, value, e] );
      };

      objectStore.put( value, rawKey );
    },

    _remove: function(key, rawKey, value, promise)
    {  
      var stork = this;
      var objectStore = this.db.transaction( this.name, READ_WRITE ).objectStore( this.name );

      objectStore.transaction.oncomplete = function()
      {
        stork.cache.remove( rawKey );

        promise.$success( [value, key] );
      }; 

      objectStore.transaction.onabort = function(e)
      {
        promise.$failure( [key, e] );
      };

      objectStore['delete']( rawKey );
    },

    _size: function(promise)
    {
      var stork = this;
      var objectStore = this.db.transaction( this.name, READ_WRITE ).objectStore( this.name );
      var request = objectStore.count();

      request.onsuccess = function()
      {
        promise.$success( [request.result] );
      };

      request.onerror = function(e)
      {
        promise.$failure( [request.error] );
      };
    }

    // TODO getMany, removeMany

  };

});

Stork.adapter('local-storage', 3, function()
{
  var store = window.localStorage;

  return {

    encode: function(key)
    {
      return this.prefix + toJson( key );
    },

    decode: function(rawKey)
    {
      return fromJson( rawKey.substring( this.prefix.length ) );
    },

    valid: function()
    {
      if (!store) 
      {
        return false;
      }
      try 
      {
        var temp = Math.random();
        store.setItem( temp, temp );
        store.removeItem( temp );

        return true;
      } 
      catch (e) 
      {
        return false;
      }
    },

    init: function(options, success, failure) 
    {
      var promise = new Promise( this, success, failure );

      this.prefix = coalesce( options.prefix, this.name + '-' );

      if ( this.lazy )
      {
        this.finishInitialization( promise, [this] );
      }
      else
      {
        promise.$bindTo( this.reload(), [this] );
      }

      return promise;
    },

    reload: function(success, failure)
    {
      var promise = new Promise( this, success, failure );
      var prefix = this.prefix;
      var cache = new FastMap();

      try
      {
        for (var i = 0; i < store.length; i++)
        {
          var rawKey = store.key( i );

          if ( rawKey.substring( 0, prefix.length ) === prefix )
          {
            var rawValue = store.getItem( rawKey );
            var value = fromJson( rawValue );
            var key = this.decode( rawKey );

            cache.put( rawKey, value, key );
          }  
        }

        this.cache.overwrite( cache );
        this.loaded = true;
      }
      catch (e)
      {
        promise.$failure( [e] );
      }

      this.finishReload( promise );

      return promise;
    },

    _destroy: function(promise)
    {
      var stork = this;
      var prefix = this.prefix;
      var removeByKeys = function( keys )
      {
        try
        {
          for (var i = 0; i < keys.length; i++)
          {
            store.removeItem( keys[ i ] );
          }
        }
        catch (e)
        {
          promise.$failure( [e] );
        }

        if ( promise.$pending() )
        {
          stork.cache.reset();

          promise.$success();
        }
      };
      
      if ( this.loaded )
      {
        removeByKeys( this.cache.keys );
      }
      else
      {
        var keys = [];

        try
        {
          for (var i = 0; i < store.length; i++)
          {
            var rawKey = store.key( i );

            if ( rawKey.substring( 0, prefix.length ) === prefix )
            {
              keys.push( rawKey );
            }
          }  
        }
        catch (e)
        {
          promise.$failure( [e] );
        }

        if ( promise.$pending() )
        {
          removeByKeys( keys );          
        }
      }
    },

    _get: function(key, rawKey, promise)
    {
      try
      { 
        var rawValue = store.getItem( rawKey );

        if ( rawValue === null )
        {
          promise.$success( [undefined, key] );
        }
        else
        {
          var value = fromJson( rawValue );

          this.cache.put( rawKey, value, key );

          promise.$success( [value, key] ); 
        }
      }
      catch (e)
      {
        promise.$failure( [key, e] );
      }
    },

    _put: function(key, value, rawKey, rawValue, promise)
    {
      try
      {
        store.setItem( rawKey, rawValue );        
      }
      catch (e)
      {
        promise.$failure( [key, value, e] );
      }

      if ( promise.$pending() )
      {
        var previousValue = this.cache.get( rawKey );

        this.cache.put( rawKey, value, key );

        promise.$success( [key, value, previousValue] );
      }
    },

    _remove: function(key, rawKey, value, promise)
    {
      try
      {
        store.removeItem( rawKey );
      }
      catch (e)
      {
        promise.$failure( [key, e] );
      }

      if ( promise.$pending() )
      {
        this.cache.remove( rawKey );

        promise.$success( [value, key] );
      }
    },

    _size: function(promise)
    {
      var onSuccess = function(keys, values)
      {
        promise.$success( [keys.length] );
      };
      var onFailure = function(e)
      {
        promise.$failure( [e] );
      };

      this.reload( onSuccess, onFailure );
    }

  }
});

Stork.adapter('memory', 1, 
{
  valid: function() 
  {
    return true;
  },

  init: function(options, success, failure) 
  {
    var promise = new Promise( this, success, failure );

    this.loaded = true;
    this.finishInitialization( promise, [this] );
    
    return promise;
  },

  reload: function(success, failure)
  {
    var promise = new Promise( this, success, failure );

    this.finishReload( promise );

    return promise;
  },

  _destroy: function(promise)
  {
    this.cache.reset();

    promise.$success();
  },

  _put: function(key, value, rawKey, rawValue, promise)
  {
    var previousValue = this.cache.get( rawKey );

    this.cache.put( rawKey, value, key );

    promise.$success( [key, value, previousValue] );
  },

  _remove: function(key, rawKey, value, promise)
  {
    this.cache.remove( rawKey );

    promise.$success( [value, key] );
  }

});

Stork.adapter('webkit-sqlite', 6, function()
{
  var DATABASE_NAME = 'stork';

  var SQL_CREATE = 'CREATE TABLE IF NOT EXISTS "{0}" ("id" TEXT PRIMARY KEY, "value" TEXT)';
  var SQL_SELECT  = 'SELECT "value" FROM "{0}" WHERE "id" = ?';
  var SQL_SELECT_ALL = 'SELECT "id", "value" FROM "{0}"';
  var SQL_SELECT_MANY = 'SELECT "id", "value" FROM "{0}" WHERE "id" IN ({1})';
  var SQL_INSERT = 'INSERT OR REPLACE INTO "{0}" ("id", "value") VALUES (?, ?)';
  var SQL_DELETE = 'DELETE FROM "{0}" WHERE "id" = ?';
  var SQL_COUNT = 'SELECT COUNT(*) as "count" FROM "{0}"';
  var SQL_DESTROY = 'DELETE FROM "{0}"';
  var SQL_DELETE_MANY = 'DELETE FROM "{0}" WHERE "id" IN ({1})';

  function streplace(str, arr)
  {
    return str.replace(/\{(\d+)\}/g, function(match, index)
    {
      index = parseInt( index );

      if ( isNaN( index ) || index < 0 || index >= arr.length )
      {
        return match;
      }

      return arr[ index ];
    });
  }

  return {

    valid: function()
    {
      return !!window.openDatabase;
    },

    init: function(options, success, failure)
    {
      var promise = new Promise( this, success, failure );

      var databaseName = coalesce( options.database, DATABASE_NAME );
      var databaseSize = coalesce( options.size, 65536 );
      var databaseVersion = coalesce( options.version, '1.0' );

      var stork = this;

      var onFailure = function(tx, error)
      {
        promise.$failure( [error] );
      };
      var onTransactionForCreate = function(tx)
      {
        tx.executeSql( stork.SQL_CREATE, [], onCreate, onFailure );
      };
      var onCreate = function(tx, results)
      {
        if ( stork.lazy )
        {
          stork.finishInitialization( promise, [stork] );
        }
        else
        {
          promise.$bindTo( stork.reload(), [stork] );
        }
      };

      this.SQL_CREATE     = streplace( SQL_CREATE, [this.name] );
      this.SQL_SELECT     = streplace( SQL_SELECT, [this.name] );
      this.SQL_SELECT_ALL = streplace( SQL_SELECT_ALL, [this.name] );
      this.SQL_INSERT     = streplace( SQL_INSERT, [this.name] );
      this.SQL_DELETE     = streplace( SQL_DELETE, [this.name] );
      this.SQL_DESTROY    = streplace( SQL_DESTROY, [this.name] );
      this.SQL_COUNT      = streplace( SQL_COUNT, [this.name] );

      this.db = openDatabase( databaseName, databaseVersion, databaseName, databaseSize );
      this.db.transaction( onTransactionForCreate, onFailure );

      return promise;
    },

    reload: function(success, failure)
    {
      var promise = new Promise( this, success, failure );
      var stork = this;

      var onFailure = function(tx, error)
      {
        promise.$failure( [error] );
      };
      var onTransactionForSelect = function(tx)
      {
        tx.executeSql( stork.SQL_SELECT_ALL, [], onResults, onFailure );
      };
      var onResults = function(tx, results)
      {
        var cache = new FastMap();
        try
        {
          for (var i = 0; i < results.rows.length; i++)
          {
            var record = results.rows[ i ];
            var value = fromJson( record.value );
            var key = fromJson( record.id );

            cache.put( record.id, value, key );
          }

          stork.cache.overwrite( cache );
          stork.loaded = true;
        }
        catch (e)
        {
          promise.$failure( [e] );
        }

        stork.finishReload( promise );
      };

      this.db.readTransaction( onTransactionForSelect, onFailure );

      return promise;
    },

    _get: function(key, rawKey, promise)
    {
      var stork = this;

      var onFailure = function(tx, error)
      {
        promise.$failure( [key, error] );
      };
      var onTransaction = function(tx)
      {
        tx.executeSql( stork.SQL_SELECT, [rawKey], onResult, onFailure );
      };
      var onResult = function(tx, results)
      {
        var value = undefined;
        try
        {
          var first = results.rows[ 0 ];

          if ( first && first.value !== undefined )
          {
            value = fromJson( first.value );
          }
        }
        catch (e)
        {
          promise.$failure( [key, e] );
        }

        if ( promise.$pending() )
        {
          if ( value !== undefined )
          {
            stork.cache.put( rawKey, value, key );

            promise.$success( [value, key] );
          }
          else
          {
            promise.$success( [undefined, key] );
          }
        }
      };

      this.db.readTransaction( onTransaction, onFailure );
    },

    _destroy: function(promise)
    {
      var stork = this;

      var onTransaction = function(tx)
      {
        tx.executeSql( stork.SQL_DESTROY, [], onSuccess, onFailure );
      };
      var onSuccess = function(tx, results)
      {
        stork.cache.reset();

        promise.$success();
      };
      var onFailure = function(tx, error)
      {
        promise.$failure( [error] );
      };

      this.db.transaction( onTransaction, onFailure );
    },

    _put: function(key, value, rawKey, rawValue, promise)
    {
      var stork = this;

      var onTransaction = function(tx)
      {
        tx.executeSql( stork.SQL_INSERT, [rawKey, rawValue], onSuccess, onFailure );
      };
      var onSuccess = function(tx, results)
      {
        var previousValue = stork.cache.get( rawKey );

        stork.cache.put( rawKey, value, key );

        promise.$success( [key, value, previousValue] );
      };
      var onFailure = function(tx, error)
      {
        promise.$failure( [key, value, error] );
      };

      this.db.transaction( onTransaction, onFailure );
    },

    _remove: function(key, rawKey, value, promise)
    {
      var stork = this;

      var onTransaction = function(tx)
      {
        tx.executeSql( stork.SQL_DELETE, [rawKey], onSuccess, onFailure );
      };
      var onSuccess = function(tx, results)
      {
        stork.cache.remove( rawKey );

        promise.$success( [value, key] );
      };
      var onFailure = function(tx, error)
      {
        promise.$failure( [key, error] );
      };

      this.db.transaction( onTransaction, onFailure );
    },

    _size: function(promise)
    {
      var stork = this;

      var onFailure = function(tx, error)
      {
        promise.$failure( [error] );
      };
      var onTransaction = function(tx)
      {
        tx.executeSql( stork.SQL_COUNT, [], onCount, onFailure );
      };
      var onCount = function(tx, results)
      {
        promise.$success( [results.rows[0].count] );
      };

      this.db.readTransaction( onTransaction, onFailure );
    },

    _resetPromise: function(keys, values, success, failure)
    {
      return Promise.Group( values.length + 1, this, success, failure );
    },

    _reset: function(keys, values, rawKeys, rawValues, promise)
    {
      var stork = this;

      var onTransaction = function(tx)
      {
        tx.executeSql( stork.SQL_DESTROY, [], onSuccess( -1 ), onFailure );

        for (var i = 0; i < rawValues.length; i++)
        {
          tx.executeSql( stork.SQL_INSERT, [rawKeys[ i ], rawValues[ i ]], onSuccess( i ), onFailure );
        }
      };
      var onSuccess = function(i)
      {
        return function()
        {
          if (i !== -1)
          {
            stork.cache.put( rawKeys[ i ], values[ i ], keys[ i ] );
          }

          promise.$success( [keys, values] );
        };
      };
      var onFailure = function(tx, error)
      {
        promise.$failure( [keys, values, error] );
      };

      stork.cache.reset();

      this.db.transaction( onTransaction, onFailure );
    },

    batch: function(records, success, failure)
    {
      var promise = new Promise( this, success, failure );

      if ( this.handlePending( this.batch, arguments, promise ) )
      {
        return promise;
      }

      var stork = this;
      var keyName = this.key;
      var successful = 0;
      var converted = [];

      try
      {
        for (var i = 0; i < records.length; i++)
        {
          var value = records[ i ];
          var key = value[ keyName ];

          if ( undef(key) )
          {
            key = value[ keyName ] = uuid();
          }

          converted.push(
          {
            value: value,
            key: key,
            rawKey: toJson( key ),
            rawValue: toJson( value )
          });
        }
      }
      catch (e)
      {
        promise.$failure( [records, successful, e] );

        return promise;
      }

      var onTransaction = function(tx)
      {
        for (var i = 0; i < converted.length; i++)
        {
          var record = converted[ i ];

          tx.executeSql( stork.SQL_INSERT, [record.rawKey, record.rawValue], onSuccess, onFailure );
        }
      };
      var onSuccess = function(tx, results)
      {
        if ( ++successful === records.length && promise.$pending() )
        {
          for (var i = 0; i < converted.length; i++)
          {
            var record = converted[ i ];

            stork.cache.put( record.rawKey, record.value, record.key );
          }

          promise.$success( [records] );
        }
      };
      var onFailure = function(tx, error)
      {
        promise.$failure( [records, successful, error] );
      };

      this.db.transaction( onTransaction, onFailure );

      return promise;
    },

    removeMany: function(keys, success, failure)
    {
      var promise = new Promise( this, success, failure );

      if ( this.handlePending( this.removeMany, arguments, promise ) )
      {
        return promise;
      }

      var stork = this;
      var rawKeys = [];
      var values = [];
      var binder = [];
      var query = '';

      var onTransaction = function(tx)
      {
        tx.executeSql( query, rawKeys, onSuccess, onFailure );
      };
      var onSuccess = function(tx, results)
      {
        for (var i = 0; i < rawKeys.length; i++)
        {
          stork.cache.remove( rawKeys[ i ] );
        }

        promise.$success( [values, keys] );
      };
      var onFailure = function(tx, error)
      {
        promise.$failure( [values, 0, error] );
      };

      try
      {
        for (var i = 0; i < keys.length; i++)
        {
          var key = toJson( keys[ i ] );

          if ( this.cache.has( key ) )
          {
            rawKeys[ i ] = key;
            values[ i ] = this.cache.get( key );
            binder[ i ] = '?';
          }
        }

        query = streplace( SQL_DELETE_MANY, [this.name, binder.join(',')] );
      }
      catch (e)
      {
        promise.$failure( [values, e] );
      }

      if ( promise.$pending() )
      {
        this.db.transaction( onTransaction, onFailure );
      }

      return promise;
    },

    getMany: function(keys, success, failure)
    {
      var promise = new Promise( this, success, failure );

      if ( this.handlePending( this.removeMany, arguments, promise ) )
      {
        return promise;
      }

      var stork = this;
      var rawKeys = [];
      var keyToValueIndex = [];
      var values = [];
      var binder = [];
      var query = '';

      var onTransaction = function(tx)
      {
        tx.executeSql( query, rawKeys, onSuccess, onFailure );
      };
      var onSuccess = function(tx, results)
      {
        for (var i = 0; i < results.rows.length; i++)
        {
          var r = results.rows[ i ];

          for (var k = 0; k < rawKeys.length; k++)
          {
            if ( rawKeys[ k ] === r.id )
            {
              var value = fromJson( r.value );
              var index = keyToValueIndex[ k ];

              values[ index ] = value;
              stork.cache.put( r.id, value, keys[ index ] );
            }
          }
        }

        promise.$success( [values, keys] );
      };
      var onFailure = function(tx, error)
      {
        promise.$failure( [keys, error] );
      };

      try
      {
        for (var i = 0; i < keys.length; i++)
        {
          var key = toJson( keys[ i ] );

          if ( this.cache.has( key ) )
          {
            values[ i ] = this.cache.get( key );
          }
          else
          {
            rawKeys.push( key );
            keyToValueIndex.push( i );
            binder.push( '?' );
          }
        }

        query = streplace( SQL_SELECT_MANY, [this.name, binder.join(',')] );
      }
      catch (e)
      {
        promise.$failure( [values, e] );
      }

      if ( promise.$pending() )
      {
        if ( rawKeys.length )
        {
          this.db.transaction( onTransaction, onFailure );
        }
        else
        {
          promise.$success( [values, keys] );
        }
      }

      return promise;
    }

  }
});


Stork.adapter('window-name', 2, function()
{

  function loadData()
  {
    if ( !loadData.cache )
    {
      try
      {
        loadData.cache = fromJson( window.top.name );
      }
      catch (e)
      {
        loadData.cache = {};
      }
    }
    
    return loadData.cache;
  }

  function saveData()
  {
    try
    {
      window.top.name = toJson( loadData() );
    }
    catch (e)
    {

    }
  }

  return {

    encode: function(key)
    {
      return this.prefix + toJson( key );
    },

    decode: function(rawKey)
    {
      return fromJson( rawKey.substring( this.prefix.length ) );
    },

    valid: function() 
    {
      return window.top && typeof window.top.name !== 'undefined';
    },

    init: function(options, success, failure) 
    {
      var promise = new Promise( this, success, failure );

      this.prefix = coalesce( options.prefix, this.name + '-' );

      promise.$bindTo( this.reload(), [this] );
      
      return promise;
    },

    reload: function(success, failure)
    {
      var promise = new Promise( this, success, failure );
      var prefix = this.prefix;
      var cache = new FastMap();
      var data = loadData();

      try
      {
        for (var rawKey in data)
        {
          if ( rawKey.substring( 0, prefix.length ) === prefix )
          {
            var rawValue = data[ rawKey ];
            var value = fromJson( rawValue );
            var key = this.decode( rawKey );

            cache.put( rawKey, value, key );
          }  
        }

        this.cache.overwrite( cache );
        this.loaded = true;
      }
      catch (e)
      {
        promise.$failure( [e] );
      }

      this.finishReload( promise );

      return promise;
    },

    _destroy: function(promise)
    {
      var keys = this.cache.keys;
      var data = loadData();

      for (var i = 0; i < keys.length; i++)
      {
        delete data[ keys[i] ];
      }

      this.cache.reset();

      saveData();

      promise.$success();
    },

    _put: function(key, value, rawKey, rawValue, promise)
    {
      var data = loadData();
      var previousValue = this.cache.get( rawKey );

      data[ rawKey ] = value;

      this.cache.put( rawKey, value, key );

      saveData();

      promise.$success( [key, value, previousValue] );
    },

    _remove: function(key, rawKey, value, promise)
    {
      var data = loadData();

      delete data[ rawKey ];

      this.cache.remove( rawKey );

      saveData();

      promise.$success( [value, key] );
    }

  }
});

  Stork.getAdapter = getAdapter;
  Stork.Promise = Promise;
  Stork.FastMap = FastMap;

  return Stork;

}));
