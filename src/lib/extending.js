
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
 * @return {Stork} The Stork namespace.
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
 * @return {Stork} The Stork namespace.
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